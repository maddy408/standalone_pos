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
            $where .= ' AND (name LIKE :s OR phone LIKE :s OR email LIKE :s)';
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

        $openingBalance = (float) ($body['opening_balance'] ?? 0);
        $initialBalance = (float) ($body['balance'] ?? $openingBalance);

        $stmt = $this->pdo->prepare(
            'INSERT INTO customers (uuid, name, phone, email, address, gstin, opening_balance, credit_limit, balance)
             VALUES (:uuid, :name, :phone, :email, :address, :gstin, :opening_balance, :credit_limit, :balance)'
        );
        $stmt->execute([
            'uuid' => $uuid,
            'name' => $body['name'],
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'opening_balance' => $openingBalance,
            'credit_limit' => (float) ($body['credit_limit'] ?? 0),
            'balance' => $initialBalance,
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
            'UPDATE customers SET name = :name, phone = :phone, email = :email,
             address = :address, gstin = :gstin, credit_limit = :credit_limit,
             opening_balance = :opening_balance
             WHERE id = :id'
        );
        $stmt->execute([
            'name' => $body['name'] ?? '',
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'credit_limit' => (float) ($body['credit_limit'] ?? 0),
            'opening_balance' => (float) ($body['opening_balance'] ?? 0),
            'id' => $id,
        ]);

        $fetch = $this->pdo->prepare('SELECT * FROM customers WHERE id = :id');
        $fetch->execute(['id' => $id]);
        Response::json($fetch->fetch());
    }

    public function recordPayment(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'customers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $amount = (float) ($body['amount'] ?? 0);
        if ($amount <= 0) {
            Response::error('Amount must be positive', 422);
        }

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('SELECT balance FROM customers WHERE id = :id FOR UPDATE');
            $stmt->execute(['id' => $id]);
            $c = $stmt->fetch();
            if (!$c) {
                $this->pdo->rollBack();
                Response::error('Customer not found', 404);
            }

            $this->pdo->prepare('UPDATE customers SET balance = balance - :amount WHERE id = :id')
                ->execute(['amount' => $amount, 'id' => $id]);

            $this->pdo->prepare(
                'INSERT INTO customer_payments (customer_id, payment_method_id, amount, notes, user_id)
                 VALUES (:cid, :pm, :amount, :notes, :uid)'
            )->execute([
                'cid' => $id,
                'pm' => $body['payment_method_id'] ?? 1,
                'amount' => $amount,
                'notes' => $body['notes'] ?? 'Manual customer payment',
                'uid' => $claims['uid'],
            ]);

            $this->pdo->commit();
            Response::json(['ok' => true]);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 500);
        }
    }
}
