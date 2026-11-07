<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Services\AuditLogger;
use PDO;

/**
 * Customer orders (pre-booking): a customer commits to specific items before
 * the sale is billed. Mirrors KC Agency's customer pre-booking workflow —
 * same statuses/transitions/field names — adapted to Universal POS, which
 * has no branches (only business_type) and no van/salesman-stock module, so
 * "dispatch to van" has no equivalent here. An order never touches stock or
 * money; it only becomes a real sale once linked to an invoice via POS.
 */
class OrderController
{
    private const STATUSES = ['pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'];

    /** @var array<string, array<int, string>> */
    private const VALID_TRANSITIONS = [
        'pending' => ['confirmed', 'processing', 'ready', 'completed', 'cancelled'],
        'confirmed' => ['processing', 'ready', 'completed', 'cancelled'],
        'processing' => ['ready', 'completed', 'cancelled'],
        'ready' => ['completed', 'cancelled'],
        'completed' => [],
        'cancelled' => [],
    ];

    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'orders.view');

        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['search'])) {
            $where .= ' AND (o.order_no LIKE :s OR c.name LIKE :s)';
            $params['s'] = '%' . $_GET['search'] . '%';
        }
        if (!empty($_GET['status'])) {
            $where .= ' AND o.status = :status';
            $params['status'] = $_GET['status'];
        }

        $stmt = $this->pdo->prepare(
            "SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
                    u.full_name AS assigned_to_name, i.invoice_no, vo.order_no AS van_order_no,
                    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                    (SELECT COALESCE(SUM(oi.qty * oi.rate * (1 + oi.tax_percent / 100)), 0)
                       FROM order_items oi WHERE oi.order_id = o.id) AS estimated_total
             FROM orders o
             JOIN customers c ON c.id = o.customer_id
             LEFT JOIN users u ON u.id = o.assigned_to
             LEFT JOIN invoices i ON i.id = o.invoice_id
             LEFT JOIN van_orders vo ON vo.id = o.van_order_id
             {$where}
             ORDER BY o.id DESC LIMIT 1000"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function show(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'orders.view');
        $order = $this->fetchOrder((int) $id);
        if (!$order) {
            Response::error('Order not found', 404);
        }
        Response::json($order);
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'orders.create');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM orders WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            Response::json($this->fetchOrder((int) $row['id']), 200);
        }

        try {
            $this->pdo->beginTransaction();
            $id = $this->createOrder($uuid, $body);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'create', 'orders', $id, ['order_no' => $this->fetchOrder($id)['order_no']]);
            Response::json($this->fetchOrder($id), 201);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'orders.create');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $current = $this->pdo->prepare('SELECT status FROM orders WHERE id = :id');
        $current->execute(['id' => $id]);
        $row = $current->fetch();
        if (!$row) {
            Response::error('Order not found', 404);
        }
        if ($row['status'] !== 'pending') {
            Response::error("Cannot edit an order once it is '{$row['status']}' — only a pending order can be edited", 422);
        }

        try {
            $this->pdo->beginTransaction();
            $this->applyOrderUpdate((int) $id, $body);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'update', 'orders', (int) $id);
            Response::json($this->fetchOrder((int) $id));
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function updateStatus(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'orders.manage_status');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $newStatus = $body['status'] ?? null;
        if (!$newStatus) {
            Response::error('status is required', 422);
        }
        $this->transitionTo((int) $id, $newStatus, $claims);
    }

    public function cancel(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'orders.manage_status');
        $this->transitionTo((int) $id, 'cancelled', $claims);
    }

    /** @param array<string, mixed> $claims */
    private function transitionTo(int $id, string $newStatus, array $claims): void
    {
        if (!in_array($newStatus, self::STATUSES, true)) {
            Response::error('Invalid status', 422);
        }
        $stmt = $this->pdo->prepare('SELECT status FROM orders WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Order not found', 404);
        }
        $current = $row['status'];
        if (!in_array($newStatus, self::VALID_TRANSITIONS[$current] ?? [], true)) {
            Response::error("Cannot move a '{$current}' order to '{$newStatus}'", 422);
        }

        $this->pdo->prepare('UPDATE orders SET status = :status WHERE id = :id')
            ->execute(['status' => $newStatus, 'id' => $id]);
        AuditLogger::log($this->pdo, $claims, 'update', 'orders', $id, ['status' => $newStatus]);
        Response::json($this->fetchOrder($id));
    }

    public function linkInvoice(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'orders.manage_status');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $invoiceId = $body['invoice_id'] ?? null;
        if (empty($invoiceId)) {
            Response::error('invoice_id is required', 422);
        }

        $stmt = $this->pdo->prepare('SELECT status FROM orders WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Order not found', 404);
        }

        $this->pdo->prepare("UPDATE orders SET invoice_id = :inv_id, status = 'completed' WHERE id = :id")
            ->execute(['inv_id' => $invoiceId, 'id' => $id]);
        AuditLogger::log($this->pdo, $claims, 'update', 'orders', (int) $id, ['invoice_id' => $invoiceId, 'status' => 'completed']);
        Response::json(['message' => 'Order linked to invoice and completed']);
    }

    /**
     * Dispatch an order directly into a Van Stock Loading Order.
     * Maps order_id, customer_id, employee_id and order items to a van order.
     */
    public function dispatchVan(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'orders.manage_status');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $order = $this->fetchOrder((int) $id);
        if (!$order) {
            Response::error('Order not found', 404);
        }
        if (!empty($order['van_order_id'])) {
            Response::error('Order is already dispatched to Van Order: ' . ($order['van_order_no'] ?? $order['van_order_id']), 422);
        }
        if (in_array($order['status'], ['cancelled', 'completed'], true)) {
            Response::error('Cannot dispatch an order with status ' . $order['status'], 422);
        }

        $vehicleId = !empty($body['vehicle_id']) ? (int) $body['vehicle_id'] : null;
        $vanNumber = !empty($body['van_number']) ? trim((string) $body['van_number']) : null;
        $routeLine = !empty($body['route_line']) ? trim((string) $body['route_line']) : null;

        if (empty($vehicleId) && empty($vanNumber)) {
            Response::error('Please enter a van number or choose a vehicle for van dispatch', 422);
        }

        $employeeId = !empty($body['employee_id']) ? (int) $body['employee_id'] : (!empty($order['assigned_to']) ? (int) $order['assigned_to'] : null);
        $orderDate = $body['order_date'] ?? date('Y-m-d');
        $notes = $body['notes'] ?? ('Dispatched from Pre-Order #' . $order['order_no']);

        $vanOrderController = new VanOrderController($this->pdo);
        $payload = [
            'vehicle_id' => $vehicleId,
            'van_number' => $vanNumber,
            'route_line' => $routeLine,
            'employee_id' => $employeeId,
            'order_id' => $order['id'],
            'customer_id' => $order['customer_id'],
            'order_date' => $orderDate,
            'notes' => $notes,
            'items' => array_map(function ($it) {
                return [
                    'product_id' => $it['product_id'],
                    'qty' => $it['qty'],
                    'rate' => $it['rate'],
                    'tax_percent' => $it['tax_percent'] ?? 0,
                    'discount_amount' => 0,
                ];
            }, $order['items'] ?? []),
        ];

        try {
            [$vanOrder, $statusCode] = $vanOrderController->createFromSync($payload, $claims);
            // Update order status to processing/ready
            $this->pdo->prepare("UPDATE orders SET status = 'processing', van_order_id = :vo_id WHERE id = :id")
                ->execute(['vo_id' => $vanOrder['id'], 'id' => $order['id']]);

            AuditLogger::log($this->pdo, $claims, 'dispatch_van', 'orders', (int) $order['id'], [
                'van_order_id' => $vanOrder['id'],
                'van_order_no' => $vanOrder['order_no'],
                'vehicle_id' => $vehicleId,
            ]);

            Response::json([
                'message' => 'Order successfully dispatched to van loading order',
                'van_order' => $vanOrder,
                'order' => $this->fetchOrder((int) $id),
            ], 201);
        } catch (\Throwable $e) {
            Response::error('Dispatch failed: ' . $e->getMessage(), 422);
        }
    }

    /** @param array<string, mixed> $body */
    private function createOrder(string $uuid, array $body): int
    {
        if (empty($body['customer_id'])) {
            throw new \RuntimeException('customer_id is required');
        }
        $items = $body['items'] ?? [];
        if (empty($items)) {
            throw new \RuntimeException('At least one item is required');
        }

        $customerCheck = $this->pdo->prepare('SELECT id FROM customers WHERE id = :id');
        $customerCheck->execute(['id' => $body['customer_id']]);
        if (!$customerCheck->fetch()) {
            throw new \RuntimeException('Customer not found');
        }

        $orderNo = 'ORD-' . date('ymd') . '-' . substr(str_replace('-', '', $uuid), 0, 6);
        $bookingSource = in_array($body['booking_source'] ?? '', ['direct', 'salesman', 'phone', 'whatsapp', 'walk_in'], true)
            ? $body['booking_source']
            : 'direct';

        $this->pdo->prepare(
            'INSERT INTO orders (uuid, order_no, customer_id, assigned_to, booking_source, status, notes, created_by)
             VALUES (:uuid, :order_no, :customer_id, :assigned_to, :booking_source, :status, :notes, :created_by)'
        )->execute([
            'uuid' => $uuid,
            'order_no' => $orderNo,
            'customer_id' => $body['customer_id'],
            'assigned_to' => !empty($body['assigned_to']) ? $body['assigned_to'] : null,
            'booking_source' => $bookingSource,
            'status' => 'processing',
            'notes' => $body['notes'] ?? null,
            'created_by' => $body['created_by'] ?? null,
        ]);
        $id = (int) $this->pdo->lastInsertId();

        $this->insertItems($id, $items);

        return $id;
    }

    /** @param array<string, mixed> $body */
    private function applyOrderUpdate(int $id, array $body): void
    {
        if (empty($body['customer_id'])) {
            throw new \RuntimeException('customer_id is required');
        }
        $items = $body['items'] ?? [];
        if (empty($items)) {
            throw new \RuntimeException('At least one item is required');
        }

        $bookingSource = in_array($body['booking_source'] ?? '', ['direct', 'salesman', 'phone', 'whatsapp', 'walk_in'], true)
            ? $body['booking_source']
            : 'direct';

        $this->pdo->prepare(
            'UPDATE orders SET customer_id = :customer_id, assigned_to = :assigned_to,
                booking_source = :booking_source, notes = :notes WHERE id = :id'
        )->execute([
            'customer_id' => $body['customer_id'],
            'assigned_to' => !empty($body['assigned_to']) ? $body['assigned_to'] : null,
            'booking_source' => $bookingSource,
            'notes' => $body['notes'] ?? null,
            'id' => $id,
        ]);

        $this->pdo->prepare('DELETE FROM order_items WHERE order_id = :id')->execute(['id' => $id]);
        $this->insertItems($id, $items);
    }

    /** @param array<int, array<string, mixed>> $items */
    private function insertItems(int $orderId, array $items): void
    {
        $productStmt = $this->pdo->prepare(
            'SELECT p.selling_price, COALESCE(t.percent, 0) AS tax_percent
             FROM products p LEFT JOIN tax_rates t ON t.id = p.tax_rate_id WHERE p.id = :id'
        );
        $insert = $this->pdo->prepare(
            'INSERT INTO order_items (order_id, product_id, qty, rate, tax_percent)
             VALUES (:order_id, :product_id, :qty, :rate, :tax_percent)'
        );

        foreach ($items as $item) {
            if (empty($item['product_id']) || empty($item['qty'])) {
                throw new \RuntimeException('Each line needs product_id and qty');
            }
            $productStmt->execute(['id' => $item['product_id']]);
            $product = $productStmt->fetch();
            if (!$product) {
                throw new \RuntimeException("Product {$item['product_id']} not found");
            }
            $rate = isset($item['rate']) && $item['rate'] !== '' ? (float) $item['rate'] : (float) $product['selling_price'];
            $insert->execute([
                'order_id' => $orderId,
                'product_id' => $item['product_id'],
                'qty' => (float) $item['qty'],
                'rate' => $rate,
                'tax_percent' => (float) $product['tax_percent'],
            ]);
        }
    }

    /** @return array<string, mixed>|null */
    private function fetchOrder(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT o.*, c.name AS customer_name, c.phone AS customer_phone,
                    u.full_name AS assigned_to_name, i.invoice_no, vo.order_no AS van_order_no
             FROM orders o
             JOIN customers c ON c.id = o.customer_id
             LEFT JOIN users u ON u.id = o.assigned_to
             LEFT JOIN invoices i ON i.id = o.invoice_id
             LEFT JOIN van_orders vo ON vo.id = o.van_order_id
             WHERE o.id = :id"
        );
        $stmt->execute(['id' => $id]);
        $order = $stmt->fetch();
        if (!$order) {
            return null;
        }

        $items = $this->pdo->prepare(
            "SELECT oi.*, p.name AS product_name, p.barcode, p.sku
             FROM order_items oi JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = :id"
        );
        $items->execute(['id' => $id]);
        $order['items'] = $items->fetchAll();
        $order['estimated_total'] = array_reduce(
            $order['items'],
            fn ($carry, $row) => $carry + ((float) $row['qty'] * (float) $row['rate'] * (1 + (float) $row['tax_percent'] / 100)),
            0.0
        );

        return $order;
    }
}
