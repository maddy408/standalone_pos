<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use PDO;

class CategoryController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        if (!empty($_GET['business_type'])) {
            $stmt = $this->pdo->prepare('SELECT * FROM categories WHERE business_type = :bt ORDER BY name');
            $stmt->execute(['bt' => $_GET['business_type']]);
        } else {
            $stmt = $this->pdo->query('SELECT * FROM categories ORDER BY business_type, name');
        }
        Response::json($stmt->fetchAll());
    }

    public function store(): void
    {
        AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['name']) || empty($body['business_type'])) {
            Response::error('name and business_type are required', 422);
        }
        $stmt = $this->pdo->prepare(
            'INSERT INTO categories (business_type, name, parent_id) VALUES (:bt, :name, :parent_id)'
        );
        $stmt->execute([
            'bt' => $body['business_type'],
            'name' => $body['name'],
            'parent_id' => $body['parent_id'] ?? null,
        ]);
        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function update(string $id): void
    {
        AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->pdo->prepare('UPDATE categories SET name = :name, parent_id = :parent_id WHERE id = :id');
        $stmt->execute(['name' => $body['name'] ?? '', 'parent_id' => $body['parent_id'] ?? null, 'id' => $id]);
        Response::json(['ok' => true]);
    }

    public function destroy(string $id): void
    {
        AuthMiddleware::authenticate();
        $this->pdo->prepare('DELETE FROM categories WHERE id = :id')->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }
}
