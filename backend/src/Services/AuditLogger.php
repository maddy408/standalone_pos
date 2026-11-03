<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

class AuditLogger
{
    /**
     * @param array<string, mixed> $claims
     * @param array<string, mixed> $details
     */
    public static function log(
        PDO $pdo,
        array $claims,
        string $action,
        string $entityType,
        ?int $entityId = null,
        array $details = []
    ): void {
        $stmt = $pdo->prepare(
            'INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details)
             VALUES (:user_id, :username, :action, :entity_type, :entity_id, :details)'
        );
        $stmt->execute([
            'user_id' => $claims['uid'] ?? null,
            'username' => $claims['username'] ?? null,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'details' => !empty($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
        ]);
    }
}
