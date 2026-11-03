<?php

declare(strict_types=1);

namespace App\Helpers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JwtHelper
{
    private static function secret(): string
    {
        $config = require __DIR__ . '/../../config/config.php';
        return $config['jwt_secret'];
    }

    /** @param array<string, mixed> $claims */
    public static function issue(array $claims, int $ttlSeconds = 60 * 60 * 12): string
    {
        $now = time();
        $payload = array_merge($claims, [
            'iat' => $now,
            'exp' => $now + $ttlSeconds,
        ]);

        return JWT::encode($payload, self::secret(), 'HS256');
    }

    /** @return array<string, mixed> */
    public static function verify(string $token): array
    {
        $decoded = JWT::decode($token, new Key(self::secret(), 'HS256'));
        return (array) $decoded;
    }
}
