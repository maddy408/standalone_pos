<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\UuidHelper;
use App\Helpers\ValidationException;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;
use App\Services\AuditLogger;
use PDO;

class ProductController
{
    public function __construct(private PDO $pdo)
    {
    }

    public function index(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.view');
        $where = 'WHERE p.is_active = 1';
        $params = [];

        if (!empty($_GET['business_type'])) {
            $where .= ' AND p.business_type = :bt';
            $params['bt'] = $_GET['business_type'];
        }
        if (!empty($_GET['search'])) {
            $where .= ' AND (p.name LIKE :s OR p.barcode LIKE :s OR p.sku LIKE :s)';
            $params['s'] = '%' . $_GET['search'] . '%';
        }
        if (!empty($_GET['barcode'])) {
            $where .= ' AND p.barcode = :barcode';
            $params['barcode'] = $_GET['barcode'];
        }
        if (!empty($_GET['category_id'])) {
            $where .= ' AND p.category_id = :category_id';
            $params['category_id'] = $_GET['category_id'];
        }
        if (!empty($_GET['updated_since'])) {
            $where .= ' AND p.updated_at > :updated_since';
            $params['updated_since'] = $_GET['updated_since'];
        }

        $sql = "SELECT p.*, c.name AS category_name, b.name AS brand_name, u.short_code AS unit_code,
                       t.percent AS tax_percent
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                LEFT JOIN brands b ON b.id = p.brand_id
                LEFT JOIN units u ON u.id = p.unit_id
                LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
                {$where}
                ORDER BY p.name ASC LIMIT 1000";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $serialStmt = $this->pdo->prepare(
            "SELECT id, imei1, imei2, serial_no FROM product_serials WHERE product_id = :pid AND status = 'in_stock' LIMIT 100"
        );
        $variantStmt = $this->pdo->prepare(
            'SELECT * FROM product_variants WHERE product_id = :pid AND is_active = 1'
        );
        foreach ($rows as &$row) {
            $row['attributes'] = $row['attributes'] ? json_decode((string) $row['attributes'], true) : [];
            if ((int) $row['track_serial'] === 1) {
                $serialStmt->execute(['pid' => $row['id']]);
                $row['available_serials'] = $serialStmt->fetchAll();
            } else {
                $row['available_serials'] = [];
            }
            $variantStmt->execute(['pid' => $row['id']]);
            $row['variants'] = array_map(function ($v) {
                $v['attributes'] = $v['attributes'] ? json_decode((string) $v['attributes'], true) : [];
                return $v;
            }, $variantStmt->fetchAll());
        }

        Response::json($rows);
    }

    public function show(string $id): void
    {
        AuthMiddleware::authenticate();
        $product = $this->fetchProduct((int) $id);
        if (!$product) {
            Response::error('Product not found', 404);
        }
        Response::json($product);
    }

    public function store(): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $this->pdo->beginTransaction();
        try {
            $id = $this->saveProduct(null, $body);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'create', 'products', $id, ['name' => $body['name'] ?? null]);
            Response::json($this->fetchProduct($id), 201);
        } catch (ValidationException $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to save product: ' . $e->getMessage(), 500);
        }
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $this->pdo->beginTransaction();
        try {
            $this->saveProduct((int) $id, $body);
            $this->pdo->commit();
            AuditLogger::log($this->pdo, $claims, 'update', 'products', (int) $id, ['name' => $body['name'] ?? null]);
            Response::json($this->fetchProduct((int) $id));
        } catch (ValidationException $e) {
            $this->pdo->rollBack();
            Response::error($e->getMessage(), 422);
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            Response::error('Failed to update product: ' . $e->getMessage(), 500);
        }
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        // Soft delete — never destroy historical sale/purchase references.
        $this->pdo->prepare('UPDATE products SET is_active = 0 WHERE id = :id')->execute(['id' => $id]);
        AuditLogger::log($this->pdo, $claims, 'delete', 'products', (int) $id);
        Response::json(['ok' => true]);
    }

    /** GET /api/products/{id}/serials?status=in_stock */
    public function serials(string $id): void
    {
        AuthMiddleware::authenticate();
        $where = 'WHERE product_id = :pid';
        $params = ['pid' => $id];
        if (!empty($_GET['status'])) {
            $where .= ' AND status = :status';
            $params['status'] = $_GET['status'];
        }
        $stmt = $this->pdo->prepare("SELECT * FROM product_serials {$where} ORDER BY id DESC");
        $stmt->execute($params);
        Response::json($stmt->fetchAll());
    }

    /**
     * Variants let Food/Hotel items carry Size+Spice-style combinations and
     * Furniture items carry dimension/material combinations, without a
     * separate table per business type — one generic row per combination.
     */
    public function storeVariant(string $productId): void
    {
        AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($body['variant_name'])) {
            Response::error('variant_name is required', 422);
        }
        $stmt = $this->pdo->prepare(
            'INSERT INTO product_variants (product_id, variant_name, attributes, price_adjustment, barcode, stock_qty)
             VALUES (:pid, :name, :attributes, :price_adjustment, :barcode, :stock_qty)'
        );
        $stmt->execute([
            'pid' => $productId,
            'name' => $body['variant_name'],
            'attributes' => isset($body['attributes']) ? json_encode($body['attributes'], JSON_UNESCAPED_UNICODE) : null,
            'price_adjustment' => (float) ($body['price_adjustment'] ?? 0),
            'barcode' => $body['barcode'] ?? null,
            'stock_qty' => (float) ($body['stock_qty'] ?? 0),
        ]);
        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function updateVariant(string $productId, string $variantId): void
    {
        AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->pdo->prepare(
            'UPDATE product_variants SET variant_name = :name, attributes = :attributes,
                price_adjustment = :price_adjustment, barcode = :barcode, stock_qty = :stock_qty
             WHERE id = :id AND product_id = :pid'
        );
        $stmt->execute([
            'name' => $body['variant_name'] ?? '',
            'attributes' => isset($body['attributes']) ? json_encode($body['attributes'], JSON_UNESCAPED_UNICODE) : null,
            'price_adjustment' => (float) ($body['price_adjustment'] ?? 0),
            'barcode' => $body['barcode'] ?? null,
            'stock_qty' => (float) ($body['stock_qty'] ?? 0),
            'id' => $variantId,
            'pid' => $productId,
        ]);
        Response::json(['ok' => true]);
    }

    public function destroyVariant(string $productId, string $variantId): void
    {
        AuthMiddleware::authenticate();
        $this->pdo->prepare('UPDATE product_variants SET is_active = 0 WHERE id = :id AND product_id = :pid')
            ->execute(['id' => $variantId, 'pid' => $productId]);
        Response::json(['ok' => true]);
    }

    /**
     * @param array<string, mixed> $body
     */
    private function saveProduct(?int $id, array $body): int
    {
        if (empty($body['name'])) {
            throw new ValidationException('Product name is required');
        }
        if (empty($body['business_type'])) {
            throw new ValidationException('business_type is required');
        }

        // HTML <select> "--" options and blank number inputs arrive as '' —
        // coerce those to null so they bind cleanly to INT/DECIMAL columns.
        foreach (['category_id', 'brand_id', 'unit_id', 'tax_rate_id', 'supplier_id', 'low_stock_threshold'] as $nullable) {
            if (($body[$nullable] ?? null) === '') {
                $body[$nullable] = null;
            }
        }

        $attributes = $body['attributes'] ?? [];
        $attributesJson = json_encode($attributes, JSON_UNESCAPED_UNICODE);
        $trackSerial = !empty($body['track_serial']);
        $serials = $trackSerial ? ($body['serials'] ?? []) : [];
        $stockQty = $trackSerial ? count($serials) : (float) ($body['stock_qty'] ?? 0);

        if ($id === null) {
            $stmt = $this->pdo->prepare(
                'INSERT INTO products
                    (uuid, business_type, name, category_id, brand_id, unit_id, tax_rate_id, supplier_id,
                     barcode, sku, purchase_price, selling_price, mrp, stock_qty, low_stock_threshold,
                     track_serial, attributes)
                 VALUES
                    (:uuid, :business_type, :name, :category_id, :brand_id, :unit_id, :tax_rate_id, :supplier_id,
                     :barcode, :sku, :purchase_price, :selling_price, :mrp, :stock_qty, :low_stock_threshold,
                     :track_serial, :attributes)'
            );
            $stmt->execute([
                'uuid' => $body['uuid'] ?? UuidHelper::v4(),
                'business_type' => $body['business_type'],
                'name' => $body['name'],
                'category_id' => $body['category_id'] ?? null,
                'brand_id' => $body['brand_id'] ?? null,
                'unit_id' => $body['unit_id'] ?? null,
                'tax_rate_id' => $body['tax_rate_id'] ?? null,
                'supplier_id' => $body['supplier_id'] ?? null,
                'barcode' => $body['barcode'] ?? null,
                'sku' => $body['sku'] ?? null,
                'purchase_price' => (float) ($body['purchase_price'] ?? 0),
                'selling_price' => (float) ($body['selling_price'] ?? 0),
                'mrp' => (float) ($body['mrp'] ?? 0),
                'stock_qty' => $stockQty,
                'low_stock_threshold' => $body['low_stock_threshold'] ?? null,
                'track_serial' => $trackSerial ? 1 : 0,
                'attributes' => $attributesJson,
            ]);
            $newId = (int) $this->pdo->lastInsertId();

            if ($trackSerial) {
                $insertSerial = $this->pdo->prepare(
                    'INSERT INTO product_serials (product_id, imei1, imei2, serial_no, status) VALUES (:pid, :imei1, :imei2, :serial_no, \'in_stock\')'
                );
                foreach ($serials as $s) {
                    $insertSerial->execute([
                        'pid' => $newId,
                        'imei1' => $s['imei1'] ?? null,
                        'imei2' => $s['imei2'] ?? null,
                        'serial_no' => $s['serial_no'] ?? null,
                    ]);
                }
            }

            if ($stockQty > 0) {
                $this->pdo->prepare(
                    'INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, notes)
                     VALUES (:uuid, :pid, :qty, \'opening\', \'manual\', \'Opening stock\')'
                )->execute(['uuid' => UuidHelper::v4(), 'pid' => $newId, 'qty' => $stockQty]);
            }

            return $newId;
        }

        $stmt = $this->pdo->prepare(
            'UPDATE products SET
                business_type = :business_type, name = :name, category_id = :category_id, brand_id = :brand_id,
                unit_id = :unit_id, tax_rate_id = :tax_rate_id, supplier_id = :supplier_id, barcode = :barcode,
                sku = :sku, purchase_price = :purchase_price, selling_price = :selling_price, mrp = :mrp,
                low_stock_threshold = :low_stock_threshold, track_serial = :track_serial, attributes = :attributes
             WHERE id = :id'
        );
        $stmt->execute([
            'business_type' => $body['business_type'],
            'name' => $body['name'],
            'category_id' => $body['category_id'] ?? null,
            'brand_id' => $body['brand_id'] ?? null,
            'unit_id' => $body['unit_id'] ?? null,
            'tax_rate_id' => $body['tax_rate_id'] ?? null,
            'supplier_id' => $body['supplier_id'] ?? null,
            'barcode' => $body['barcode'] ?? null,
            'sku' => $body['sku'] ?? null,
            'purchase_price' => (float) ($body['purchase_price'] ?? 0),
            'selling_price' => (float) ($body['selling_price'] ?? 0),
            'mrp' => (float) ($body['mrp'] ?? 0),
            'low_stock_threshold' => $body['low_stock_threshold'] ?? null,
            'track_serial' => !empty($body['track_serial']) ? 1 : 0,
            'attributes' => $attributesJson,
            'id' => $id,
        ]);

        return $id;
    }

    private function fetchProduct(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, c.name AS category_name, b.name AS brand_name, u.short_code AS unit_code,
                    t.percent AS tax_percent
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN brands b ON b.id = p.brand_id
             LEFT JOIN units u ON u.id = p.unit_id
             LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
             WHERE p.id = :id'
        );
        $stmt->execute(['id' => $id]);
        $product = $stmt->fetch();
        if (!$product) {
            return null;
        }
        $product['attributes'] = $product['attributes'] ? json_decode((string) $product['attributes'], true) : [];

        $variants = $this->pdo->prepare('SELECT * FROM product_variants WHERE product_id = :id AND is_active = 1');
        $variants->execute(['id' => $id]);
        $product['variants'] = $variants->fetchAll();

        return $product;
    }
}
