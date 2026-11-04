<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

/**
 * Generic CRUD for simple master/lookup tables (brands, units, tax rates,
 * payment methods, add-ons, expense/income categories) — one controller
 * instead of six nearly-identical ones. Table + column whitelist only, to
 * keep raw identifiers out of SQL.
 */
class LookupController
{
    /** @var array<string, array{table: string, columns: array<int, string>}> */
    private const RESOURCES = [
        'brands' => ['table' => 'brands', 'columns' => ['name', 'business_type', 'is_active']],
        'units' => ['table' => 'units', 'columns' => ['name', 'short_code']],
        'tax-rates' => ['table' => 'tax_rates', 'columns' => ['name', 'percent']],
        'payment-methods' => ['table' => 'payment_methods', 'columns' => ['code', 'name', 'is_active']],
        'addons' => ['table' => 'addons', 'columns' => ['name', 'price', 'is_active', 'group_name', 'is_mandatory']],
        'expense-categories' => ['table' => 'expense_categories', 'columns' => ['name']],
        'income-categories' => ['table' => 'income_categories', 'columns' => ['name']],
    ];

    public function __construct(private PDO $pdo)
    {
    }

    private function resource(string $key): array
    {
        if (!isset(self::RESOURCES[$key])) {
            Response::error('Unknown lookup resource', 404);
        }
        return self::RESOURCES[$key];
    }

    public function index(string $key): void
    {
        AuthMiddleware::authenticate();
        $res = $this->resource($key);

        if ($key === 'brands') {
            $where = 'WHERE 1=1';
            $params = [];
            if (!empty($_GET['business_type'])) {
                $where .= ' AND (business_type = :bt OR business_type IS NULL)';
                $params['bt'] = $_GET['business_type'];
            }
            if (isset($_GET['is_active']) && $_GET['is_active'] !== '') {
                $where .= ' AND is_active = :ia';
                $params['ia'] = (int) $_GET['is_active'];
            }
            $stmt = $this->pdo->prepare("SELECT * FROM brands {$where} ORDER BY name");
            $stmt->execute($params);
            Response::json($stmt->fetchAll());
        }

        $stmt = $this->pdo->query("SELECT * FROM {$res['table']} ORDER BY id DESC");
        Response::json($stmt->fetchAll());
    }

    public function store(string $key): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $res = $this->resource($key);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (isset($body['business_type']) && $body['business_type'] === '') {
            $body['business_type'] = null;
        }

        $cols = array_values(array_intersect($res['columns'], array_keys($body)));
        if (empty($cols)) {
            Response::error('No valid fields supplied', 422);
        }

        $placeholders = array_map(fn ($c) => ":$c", $cols);
        $sql = "INSERT INTO {$res['table']} (" . implode(',', $cols) . ') VALUES (' . implode(',', $placeholders) . ')';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(array_intersect_key($body, array_flip($cols)));

        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function update(string $key, string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $res = $this->resource($key);
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (isset($body['business_type']) && $body['business_type'] === '') {
            $body['business_type'] = null;
        }

        $cols = array_values(array_intersect($res['columns'], array_keys($body)));
        if (empty($cols)) {
            Response::error('No valid fields supplied', 422);
        }

        $sets = implode(', ', array_map(fn ($c) => "$c = :$c", $cols));
        $sql = "UPDATE {$res['table']} SET $sets WHERE id = :id";
        $params = array_intersect_key($body, array_flip($cols));
        $params['id'] = $id;
        $this->pdo->prepare($sql)->execute($params);

        Response::json(['ok' => true]);
    }

    public function destroy(string $key, string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $res = $this->resource($key);
        $this->pdo->prepare("DELETE FROM {$res['table']} WHERE id = :id")->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }
}
