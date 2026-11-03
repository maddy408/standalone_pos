<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

class SupplierController
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
        $stmt = $this->pdo->prepare("SELECT * FROM suppliers {$where} ORDER BY name ASC LIMIT 1000");
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function show(string $id): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->prepare('SELECT * FROM suppliers WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $supplier = $stmt->fetch();
        if (!$supplier) {
            Response::error('Supplier not found', 404);
        }

        $history = $this->pdo->prepare(
            'SELECT id, uuid, purchase_no, grand_total, paid_amount, balance_amount, status, created_at
             FROM purchases WHERE supplier_id = :id ORDER BY created_at DESC LIMIT 100'
        );
        $history->execute(['id' => $id]);
        $supplier['purchase_history'] = $history->fetchAll();

        $payments = $this->pdo->prepare('SELECT * FROM supplier_payments WHERE supplier_id = :id ORDER BY created_at DESC LIMIT 100');
        $payments->execute(['id' => $id]);
        $supplier['payment_history'] = $payments->fetchAll();

        Response::json($supplier);
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'suppliers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        [$supplier, $status] = $this->createFromSync($body, $claims);
        Response::json($supplier, $status);
    }

    /** @param array<string, mixed> $body @param array<string, mixed> $claims @return array{0: array<string, mixed>, 1: int} */
    public function createFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'suppliers.manage');
        if (empty($body['name'])) {
            Response::error('Supplier name is required', 422);
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT * FROM suppliers WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [$row, 200];
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO suppliers (uuid, name, phone, email, address, gstin) VALUES (:uuid, :name, :phone, :email, :address, :gstin)'
        );
        $stmt->execute([
            'uuid' => $uuid,
            'name' => $body['name'],
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
        ]);
        $id = (int) $this->pdo->lastInsertId();
        $fetch = $this->pdo->prepare('SELECT * FROM suppliers WHERE id = :id');
        $fetch->execute(['id' => $id]);
        return [$fetch->fetch(), 201];
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'suppliers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->pdo->prepare(
            'UPDATE suppliers SET name = :name, phone = :phone, email = :email, address = :address, gstin = :gstin WHERE id = :id'
        );
        $stmt->execute([
            'name' => $body['name'] ?? '',
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'id' => $id,
        ]);
        Response::json(['ok' => true]);
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'suppliers.manage');
        $this->pdo->prepare('DELETE FROM suppliers WHERE id = :id')->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }

    public function recordPayment(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'suppliers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $amount = (float) ($body['amount'] ?? 0);
        if ($amount <= 0) {
            Response::error('Amount must be greater than zero', 422);
        }

        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare(
                'INSERT INTO supplier_payments (uuid, supplier_id, purchase_id, amount, payment_method_id, reference_no, notes)
                 VALUES (:uuid, :sid, :purchase_id, :amount, :pmid, :ref, :notes)'
            )->execute([
                'uuid' => $body['uuid'] ?? UuidHelper::v4(),
                'sid' => $id,
                'purchase_id' => $body['purchase_id'] ?? null,
                'amount' => $amount,
                'pmid' => $body['payment_method_id'] ?? 1,
                'ref' => $body['reference_no'] ?? null,
                'notes' => $body['notes'] ?? null,
            ]);
            $this->pdo->prepare('UPDATE suppliers SET balance = balance - :amt WHERE id = :id')
                ->execute(['amt' => $amount, 'id' => $id]);
            $this->pdo->commit();
            Response::json(['ok' => true], 201);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to record payment: ' . $e->getMessage(), 500);
        }
    }
}
