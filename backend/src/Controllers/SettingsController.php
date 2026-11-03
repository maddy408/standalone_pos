<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Services\AuditLogger;
use PDO;

class SettingsController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function show(): void
    {
        AuthMiddleware::authenticate();
        $stmt = $this->pdo->query('SELECT * FROM business_settings WHERE id = 1');
        Response::json($stmt->fetch());
    }

    public function update(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'settings.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $allowed = [
            'business_type', 'company_name', 'company_address', 'company_phone', 'company_gstin',
            'invoice_prefix', 'currency_symbol', 'tax_inclusive', 'low_stock_threshold',
            'default_language', 'default_theme',
            'receipt_paper_width', 'auto_print_on_sale', 'barcode_scanner_mode',
        ];
        $sets = [];
        $params = ['id' => 1];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $body)) {
                $sets[] = "$field = :$field";
                $params[$field] = $body[$field];
            }
        }

        if (!empty($sets)) {
            $sql = 'UPDATE business_settings SET ' . implode(', ', $sets) . ' WHERE id = :id';
            $this->pdo->prepare($sql)->execute($params);
            AuditLogger::log($this->pdo, $claims, 'update', 'business_settings', 1, array_intersect_key($body, array_flip($allowed)));
        }

        $stmt = $this->pdo->query('SELECT * FROM business_settings WHERE id = 1');
        Response::json($stmt->fetch());
    }

    /** GET /api/settings/attribute-fields?business_type=mobile */
    public function attributeFields(): void
    {
        AuthMiddleware::authenticate();
        $businessType = $_GET['business_type'] ?? null;

        if ($businessType) {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM business_attribute_fields WHERE business_type = :bt ORDER BY sort_order ASC'
            );
            $stmt->execute(['bt' => $businessType]);
        } else {
            $stmt = $this->pdo->query('SELECT * FROM business_attribute_fields ORDER BY business_type, sort_order ASC');
        }

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['options'] = $row['options'] ? json_decode((string) $row['options'], true) : null;
            $row['is_required'] = (bool) $row['is_required'];
            $row['is_variant_attribute'] = (bool) $row['is_variant_attribute'];
        }
        Response::json($rows);
    }
}
