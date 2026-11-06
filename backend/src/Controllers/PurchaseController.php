<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\PermissionDeniedException;
use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Helpers\ValidationException;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

class PurchaseController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'purchases.manage');
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['search'])) {
            $where .= ' AND (p.purchase_no LIKE :s OR s.name LIKE :s)';
            $params['s'] = '%' . $_GET['search'] . '%';
        }
        $stmt = $this->pdo->prepare(
            "SELECT p.*, s.name AS supplier_name FROM purchases p
             JOIN suppliers s ON s.id = p.supplier_id {$where} ORDER BY p.created_at DESC LIMIT 500"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'purchases.manage');

        $this->pdo->beginTransaction();
        try {
            $purchase = $this->fetchPurchase((int) $id);
            if (!$purchase) {
                Response::error('Purchase not found', 404);
            }

            // Reverse stock
            foreach ($purchase['items'] as $item) {
                $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty - :qty WHERE id = :pid')
                    ->execute(['qty' => $item['qty'], 'pid' => $item['product_id']]);

                // Delete serials if any created by this purchase
                $this->pdo->prepare('DELETE FROM product_serials WHERE purchase_item_id = :piid')
                    ->execute(['piid' => $item['id']]);
            }

            // Adjust supplier balance if balance_amount > 0
            if ((float) ($purchase['balance_amount'] ?? 0) > 0) {
                $this->pdo->prepare('UPDATE suppliers SET balance = balance - :amt WHERE id = :sid')
                    ->execute(['amt' => $purchase['balance_amount'], 'sid' => $purchase['supplier_id']]);
            }

            // Delete purchase movements
            $this->pdo->prepare("DELETE FROM stock_movements WHERE ref_type = 'purchases' AND ref_id = :id")
                ->execute(['id' => $id]);

            // Delete purchase items
            $this->pdo->prepare('DELETE FROM purchase_items WHERE purchase_id = :id')->execute(['id' => $id]);

            // Delete purchase
            $this->pdo->prepare('DELETE FROM purchases WHERE id = :id')->execute(['id' => $id]);

            $this->pdo->commit();
            Response::json(['ok' => true]);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to delete purchase: ' . $e->getMessage(), 500);
        }
    }

    public function show(string $id): void
    {
        AuthMiddleware::authenticate();
        $purchase = $this->fetchPurchase((int) $id);
        if (!$purchase) {
            Response::error('Purchase not found', 404);
        }
        Response::json($purchase);
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            [$purchase, $status] = $this->createFromSync($body, $claims);
            Response::json($purchase, $status);
        } catch (ValidationException $e) {
            Response::error($e->getMessage(), 422);
        } catch (PermissionDeniedException $e) {
            Response::error($e->getMessage(), 403);
        } catch (\Throwable $e) {
            Response::error('Failed to save purchase: ' . $e->getMessage(), 500);
        }
    }

    /**
     * @param array<string, mixed> $body
     * @param array<string, mixed> $claims
     * @return array{0: array<string, mixed>, 1: int}
     */
    public function createFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'purchases.manage');
        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM purchases WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [$this->fetchPurchase((int) $row['id']), 200];
        }

        $this->pdo->beginTransaction();
        try {
            $id = $this->createPurchase($uuid, $body, $claims);
            $this->pdo->commit();
            return [$this->fetchPurchase($id), 201];
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /** @param array<string, mixed> $body @param array<string, mixed> $claims */
    private function createPurchase(string $uuid, array $body, array $claims): int
    {
        $items = $body['items'] ?? [];
        if (empty($items) || empty($body['supplier_id'])) {
            throw new ValidationException('supplier_id and at least one item are required');
        }

        $purchaseNo = 'PO-' . date('ymd') . '-' . substr(str_replace('-', '', $uuid), 0, 6);
        $subtotal = 0.0;
        $discountTotal = 0.0;
        $taxTotal = 0.0;
        $rows = [];

        foreach ($items as $item) {
            $qty = (float) ($item['qty'] ?? 0);
            $unitPrice = (float) ($item['unit_price'] ?? 0);
            $discount = (float) ($item['discount_amount'] ?? 0);
            $tax = (float) ($item['tax_amount'] ?? 0);
            $lineTotal = round($qty * $unitPrice - $discount + $tax, 2);
            $subtotal += $qty * $unitPrice;
            $discountTotal += $discount;
            $taxTotal += $tax;
            $rows[] = $item + ['qty' => $qty, 'unit_price' => $unitPrice, 'discount_amount' => $discount, 'tax_amount' => $tax, 'line_total' => $lineTotal];
        }

        $subtotal = round($subtotal, 2);
        $discountTotal = round($discountTotal, 2);
        $taxTotal = round($taxTotal, 2);
        $grandTotal = round($subtotal - $discountTotal + $taxTotal, 2);
        $paidAmount = round((float) ($body['paid_amount'] ?? 0), 2);
        $balanceAmount = round($grandTotal - $paidAmount, 2);

        $this->pdo->prepare(
            'INSERT INTO purchases (uuid, purchase_no, supplier_id, user_id, subtotal, discount_amount, tax_amount,
                grand_total, paid_amount, balance_amount, source)
             VALUES (:uuid, :no, :supplier_id, :user_id, :subtotal, :discount, :tax, :grand_total, :paid, :balance, :source)'
        )->execute([
            'uuid' => $uuid,
            'no' => $purchaseNo,
            'supplier_id' => $body['supplier_id'],
            'user_id' => $claims['uid'],
            'subtotal' => $subtotal,
            'discount' => $discountTotal,
            'tax' => $taxTotal,
            'grand_total' => $grandTotal,
            'paid' => $paidAmount,
            'balance' => $balanceAmount,
            'source' => ($body['source'] ?? 'online') === 'offline' ? 'offline' : 'online',
        ]);
        $purchaseId = (int) $this->pdo->lastInsertId();

        $insertItem = $this->pdo->prepare(
            'INSERT INTO purchase_items (purchase_id, product_id, qty, unit_price, discount_amount, tax_amount, line_total, serials)
             VALUES (:purchase_id, :product_id, :qty, :unit_price, :discount_amount, :tax_amount, :line_total, :serials)'
        );
        foreach ($rows as $row) {
            if (empty($row['product_id'])) {
                throw new ValidationException('Each purchase item requires a product_id');
            }
            $serials = $row['serials'] ?? [];
            $insertItem->execute([
                'purchase_id' => $purchaseId,
                'product_id' => $row['product_id'],
                'qty' => $row['qty'],
                'unit_price' => $row['unit_price'],
                'discount_amount' => $row['discount_amount'],
                'tax_amount' => $row['tax_amount'],
                'line_total' => $row['line_total'],
                'serials' => !empty($serials) ? json_encode($serials) : null,
            ]);
            $purchaseItemId = (int) $this->pdo->lastInsertId();

            $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty + :qty, purchase_price = :price WHERE id = :id')
                ->execute(['qty' => $row['qty'], 'price' => $row['unit_price'], 'id' => $row['product_id']]);

            if (!empty($serials)) {
                $insertSerial = $this->pdo->prepare(
                    "INSERT INTO product_serials (product_id, imei1, imei2, serial_no, status, purchase_item_id)
                     VALUES (:pid, :imei1, :imei2, :serial_no, 'in_stock', :purchase_item_id)"
                );
                foreach ($serials as $s) {
                    $insertSerial->execute([
                        'pid' => $row['product_id'],
                        'imei1' => $s['imei1'] ?? null,
                        'imei2' => $s['imei2'] ?? null,
                        'serial_no' => $s['serial_no'] ?? null,
                        'purchase_item_id' => $purchaseItemId,
                    ]);
                }
            }

            $this->pdo->prepare(
                "INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, ref_id, user_id)
                 VALUES (:uuid, :pid, :qty, 'purchase', 'purchases', :ref_id, :user_id)"
            )->execute([
                'uuid' => UuidHelper::v4(),
                'pid' => $row['product_id'],
                'qty' => $row['qty'],
                'ref_id' => $purchaseId,
                'user_id' => $claims['uid'],
            ]);
        }

        if ($balanceAmount > 0) {
            $this->pdo->prepare('UPDATE suppliers SET balance = balance + :amt WHERE id = :id')
                ->execute(['amt' => $balanceAmount, 'id' => $body['supplier_id']]);
        }

        return $purchaseId;
    }

    private function fetchPurchase(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = :id'
        );
        $stmt->execute(['id' => $id]);
        $purchase = $stmt->fetch();
        if (!$purchase) {
            return null;
        }
        $items = $this->pdo->prepare(
            'SELECT pi.*, pr.name AS product_name FROM purchase_items pi
             JOIN products pr ON pr.id = pi.product_id WHERE pi.purchase_id = :id'
        );
        $items->execute(['id' => $id]);
        $purchase['items'] = $items->fetchAll();
        return $purchase;
    }
}
