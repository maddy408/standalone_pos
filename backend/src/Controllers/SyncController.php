<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\ValidationException;
use App\Middleware\AuthMiddleware;
use PDO;

/**
 * Batch endpoint for the offline outbox. Each queued operation is applied
 * independently and idempotently (by its own uuid) so a partial failure
 * never blocks the rest of the batch, and a retried batch never double-applies.
 */
class SyncController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function push(): void
    {
        $claims = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $operations = $body['operations'] ?? [];

        $products = new ProductController($this->pdo);
        $invoices = new InvoiceController($this->pdo);
        $purchases = new PurchaseController($this->pdo);
        $customers = new CustomerController($this->pdo);
        $suppliers = new SupplierController($this->pdo);
        $stock = new StockController($this->pdo);
        $ledger = new LedgerEntryController($this->pdo);

        $results = [];
        foreach ($operations as $op) {
            $clientId = $op['client_id'] ?? $op['uuid'] ?? null;
            $type = $op['type'] ?? '';
            $payload = $op['payload'] ?? [];

            try {
                [$data, $status] = match ($type) {
                    'product' => $products->createFromSync($payload, $claims),
                    'invoice' => $invoices->createFromSync($payload, $claims),
                    'purchase' => $purchases->createFromSync($payload, $claims),
                    'customer' => $customers->createFromSync($payload, $claims),
                    'supplier' => $suppliers->createFromSync($payload, $claims),
                    'stock_adjustment' => $stock->adjustFromSync($payload, $claims),
                    'expense' => $ledger->createFromSync('expenses', $payload, $claims),
                    'income' => $ledger->createFromSync('income', $payload, $claims),
                    default => throw new ValidationException("Unknown sync operation type: {$type}"),
                };
                $results[] = [
                    'client_id' => $clientId,
                    'type' => $type,
                    'status' => 'applied',
                    'http_status' => $status,
                    'data' => $data,
                ];
            } catch (ValidationException $e) {
                $results[] = ['client_id' => $clientId, 'type' => $type, 'status' => 'failed', 'error' => $e->getMessage()];
            } catch (\Throwable $e) {
                $results[] = ['client_id' => $clientId, 'type' => $type, 'status' => 'failed', 'error' => $e->getMessage()];
            }
        }

        Response::json(['results' => $results, 'synced_at' => date('c')]);
    }

    /** GET /api/sync/pull?since=2026-01-01T00:00:00 — deltas for the offline cache. */
    public function pull(): void
    {
        AuthMiddleware::authenticate();
        $since = $_GET['since'] ?? '1970-01-01 00:00:00';

        $products = $this->pdo->prepare('SELECT * FROM products WHERE updated_at > :since');
        $products->execute(['since' => $since]);
        $productRows = $products->fetchAll();
        foreach ($productRows as &$row) {
            $row['attributes'] = $row['attributes'] ? json_decode((string) $row['attributes'], true) : [];
        }

        $customers = $this->pdo->prepare('SELECT * FROM customers WHERE created_at > :since');
        $customers->execute(['since' => $since]);

        $settings = $this->pdo->query('SELECT * FROM business_settings WHERE id = 1')->fetch();

        Response::json([
            'server_time' => date('c'),
            'products' => $productRows,
            'customers' => $customers->fetchAll(),
            'settings' => $settings,
        ]);
    }
}
