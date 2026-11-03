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

class PurchaseReturnController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->query(
            "SELECT pr.*, p.purchase_no FROM purchase_returns pr
             JOIN purchases p ON p.id = pr.purchase_id ORDER BY pr.created_at DESC LIMIT 200"
        );
        Response::json($stmt->fetchAll());
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'purchases.return');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['purchase_id']) || empty($body['items'])) {
            Response::error('purchase_id and items are required', 422);
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM purchase_returns WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            Response::json(['id' => $row['id']], 200);
        }

        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare(
                'INSERT INTO purchase_returns (uuid, purchase_id, user_id, total_amount, reason) VALUES (:uuid, :purchase_id, :user_id, 0, :reason)'
            )->execute([
                'uuid' => $uuid,
                'purchase_id' => $body['purchase_id'],
                'user_id' => $claims['uid'],
                'reason' => $body['reason'] ?? null,
            ]);
            $returnId = (int) $this->pdo->lastInsertId();

            $itemStmt = $this->pdo->prepare('SELECT * FROM purchase_items WHERE id = :id');
            $insertReturnItem = $this->pdo->prepare(
                'INSERT INTO purchase_return_items (purchase_return_id, purchase_item_id, qty, amount) VALUES (:rid, :iid, :qty, :amount)'
            );

            $totalAmount = 0.0;
            foreach ($body['items'] as $item) {
                $itemStmt->execute(['id' => $item['purchase_item_id']]);
                $purchaseItem = $itemStmt->fetch();
                if (!$purchaseItem) {
                    throw new ValidationException('Purchase item not found');
                }
                $qty = (float) $item['qty'];
                if ($qty <= 0 || $qty > (float) $purchaseItem['qty']) {
                    throw new ValidationException('Invalid return quantity');
                }
                $unitValue = (float) $purchaseItem['line_total'] / (float) $purchaseItem['qty'];
                $amount = round($unitValue * $qty, 2);
                $totalAmount += $amount;

                $insertReturnItem->execute(['rid' => $returnId, 'iid' => $purchaseItem['id'], 'qty' => $qty, 'amount' => $amount]);

                $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty - :qty WHERE id = :id')
                    ->execute(['qty' => $qty, 'id' => $purchaseItem['product_id']]);

                $this->pdo->prepare(
                    "INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, ref_id, user_id)
                     VALUES (:uuid, :pid, :qty, 'purchase_return', 'purchase_returns', :ref_id, :user_id)"
                )->execute([
                    'uuid' => UuidHelper::v4(),
                    'pid' => $purchaseItem['product_id'],
                    'qty' => -$qty,
                    'ref_id' => $returnId,
                    'user_id' => $claims['uid'],
                ]);
            }

            $totalAmount = round($totalAmount, 2);
            $this->pdo->prepare('UPDATE purchase_returns SET total_amount = :amt WHERE id = :id')
                ->execute(['amt' => $totalAmount, 'id' => $returnId]);

            $purchase = $this->pdo->prepare('SELECT supplier_id FROM purchases WHERE id = :id');
            $purchase->execute(['id' => $body['purchase_id']]);
            $supplierId = $purchase->fetchColumn();
            if ($supplierId) {
                $this->pdo->prepare('UPDATE suppliers SET balance = balance - :amt WHERE id = :id')
                    ->execute(['amt' => $totalAmount, 'id' => $supplierId]);
            }

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'create', 'purchase_returns', $returnId, ['purchase_id' => $body['purchase_id'], 'total_amount' => $totalAmount]);
            Response::json(['id' => $returnId, 'total_amount' => $totalAmount], 201);
        } catch (ValidationException $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to save return: ' . $e->getMessage(), 500);
        }
    }
}
