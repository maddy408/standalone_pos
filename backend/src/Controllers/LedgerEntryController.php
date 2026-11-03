<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

/**
 * Shared implementation for Expenses and Income — identical shape
 * (category, amount, payment method, date, notes), so one controller
 * parameterised by table name avoids duplicating the same CRUD twice.
 */
class LedgerEntryController
{
    /** @var array<string, array{table: string, date_col: string, category_table: string}> */
    private const KINDS = [
        'expenses' => ['table' => 'expenses', 'date_col' => 'expense_date', 'category_table' => 'expense_categories'],
        'income' => ['table' => 'income', 'date_col' => 'income_date', 'category_table' => 'income_categories'],
    ];

    public function __construct(private PDO $pdo)
    {
    }

    public function index(string $kind): void
    {
        AuthMiddleware::authenticate();
        $k = self::KINDS[$kind];
        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['from'])) {
            $where .= " AND e.{$k['date_col']} >= :from";
            $params['from'] = $_GET['from'];
        }
        if (!empty($_GET['to'])) {
            $where .= " AND e.{$k['date_col']} <= :to";
            $params['to'] = $_GET['to'];
        }
        $stmt = $this->pdo->prepare(
            "SELECT e.*, c.name AS category_name FROM {$k['table']} e
             LEFT JOIN {$k['category_table']} c ON c.id = e.category_id
             {$where} ORDER BY e.{$k['date_col']} DESC, e.id DESC LIMIT 1000"
        );
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    private function permissionFor(string $kind): string
    {
        return $kind === 'expenses' ? 'expenses.manage' : 'income.manage';
    }

    public function store(string $kind): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, $this->permissionFor($kind));
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        [$result, $status] = $this->createFromSync($kind, $body, $claims);
        Response::json($result, $status);
    }

    /** @param array<string, mixed> $body @param array<string, mixed> $claims @return array{0: array<string, mixed>, 1: int} */
    public function createFromSync(string $kind, array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, $this->permissionFor($kind));
        $k = self::KINDS[$kind];
        $amount = (float) ($body['amount'] ?? 0);
        if ($amount <= 0) {
            Response::error('Amount must be greater than zero', 422);
        }

        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare("SELECT id FROM {$k['table']} WHERE uuid = :uuid");
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [['id' => $row['id'], 'uuid' => $uuid], 200];
        }

        $dateCol = $k['date_col'];
        $stmt = $this->pdo->prepare(
            "INSERT INTO {$k['table']} (uuid, category_id, amount, payment_method_id, notes, {$dateCol}, user_id)
             VALUES (:uuid, :category_id, :amount, :payment_method_id, :notes, :date, :user_id)"
        );
        $stmt->execute([
            'uuid' => $uuid,
            'category_id' => $body['category_id'] ?? null,
            'amount' => $amount,
            'payment_method_id' => $body['payment_method_id'] ?? null,
            'notes' => $body['notes'] ?? null,
            'date' => $body['date'] ?? date('Y-m-d'),
            'user_id' => $claims['uid'],
        ]);
        return [['id' => (int) $this->pdo->lastInsertId(), 'uuid' => $uuid], 201];
    }

    public function destroy(string $kind, string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, $this->permissionFor($kind));
        $k = self::KINDS[$kind];
        $this->pdo->prepare("DELETE FROM {$k['table']} WHERE id = :id")->execute(['id' => $id]);
        Response::json(['ok' => true]);
    }
}
