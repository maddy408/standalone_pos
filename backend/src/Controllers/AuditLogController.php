<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use PDO;

class AuditLogController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');

        $where = 'WHERE 1=1';
        $params = [];
        if (!empty($_GET['action'])) {
            $where .= ' AND action = :action';
            $params['action'] = $_GET['action'];
        }
        if (!empty($_GET['entity_type'])) {
            $where .= ' AND entity_type = :entity_type';
            $params['entity_type'] = $_GET['entity_type'];
        }
        if (!empty($_GET['user_id'])) {
            $where .= ' AND user_id = :user_id';
            $params['user_id'] = $_GET['user_id'];
        }
        if (!empty($_GET['from'])) {
            $where .= ' AND created_at >= :from';
            $params['from'] = $_GET['from'];
        }
        if (!empty($_GET['to'])) {
            $where .= ' AND created_at <= :to';
            $params['to'] = $_GET['to'] . ' 23:59:59';
        }

        $page = max(1, (int) ($_GET['page'] ?? 1));
        $limit = max(1, min(200, (int) ($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM audit_log {$where}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->pdo->prepare(
            "SELECT * FROM audit_log {$where} ORDER BY created_at DESC, id DESC LIMIT {$limit} OFFSET {$offset}"
        );
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['details'] = $row['details'] ? json_decode((string) $row['details'], true) : null;
        }

        Response::json([
            'data' => $rows,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => (int) ceil($total / $limit),
        ]);
    }

    /** GET /api/audit-log/entity-types — distinct values, to populate the filter dropdown. */
    public function entityTypes(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'users.manage');
        $stmt = $this->pdo->query('SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type');
        Response::json($stmt->fetchAll(PDO::FETCH_COLUMN));
    }
}
