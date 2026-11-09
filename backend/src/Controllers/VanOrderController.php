<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Helpers\ValidationException;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Services\AuditLogger;
use PDO;

/**
 * Van Sales — Order Management: a physical-goods loading order that
 * transfers stock from the warehouse onto a vehicle. Separate from the
 * customer pre-booking "Order Management" module (OrderController/orders
 * table) — this is a distinct workflow: Order -> Van Stock Loading ->
 * Day Return -> Day Closing. Never record a sale here; a van order only
 * ever moves stock between the warehouse and a vehicle.
 */
class VanOrderController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['status'])) {
            $where .= ' AND vo.status = :status';
            $params['status'] = $_GET['status'];
        }
        if (!empty($_GET['vehicle_id'])) {
            $where .= ' AND vo.vehicle_id = :vehicle_id';
            $params['vehicle_id'] = $_GET['vehicle_id'];
        }
        if (!empty($_GET['search'])) {
            $where .= ' AND vo.order_no LIKE :s';
            $params['s'] = '%' . $_GET['search'] . '%';
        }
        $stmt = $this->pdo->prepare(
            "SELECT vo.*, COALESCE(v.name, vo.van_number, 'Unassigned Van') AS vehicle_name,
                    v.registration_no AS vehicle_registration_no,
                    u.full_name AS created_by_name,
                    emp.full_name AS employee_name, c.name AS customer_name, ord.order_no AS mapped_order_no,
                    (SELECT COUNT(*) FROM van_order_items WHERE van_order_id = vo.id) AS item_count,
                    (SELECT dr.id FROM day_returns dr WHERE dr.van_order_id = vo.id AND dr.status = 'completed' LIMIT 1) AS day_return_id
             FROM van_orders vo
             LEFT JOIN vehicles v ON v.id = vo.vehicle_id
             LEFT JOIN users u ON u.id = vo.created_by
             LEFT JOIN users emp ON emp.id = vo.employee_id
             LEFT JOIN customers c ON c.id = vo.customer_id
             LEFT JOIN orders ord ON ord.id = vo.order_id
             {$where}
             ORDER BY vo.id DESC LIMIT 1000"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function show(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $order = $this->fetchOrder((int) $id);
        if (!$order) {
            Response::error('Van order not found', 404);
        }
        Response::json($order);
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            [$order, $status] = $this->createFromSync($body, $claims);
            Response::json($order, $status);
        } catch (ValidationException $e) {
            Response::error($e->getMessage(), 422);
        } catch (\Throwable $e) {
            Response::error('Failed to save van order: ' . $e->getMessage(), 500);
        }
    }

    /** @param array<string, mixed> $body @param array<string, mixed> $claims @return array{0: array<string, mixed>, 1: int} */
    public function createFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'van_sales.manage_orders');
        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM van_orders WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [$this->fetchOrder((int) $row['id']), 200];
        }

        // Vehicle selection: can use existing vehicle_id, specify van_number/route_line, or default to first active vehicle/General Delivery Van.
        $vehicleId = !empty($body['vehicle_id']) ? (int) $body['vehicle_id'] : null;
        $vanNumber = !empty($body['van_number']) ? trim((string) $body['van_number']) : null;
        $routeLine = !empty($body['route_line']) ? trim((string) $body['route_line']) : null;

        if (!$vehicleId && !empty($vanNumber)) {
            $vFind = $this->pdo->prepare('SELECT id FROM vehicles WHERE registration_no = :reg OR name = :name LIMIT 1');
            $vFind->execute(['reg' => $vanNumber, 'name' => $vanNumber]);
            if ($row = $vFind->fetch()) {
                $vehicleId = (int) $row['id'];
            } else {
                $vIns = $this->pdo->prepare(
                    'INSERT INTO vehicles (uuid, name, registration_no, driver_name) VALUES (:uuid, :name, :reg, :driver)'
                );
                $vIns->execute([
                    'uuid' => UuidHelper::v4(),
                    'name' => 'Van ' . $vanNumber,
                    'reg' => $vanNumber,
                    'driver' => $routeLine ? ("Route: " . $routeLine) : null,
                ]);
                $vehicleId = (int) $this->pdo->lastInsertId();
            }
        }

        // If still no vehicle assigned, assign to default / first available vehicle
        if (!$vehicleId) {
            $defV = $this->pdo->query('SELECT id FROM vehicles WHERE is_active = 1 ORDER BY id ASC LIMIT 1');
            if ($row = $defV->fetch()) {
                $vehicleId = (int) $row['id'];
            } else {
                $vIns = $this->pdo->prepare(
                    'INSERT INTO vehicles (uuid, name, registration_no, driver_name) VALUES (:uuid, :name, :reg, :driver)'
                );
                $vIns->execute([
                    'uuid' => UuidHelper::v4(),
                    'name' => 'General Delivery Van',
                    'reg' => 'VAN-DEFAULT',
                    'driver' => 'Standard Driver',
                ]);
                $vehicleId = (int) $this->pdo->lastInsertId();
            }
        }

        $items = $body['items'] ?? [];
        if (empty($items)) {
            throw new ValidationException('At least one item is required');
        }

        $this->pdo->beginTransaction();
        try {
            $orderNo = 'VO-' . date('ymd') . '-' . substr(str_replace('-', '', $uuid), 0, 6);
            [$subtotal, $discountTotal, $taxTotal, $rows] = $this->computeLines($items);
            $grandTotal = round($subtotal - $discountTotal + $taxTotal, 2);
            $paidAmount = round((float) ($body['paid_amount'] ?? 0), 2);

            $this->pdo->prepare(
                'INSERT INTO van_orders (uuid, order_no, order_date, vehicle_id, van_number, route_line, employee_id, order_id, customer_id, subtotal, discount_amount,
                    tax_amount, grand_total, paid_amount, balance_amount, notes, created_by)
                 VALUES (:uuid, :no, :date, :vehicle_id, :van_number, :route_line, :employee_id, :order_id, :customer_id, :subtotal, :discount, :tax, :grand_total, :paid, :balance, :notes, :created_by)'
            )->execute([
                'uuid' => $uuid,
                'no' => $orderNo,
                'date' => $body['order_date'] ?? date('Y-m-d'),
                'vehicle_id' => $vehicleId,
                'van_number' => $vanNumber,
                'route_line' => $routeLine,
                'employee_id' => !empty($body['employee_id']) ? (int) $body['employee_id'] : null,
                'order_id' => !empty($body['order_id']) ? (int) $body['order_id'] : null,
                'customer_id' => !empty($body['customer_id']) ? (int) $body['customer_id'] : null,
                'subtotal' => $subtotal,
                'discount' => $discountTotal,
                'tax' => $taxTotal,
                'grand_total' => $grandTotal,
                'paid' => $paidAmount,
                'balance' => round($grandTotal - $paidAmount, 2),
                'notes' => $body['notes'] ?? null,
                'created_by' => $claims['uid'] ?? null,
            ]);
            $id = (int) $this->pdo->lastInsertId();
            $this->insertItems($id, $rows);

            // Directly auto-load stock into the van so creating the van order = van loaded with stock!
            $freshOrder = $this->fetchOrder($id);
            if ($freshOrder) {
                $this->applyLoad($id, $freshOrder, $claims);
                $this->pdo->prepare("UPDATE van_orders SET status = 'loaded', loaded_at = NOW() WHERE id = :id")->execute(['id' => $id]);
            }

            // If an order_id was mapped, link it in the orders table and update to processing
            if (!empty($body['order_id'])) {
                $this->pdo->prepare("UPDATE orders SET van_order_id = :vo_id, status = 'processing' WHERE id = :ord_id")
                    ->execute(['vo_id' => $id, 'ord_id' => (int) $body['order_id']]);
            }

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'create', 'van_orders', $id, ['order_no' => $orderNo]);
            return [$this->fetchOrder($id), 201];
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Edit an order. While 'pending' this is a plain update. Once 'loaded',
     * the previous warehouse/van stock movement is reversed first and the
     * new quantities are re-applied — both movements stay in the audit
     * trail (nothing is deleted from stock_movements/van_stock_movements).
     */
    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_orders');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $order = $this->fetchOrder((int) $id);
        if (!$order) {
            Response::error('Van order not found', 404);
        }
        if (in_array($order['status'], ['completed', 'cancelled'], true)) {
            Response::error("Cannot edit a van order once it is '{$order['status']}'", 422);
        }
        $items = $body['items'] ?? [];
        if (empty($items)) {
            Response::error('At least one item is required', 422);
        }

        $this->pdo->beginTransaction();
        try {
            if ($order['status'] === 'loaded') {
                $this->reverseLoad((int) $id, $order, $claims);
            }

            [$subtotal, $discountTotal, $taxTotal, $rows] = $this->computeLines($items);
            $grandTotal = round($subtotal - $discountTotal + $taxTotal, 2);
            $paidAmount = round((float) ($body['paid_amount'] ?? $order['paid_amount']), 2);

            $this->pdo->prepare(
                'UPDATE van_orders SET vehicle_id = :vehicle_id, van_number = :van_number, route_line = :route_line,
                    employee_id = :employee_id, order_id = :order_id,
                    customer_id = :customer_id, order_date = :date, subtotal = :subtotal,
                    discount_amount = :discount, tax_amount = :tax, grand_total = :grand_total,
                    paid_amount = :paid, balance_amount = :balance, notes = :notes
                 WHERE id = :id'
            )->execute([
                'vehicle_id' => array_key_exists('vehicle_id', $body) ? (!empty($body['vehicle_id']) ? (int) $body['vehicle_id'] : null) : $order['vehicle_id'],
                'van_number' => $body['van_number'] ?? $order['van_number'],
                'route_line' => $body['route_line'] ?? $order['route_line'],
                'employee_id' => array_key_exists('employee_id', $body) ? (!empty($body['employee_id']) ? (int) $body['employee_id'] : null) : $order['employee_id'],
                'order_id' => array_key_exists('order_id', $body) ? (!empty($body['order_id']) ? (int) $body['order_id'] : null) : $order['order_id'],
                'customer_id' => array_key_exists('customer_id', $body) ? (!empty($body['customer_id']) ? (int) $body['customer_id'] : null) : $order['customer_id'],
                'date' => $body['order_date'] ?? $order['order_date'],
                'subtotal' => $subtotal,
                'discount' => $discountTotal,
                'tax' => $taxTotal,
                'grand_total' => $grandTotal,
                'paid' => $paidAmount,
                'balance' => round($grandTotal - $paidAmount, 2),
                'notes' => $body['notes'] ?? $order['notes'],
                'id' => $id,
            ]);
            $this->pdo->prepare('DELETE FROM van_order_items WHERE van_order_id = :id')->execute(['id' => $id]);
            $this->insertItems((int) $id, $rows);

            if (!empty($body['order_id'])) {
                $this->pdo->prepare('UPDATE orders SET van_order_id = :vo_id WHERE id = :ord_id')
                    ->execute(['vo_id' => $id, 'ord_id' => (int) $body['order_id']]);
            }

            if ($order['status'] === 'loaded') {
                // Re-fetch the (possibly new) vehicle_id/items to reload against.
                $fresh = $this->fetchOrder((int) $id);
                $this->applyLoad((int) $id, $fresh, $claims);
            }

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'update', 'van_orders', (int) $id, ['reloaded' => $order['status'] === 'loaded']);
            Response::json($this->fetchOrder((int) $id));
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function loadToVan(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_orders');
        $order = $this->fetchOrder((int) $id);
        if (!$order) {
            Response::error('Van order not found', 404);
        }
        if ($order['status'] !== 'pending') {
            Response::error("Only a pending order can be loaded to the van (current status: {$order['status']})", 422);
        }

        $this->pdo->beginTransaction();
        try {
            $this->applyLoad((int) $id, $order, $claims);
            $this->pdo->prepare("UPDATE van_orders SET status = 'loaded', loaded_at = NOW() WHERE id = :id")->execute(['id' => $id]);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'update', 'van_orders', (int) $id, ['status' => 'loaded']);
            Response::json($this->fetchOrder((int) $id));
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function cancel(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_orders');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $order = $this->fetchOrder((int) $id);
        if (!$order) {
            Response::error('Van order not found', 404);
        }
        if ($order['status'] === 'cancelled') {
            Response::error('Order is already cancelled', 422);
        }
        if ($order['status'] === 'completed') {
            Response::error('Cannot cancel a completed order — cancel its Day Return instead', 422);
        }

        $this->pdo->beginTransaction();
        try {
            if ($order['status'] === 'loaded') {
                $this->reverseLoad((int) $id, $order, $claims);
            }
            $this->pdo->prepare(
                "UPDATE van_orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = :reason WHERE id = :id"
            )->execute(['reason' => $body['reason'] ?? null, 'id' => $id]);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'cancel', 'van_orders', (int) $id, ['reason' => $body['reason'] ?? null]);
            Response::json($this->fetchOrder((int) $id));
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_orders');
        $order = $this->fetchOrder((int) $id);
        if (!$order) {
            Response::error('Van order not found', 404);
        }
        // Only pending (stock never moved) or cancelled (stock already
        // reversed) orders can be removed — never delete one with a live
        // stock effect still outstanding.
        if (!in_array($order['status'], ['pending', 'cancelled'], true)) {
            Response::error("Cannot delete a van order that is '{$order['status']}' — cancel it first", 422);
        }

        $this->pdo->prepare('DELETE FROM van_order_items WHERE van_order_id = :id')->execute(['id' => $id]);
        $this->pdo->prepare('DELETE FROM van_orders WHERE id = :id')->execute(['id' => $id]);
        AuditLogger::log($this->pdo, $claims, 'delete', 'van_orders', (int) $id);
        Response::json(['ok' => true]);
    }

    // -------------------------------------------------------------------
    // Stock movement helpers
    // -------------------------------------------------------------------

    /** @param array<string, mixed> $order @param array<string, mixed> $claims */
    private function applyLoad(int $orderId, array $order, array $claims): void
    {
        $vehicleId = $order['vehicle_id'];
        foreach ($order['items'] as $item) {
            $qty = (float) $item['qty'];
            $product = $this->pdo->prepare('SELECT stock_qty FROM products WHERE id = :id FOR UPDATE');
            $product->execute(['id' => $item['product_id']]);
            $p = $product->fetch();
            if (!$p) {
                throw new \RuntimeException("Product {$item['product_id']} not found");
            }
            if ((float) $p['stock_qty'] < $qty) {
                throw new \RuntimeException("Insufficient warehouse stock for product {$item['product_id']} (have {$p['stock_qty']}, need {$qty})");
            }

            $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty - :qty WHERE id = :id')
                ->execute(['qty' => $qty, 'id' => $item['product_id']]);
            $this->pdo->prepare(
                "INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, ref_id, notes, user_id)
                 VALUES (:uuid, :pid, :qty, 'van_load', 'van_orders', :ref_id, :notes, :uid)"
            )->execute([
                'uuid' => UuidHelper::v4(),
                'pid' => $item['product_id'],
                'qty' => -$qty,
                'ref_id' => $orderId,
                'notes' => "Loaded to {$order['vehicle_name']}",
                'uid' => $claims['uid'] ?? null,
            ]);

            $this->pdo->prepare(
                'INSERT INTO van_stock (vehicle_id, product_id, qty) VALUES (:vid, :pid, :qty)
                 ON DUPLICATE KEY UPDATE qty = qty + :qty2'
            )->execute(['vid' => $vehicleId, 'pid' => $item['product_id'], 'qty' => $qty, 'qty2' => $qty]);
            $this->pdo->prepare(
                "INSERT INTO van_stock_movements (uuid, vehicle_id, product_id, qty_change, movement_type, ref_type, ref_id, notes, user_id)
                 VALUES (:uuid, :vid, :pid, :qty, 'load', 'van_orders', :ref_id, :notes, :uid)"
            )->execute([
                'uuid' => UuidHelper::v4(),
                'vid' => $vehicleId,
                'pid' => $item['product_id'],
                'qty' => $qty,
                'ref_id' => $orderId,
                'notes' => "Loaded from order {$order['order_no']}",
                'uid' => $claims['uid'] ?? null,
            ]);
        }
    }

    /** Reverses a previously-applied load: warehouse gets its stock back, the van loses it. */
    private function reverseLoad(int $orderId, array $order, array $claims): void
    {
        $vehicleId = $order['vehicle_id'];
        foreach ($order['items'] as $item) {
            $qty = (float) $item['qty'];
            $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty + :qty WHERE id = :id')
                ->execute(['qty' => $qty, 'id' => $item['product_id']]);
            $this->pdo->prepare(
                "INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, ref_id, notes, user_id)
                 VALUES (:uuid, :pid, :qty, 'van_load', 'van_orders', :ref_id, :notes, :uid)"
            )->execute([
                'uuid' => UuidHelper::v4(),
                'pid' => $item['product_id'],
                'qty' => $qty,
                'ref_id' => $orderId,
                'notes' => "Reversed load from {$order['vehicle_name']}",
                'uid' => $claims['uid'] ?? null,
            ]);

            $this->pdo->prepare('UPDATE van_stock SET qty = qty - :qty WHERE vehicle_id = :vid AND product_id = :pid')
                ->execute(['qty' => $qty, 'vid' => $vehicleId, 'pid' => $item['product_id']]);
            $this->pdo->prepare(
                "INSERT INTO van_stock_movements (uuid, vehicle_id, product_id, qty_change, movement_type, ref_type, ref_id, notes, user_id)
                 VALUES (:uuid, :vid, :pid, :qty, 'unload', 'van_orders', :ref_id, :notes, :uid)"
            )->execute([
                'uuid' => UuidHelper::v4(),
                'vid' => $vehicleId,
                'pid' => $item['product_id'],
                'qty' => -$qty,
                'ref_id' => $orderId,
                'notes' => "Reversed for edit/cancel of order {$order['order_no']}",
                'uid' => $claims['uid'] ?? null,
            ]);
        }
    }

    /** @param array<int, array<string, mixed>> $items @return array{0: float, 1: float, 2: float, 3: array<int, array<string, mixed>>} */
    private function computeLines(array $items): array
    {
        $subtotal = 0.0;
        $discountTotal = 0.0;
        $taxTotal = 0.0;
        $rows = [];
        foreach ($items as $item) {
            if (empty($item['product_id']) || empty($item['qty'])) {
                throw new ValidationException('Each line needs product_id and qty');
            }
            $qty = (float) $item['qty'];
            $unitPrice = (float) ($item['unit_price'] ?? 0);
            $discount = (float) ($item['discount_amount'] ?? 0);
            $tax = (float) ($item['tax_amount'] ?? 0);
            $lineTotal = round($qty * $unitPrice - $discount + $tax, 2);
            $subtotal += $qty * $unitPrice;
            $discountTotal += $discount;
            $taxTotal += $tax;
            $rows[] = [
                'product_id' => $item['product_id'],
                'qty' => $qty,
                'unit_price' => $unitPrice,
                'discount_amount' => $discount,
                'tax_amount' => $tax,
                'line_total' => $lineTotal,
            ];
        }
        return [round($subtotal, 2), round($discountTotal, 2), round($taxTotal, 2), $rows];
    }

    /** @param array<int, array<string, mixed>> $rows */
    private function insertItems(int $orderId, array $rows): void
    {
        $insert = $this->pdo->prepare(
            'INSERT INTO van_order_items (van_order_id, product_id, qty, unit_price, discount_amount, tax_amount, line_total)
             VALUES (:order_id, :product_id, :qty, :unit_price, :discount_amount, :tax_amount, :line_total)'
        );
        foreach ($rows as $row) {
            $insert->execute(['order_id' => $orderId, ...$row]);
        }
    }

    public function eligibleOrders(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $stmt = $this->pdo->prepare(
            "SELECT o.id, o.order_no, o.created_at AS order_date, o.customer_id, o.assigned_to, o.notes,
                    c.name AS customer_name, c.phone AS customer_phone, u.full_name AS assigned_to_name
             FROM orders o
             JOIN customers c ON c.id = o.customer_id
             LEFT JOIN users u ON u.id = o.assigned_to
             WHERE o.status IN ('created', 'pending', 'confirmed', 'processing')
               AND o.van_order_id IS NULL
             ORDER BY o.id DESC LIMIT 100"
        );
        $stmt->execute();
        $orders = $stmt->fetchAll();

        foreach ($orders as &$ord) {
            $itemsStmt = $this->pdo->prepare(
                "SELECT oi.*, p.name AS product_name, p.barcode, p.sku, p.selling_price, p.stock_qty
                 FROM order_items oi
                 JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = :oid"
            );
            $itemsStmt->execute(['oid' => $ord['id']]);
            $ord['items'] = $itemsStmt->fetchAll();
        }

        Response::json($orders);
    }

    /** @return array<string, mixed>|null */
    private function fetchOrder(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT vo.*, COALESCE(v.name, vo.van_number, 'Unassigned Van') AS vehicle_name,
                    v.registration_no AS vehicle_registration_no,
                    u.full_name AS created_by_name,
                    emp.full_name AS employee_name, c.name AS customer_name, ord.order_no AS mapped_order_no,
                    (SELECT dr.id FROM day_returns dr WHERE dr.van_order_id = vo.id AND dr.status = 'completed' LIMIT 1) AS day_return_id
             FROM van_orders vo
             LEFT JOIN vehicles v ON v.id = vo.vehicle_id
             LEFT JOIN users u ON u.id = vo.created_by
             LEFT JOIN users emp ON emp.id = vo.employee_id
             LEFT JOIN customers c ON c.id = vo.customer_id
             LEFT JOIN orders ord ON ord.id = vo.order_id
             WHERE vo.id = :id"
        );
        $stmt->execute(['id' => $id]);
        $order = $stmt->fetch();
        if (!$order) {
            return null;
        }
        $items = $this->pdo->prepare(
            "SELECT voi.*, p.name AS product_name, p.barcode, p.sku, p.stock_qty AS warehouse_stock
             FROM van_order_items voi JOIN products p ON p.id = voi.product_id
             WHERE voi.van_order_id = :id"
        );
        $items->execute(['id' => $id]);
        $order['items'] = $items->fetchAll();
        return $order;
    }
}
