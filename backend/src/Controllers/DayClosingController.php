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
 * Van Sales — Day Closing: locks a vehicle's reconciled day returns for a
 * given date so they can no longer be edited/cancelled directly. Blocks
 * closing while a loaded van order for that vehicle/date still has no
 * day return (an unreconciled stock difference), unless an authorized
 * user supplies an override reason.
 */
class DayClosingController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $stmt = $this->pdo->query(
            "SELECT dc.*, v.name AS vehicle_name, u.full_name AS created_by_name
             FROM day_closings dc JOIN vehicles v ON v.id = dc.vehicle_id
             LEFT JOIN users u ON u.id = dc.created_by
             ORDER BY dc.id DESC LIMIT 500"
        );
        Response::json($stmt->fetchAll());
    }

    public function show(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $closing = $this->fetchClosing((int) $id);
        if (!$closing) {
            Response::error('Day closing not found', 404);
        }
        Response::json($closing);
    }

    /** GET /van-sales/day-closing/preview?vehicle_id=&date= — what WOULD be closed. */
    public function preview(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $vehicleId = $_GET['vehicle_id'] ?? null;
        $date = $_GET['date'] ?? date('Y-m-d');
        if (!$vehicleId) {
            Response::error('vehicle_id is required', 422);
        }
        Response::json($this->buildPreview((int) $vehicleId, $date));
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_day_closing');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $vehicleId = (int) ($body['vehicle_id'] ?? 0);
        $date = $body['date'] ?? date('Y-m-d');
        if (!$vehicleId) {
            Response::error('vehicle_id is required', 422);
        }

        $preview = $this->buildPreview($vehicleId, $date);
        $overrideReason = $body['override_reason'] ?? null;
        if (!empty($preview['blocking_orders']) && empty($overrideReason)) {
            Response::error(
                'Cannot close the day while a loaded van order has no day return yet — provide an override_reason to force-close',
                422
            );
        }
        if (empty($preview['return_ids'])) {
            Response::error('No day returns to close for this vehicle/date', 422);
        }

        $this->pdo->beginTransaction();
        try {
            $uuid = UuidHelper::v4();
            $closingNo = 'DC-' . date('ymd') . '-' . substr(str_replace('-', '', $uuid), 0, 6);
            $this->pdo->prepare(
                'INSERT INTO day_closings (uuid, closing_no, closing_date, vehicle_id,
                    total_sold_value, total_returned_value, total_damaged_value, total_missing_value,
                    total_cash_collected, total_credit, amount_difference, stock_difference, override_reason, created_by)
                 VALUES (:uuid, :no, :date, :vehicle_id, :sold, :returned, :damaged, :missing,
                    :cash, :credit, :amt_diff, :stock_diff, :reason, :created_by)'
            )->execute([
                'uuid' => $uuid,
                'no' => $closingNo,
                'date' => $date,
                'vehicle_id' => $vehicleId,
                'sold' => $preview['total_sold_value'],
                'returned' => $preview['total_returned_value'],
                'damaged' => $preview['total_damaged_value'],
                'missing' => $preview['total_missing_value'],
                'cash' => $preview['total_cash_collected'],
                'credit' => $preview['total_credit'],
                'amt_diff' => $preview['amount_difference'],
                'stock_diff' => $preview['stock_difference'],
                'reason' => $overrideReason,
                'created_by' => $claims['uid'] ?? null,
            ]);
            $id = (int) $this->pdo->lastInsertId();

            $in = implode(',', array_fill(0, count($preview['return_ids']), '?'));
            $this->pdo->prepare("UPDATE day_returns SET day_closing_id = {$id} WHERE id IN ({$in})")
                ->execute($preview['return_ids']);

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'create', 'day_closings', $id, ['closing_no' => $closingNo, 'vehicle_id' => $vehicleId, 'date' => $date]);
            Response::json($this->fetchClosing($id), 201);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to close the day: ' . $e->getMessage(), 500);
        }
    }

    public function reopen(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_day_closing');
        $closing = $this->fetchClosing((int) $id);
        if (!$closing) {
            Response::error('Day closing not found', 404);
        }
        if ($closing['status'] === 'reopened') {
            Response::error('Day closing is already reopened', 422);
        }

        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare(
                "UPDATE day_closings SET status = 'reopened', reopened_at = NOW(), reopened_by = :uid WHERE id = :id"
            )->execute(['uid' => $claims['uid'] ?? null, 'id' => $id]);
            $this->pdo->prepare('UPDATE day_returns SET day_closing_id = NULL WHERE day_closing_id = :id')->execute(['id' => $id]);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'update', 'day_closings', (int) $id, ['status' => 'reopened']);
            Response::json($this->fetchClosing((int) $id));
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }

    /** @return array<string, mixed> */
    private function buildPreview(int $vehicleId, string $date): array
    {
        $returnsStmt = $this->pdo->prepare(
            "SELECT * FROM day_returns
             WHERE vehicle_id = :vid AND return_date = :date AND status = 'completed' AND day_closing_id IS NULL"
        );
        $returnsStmt->execute(['vid' => $vehicleId, 'date' => $date]);
        $returns = $returnsStmt->fetchAll();

        $totals = [
            'total_sold_value' => 0.0, 'total_returned_value' => 0.0, 'total_damaged_value' => 0.0,
            'total_missing_value' => 0.0, 'total_cash_collected' => 0.0, 'total_credit' => 0.0, 'amount_difference' => 0.0,
        ];
        $returnIds = [];
        foreach ($returns as $r) {
            $returnIds[] = $r['id'];
            $totals['total_sold_value'] += (float) $r['total_sold_value'];
            $totals['total_returned_value'] += (float) $r['total_returned_value'];
            $totals['total_damaged_value'] += (float) $r['total_damaged_value'];
            $totals['total_missing_value'] += (float) $r['total_missing_value'];
            $totals['total_cash_collected'] += (float) $r['amount_collected'];
            $totals['total_credit'] += (float) $r['credit_amount'];
            $totals['amount_difference'] += (float) $r['outstanding_amount'];
        }
        foreach ($totals as $k => $v) {
            $totals[$k] = round($v, 2);
        }

        $blockingStmt = $this->pdo->prepare(
            "SELECT id, order_no FROM van_orders WHERE vehicle_id = :vid AND status = 'loaded' AND order_date <= :date"
        );
        $blockingStmt->execute(['vid' => $vehicleId, 'date' => $date]);
        $blocking = $blockingStmt->fetchAll();

        return $totals + [
            'vehicle_id' => $vehicleId,
            'date' => $date,
            'return_ids' => $returnIds,
            'returns' => $returns,
            'blocking_orders' => $blocking,
            // Structurally always 0 here: sold_qty is defined as the exact
            // remainder (loaded - returned - damaged - missing), so the only
            // real "stock difference" risk is an order with no return yet
            // at all — caught separately via blocking_orders.
            'stock_difference' => 0,
        ];
    }

    /** @return array<string, mixed>|null */
    private function fetchClosing(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT dc.*, v.name AS vehicle_name, u.full_name AS created_by_name
             FROM day_closings dc JOIN vehicles v ON v.id = dc.vehicle_id
             LEFT JOIN users u ON u.id = dc.created_by
             WHERE dc.id = :id"
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $returns = $this->pdo->prepare(
            "SELECT dr.*, vo.order_no FROM day_returns dr JOIN van_orders vo ON vo.id = dr.van_order_id WHERE dr.day_closing_id = :id"
        );
        $returns->execute(['id' => $id]);
        $row['day_returns'] = $returns->fetchAll();
        return $row;
    }
}
