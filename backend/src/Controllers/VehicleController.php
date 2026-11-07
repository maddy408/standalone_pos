<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

/** Vehicles / vans master — the fleet that Van Sales orders are loaded onto. */
class VehicleController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        AuthMiddleware::authenticate();
        $where = isset($_GET['is_active']) && $_GET['is_active'] !== '' ? 'WHERE is_active = :ia' : 'WHERE 1=1';
        $params = isset($_GET['is_active']) && $_GET['is_active'] !== '' ? ['ia' => (int) $_GET['is_active']] : [];
        $stmt = $this->pdo->prepare("SELECT * FROM vehicles {$where} ORDER BY name");
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_vehicles');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['name'])) {
            Response::error('Vehicle name is required', 422);
        }
        $this->pdo->prepare(
            'INSERT INTO vehicles (uuid, name, registration_no, driver_name, driver_phone)
             VALUES (:uuid, :name, :reg, :driver, :phone)'
        )->execute([
            'uuid' => UuidHelper::v4(),
            'name' => $body['name'],
            'reg' => $body['registration_no'] ?? null,
            'driver' => $body['driver_name'] ?? null,
            'phone' => $body['driver_phone'] ?? null,
        ]);
        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_vehicles');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $this->pdo->prepare(
            'UPDATE vehicles SET name = :name, registration_no = :reg, driver_name = :driver,
                driver_phone = :phone, is_active = :active WHERE id = :id'
        )->execute([
            'name' => $body['name'] ?? '',
            'reg' => $body['registration_no'] ?? null,
            'driver' => $body['driver_name'] ?? null,
            'phone' => $body['driver_phone'] ?? null,
            'active' => isset($body['is_active']) ? (int) $body['is_active'] : 1,
            'id' => $id,
        ]);
        Response::json(['ok' => true]);
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'van_sales.manage_vehicles');
        // Soft-disable rather than delete — van_orders/van_stock reference vehicles historically.
        $this->pdo->prepare('UPDATE vehicles SET is_active = 0 WHERE id = :id')->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }
}
