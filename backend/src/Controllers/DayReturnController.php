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
 * Van Sales — Day Return: end-of-day reconciliation of a loaded van order.
 * For each line: returned (good, back to warehouse), damaged (write-off,
 * never re-enters saleable stock), missing (shortage, never re-enters
 * saleable stock) — sold_qty is always the computed remainder
 * (loaded - returned - damaged - missing), never a separate manual entry,
 * so stock reconciliation can never drift from what was actually loaded.
 */
class DayReturnController
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
        if (!empty($_GET['vehicle_id'])) {
            $where .= ' AND dr.vehicle_id = :vehicle_id';
            $params['vehicle_id'] = $_GET['vehicle_id'];
        }
        if (!empty($_GET['from'])) {
            $where .= ' AND dr.return_date >= :from';
            $params['from'] = $_GET['from'];
        }
        if (!empty($_GET['to'])) {
            $where .= ' AND dr.return_date <= :to';
            $params['to'] = $_GET['to'];
        }
        $stmt = $this->pdo->prepare(
            "SELECT dr.*, v.name AS vehicle_name, vo.order_no, emp.full_name AS employee_name, c.name AS customer_name
             FROM day_returns dr
             JOIN vehicles v ON v.id = dr.vehicle_id
             JOIN van_orders vo ON vo.id = dr.van_order_id
             LEFT JOIN users emp ON emp.id = vo.employee_id
             LEFT JOIN customers c ON c.id = vo.customer_id
             {$where}
             ORDER BY dr.id DESC LIMIT 1000"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function show(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $row = $this->fetchReturn((int) $id);
        if (!$row) {
            Response::error('Day return not found', 404);
        }
        Response::json($row);
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            [$row, $status] = $this->createFromSync($body, $claims);
            Response::json($row, $status);
        } catch (ValidationException $e) {
            Response::error($e->getMessage(), 422);
        } catch (\Throwable $e) {
            Response::error('Failed to save day return: ' . $e->getMessage(), 500);
        }
    }

    /** @param array<string, mixed> $body @param array<string, mixed> $claims @return array{0: array<string, mixed>, 1: int} */
    public function createFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'van_sales.manage_returns');
        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM day_returns WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [$this->fetchReturn((int) $row['id']), 200];
        }

        if (empty($body['van_order_id'])) {
            throw new ValidationException('van_order_id is required');
        }
        $orderStmt = $this->pdo->prepare(
            "SELECT vo.*, v.name AS vehicle_name FROM van_orders vo JOIN vehicles v ON v.id = vo.vehicle_id WHERE vo.id = :id"
        );
        $orderStmt->execute(['id' => $body['van_order_id']]);
        $order = $orderStmt->fetch();
        if (!$order) {
            throw new ValidationException('Van order not found');
        }
        if ($order['status'] !== 'loaded') {
            throw new ValidationException("Cannot return against a van order that is '{$order['status']}' — it must be 'loaded' first");
        }
        $dup = $this->pdo->prepare("SELECT id FROM day_returns WHERE van_order_id = :id AND status = 'completed'");
        $dup->execute(['id' => $order['id']]);
        if ($dup->fetch()) {
            throw new ValidationException('This van order already has a completed day return');
        }

        $orderItems = $this->pdo->prepare('SELECT * FROM van_order_items WHERE van_order_id = :id');
        $orderItems->execute(['id' => $order['id']]);
        $loadedByProduct = [];
        foreach ($orderItems->fetchAll() as $oi) {
            $loadedByProduct[(int) $oi['product_id']] = $oi;
        }

        $items = $body['items'] ?? [];
        if (empty($items)) {
            throw new ValidationException('At least one item is required');
        }

        $this->pdo->beginTransaction();
        try {
            $rows = [];
            $totalSoldValue = 0.0;
            $totalReturnedValue = 0.0;
            $totalDamagedValue = 0.0;
            $totalMissingValue = 0.0;

            foreach ($items as $item) {
                $productId = (int) ($item['product_id'] ?? 0);
                if (!isset($loadedByProduct[$productId])) {
                    throw new ValidationException("Product {$productId} was not part of the loaded order");
                }
                $loadedQty = (float) $loadedByProduct[$productId]['qty'];
                // Effective tax-inclusive per-unit value (line_total already
                // folds in that line's discount + tax) so sold/returned/
                // damaged/missing values reconcile against real cash, not a
                // pre-tax figure that would always leave a phantom GST gap.
                $unitPrice = $loadedQty > 0 ? (float) $loadedByProduct[$productId]['line_total'] / $loadedQty : 0.0;
                $returnedQty = (float) ($item['returned_qty'] ?? 0);
                $damagedQty = (float) ($item['damaged_qty'] ?? 0);
                $missingQty = (float) ($item['missing_qty'] ?? 0);
                $soldQty = $loadedQty - $returnedQty - $damagedQty - $missingQty;
                if ($soldQty < -0.001) {
                    throw new ValidationException("Returned + damaged + missing exceeds the loaded quantity for product {$productId}");
                }
                $soldQty = max(0, round($soldQty, 3));

                $rows[] = [
                    'product_id' => $productId,
                    'loaded_qty' => $loadedQty,
                    'returned_qty' => $returnedQty,
                    'damaged_qty' => $damagedQty,
                    'missing_qty' => $missingQty,
                    'sold_qty' => $soldQty,
                    'unit_price' => $unitPrice,
                ];
                $totalSoldValue += $soldQty * $unitPrice;
                $totalReturnedValue += $returnedQty * $unitPrice;
                $totalDamagedValue += $damagedQty * $unitPrice;
                $totalMissingValue += $missingQty * $unitPrice;
            }

            $amountCollected = round((float) ($body['amount_collected'] ?? 0), 2);
            $creditAmount = round((float) ($body['credit_amount'] ?? 0), 2);
            $otherAdjustment = round((float) ($body['other_adjustment'] ?? 0), 2);
            $totalSoldValue = round($totalSoldValue, 2);
            $outstanding = round($totalSoldValue - $amountCollected - $creditAmount - $otherAdjustment, 2);

            $returnNo = 'DR-' . date('ymd') . '-' . substr(str_replace('-', '', $uuid), 0, 6);
            $this->pdo->prepare(
                'INSERT INTO day_returns (uuid, return_no, return_date, vehicle_id, van_order_id,
                    total_sold_value, total_returned_value, total_damaged_value, total_missing_value,
                    amount_collected, credit_amount, other_adjustment, adjustment_reason, outstanding_amount, notes, created_by)
                 VALUES (:uuid, :no, :date, :vehicle_id, :order_id,
                    :sold_v, :returned_v, :damaged_v, :missing_v,
                    :collected, :credit, :other_adj, :adj_reason, :outstanding, :notes, :created_by)'
            )->execute([
                'uuid' => $uuid,
                'no' => $returnNo,
                'date' => $body['return_date'] ?? date('Y-m-d'),
                'vehicle_id' => $order['vehicle_id'],
                'order_id' => $order['id'],
                'sold_v' => $totalSoldValue,
                'returned_v' => round($totalReturnedValue, 2),
                'damaged_v' => round($totalDamagedValue, 2),
                'missing_v' => round($totalMissingValue, 2),
                'collected' => $amountCollected,
                'credit' => $creditAmount,
                'other_adj' => $otherAdjustment,
                'adj_reason' => $body['adjustment_reason'] ?? null,
                'outstanding' => $outstanding,
                'notes' => $body['notes'] ?? null,
                'created_by' => $claims['uid'] ?? null,
            ]);
            $id = (int) $this->pdo->lastInsertId();

            $this->insertItemsAndMovements($id, $order, $rows, $claims, false);

            $this->pdo->prepare("UPDATE van_orders SET status = 'completed' WHERE id = :id")->execute(['id' => $order['id']]);

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'create', 'day_returns', $id, ['return_no' => $returnNo]);
            return [$this->fetchReturn($id), 201];
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /** Edit before the day closing locks it in — reverses the old movement, applies the new one. */
    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_returns');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $current = $this->fetchReturn((int) $id);
        if (!$current) {
            Response::error('Day return not found', 404);
        }
        if ($current['status'] !== 'completed') {
            Response::error("Cannot edit a day return that is '{$current['status']}'", 422);
        }
        if ($current['day_closing_id']) {
            Response::error('This day has already been closed — reopen the day closing to correct it', 409);
        }

        $items = $body['items'] ?? [];
        if (empty($items)) {
            Response::error('At least one item is required', 422);
        }

        $this->pdo->beginTransaction();
        try {
            $this->reverseReturn($current, $claims);

            $orderItems = $this->pdo->prepare('SELECT * FROM van_order_items WHERE van_order_id = :id');
            $orderItems->execute(['id' => $current['van_order_id']]);
            $loadedByProduct = [];
            foreach ($orderItems->fetchAll() as $oi) {
                $loadedByProduct[(int) $oi['product_id']] = $oi;
            }

            $rows = [];
            $totalSoldValue = 0.0;
            $totalReturnedValue = 0.0;
            $totalDamagedValue = 0.0;
            $totalMissingValue = 0.0;
            foreach ($items as $item) {
                $productId = (int) ($item['product_id'] ?? 0);
                if (!isset($loadedByProduct[$productId])) {
                    throw new \RuntimeException("Product {$productId} was not part of the loaded order");
                }
                $loadedQty = (float) $loadedByProduct[$productId]['qty'];
                $unitPrice = $loadedQty > 0 ? (float) $loadedByProduct[$productId]['line_total'] / $loadedQty : 0.0;
                $returnedQty = (float) ($item['returned_qty'] ?? 0);
                $damagedQty = (float) ($item['damaged_qty'] ?? 0);
                $missingQty = (float) ($item['missing_qty'] ?? 0);
                $soldQty = $loadedQty - $returnedQty - $damagedQty - $missingQty;
                if ($soldQty < -0.001) {
                    throw new \RuntimeException("Returned + damaged + missing exceeds the loaded quantity for product {$productId}");
                }
                $soldQty = max(0, round($soldQty, 3));
                $rows[] = [
                    'product_id' => $productId, 'loaded_qty' => $loadedQty, 'returned_qty' => $returnedQty,
                    'damaged_qty' => $damagedQty, 'missing_qty' => $missingQty, 'sold_qty' => $soldQty, 'unit_price' => $unitPrice,
                ];
                $totalSoldValue += $soldQty * $unitPrice;
                $totalReturnedValue += $returnedQty * $unitPrice;
                $totalDamagedValue += $damagedQty * $unitPrice;
                $totalMissingValue += $missingQty * $unitPrice;
            }

            $amountCollected = round((float) ($body['amount_collected'] ?? $current['amount_collected']), 2);
            $creditAmount = round((float) ($body['credit_amount'] ?? $current['credit_amount']), 2);
            $otherAdjustment = round((float) ($body['other_adjustment'] ?? $current['other_adjustment']), 2);
            $totalSoldValue = round($totalSoldValue, 2);
            $outstanding = round($totalSoldValue - $amountCollected - $creditAmount - $otherAdjustment, 2);

            $this->pdo->prepare(
                'UPDATE day_returns SET total_sold_value = :sold_v, total_returned_value = :returned_v,
                    total_damaged_value = :damaged_v, total_missing_value = :missing_v,
                    amount_collected = :collected, credit_amount = :credit, other_adjustment = :other_adj,
                    adjustment_reason = :adj_reason, outstanding_amount = :outstanding, notes = :notes
                 WHERE id = :id'
            )->execute([
                'sold_v' => $totalSoldValue,
                'returned_v' => round($totalReturnedValue, 2),
                'damaged_v' => round($totalDamagedValue, 2),
                'missing_v' => round($totalMissingValue, 2),
                'collected' => $amountCollected,
                'credit' => $creditAmount,
                'other_adj' => $otherAdjustment,
                'adj_reason' => $body['adjustment_reason'] ?? $current['adjustment_reason'],
                'outstanding' => $outstanding,
                'notes' => $body['notes'] ?? $current['notes'],
                'id' => $id,
            ]);

            $order = ['id' => $current['van_order_id'], 'vehicle_id' => $current['vehicle_id'], 'order_no' => $current['order_no']];
            $this->insertItemsAndMovements((int) $id, $order, $rows, $claims, true);

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'update', 'day_returns', (int) $id);
            Response::json($this->fetchReturn((int) $id));
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function cancel(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_returns');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $current = $this->fetchReturn((int) $id);
        if (!$current) {
            Response::error('Day return not found', 404);
        }
        if ($current['status'] === 'cancelled') {
            Response::error('Day return is already cancelled', 422);
        }
        if ($current['day_closing_id']) {
            Response::error('This day has already been closed — reopen the day closing to correct it', 409);
        }

        $this->pdo->beginTransaction();
        try {
            $this->reverseReturn($current, $claims);
            $this->pdo->prepare(
                "UPDATE day_returns SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = :reason WHERE id = :id"
            )->execute(['reason' => $body['reason'] ?? null, 'id' => $id]);
            // The order goes back to 'loaded' — its stock is still out on the van, waiting for a fresh return.
            $this->pdo->prepare("UPDATE van_orders SET status = 'loaded' WHERE id = :id")->execute(['id' => $current['van_order_id']]);

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'cancel', 'day_returns', (int) $id, ['reason' => $body['reason'] ?? null]);
            Response::json($this->fetchReturn((int) $id));
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        }
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_returns');
        $current = $this->fetchReturn((int) $id);
        if (!$current) {
            Response::error('Day return not found', 404);
        }
        if ($current['status'] !== 'cancelled') {
            Response::error('Only a cancelled day return can be deleted', 422);
        }
        $this->pdo->prepare('DELETE FROM day_return_items WHERE day_return_id = :id')->execute(['id' => $id]);
        $this->pdo->prepare('DELETE FROM day_returns WHERE id = :id')->execute(['id' => $id]);
        AuditLogger::log($this->pdo, $claims, 'delete', 'day_returns', (int) $id);
        Response::json(['ok' => true]);
    }

    // -------------------------------------------------------------------

    /** @param array<string, mixed> $order @param array<int, array<string, mixed>> $rows @param array<string, mixed> $claims */
    private function insertItemsAndMovements(int $returnId, array $order, array $rows, array $claims, bool $isReapply): void
    {
        $insert = $this->pdo->prepare(
            'INSERT INTO day_return_items (day_return_id, product_id, loaded_qty, returned_qty, damaged_qty, missing_qty, sold_qty, unit_price)
             VALUES (:return_id, :product_id, :loaded_qty, :returned_qty, :damaged_qty, :missing_qty, :sold_qty, :unit_price)'
        );
        foreach ($rows as $row) {
            $insert->execute(['return_id' => $returnId, ...$row]);

            $returnedQty = (float) $row['returned_qty'];
            $damagedQty = (float) $row['damaged_qty'];
            $missingQty = (float) $row['missing_qty'];
            $soldQty = (float) $row['sold_qty'];
            $productId = $row['product_id'];
            $label = $isReapply ? 'corrected' : 'recorded';

            if ($returnedQty > 0) {
                $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty + :qty WHERE id = :id')
                    ->execute(['qty' => $returnedQty, 'id' => $productId]);
                $this->pdo->prepare(
                    "INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, ref_id, notes, user_id)
                     VALUES (:uuid, :pid, :qty, 'van_return', 'day_returns', :ref_id, :notes, :uid)"
                )->execute([
                    'uuid' => UuidHelper::v4(), 'pid' => $productId, 'qty' => $returnedQty, 'ref_id' => $returnId,
                    'notes' => "Day return {$label} from {$order['order_no']}", 'uid' => $claims['uid'] ?? null,
                ]);
            }

            // The van's book balance clears by the FULL loaded quantity —
            // sold units left via a sale, returned units went back to the
            // warehouse, damaged/missing units are written off. Whatever was
            // loaded is now fully accounted for; nothing should linger.
            $vanDelta = $returnedQty + $damagedQty + $missingQty + $soldQty;
            if ($vanDelta > 0) {
                $this->pdo->prepare('UPDATE van_stock SET qty = qty - :qty WHERE vehicle_id = :vid AND product_id = :pid')
                    ->execute(['qty' => $vanDelta, 'vid' => $order['vehicle_id'], 'pid' => $productId]);
            }
            foreach ([['return', $returnedQty], ['damage', $damagedQty], ['missing', $missingQty], ['sale', $soldQty]] as [$type, $qty]) {
                if ($qty <= 0) {
                    continue;
                }
                $this->pdo->prepare(
                    "INSERT INTO van_stock_movements (uuid, vehicle_id, product_id, qty_change, movement_type, ref_type, ref_id, notes, user_id)
                     VALUES (:uuid, :vid, :pid, :qty, :type, 'day_returns', :ref_id, :notes, :uid)"
                )->execute([
                    'uuid' => UuidHelper::v4(), 'vid' => $order['vehicle_id'], 'pid' => $productId, 'qty' => -$qty, 'type' => $type,
                    'ref_id' => $returnId, 'notes' => "Day return {$label}", 'uid' => $claims['uid'] ?? null,
                ]);
            }
        }
    }

    /** Puts warehouse/van stock back to how they were before this return was recorded. */
    private function reverseReturn(array $current, array $claims): void
    {
        $items = $this->pdo->prepare('SELECT * FROM day_return_items WHERE day_return_id = :id');
        $items->execute(['id' => $current['id']]);
        foreach ($items->fetchAll() as $item) {
            $returnedQty = (float) $item['returned_qty'];
            $damagedQty = (float) $item['damaged_qty'];
            $missingQty = (float) $item['missing_qty'];
            $soldQty = (float) $item['sold_qty'];
            $productId = $item['product_id'];

            if ($returnedQty > 0) {
                $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty - :qty WHERE id = :id')
                    ->execute(['qty' => $returnedQty, 'id' => $productId]);
                $this->pdo->prepare(
                    "INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, ref_id, notes, user_id)
                     VALUES (:uuid, :pid, :qty, 'van_return', 'day_returns', :ref_id, :notes, :uid)"
                )->execute([
                    'uuid' => UuidHelper::v4(), 'pid' => $productId, 'qty' => -$returnedQty, 'ref_id' => $current['id'],
                    'notes' => 'Reversed for edit/cancel of day return ' . $current['return_no'], 'uid' => $claims['uid'] ?? null,
                ]);
            }

            $vanDelta = $returnedQty + $damagedQty + $missingQty + $soldQty;
            if ($vanDelta > 0) {
                $this->pdo->prepare(
                    'INSERT INTO van_stock (vehicle_id, product_id, qty) VALUES (:vid, :pid, :qty)
                     ON DUPLICATE KEY UPDATE qty = qty + :qty2'
                )->execute(['vid' => $current['vehicle_id'], 'pid' => $productId, 'qty' => $vanDelta, 'qty2' => $vanDelta]);
                $this->pdo->prepare(
                    "INSERT INTO van_stock_movements (uuid, vehicle_id, product_id, qty_change, movement_type, ref_type, ref_id, notes, user_id)
                     VALUES (:uuid, :vid, :pid, :qty, 'adjustment', 'day_returns', :ref_id, :notes, :uid)"
                )->execute([
                    'uuid' => UuidHelper::v4(), 'vid' => $current['vehicle_id'], 'pid' => $productId, 'qty' => $vanDelta,
                    'ref_id' => $current['id'], 'notes' => 'Reversed for edit/cancel of day return ' . $current['return_no'], 'uid' => $claims['uid'] ?? null,
                ]);
            }
        }
        $this->pdo->prepare('DELETE FROM day_return_items WHERE day_return_id = :id')->execute(['id' => $current['id']]);
    }

    /** @return array<string, mixed>|null */
    private function fetchReturn(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT dr.*, v.name AS vehicle_name, vo.order_no, emp.full_name AS employee_name, c.name AS customer_name
             FROM day_returns dr
             JOIN vehicles v ON v.id = dr.vehicle_id
             JOIN van_orders vo ON vo.id = dr.van_order_id
             LEFT JOIN users emp ON emp.id = vo.employee_id
             LEFT JOIN customers c ON c.id = vo.customer_id
             WHERE dr.id = :id"
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $items = $this->pdo->prepare(
            "SELECT dri.*, p.name AS product_name
             FROM day_return_items dri JOIN products p ON p.id = dri.product_id
             WHERE dri.day_return_id = :id"
        );
        $items->execute(['id' => $id]);
        $row['items'] = $items->fetchAll();
        return $row;
    }
}
