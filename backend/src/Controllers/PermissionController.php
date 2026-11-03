<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

class PermissionController
{
    public function __construct(private PDO $pdo)
    {
    }

    /** GET /api/permissions — the full catalog, for building the matrix UI. */
    public function index(): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->query('SELECT * FROM permissions ORDER BY category, sort_order');
        Response::json($stmt->fetchAll());
    }

    /** GET /api/role-permissions — {admin:[...], manager:[...], cashier:[...]} */
    public function roleMatrix(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');

        $stmt = $this->pdo->query('SELECT role, permission_code FROM role_permissions');
        $matrix = ['admin' => [], 'manager' => [], 'cashier' => []];
        foreach ($stmt->fetchAll() as $row) {
            $matrix[$row['role']][] = $row['permission_code'];
        }
        Response::json($matrix);
    }

    /** PUT /api/role-permissions — body: {role, permission_code, allowed} toggles one cell. */
    public function updateRoleMatrix(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $role = $body['role'] ?? '';
        $code = $body['permission_code'] ?? '';
        if (!in_array($role, ['admin', 'manager', 'cashier'], true) || $code === '') {
            Response::error('role and permission_code are required', 422);
        }
        if ($role === 'admin') {
            Response::error('The admin role always has every permission', 422);
        }

        if (!empty($body['allowed'])) {
            $this->pdo->prepare('INSERT IGNORE INTO role_permissions (role, permission_code) VALUES (:role, :code)')
                ->execute(['role' => $role, 'code' => $code]);
        } else {
            $this->pdo->prepare('DELETE FROM role_permissions WHERE role = :role AND permission_code = :code')
                ->execute(['role' => $role, 'code' => $code]);
        }

        Response::json(['ok' => true]);
    }

    /** GET /api/users/{id}/permissions — role defaults + this user's overrides. */
    public function userOverrides(string $userId): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');

        $stmt = $this->pdo->prepare('SELECT permission_code, allowed FROM user_permission_overrides WHERE user_id = :uid');
        $stmt->execute(['uid' => $userId]);
        Response::json($stmt->fetchAll());
    }

    /** PUT /api/users/{id}/permissions — body: {permission_code, allowed: true|false|null}. null clears the override. */
    public function setUserOverride(string $userId): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $code = $body['permission_code'] ?? '';
        if ($code === '') {
            Response::error('permission_code is required', 422);
        }

        if (!array_key_exists('allowed', $body) || $body['allowed'] === null) {
            $this->pdo->prepare('DELETE FROM user_permission_overrides WHERE user_id = :uid AND permission_code = :code')
                ->execute(['uid' => $userId, 'code' => $code]);
        } else {
            $this->pdo->prepare(
                'INSERT INTO user_permission_overrides (user_id, permission_code, allowed) VALUES (:uid, :code, :allowed)
                 ON DUPLICATE KEY UPDATE allowed = :allowed2'
            )->execute([
                'uid' => $userId,
                'code' => $code,
                'allowed' => !empty($body['allowed']) ? 1 : 0,
                'allowed2' => !empty($body['allowed']) ? 1 : 0,
            ]);
        }

        Response::json(['ok' => true]);
    }
}
