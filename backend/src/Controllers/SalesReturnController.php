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

class SalesReturnController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->query(
            "SELECT sr.*, i.invoice_no FROM sales_returns sr
             JOIN invoices i ON i.id = sr.invoice_id ORDER BY sr.created_at DESC LIMIT 200"
        );
        Response::json($stmt->fetchAll());
    }

    /** GET /api/invoices/{id}/returnable-items — what's left to return on this invoice. */
    public function returnableItems(string $invoiceId): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->prepare(
            "SELECT ii.id, ii.product_name_snapshot, ii.qty, ii.unit_price, ii.line_total, ii.serial_id,
                    ii.qty - COALESCE((SELECT SUM(sri.qty) FROM sales_return_items sri WHERE sri.invoice_item_id = ii.id), 0) AS qty_returnable
             FROM invoice_items ii WHERE ii.invoice_id = :id"
        );
        $stmt->execute(['id' => $invoiceId]);
        Response::json(array_values(array_filter($stmt->fetchAll(), fn ($r) => (float) $r['qty_returnable'] > 0.0001)));
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'pos.sales_return');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['invoice_id']) || empty($body['items'])) {
            Response::error('invoice_id and items are required', 422);
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT id FROM sales_returns WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            Response::json(['id' => $row['id']], 200);
        }

        $this->pdo->beginTransaction();
        try {
            $totalAmount = 0.0;
            $returnId = null;

            $this->pdo->prepare(
                'INSERT INTO sales_returns (uuid, invoice_id, user_id, total_amount, reason) VALUES (:uuid, :invoice_id, :user_id, 0, :reason)'
            )->execute([
                'uuid' => $uuid,
                'invoice_id' => $body['invoice_id'],
                'user_id' => $claims['uid'],
                'reason' => $body['reason'] ?? null,
            ]);
            $returnId = (int) $this->pdo->lastInsertId();

            $itemStmt = $this->pdo->prepare('SELECT * FROM invoice_items WHERE id = :id');
            $insertReturnItem = $this->pdo->prepare(
                'INSERT INTO sales_return_items (sales_return_id, invoice_item_id, qty, amount, serial_id) VALUES (:rid, :iid, :qty, :amount, :serial_id)'
            );

            foreach ($body['items'] as $item) {
                $itemStmt->execute(['id' => $item['invoice_item_id']]);
                $invoiceItem = $itemStmt->fetch();
                if (!$invoiceItem) {
                    throw new ValidationException('Invoice item not found');
                }
                $qty = (float) $item['qty'];
                if ($qty <= 0 || $qty > (float) $invoiceItem['qty']) {
                    throw new ValidationException('Invalid return quantity for ' . $invoiceItem['product_name_snapshot']);
                }
                $unitValue = (float) $invoiceItem['line_total'] / (float) $invoiceItem['qty'];
                $amount = round($unitValue * $qty, 2);
                $totalAmount += $amount;

                $insertReturnItem->execute([
                    'rid' => $returnId,
                    'iid' => $invoiceItem['id'],
                    'qty' => $qty,
                    'amount' => $amount,
                    'serial_id' => $invoiceItem['serial_id'],
                ]);

                if ($invoiceItem['product_id']) {
                    $this->pdo->prepare('UPDATE products SET stock_qty = stock_qty + :qty WHERE id = :id')
                        ->execute(['qty' => $qty, 'id' => $invoiceItem['product_id']]);
                    if ($invoiceItem['serial_id']) {
                        $this->pdo->prepare("UPDATE product_serials SET status = 'returned' WHERE id = :id")
                            ->execute(['id' => $invoiceItem['serial_id']]);
                    }
                    $this->pdo->prepare(
                        "INSERT INTO stock_movements (uuid, product_id, serial_id, qty_change, movement_type, ref_type, ref_id, user_id)
                         VALUES (:uuid, :pid, :serial_id, :qty, 'sale_return', 'sales_returns', :ref_id, :user_id)"
                    )->execute([
                        'uuid' => UuidHelper::v4(),
                        'pid' => $invoiceItem['product_id'],
                        'serial_id' => $invoiceItem['serial_id'],
                        'qty' => $qty,
                        'ref_id' => $returnId,
                        'user_id' => $claims['uid'],
                    ]);
                }
            }

            $totalAmount = round($totalAmount, 2);
            $this->pdo->prepare('UPDATE sales_returns SET total_amount = :amt WHERE id = :id')
                ->execute(['amt' => $totalAmount, 'id' => $returnId]);

            $invoice = $this->pdo->prepare('SELECT customer_id FROM invoices WHERE id = :id');
            $invoice->execute(['id' => $body['invoice_id']]);
            $customerId = $invoice->fetchColumn();
            if ($customerId) {
                $this->pdo->prepare('UPDATE customers SET balance = balance - :amt WHERE id = :id')
                    ->execute(['amt' => $totalAmount, 'id' => $customerId]);
            }

            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'create', 'sales_returns', $returnId, ['invoice_id' => $body['invoice_id'], 'total_amount' => $totalAmount]);
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
