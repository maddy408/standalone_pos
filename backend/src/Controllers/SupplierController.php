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
            $where .= ' AND (name LIKE :s OR phone LIKE :s OR email LIKE :s)';
            $params['s'] = '%' . $_GET['search'] . '%';
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

        $stmt = $this->pdo->prepare(
            'INSERT INTO suppliers (uuid, name, phone, email, address, gstin)
             VALUES (:uuid, :name, :phone, :email, :address, :gstin)'
        );
        $stmt->execute([
            'uuid' => $body['uuid'] ?? UuidHelper::v4(),
            'name' => $body['name'],
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
        ]);
        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'suppliers.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $stmt = $this->pdo->prepare(
            'UPDATE suppliers SET 
                name = COALESCE(:name, name),
                phone = :phone,
                email = :email,
                address = :address,
                gstin = :gstin,
                is_active = COALESCE(:is_active, is_active)
             WHERE id = :id'
        );
        $stmt->execute([
            'name' => isset($body['name']) ? $body['name'] : null,
            'phone' => $body['phone'] ?? null,
            'email' => $body['email'] ?? null,
            'address' => $body['address'] ?? null,
            'gstin' => $body['gstin'] ?? null,
            'is_active' => isset($body['is_active']) ? (int) $body['is_active'] : null,
            'id' => $id,
        ]);
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
