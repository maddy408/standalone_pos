<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Services\AuditLogger;
use PDO;

/** Van Sales — the Van Stock screen: what's currently (and was) on each vehicle. */
class VanStockController
{
    public function __construct(private PDO $pdo)
    {
    }

    /** GET /van-stock?vehicle_id=&from=&to= */
    public function index(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-d');
        $vehicleFilter = '';
        $params = ['from' => $from . ' 00:00:00', 'to' => $to . ' 23:59:59'];
        if (!empty($_GET['vehicle_id'])) {
            $vehicleFilter = ' AND vs.vehicle_id = :vehicle_id';
            $params['vehicle_id'] = $_GET['vehicle_id'];
        }

        // Current (live) balance per vehicle/product — the baseline rows we report on.
        $current = $this->pdo->prepare(
            "SELECT vs.vehicle_id, vs.product_id, vs.qty AS available_qty, v.name AS vehicle_name,
                    p.name AS product_name, p.barcode, p.sku
             FROM van_stock vs
             JOIN vehicles v ON v.id = vs.vehicle_id
             JOIN products p ON p.id = vs.product_id
             WHERE 1=1 {$vehicleFilter}
             ORDER BY v.name, p.name"
        );
        $current->execute(array_diff_key($params, ['from' => 0, 'to' => 0]));
        $rows = $current->fetchAll();

        // Opening balance = live balance minus every movement that falls inside the window.
        $movementFilter = '';
        $moveParams = ['from' => $params['from'], 'to' => $params['to']];
        if (!empty($_GET['vehicle_id'])) {
            $movementFilter = ' AND vehicle_id = :vehicle_id';
            $moveParams['vehicle_id'] = $_GET['vehicle_id'];
        }
        $agg = $this->pdo->prepare(
            "SELECT vehicle_id, product_id, movement_type, SUM(qty_change) AS total
             FROM van_stock_movements
             WHERE created_at BETWEEN :from AND :to {$movementFilter}
             GROUP BY vehicle_id, product_id, movement_type"
        );
        $agg->execute($moveParams);
        $byKey = [];
        foreach ($agg->fetchAll() as $a) {
            $key = $a['vehicle_id'] . ':' . $a['product_id'];
            $byKey[$key][$a['movement_type']] = (float) $a['total'];
        }

        // Sold quantity isn't its own movement type — it's the reconciled
        // remainder recorded on day_return_items when a return is posted.
        $vehicleFilter2 = '';
        $soldParams = ['from2' => $from, 'to2' => $to];
        if (!empty($_GET['vehicle_id'])) {
            $vehicleFilter2 = ' AND dr.vehicle_id = :vehicle_id2';
            $soldParams['vehicle_id2'] = $_GET['vehicle_id'];
        }
        $soldStmt = $this->pdo->prepare(
            "SELECT dr.vehicle_id, dri.product_id, SUM(dri.sold_qty) AS sold
             FROM day_return_items dri JOIN day_returns dr ON dr.id = dri.day_return_id
             WHERE dr.status = 'completed' AND dr.return_date BETWEEN :from2 AND :to2 {$vehicleFilter2}
             GROUP BY dr.vehicle_id, dri.product_id"
        );
        $soldStmt->execute($soldParams);
        $soldByKey = [];
        foreach ($soldStmt->fetchAll() as $s) {
            $soldByKey[$s['vehicle_id'] . ':' . $s['product_id']] = (float) $s['sold'];
        }

        foreach ($rows as &$row) {
            $key = $row['vehicle_id'] . ':' . $row['product_id'];
            $m = $byKey[$key] ?? [];
            $loaded = $m['load'] ?? 0.0;
            $returned = abs($m['return'] ?? 0.0);
            $damaged = abs($m['damage'] ?? 0.0);
            $missing = abs($m['missing'] ?? 0.0);
            $netInWindow = array_sum($m);
            $row['opening_qty'] = round((float) $row['available_qty'] - $netInWindow, 3);
            $row['loaded_qty'] = $loaded;
            $row['sold_qty'] = $soldByKey[$key] ?? 0.0;
            $row['returned_qty'] = $returned;
            $row['damaged_qty'] = $damaged;
            $row['missing_qty'] = $missing;
        }

        Response::json($rows);
    }

    /** GET /van-stock/movements?vehicle_id=&product_id= */
    public function movements(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.view');
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['vehicle_id'])) {
            $where .= ' AND vsm.vehicle_id = :vehicle_id';
            $params['vehicle_id'] = $_GET['vehicle_id'];
        }
        if (!empty($_GET['product_id'])) {
            $where .= ' AND vsm.product_id = :product_id';
            $params['product_id'] = $_GET['product_id'];
        }
        $stmt = $this->pdo->prepare(
            "SELECT vsm.*, v.name AS vehicle_name, p.name AS product_name, u.full_name AS user_name
             FROM van_stock_movements vsm
             JOIN vehicles v ON v.id = vsm.vehicle_id
             JOIN products p ON p.id = vsm.product_id
             LEFT JOIN users u ON u.id = vsm.user_id
             {$where}
             ORDER BY vsm.created_at DESC, vsm.id DESC LIMIT 500"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    /** Manual van stock correction (e.g. a miscount found during audit) — idempotent by uuid. */
    public function adjust(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_orders');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $vehicleId = (int) ($body['vehicle_id'] ?? 0);
        $productId = (int) ($body['product_id'] ?? 0);
        $qtyChange = (float) ($body['qty_change'] ?? 0);
        if (!$vehicleId || !$productId || $qtyChange === 0.0) {
            Response::error('vehicle_id, product_id and a non-zero qty_change are required', 422);
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM van_stock_movements WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($existing->fetch()) {
            Response::json(['ok' => true, 'duplicate' => true]);
        }

        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare(
                'INSERT INTO van_stock (vehicle_id, product_id, qty) VALUES (:vid, :pid, :qty)
                 ON DUPLICATE KEY UPDATE qty = qty + :qty2'
            )->execute(['vid' => $vehicleId, 'pid' => $productId, 'qty' => $qtyChange, 'qty2' => $qtyChange]);

            $this->pdo->prepare(
                "INSERT INTO van_stock_movements (uuid, vehicle_id, product_id, qty_change, movement_type, ref_type, notes, user_id)
                 VALUES (:uuid, :vid, :pid, :qty, 'adjustment', 'manual', :notes, :uid)"
            )->execute([
                'uuid' => $uuid, 'vid' => $vehicleId, 'pid' => $productId, 'qty' => $qtyChange,
                'notes' => $body['reason'] ?? null, 'uid' => $claims['uid'] ?? null,
            ]);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'adjust', 'van_stock', $vehicleId, ['product_id' => $productId, 'qty_change' => $qtyChange, 'reason' => $body['reason'] ?? null]);
            Response::json(['ok' => true], 201);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to adjust van stock: ' . $e->getMessage(), 500);
        }
    }
}
