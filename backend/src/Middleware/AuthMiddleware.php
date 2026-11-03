<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Helpers\JwtHelper;
use App\Helpers\Response;

class AuthMiddleware
{
    /** @return array<string, mixed> */
    public static function authenticate(): array
    {
        $header = self::getAuthorizationHeader();

        if (!preg_match('/Bearer\s+(\S+)/i', $header, $matches)) {
            Response::error('Missing or malformed Authorization header', 401);
        }

        try {
            return JwtHelper::verify($matches[1]);
        } catch (\Throwable $e) {
            Response::error('Invalid or expired token', 401);
        }
    }

    private static function getAuthorizationHeader(): string
    {
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            return $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $key => $value) {
                if (strtolower((string) $key) === 'authorization') {
                    return $value;
                }
            }
        }
        return '';
    }

    /** @param array<string, mixed> $claims @param array<int, string> $roles */
    public static function requireRole(array $claims, array $roles): void
    {
        if (!in_array($claims['role'] ?? '', $roles, true)) {
            Response::error('Forbidden — insufficient role', 403);
        }
    }
}
