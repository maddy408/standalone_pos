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
        $cols = $this->pdo->query('DESCRIBE categories')->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $hasActive = in_array('is_active', $cols, true);

        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['business_type'])) {
            $where .= ' AND business_type = :bt';
            $params['bt'] = $_GET['business_type'];
        }
        if ($hasActive && isset($_GET['is_active']) && $_GET['is_active'] !== '') {
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

        $cols = $this->pdo->query('DESCRIBE categories')->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $fields = ['business_type', 'name'];
        $values = [':bt', ':name'];
        $params = [
            'bt' => $body['business_type'],
            'name' => $body['name'],
        ];

        if (in_array('parent_id', $cols, true)) {
            $fields[] = 'parent_id';
            $values[] = ':parent_id';
            $params['parent_id'] = !empty($body['parent_id']) ? (int) $body['parent_id'] : null;
        }

        if (in_array('is_active', $cols, true)) {
            $fields[] = 'is_active';
            $values[] = ':is_active';
            $params['is_active'] = isset($body['is_active']) ? (int) $body['is_active'] : 1;
        }

        $sql = 'INSERT INTO categories (' . implode(', ', $fields) . ') VALUES (' . implode(', ', $values) . ')';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $cols = $this->pdo->query('DESCRIBE categories')->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $sets = ['name = :name'];
        $params = [
            'name' => $body['name'] ?? '',
            'id' => $id,
        ];

        if (in_array('parent_id', $cols, true)) {
            $sets[] = 'parent_id = :parent_id';
            $params['parent_id'] = !empty($body['parent_id']) ? (int) $body['parent_id'] : null;
        }

        if (in_array('is_active', $cols, true)) {
            $sets[] = 'is_active = :is_active';
            $params['is_active'] = isset($body['is_active']) ? (int) $body['is_active'] : 1;
        }

        $sql = 'UPDATE categories SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
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
