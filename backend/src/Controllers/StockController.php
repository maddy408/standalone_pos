<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\PermissionDeniedException;
use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Services\AuditLogger;
use PDO;

class StockController
{
    public function __construct(private PDO $pdo)
    {
    }

    /** GET /api/stock/movements?product_id=.. */
    public function movements(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'inventory.view');
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['product_id'])) {
            $where .= ' AND sm.product_id = :pid';
            $params['pid'] = $_GET['product_id'];
        }
        if (!empty($_GET['business_type'])) {
            $where .= ' AND p.business_type = :bt';
            $params['bt'] = $_GET['business_type'];
        }
        $stmt = $this->pdo->prepare(
            "SELECT sm.*, p.name AS product_name FROM stock_movements sm
             JOIN products p ON p.id = sm.product_id {$where}
             ORDER BY sm.created_at DESC, sm.id DESC LIMIT 500"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    /** GET /api/stock/low — products at/below their low stock threshold. */
    public function lowStock(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'inventory.view');
        $where = "WHERE p.is_active = 1
               AND p.stock_qty <= COALESCE(p.low_stock_threshold, s.low_stock_threshold, 5)";
        $params = [];
        if (!empty($_GET['business_type'])) {
            $where .= ' AND p.business_type = :bt';
            $params['bt'] = $_GET['business_type'];
        }
        $stmt = $this->pdo->prepare(
            "SELECT p.*, COALESCE(p.low_stock_threshold, s.low_stock_threshold, 5) AS effective_threshold
             FROM products p
             LEFT JOIN business_settings s ON s.id = 1
             {$where}
             ORDER BY p.stock_qty ASC"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    /** Manual stock-in/out adjustment — idempotent by uuid for offline replay. */
    public function adjust(): void
    {
        $claims = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            [$result, $status] = $this->adjustFromSync($body, $claims);
            if ($status === 201) {
                AuditLogger::log($this->pdo, $claims, 'adjust', 'products', (int) ($body['product_id'] ?? 0), [
                    'qty_change' => $body['qty_change'] ?? null,
                    'reason' => $body['reason'] ?? null,
                ]);
            }
            Response::json($result, $status);
        } catch (PermissionDeniedException $e) {
            Response::error($e->getMessage(), 403);
        } catch (\Throwable $e) {
            Response::error('Failed to adjust stock: ' . $e->getMessage(), 500);
        }
    }

    /** @param array<string, mixed> $body @param array<string, mixed> $claims @return array{0: array<string, mixed>, 1: int} */
    public function adjustFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'inventory.adjust');
        $productId = (int) ($body['product_id'] ?? 0);
        $qtyChange = (float) ($body['qty_change'] ?? 0);
        if (!$productId || $qtyChange === 0.0) {
            throw new \InvalidArgumentException('product_id and a non-zero qty_change are required');
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM stock_movements WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($existing->fetch()) {
            return [['ok' => true, 'duplicate' => true], 200];
        }

        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty + :qty WHERE id = :id')
                ->execute(['qty' => $qtyChange, 'id' => $productId]);

            // If new barcode or dates provided, update product active metadata if present
            $mfgDate = !empty($body['mfg_date']) ? $body['mfg_date'] : null;
            $expDate = !empty($body['exp_date']) ? $body['exp_date'] : null;
            $barcode = !empty($body['barcode']) ? trim($body['barcode']) : null;

            if ($barcode || $mfgDate || $expDate) {
                $updates = [];
                $uParams = ['id' => $productId];
                if ($barcode) {
                    $updates[] = 'barcode = :barcode';
                    $uParams['barcode'] = $barcode;
                }
                if ($mfgDate) {
                    $updates[] = 'mfg_date = :mfg';
                    $uParams['mfg'] = $mfgDate;
                }
                if ($expDate) {
                    $updates[] = 'exp_date = :exp';
                    $uParams['exp'] = $expDate;
                }
                if (!empty($updates)) {
                    $this->pdo->prepare('UPDATE products SET ' . implode(', ', $updates) . ' WHERE id = :id')
                        ->execute($uParams);
                }
            }

            // Dynamically check columns on stock_movements
            $smCols = $this->pdo->query('DESCRIBE stock_movements')->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $hasSmMfg = in_array('mfg_date', $smCols, true);
            $hasSmExp = in_array('exp_date', $smCols, true);
            $hasSmBarcode = in_array('barcode', $smCols, true);

            $extraCols = '';
            $extraVals = '';
            $insertParams = [
                'uuid' => $uuid,
                'pid' => $productId,
                'qty' => $qtyChange,
                'notes' => $body['reason'] ?? null,
                'user_id' => $claims['uid'],
            ];

            if ($hasSmMfg) {
                $extraCols .= ', mfg_date';
                $extraVals .= ', :mfg';
                $insertParams['mfg'] = $mfgDate;
            }
            if ($hasSmExp) {
                $extraCols .= ', exp_date';
                $extraVals .= ', :exp';
                $insertParams['exp'] = $expDate;
            }
            if ($hasSmBarcode) {
                $extraCols .= ', barcode';
                $extraVals .= ', :barcode';
                $insertParams['barcode'] = $barcode;
            }

            $this->pdo->prepare(
                "INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, notes, user_id{$extraCols})
                 VALUES (:uuid, :pid, :qty, 'adjustment', 'manual', :notes, :user_id{$extraVals})"
            )->execute($insertParams);
            $this->pdo->commit();
            return [['ok' => true], 201];
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function destroyMovement(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'inventory.adjust');

        $stmt = $this->pdo->prepare('SELECT * FROM stock_movements WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $mov = $stmt->fetch();
        if (!$mov) {
            Response::error('Movement record not found', 404);
        }

        $this->pdo->beginTransaction();
        try {
            // Revert stock on the product
            $qty = (float) $mov['qty_change'];
            $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty - :qty WHERE id = :pid')
                ->execute(['qty' => $qty, 'pid' => $mov['product_id']]);

            $this->pdo->prepare('DELETE FROM stock_movements WHERE id = :id')->execute(['id' => $id]);
            $this->pdo->commit();
            Response::json(['ok' => true]);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to delete movement: ' . $e->getMessage(), 500);
        }
    }
}
