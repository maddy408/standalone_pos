<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Helpers\ValidationException;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

class CustomerController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['search'])) {
            $where .= ' AND (name LIKE :s OR phone LIKE :s)';
            $params['s'] = '%' . $_GET['search'] . '%';
        }
        if (!empty($_GET['updated_since'])) {
            $where .= ' AND created_at > :updated_since';
            $params['updated_since'] = $_GET['updated_since'];
        }
        $stmt = $this->pdo->prepare("SELECT * FROM customers {$where} ORDER BY name ASC LIMIT 1000");
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function show(string $id): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->prepare('SELECT * FROM customers WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $customer = $stmt->fetch();
        if (!$customer) {
            Response::error('Customer not found', 404);
        }
        Response::json($customer);
    }

    /** Idempotent by uuid — safe to replay from the offline outbox. */
    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'customers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        [$customer, $status] = $this->createFromSync($body, $claims);
        Response::json($customer, $status);
    }

    /** @param array<string, mixed> $body @param array<string, mixed> $claims @return array{0: array<string, mixed>, 1: int} */
    public function createFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'customers.manage');
        if (empty($body['name'])) {
            Response::error('Customer name is required', 422);
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT * FROM customers WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [$row, 200];
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO customers (uuid, name, phone, email, address, gstin, credit_limit)
             VALUES (:uuid, :name, :phone, :email, :address, :gstin, :credit_limit)'
        );
        $stmt->execute([
            'uuid' => $uuid,
            'name' => $body['name'],
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'credit_limit' => (float) ($body['credit_limit'] ?? 0),
        ]);
        $id = (int) $this->pdo->lastInsertId();

        $fetch = $this->pdo->prepare('SELECT * FROM customers WHERE id = :id');
        $fetch->execute(['id' => $id]);
        return [$fetch->fetch(), 201];
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'customers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->pdo->prepare(
            'UPDATE customers SET name = :name, phone = :phone, email = :email, address = :address,
                gstin = :gstin, credit_limit = :credit_limit WHERE id = :id'
        );
        $stmt->execute([
            'name' => $body['name'] ?? '',
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'credit_limit' => (float) ($body['credit_limit'] ?? 0),
            'id' => $id,
        ]);
        Response::json(['ok' => true]);
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'customers.manage');
        $this->pdo->prepare('DELETE FROM customers WHERE id = :id')->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }

    /** POST /api/customers/{id}/payments — records a collection against the running balance. */
    public function recordPayment(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $amount = (float) ($body['amount'] ?? 0);
        if ($amount <= 0) {
            Response::error('Amount must be greater than zero', 422);
        }

        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare(
                'INSERT INTO customer_payments (uuid, customer_id, invoice_id, amount, payment_method_id, reference_no, notes)
                 VALUES (:uuid, :cid, :invoice_id, :amount, :pmid, :ref, :notes)'
            )->execute([
                'uuid' => $body['uuid'] ?? UuidHelper::v4(),
                'cid' => $id,
                'invoice_id' => $body['invoice_id'] ?? null,
                'amount' => $amount,
                'pmid' => $body['payment_method_id'] ?? 1,
                'ref' => $body['reference_no'] ?? null,
                'notes' => $body['notes'] ?? null,
            ]);
            $this->pdo->prepare('UPDATE customers SET balance = balance - :amt WHERE id = :id')
                ->execute(['amt' => $amount, 'id' => $id]);
            $this->pdo->commit();
            Response::json(['ok' => true], 201);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to record payment: ' . $e->getMessage(), 500);
        }
    }
}
