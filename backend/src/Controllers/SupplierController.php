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
            $term = '%' . trim($_GET['search']) . '%';
            $where .= ' AND (name LIKE :s1 OR phone LIKE :s2 OR email LIKE :s3)';
            $params['s1'] = $term;
            $params['s2'] = $term;
            $params['s3'] = $term;
        }
        $stmt = $this->pdo->prepare("SELECT * FROM suppliers {$where} ORDER BY name ASC");
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

        $purchases = $this->pdo->prepare(
            'SELECT id, purchase_no, grand_total, paid_amount, created_at FROM purchases WHERE supplier_id = :id ORDER BY created_at DESC LIMIT 20'
        );
        $purchases->execute(['id' => $id]);

        $payments = $this->pdo->prepare(
            'SELECT p.*, pm.name AS payment_method_name FROM supplier_payments p
             JOIN payment_methods pm ON pm.id = p.payment_method_id
             WHERE p.supplier_id = :id ORDER BY p.created_at DESC LIMIT 20'
        );
        $payments->execute(['id' => $id]);

        $supplier['purchase_history'] = $purchases->fetchAll();
        $supplier['payment_history'] = $payments->fetchAll();
        Response::json($supplier);
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'suppliers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['name'])) {
            Response::error('Supplier name is required', 422);
        }

        $openingBalance = (float) ($body['opening_balance'] ?? 0);
        $initialBalance = (float) ($body['balance'] ?? $openingBalance);

        $cols = $this->pdo->query('DESCRIBE suppliers')->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $hasOpening = in_array('opening_balance', $cols, true);

        if ($hasOpening) {
            $stmt = $this->pdo->prepare(
                'INSERT INTO suppliers (uuid, name, phone, email, address, gstin, opening_balance, balance)
                 VALUES (:uuid, :name, :phone, :email, :address, :gstin, :opening_balance, :balance)'
            );
            $stmt->execute([
                'uuid' => $body['uuid'] ?? UuidHelper::v4(),
                'name' => $body['name'],
                'phone' => $body['phone'] ?? null,
                'email' => $body['email'] ?? null,
                'address' => $body['address'] ?? null,
                'gstin' => $body['gstin'] ?? null,
                'opening_balance' => $openingBalance,
                'balance' => $initialBalance,
            ]);
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO suppliers (uuid, name, phone, email, address, gstin, balance)
                 VALUES (:uuid, :name, :phone, :email, :address, :gstin, :balance)'
            );
            $stmt->execute([
                'uuid' => $body['uuid'] ?? UuidHelper::v4(),
                'name' => $body['name'],
                'phone' => $body['phone'] ?? null,
                'email' => $body['email'] ?? null,
                'address' => $body['address'] ?? null,
                'gstin' => $body['gstin'] ?? null,
                'balance' => $initialBalance,
            ]);
        }
        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'suppliers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $cols = $this->pdo->query('DESCRIBE suppliers')->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $sets = [
            'name = COALESCE(:name, name)',
            'phone = :phone',
            'email = :email',
            'address = :address',
            'gstin = :gstin',
        ];
        $params = [
            'name' => isset($body['name']) ? $body['name'] : null,
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'id' => $id,
        ];

        if (in_array('opening_balance', $cols, true) && isset($body['opening_balance'])) {
            $sets[] = 'opening_balance = :opening_balance';
            $params['opening_balance'] = (float) $body['opening_balance'];
        }

        if (isset($body['balance'])) {
            $sets[] = 'balance = :balance';
            $params['balance'] = (float) $body['balance'];
        }

        if (in_array('is_active', $cols, true)) {
            $sets[] = 'is_active = COALESCE(:is_active, is_active)';
            $params['is_active'] = isset($body['is_active']) ? (int) $body['is_active'] : null;
        }

        $sql = 'UPDATE suppliers SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        Response::json(['ok' => true]);
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'suppliers.manage');

        // Check if supplier has linked purchases
        $chk = $this->pdo->prepare('SELECT COUNT(*) FROM purchases WHERE supplier_id = :id');
        $chk->execute(['id' => $id]);
        if ((int) $chk->fetchColumn() > 0) {
            Response::error('Cannot delete supplier because purchase records exist for this supplier.', 422);
        }

        $stmt = $this->pdo->prepare('DELETE FROM suppliers WHERE id = :id');
        $stmt->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }
}
