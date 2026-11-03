<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\JwtHelper;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Services\AuditLogger;
use PDO;

class AuthController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function login(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($username === '' || $password === '') {
            Response::error('Username and password are required', 422);
        }

        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE username = :u AND is_active = 1');
        $stmt->execute(['u' => $username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::error('Invalid username or password', 401);
        }

        $permissions = $this->resolvePermissions((int) $user['id'], $user['role']);

        $token = JwtHelper::issue([
            'uid' => $user['id'],
            'username' => $user['username'],
            'role' => $user['role'],
            'full_name' => $user['full_name'],
            'permissions' => $permissions,
        ]);

        AuditLogger::log($this->pdo, ['uid' => $user['id'], 'username' => $user['username']], 'login', 'users', (int) $user['id']);

        Response::json([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'full_name' => $user['full_name'],
                'role' => $user['role'],
                'permissions' => $permissions,
            ],
        ]);
    }

    public function me(): void
    {
        $claims = AuthMiddleware::authenticate();
        Response::json([
            'id' => $claims['uid'],
            'username' => $claims['username'],
            'full_name' => $claims['full_name'],
            'role' => $claims['role'],
            'permissions' => $claims['permissions'] ?? [],
        ]);
    }

    /**
     * Role default permissions, adjusted by any per-user overrides
     * (an override can grant something the role lacks, or revoke
     * something the role would otherwise include).
     *
     * @return array<int, string>
     */
    private function resolvePermissions(int $userId, string $role): array
    {
        $roleStmt = $this->pdo->prepare('SELECT permission_code FROM role_permissions WHERE role = :role');
        $roleStmt->execute(['role' => $role]);
        $codes = array_flip($roleStmt->fetchAll(PDO::FETCH_COLUMN));

        $overrideStmt = $this->pdo->prepare('SELECT permission_code, allowed FROM user_permission_overrides WHERE user_id = :uid');
        $overrideStmt->execute(['uid' => $userId]);
        foreach ($overrideStmt->fetchAll() as $row) {
            if ((int) $row['allowed'] === 1) {
                $codes[$row['permission_code']] = true;
            } else {
                unset($codes[$row['permission_code']]);
            }
        }

        return array_values(array_keys($codes));
    }
}
