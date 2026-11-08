<?php

declare(strict_types=1);

if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';

    if (file_exists(__DIR__ . '/../.env')) {
        \Dotenv\Dotenv::createImmutable(__DIR__ . '/..')->safeLoad();
    }
}

$getEnv = static function (string $key, ?string $default = null): ?string {
    $value = getenv($key);

    if ($value !== false && $value !== '') {
        return $value;
    }

    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return (string) $_ENV[$key];
    }

    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return (string) $_SERVER[$key];
    }

    return $default;
};

// Support DATABASE_URL if available
$databaseUrl = $getEnv('DATABASE_URL');
$urlParts = $databaseUrl ? parse_url($databaseUrl) : false;

$urlDatabase = is_array($urlParts)
    ? ltrim($urlParts['path'] ?? '', '/')
    : '';

return [
    'db' => [
        'host' => $getEnv('DB_HOST', $urlParts['host'] ?? '127.0.0.1'),
        'port' => $getEnv('DB_PORT', (string) ($urlParts['port'] ?? 3306)),
        'database' => $getEnv(
            'DB_DATABASE',
            $urlDatabase ?: 'universal_pos'
        ),
        'username' => $getEnv(
            'DB_USERNAME',
            isset($urlParts['user']) ? urldecode($urlParts['user']) : 'root'
        ),
        'password' => $getEnv(
            'DB_PASSWORD',
            isset($urlParts['pass']) ? urldecode($urlParts['pass']) : ''
        ),
    ],

    'jwt_secret' => $getEnv(
        'JWT_SECRET',
        'universal-pos-dev-secret'
    ),
];