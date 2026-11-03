<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Middleware\AuthMiddleware;
use PDO;

class HeldBillController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->query(
            'SELECT h.*, c.name AS customer_name FROM held_bills h
             LEFT JOIN customers c ON c.id = h.customer_id ORDER BY h.created_at DESC'
        );
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['payload'] = json_decode((string) $row['payload'], true);
        }
        Response::json($rows);
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $uuid = $body['uuid'] ?? UuidHelper::v4();

        $existing = $this->pdo->prepare('SELECT id FROM held_bills WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            Response::json(['id' => $row['id'], 'uuid' => $uuid], 200);
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO held_bills (uuid, label, customer_id, payload, user_id)
             VALUES (:uuid, :label, :customer_id, :payload, :user_id)'
        );
        $stmt->execute([
            'uuid' => $uuid,
            'label' => $body['label'] ?? null,
            'customer_id' => $body['customer_id'] ?? null,
            'payload' => json_encode($body['payload'] ?? [], JSON_UNESCAPED_UNICODE),
            'user_id' => $claims['uid'],
        ]);
        Response::json(['id' => (int) $this->pdo->lastInsertId(), 'uuid' => $uuid], 201);
    }

    public function destroy(string $id): void
    {
        AuthMiddleware::authenticate();
        $where = ctype_digit($id) ? 'id = :id' : 'uuid = :id';
        $this->pdo->prepare("DELETE FROM held_bills WHERE {$where}")->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }
}
