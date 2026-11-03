<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Services\AuditLogger;
use PDO;

class UserController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');
        $stmt = $this->pdo->query('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id');
        Response::json($stmt->fetchAll());
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['username']) || empty($body['password']) || empty($body['full_name'])) {
            Response::error('username, password and full_name are required', 422);
        }
        $role = in_array($body['role'] ?? '', ['admin', 'manager', 'cashier'], true) ? $body['role'] : 'cashier';

        $exists = $this->pdo->prepare('SELECT id FROM users WHERE username = :u');
        $exists->execute(['u' => $body['username']]);
        if ($exists->fetch()) {
            Response::error('Username already exists', 422);
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES (:username, :hash, :full_name, :role)'
        );
        $stmt->execute([
            'username' => $body['username'],
            'hash' => password_hash($body['password'], PASSWORD_BCRYPT),
            'full_name' => $body['full_name'],
            'role' => $role,
        ]);
        $id = (int) $this->pdo->lastInsertId();
        AuditLogger::log($this->pdo, $claims, 'create', 'users', $id, ['username' => $body['username'], 'role' => $role]);
        Response::json(['id' => $id], 201);
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $sets = ['full_name = :full_name', 'role = :role', 'is_active = :is_active'];
        $params = [
            'full_name' => $body['full_name'] ?? '',
            'role' => in_array($body['role'] ?? '', ['admin', 'manager', 'cashier'], true) ? $body['role'] : 'cashier',
            'is_active' => !empty($body['is_active']) ? 1 : 0,
            'id' => $id,
        ];
        if (!empty($body['password'])) {
            $sets[] = 'password_hash = :password_hash';
            $params['password_hash'] = password_hash($body['password'], PASSWORD_BCRYPT);
        }

        $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $this->pdo->prepare($sql)->execute($params);
        AuditLogger::log($this->pdo, $claims, 'update', 'users', (int) $id, ['role' => $params['role'], 'is_active' => $params['is_active']]);
        Response::json(['ok' => true]);
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');
        if ((int) $id === (int) $claims['uid']) {
            Response::error('You cannot deactivate your own account', 422);
        }
        $this->pdo->prepare('UPDATE users SET is_active = 0 WHERE id = :id')->execute(['id' => $id]);
        AuditLogger::log($this->pdo, $claims, 'delete', 'users', (int) $id);
        Response::json(['ok' => true]);
    }
}
