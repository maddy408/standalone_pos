<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\PermissionDeniedException;
use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Helpers\ValidationException;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Services\AuditLogger;
use PDO;

class InvoiceController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['search'])) {
            $where .= ' AND (i.invoice_no LIKE :s OR c.name LIKE :s OR i.customer_name LIKE :s)';
            $params['s'] = '%' . $_GET['search'] . '%';
        }
        if (!empty($_GET['status'])) {
            $where .= ' AND i.status = :status';
            $params['status'] = $_GET['status'];
        }
        if (!empty($_GET['customer_id'])) {
            $where .= ' AND i.customer_id = :customer_id';
            $params['customer_id'] = $_GET['customer_id'];
        }
        if (!empty($_GET['from'])) {
            $where .= ' AND i.created_at >= :from';
            $params['from'] = $_GET['from'] . ' 00:00:00';
        }
        if (!empty($_GET['to'])) {
            $where .= ' AND i.created_at <= :to';
            $params['to'] = $_GET['to'] . ' 23:59:59';
        }

        $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
        $limit = max(1, min(1000, (int) ($_GET['limit'] ?? 25)));
        $offset = ($page - 1) * $limit;

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id {$where}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT i.*, c.name AS customer_name
                FROM invoices i
                LEFT JOIN customers c ON c.id = i.customer_id
                {$where}
                ORDER BY i.created_at DESC, i.id DESC
                LIMIT {$limit} OFFSET {$offset}";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        Response::json([
            'data' => $stmt->fetchAll(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => (int) ceil($total / $limit),
        ]);
    }

    public function show(string $id): void
    {
        AuthMiddleware::authenticate();
        $invoice = $this->fetchInvoice($this->resolveId($id));
        if (!$invoice) {
            Response::error('Invoice not found', 404);
        }
        Response::json($invoice);
    }

    public function print(string $id): void
    {
        AuthMiddleware::authenticate();
        $invoice = $this->fetchInvoice($this->resolveId($id));
        if (!$invoice) {
            Response::error('Invoice not found', 404);
        }
        $settings = $this->pdo->query('SELECT * FROM business_settings WHERE id = 1')->fetch();
        Response::json(['invoice' => $invoice, 'settings' => $settings]);
    }

    /**
     * Creates (or, if a matching uuid already exists, returns) an invoice.
     * Idempotent so the offline sync queue can safely retry/replay.
     */
    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            [$invoice, $status] = $this->createFromSync($body, $claims);
            Response::json($invoice, $status);
        } catch (ValidationException $e) {
            Response::error($e->getMessage(), 422);
        } catch (PermissionDeniedException $e) {
            Response::error($e->getMessage(), 403);
        } catch (\Throwable $e) {
            Response::error('Failed to save invoice: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Idempotent create used by both the direct REST endpoint and the
     * offline sync queue. Returns [invoiceArray, httpStatus]; throws
     * ValidationException on bad input — callers decide how to surface it.
     *
     * @param array<string, mixed> $body
     * @param array<string, mixed> $claims
     * @return array{0: array<string, mixed>, 1: int}
     */
    public function createFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'pos.access');
        $hasDiscount = (float) ($body['discount_amount'] ?? 0) > 0
            || array_reduce($body['items'] ?? [], fn ($carry, $item) => $carry || (float) ($item['discount_amount'] ?? 0) > 0, false);
        if ($hasDiscount) {
            PermissionMiddleware::requireOrThrow($claims, 'pos.apply_discount');
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM invoices WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [$this->fetchInvoice((int) $row['id']), 200];
        }

        $this->pdo->beginTransaction();
        try {
            $id = $this->createInvoice($uuid, $body, $claims);
            $this->pdo->commit();
            return [$this->fetchInvoice($id), 201];
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /** PUT /api/invoices/{id} — updates an existing invoice, adjusts stock & re-calculates balances. */
    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'pos.access');
        $invoiceId = $this->resolveId($id);

        $stmt = $this->pdo->prepare('SELECT * FROM invoices WHERE id = :id');
        $stmt->execute(['id' => $invoiceId]);
        $existingInvoice = $stmt->fetch();
        if (!$existingInvoice) {
            Response::error('Invoice not found', 404);
        }
        if ($existingInvoice['status'] === 'cancelled') {
            Response::error('Cancelled invoices cannot be edited', 422);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $items = $body['items'] ?? [];
        if (empty($items)) {
            Response::error('Invoice must have at least one item', 422);
        }

        $this->pdo->beginTransaction();
        try {
            // 1. Fetch old invoice items and return their deducted stock
            $oldItemsStmt = $this->pdo->prepare('SELECT * FROM invoice_items WHERE invoice_id = :id');
            $oldItemsStmt->execute(['id' => $invoiceId]);
            $oldItems = $oldItemsStmt->fetchAll();

            foreach ($oldItems as $oldItem) {
                if ($oldItem['product_id']) {
                    $this->restock(
                        (int) $oldItem['product_id'],
                        (float) $oldItem['qty'],
                        'sale_return',
                        'invoices',
                        $invoiceId,
                        $oldItem['serial_id'] ? (int) $oldItem['serial_id'] : null
                    );
                }
            }

            // 2. Reverse customer balance change from old invoice
            if ($existingInvoice['customer_id'] && (float) $existingInvoice['balance_amount'] > 0) {
                $this->pdo->prepare('UPDATE customers SET balance = balance - :amt WHERE id = :id')
                    ->execute(['amt' => (float) $existingInvoice['balance_amount'], 'id' => $existingInvoice['customer_id']]);
            }

            // 3. Delete existing invoice items
            $this->pdo->prepare('DELETE FROM invoice_items WHERE invoice_id = :id')->execute(['id' => $invoiceId]);

            // 4. Calculate new totals and re-insert items
            $subtotal = 0.0;
            $discountTotal = 0.0;
            $taxTotal = 0.0;
            $lineRows = [];

            foreach ($items as $item) {
                $qty = (float) ($item['qty'] ?? 0);
                if ($qty <= 0) {
                    throw new ValidationException('Item quantity must be greater than zero');
                }
                $unitPrice = (float) ($item['unit_price'] ?? 0);
                $addonsTotal = 0.0;
                foreach ($item['addons'] ?? [] as $addon) {
                    $addonsTotal += (float) ($addon['price'] ?? 0);
                }
                $lineBase = ($unitPrice + $addonsTotal) * $qty;
                $discountAmount = (float) ($item['discount_amount'] ?? 0);
                $taxAmount = (float) ($item['tax_amount'] ?? 0);
                $lineTotal = round($lineBase - $discountAmount + $taxAmount, 2);

                $subtotal += $lineBase;
                $discountTotal += $discountAmount;
                $taxTotal += $taxAmount;

                $lineRows[] = [
                    'product_id' => $item['product_id'] ?? null,
                    'variant_id' => $item['variant_id'] ?? null,
                    'serial_id' => $item['serial_id'] ?? null,
                    'product_name_snapshot' => $item['product_name'] ?? ($item['product_name_snapshot'] ?? 'Item'),
                    'qty' => $qty,
                    'unit_price' => $unitPrice,
                    'discount_amount' => $discountAmount,
                    'tax_amount' => $taxAmount,
                    'line_total' => $lineTotal,
                    'addons' => !empty($item['addons']) ? (is_string($item['addons']) ? $item['addons'] : json_encode($item['addons'], JSON_UNESCAPED_UNICODE)) : null,
                    'customization' => !empty($item['customization']) ? (is_string($item['customization']) ? $item['customization'] : json_encode($item['customization'], JSON_UNESCAPED_UNICODE)) : null,
                ];
            }

            $billDiscount = (float) ($body['discount_amount'] ?? 0);
            $subtotal = round($subtotal, 2);
            $discountTotal = round($discountTotal + $billDiscount, 2);
            $taxTotal = round($taxTotal, 2);
            $grandTotal = round($subtotal - $discountTotal + $taxTotal, 2);

            $paidAmount = isset($body['paid_amount']) ? (float) $body['paid_amount'] : (float) $existingInvoice['paid_amount'];
            $balanceAmount = round(max(0, $grandTotal - $paidAmount), 2);

            // 5. Update invoice record
            $customerId = $body['customer_id'] ?? $existingInvoice['customer_id'];
            $this->pdo->prepare(
                'UPDATE invoices SET
                    customer_id = :customer_id,
                    subtotal = :subtotal,
                    discount_amount = :discount_amount,
                    tax_amount = :tax_amount,
                    grand_total = :grand_total,
                    paid_amount = :paid_amount,
                    balance_amount = :balance_amount,
                    slogan = :slogan,
                    customer_type = :customer_type
                 WHERE id = :id'
            )->execute([
                'customer_id' => $customerId,
                'subtotal' => $subtotal,
                'discount_amount' => $discountTotal,
                'tax_amount' => $taxTotal,
                'grand_total' => $grandTotal,
                'paid_amount' => $paidAmount,
                'balance_amount' => $balanceAmount,
                'slogan' => $body['slogan'] ?? $existingInvoice['slogan'],
                'customer_type' => $body['customer_type'] ?? $existingInvoice['customer_type'],
                'id' => $invoiceId,
            ]);

            // 6. Insert new items and deduct stock
            $insertItem = $this->pdo->prepare(
                'INSERT INTO invoice_items
                    (invoice_id, product_id, variant_id, serial_id, product_name_snapshot, qty, unit_price,
                     discount_amount, tax_amount, line_total, addons, customization)
                 VALUES
                    (:invoice_id, :product_id, :variant_id, :serial_id, :name, :qty, :unit_price,
                     :discount_amount, :tax_amount, :line_total, :addons, :customization)'
            );
            foreach ($lineRows as $line) {
                $insertItem->execute([
                    'invoice_id' => $invoiceId,
                    'product_id' => $line['product_id'],
                    'variant_id' => $line['variant_id'],
                    'serial_id' => $line['serial_id'],
                    'name' => $line['product_name_snapshot'],
                    'qty' => $line['qty'],
                    'unit_price' => $line['unit_price'],
                    'discount_amount' => $line['discount_amount'],
                    'tax_amount' => $line['tax_amount'],
                    'line_total' => $line['line_total'],
                    'addons' => $line['addons'],
                    'customization' => $line['customization'],
                ]);

                if ($line['product_id']) {
                    $this->deductStock(
                        (int) $line['product_id'],
                        (float) $line['qty'],
                        'online',
                        $invoiceId,
                        $line['serial_id'] ? (int) $line['serial_id'] : null,
                        (int) $claims['uid']
                    );
                }
            }

            // 7. Update customer balance if applicable
            if ($customerId && $balanceAmount > 0) {
                $this->pdo->prepare('UPDATE customers SET balance = balance + :amt WHERE id = :id')
                    ->execute(['amt' => $balanceAmount, 'id' => $customerId]);
            }

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'update', 'invoices', $invoiceId, [
                'invoice_no' => $existingInvoice['invoice_no'],
                'grand_total' => $grandTotal,
            ]);
            Response::json($this->fetchInvoice($invoiceId));
        } catch (ValidationException $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to update invoice: ' . $e->getMessage(), 500);
        }
    }

    /** POST /api/invoices/{id}/cancel — reverses stock and marks cancelled. */
    public function cancel(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'pos.cancel_invoice');
        $invoiceId = $this->resolveId($id);

        $stmt = $this->pdo->prepare('SELECT * FROM invoices WHERE id = :id');
        $stmt->execute(['id' => $invoiceId]);
        $invoice = $stmt->fetch();
        if (!$invoice) {
            Response::error('Invoice not found', 404);
        }
        if ($invoice['status'] === 'cancelled') {
            Response::json($this->fetchInvoice($invoiceId));
        }

        $this->pdo->beginTransaction();
        try {
            $items = $this->pdo->prepare('SELECT * FROM invoice_items WHERE invoice_id = :id');
            $items->execute(['id' => $invoiceId]);
            foreach ($items->fetchAll() as $item) {
                if ($item['product_id']) {
                    $this->restock((int) $item['product_id'], (float) $item['qty'], 'sale_return', 'invoices', $invoiceId, $item['serial_id'] ? (int) $item['serial_id'] : null);
                }
            }

            if ($invoice['customer_id'] && (float) $invoice['balance_amount'] > 0) {
                $this->pdo->prepare('UPDATE customers SET balance = balance - :amt WHERE id = :id')
                    ->execute(['amt' => (float) $invoice['balance_amount'], 'id' => $invoice['customer_id']]);
            }

            $this->pdo->prepare("UPDATE invoices SET status = 'cancelled' WHERE id = :id")->execute(['id' => $invoiceId]);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'cancel', 'invoices', $invoiceId, ['invoice_no' => $invoice['invoice_no']]);
            Response::json($this->fetchInvoice($invoiceId));
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to cancel invoice: ' . $e->getMessage(), 500);
        }
    }

    /**
     * @param array<string, mixed> $body
     * @param array<string, mixed> $claims
     */
    private function createInvoice(string $uuid, array $body, array $claims): int
    {
        $items = $body['items'] ?? [];
        if (empty($items)) {
            throw new ValidationException('Invoice must have at least one item');
        }
        $source = ($body['source'] ?? 'online') === 'offline' ? 'offline' : 'online';

        $settingsStmt = $this->pdo->prepare('SELECT * FROM business_settings WHERE id = 1 FOR UPDATE');
        $settingsStmt->execute();
        $settings = $settingsStmt->fetch();
        $invoiceNo = $settings['invoice_prefix'] . '-' . str_pad((string) $settings['invoice_next_number'], 6, '0', STR_PAD_LEFT);
        $this->pdo->prepare('UPDATE business_settings SET invoice_next_number = invoice_next_number + 1 WHERE id = 1')->execute();

        $subtotal = 0.0;
        $discountTotal = 0.0;
        $taxTotal = 0.0;
        $lineRows = [];

        foreach ($items as $item) {
            $qty = (float) ($item['qty'] ?? 0);
            if ($qty <= 0) {
                throw new ValidationException('Item quantity must be greater than zero');
            }
            $unitPrice = (float) ($item['unit_price'] ?? 0);
            $addonsTotal = 0.0;
            foreach ($item['addons'] ?? [] as $addon) {
                $addonsTotal += (float) ($addon['price'] ?? 0);
            }
            $lineBase = ($unitPrice + $addonsTotal) * $qty;
            $discountAmount = (float) ($item['discount_amount'] ?? 0);
            $taxAmount = (float) ($item['tax_amount'] ?? 0);
            $lineTotal = round($lineBase - $discountAmount + $taxAmount, 2);

            $subtotal += $lineBase;
            $discountTotal += $discountAmount;
            $taxTotal += $taxAmount;

            $lineRows[] = [
                'product_id' => $item['product_id'] ?? null,
                'variant_id' => $item['variant_id'] ?? null,
                'serial_id' => $item['serial_id'] ?? null,
                'product_name_snapshot' => $item['product_name'] ?? ($item['product_name_snapshot'] ?? 'Item'),
                'qty' => $qty,
                'unit_price' => $unitPrice,
                'discount_amount' => $discountAmount,
                'tax_amount' => $taxAmount,
                'line_total' => $lineTotal,
                'addons' => !empty($item['addons']) ? json_encode($item['addons'], JSON_UNESCAPED_UNICODE) : null,
                'customization' => !empty($item['customization']) ? json_encode($item['customization'], JSON_UNESCAPED_UNICODE) : null,
            ];
        }

        $billDiscount = (float) ($body['discount_amount'] ?? 0);
        $subtotal = round($subtotal, 2);
        $discountTotal = round($discountTotal + $billDiscount, 2);
        $taxTotal = round($taxTotal, 2);
        $grandTotal = round($subtotal - $discountTotal + $taxTotal, 2);

        $payments = $body['payments'] ?? [];
        $paidAmount = 0.0;
        foreach ($payments as $p) {
            if (($p['payment_method'] ?? $p['code'] ?? '') !== 'credit') {
                $paidAmount += (float) ($p['amount'] ?? 0);
            }
        }
        $balanceAmount = round($grandTotal - $paidAmount, 2);

        // Offline clients send JS Date.toISOString() ('...T...Z'); MySQL DATETIME needs 'Y-m-d H:i:s'.
        $createdAt = date('Y-m-d H:i:s');
        if ($source === 'offline' && !empty($body['created_at'])) {
            try {
                $createdAt = (new \DateTime($body['created_at']))->format('Y-m-d H:i:s');
            } catch (\Throwable) {
                // Keep the server time if the client sent something unparsable.
            }
        }

        $customerType = in_array($body['customer_type'] ?? '', ['retail', 'wholesale', 'regular'], true) ? $body['customer_type'] : 'retail';
        $slogan = $body['slogan'] ?? null;

        $stmt = $this->pdo->prepare(
            'INSERT INTO invoices
                (uuid, invoice_no, customer_id, user_id, subtotal, discount_amount, tax_amount, grand_total,
                 paid_amount, balance_amount, status, slogan, customer_type, source, created_at)
             VALUES
                (:uuid, :invoice_no, :customer_id, :user_id, :subtotal, :discount_amount, :tax_amount, :grand_total,
                 :paid_amount, :balance_amount, \'completed\', :slogan, :customer_type, :source, :created_at)'
        );
        $stmt->execute([
            'uuid' => $uuid,
            'invoice_no' => $invoiceNo,
            'customer_id' => $body['customer_id'] ?? null,
            'user_id' => $claims['uid'],
            'subtotal' => $subtotal,
            'discount_amount' => $discountTotal,
            'tax_amount' => $taxTotal,
            'grand_total' => $grandTotal,
            'paid_amount' => $paidAmount,
            'balance_amount' => $balanceAmount,
            'slogan' => $slogan,
            'customer_type' => $customerType,
            'source' => $source,
            'created_at' => $createdAt,
        ]);
        $invoiceId = (int) $this->pdo->lastInsertId();

        $insertItem = $this->pdo->prepare(
            'INSERT INTO invoice_items
                (invoice_id, product_id, variant_id, serial_id, product_name_snapshot, qty, unit_price,
                 discount_amount, tax_amount, line_total, addons, customization)
             VALUES
                (:invoice_id, :product_id, :variant_id, :serial_id, :name, :qty, :unit_price,
                 :discount_amount, :tax_amount, :line_total, :addons, :customization)'
        );
        foreach ($lineRows as $line) {
            $insertItem->execute([
                'invoice_id' => $invoiceId,
                'product_id' => $line['product_id'],
                'variant_id' => $line['variant_id'],
                'serial_id' => $line['serial_id'],
                'name' => $line['product_name_snapshot'],
                'qty' => $line['qty'],
                'unit_price' => $line['unit_price'],
                'discount_amount' => $line['discount_amount'],
                'tax_amount' => $line['tax_amount'],
                'line_total' => $line['line_total'],
                'addons' => $line['addons'],
                'customization' => $line['customization'],
            ]);

            if ($line['product_id']) {
                $this->deductStock((int) $line['product_id'], (float) $line['qty'], $source, $invoiceId, $line['serial_id'] ? (int) $line['serial_id'] : null, (int) $claims['uid']);
            }
        }

        foreach ($payments as $p) {
            $methodId = $this->resolvePaymentMethodId($p['payment_method'] ?? $p['code'] ?? 'cash');
            $amount = (float) ($p['amount'] ?? 0);
            if ($amount <= 0) {
                continue;
            }
            $this->pdo->prepare(
                'INSERT INTO invoice_payments (invoice_id, payment_method_id, amount, reference_no)
                 VALUES (:invoice_id, :method_id, :amount, :ref)'
            )->execute([
                'invoice_id' => $invoiceId,
                'method_id' => $methodId,
                'amount' => $amount,
                'ref' => $p['reference_no'] ?? null,
            ]);
        }

        if ($body['customer_id'] ?? null) {
            $this->pdo->prepare('UPDATE customers SET balance = balance + :amt WHERE id = :id')
                ->execute(['amt' => $balanceAmount, 'id' => $body['customer_id']]);
        }

        return $invoiceId;
    }

    /**
     * Atomically decrements product stock and writes the movement ledger row.
     * Online sales are stock-checked (a live register can warn the cashier);
     * offline sales being replayed from the sync queue already happened in
     * the real world, so they are applied even if they drive stock negative
     * — the movement ledger is the record of truth for reconciling that later.
     */
    private function deductStock(int $productId, float $qty, string $source, int $invoiceId, ?int $serialId, int $userId): void
    {
        $lock = $this->pdo->prepare('SELECT stock_qty, track_serial FROM products WHERE id = :id FOR UPDATE');
        $lock->execute(['id' => $productId]);
        $product = $lock->fetch();
        if (!$product) {
            return;
        }

        if ($source === 'online' && (float) $product['stock_qty'] < $qty && !$serialId) {
            throw new ValidationException('Insufficient stock for the selected product');
        }

        if ($serialId) {
            $serialStmt = $this->pdo->prepare("SELECT status FROM product_serials WHERE id = :id FOR UPDATE");
            $serialStmt->execute(['id' => $serialId]);
            $serial = $serialStmt->fetch();
            if ($source === 'online' && (!$serial || $serial['status'] !== 'in_stock')) {
                throw new ValidationException('Selected IMEI/serial is not available in stock');
            }
            $this->pdo->prepare("UPDATE product_serials SET status = 'sold', invoice_item_id = NULL WHERE id = :id")
                ->execute(['id' => $serialId]);
        }

        $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty - :qty WHERE id = :id')
            ->execute(['qty' => $qty, 'id' => $productId]);

        $this->pdo->prepare(
            "INSERT INTO stock_movements (uuid, product_id, serial_id, qty_change, movement_type, ref_type, ref_id, user_id)
             VALUES (:uuid, :pid, :serial_id, :qty, 'sale', 'invoices', :ref_id, :user_id)"
        )->execute([
            'uuid' => UuidHelper::v4(),
            'pid' => $productId,
            'serial_id' => $serialId,
            'qty' => -$qty,
            'ref_id' => $invoiceId,
            'user_id' => $userId,
        ]);
    }

    private function restock(int $productId, float $qty, string $movementType, string $refType, int $refId, ?int $serialId): void
    {
        $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty + :qty WHERE id = :id')
            ->execute(['qty' => $qty, 'id' => $productId]);

        if ($serialId) {
            $this->pdo->prepare("UPDATE product_serials SET status = 'in_stock' WHERE id = :id")->execute(['id' => $serialId]);
        }

        $this->pdo->prepare(
            "INSERT INTO stock_movements (uuid, product_id, serial_id, qty_change, movement_type, ref_type, ref_id)
             VALUES (:uuid, :pid, :serial_id, :qty, :type, :ref_type, :ref_id)"
        )->execute([
            'uuid' => UuidHelper::v4(),
            'pid' => $productId,
            'serial_id' => $serialId,
            'qty' => $qty,
            'type' => $movementType,
            'ref_type' => $refType,
            'ref_id' => $refId,
        ]);
    }

    private function resolvePaymentMethodId(string $code): int
    {
        $stmt = $this->pdo->prepare('SELECT id FROM payment_methods WHERE code = :code');
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : 1;
    }

    /** Accepts either a numeric id or a uuid, so offline clients can reference invoices by uuid. */
    private function resolveId(string $id): int
    {
        if (ctype_digit($id)) {
            return (int) $id;
        }
        $stmt = $this->pdo->prepare('SELECT id FROM invoices WHERE uuid = :uuid');
        $stmt->execute(['uuid' => $id]);
        $row = $stmt->fetch();
        return $row ? (int) $row['id'] : 0;
    }

    private function fetchInvoice(int $id): ?array
    {
        if ($id <= 0) {
            return null;
        }
        $stmt = $this->pdo->prepare(
            'SELECT i.*, c.name AS customer_name, c.phone AS customer_phone
             FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE i.id = :id'
        );
        $stmt->execute(['id' => $id]);
        $invoice = $stmt->fetch();
        if (!$invoice) {
            return null;
        }

        $items = $this->pdo->prepare('SELECT * FROM invoice_items WHERE invoice_id = :id');
        $items->execute(['id' => $id]);
        $invoice['items'] = array_map(function ($row) {
            $row['addons'] = $row['addons'] ? json_decode((string) $row['addons'], true) : [];
            $row['customization'] = $row['customization'] ? json_decode((string) $row['customization'], true) : [];
            return $row;
        }, $items->fetchAll());

        $payments = $this->pdo->prepare(
            'SELECT ip.*, pm.code, pm.name AS method_name FROM invoice_payments ip
             JOIN payment_methods pm ON pm.id = ip.payment_method_id WHERE ip.invoice_id = :id'
        );
        $payments->execute(['id' => $id]);
        $invoice['payments'] = $payments->fetchAll();

        return $invoice;
    }
}
