<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

class CategoryController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['business_type'])) {
            $where .= ' AND business_type = :bt';
            $params['bt'] = $_GET['business_type'];
        }
        if (isset($_GET['is_active']) && $_GET['is_active'] !== '') {
            $where .= ' AND is_active = :ia';
            $params['ia'] = (int) $_GET['is_active'];
        }
        $stmt = $this->pdo->prepare("SELECT * FROM categories {$where} ORDER BY business_type, name");
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['name']) || empty($body['business_type'])) {
            Response::error('name and business_type are required', 422);
        }
        $stmt = $this->pdo->prepare(
            'INSERT INTO categories (business_type, name, parent_id, is_active) VALUES (:bt, :name, :parent_id, :is_active)'
        );
        $stmt->execute([
            'bt' => $body['business_type'],
            'name' => $body['name'],
            'parent_id' => !empty($body['parent_id']) ? (int) $body['parent_id'] : null,
            'is_active' => isset($body['is_active']) ? (int) $body['is_active'] : 1,
        ]);
        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->pdo->prepare(
            'UPDATE categories SET name = :name, parent_id = :parent_id, is_active = :is_active WHERE id = :id'
        );
        $stmt->execute([
            'name' => $body['name'] ?? '',
            'parent_id' => !empty($body['parent_id']) ? (int) $body['parent_id'] : null,
            'is_active' => isset($body['is_active']) ? (int) $body['is_active'] : 1,
            'id' => $id,
        ]);
        Response::json(['ok' => true]);
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $this->pdo->prepare('DELETE FROM categories WHERE id = :id')->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }
}
