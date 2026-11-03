<?php

declare(strict_types=1);

if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
    if (file_exists(__DIR__ . '/../.env')) {
        \Dotenv\Dotenv::createImmutable(__DIR__ . '/..')->safeLoad();
    }
}

return [
    'db' => [
        'host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
        'port' => $_ENV['DB_PORT'] ?? '3306',
        'database' => $_ENV['DB_DATABASE'] ?? 'universal_pos',
        'username' => $_ENV['DB_USERNAME'] ?? 'root',
        'password' => $_ENV['DB_PASSWORD'] ?? '',
    ],
    'jwt_secret' => $_ENV['JWT_SECRET'] ?? 'universal-pos-dev-secret',
];
