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
                ORDER BY p.name ASC
                LIMIT 500";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll();

        // Attach variants and available serials for each product
        foreach ($products as &$p) {
            $p['attributes'] = json_decode((string) $p['attributes'], true) ?? (object) [];
            $vStmt = $this->pdo->prepare('SELECT * FROM product_variants WHERE product_id = :pid AND is_active = 1');
            $vStmt->execute(['pid' => $p['id']]);
            $p['variants'] = $vStmt->fetchAll();

            if (!empty($p['track_serial'])) {
                $sStmt = $this->pdo->prepare(
                    "SELECT id, imei1, imei2, serial_no FROM product_serials
                     WHERE product_id = :pid AND status = 'in_stock'"
                );
                $sStmt->execute(['pid' => $p['id']]);
                $p['available_serials'] = $sStmt->fetchAll();
            } else {
                $p['available_serials'] = [];
            }
        }

        Response::json($products);
    }

    public function show(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.view');
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
        try {
            $id = $this->saveProduct(null, $body);
            AuditLogger::log($this->pdo, $claims, 'create', 'products', $id, ['name' => $body['name'] ?? '']);
            Response::json(['id' => $id], 201);
        } catch (ValidationException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function update(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        try {
            $this->saveProduct((int) $id, $body);
            AuditLogger::log($this->pdo, $claims, 'update', 'products', (int) $id, ['name' => $body['name'] ?? '']);
            Response::json(['ok' => true]);
        } catch (ValidationException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function destroy(string $id): void
    {
        $claims = AuthMiddleware::authenticate();
        PermissionMiddleware::require($claims, 'products.manage');
        $stmt = $this->pdo->prepare('UPDATE products SET is_active = 0 WHERE id = :id');
        $stmt->execute(['id' => $id]);
        AuditLogger::log($this->pdo, $claims, 'delete', 'products', (int) $id);
        Response::json(['ok' => true]);
    }

    private function fetchProduct(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM products WHERE id = :id AND is_active = 1');
        $stmt->execute(['id' => $id]);
        $p = $stmt->fetch();
        if (!$p) {
            return null;
        }
        $p['attributes'] = json_decode((string) $p['attributes'], true) ?? (object) [];

        $vStmt = $this->pdo->prepare('SELECT * FROM product_variants WHERE product_id = :pid AND is_active = 1');
        $vStmt->execute(['pid' => $id]);
        $p['variants'] = $vStmt->fetchAll();

        $sStmt = $this->pdo->prepare('SELECT * FROM product_serials WHERE product_id = :pid AND status = \'in_stock\'');
        $sStmt->execute(['pid' => $id]);
        $p['available_serials'] = $sStmt->fetchAll();

        return $p;
    }

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

        foreach (['category_id', 'brand_id', 'unit_id', 'tax_rate_id', 'supplier_id', 'low_stock_threshold'] as $nullable) {
            if (($body[$nullable] ?? null) === '') {
                $body[$nullable] = null;
            }
        }

        $this->assertCategoryMatchesBusinessType($body['category_id'] ?? null, $body['business_type']);
        $this->assertBrandMatchesBusinessType($body['brand_id'] ?? null, $body['business_type']);

        $attributes = $body['attributes'] ?? [];
        $attributesJson = json_encode($attributes, JSON_UNESCAPED_UNICODE);
        $trackSerial = !empty($body['track_serial']);
        $serials = $trackSerial ? ($body['serials'] ?? []) : [];
        $stockQty = $trackSerial ? count($serials) : (float) ($body['stock_qty'] ?? 0);

        $retailPrice = (float) ($body['retail_price'] ?? $body['selling_price'] ?? 0);
        $wholesalePrice = (float) ($body['wholesale_price'] ?? 0);
        $customerPrice = (float) ($body['customer_price'] ?? 0);
        $sellingPrice = (float) ($body['selling_price'] ?? $retailPrice);

        if ($id === null) {
            $stmt = $this->pdo->prepare(
                'INSERT INTO products
                    (uuid, business_type, name, category_id, brand_id, unit_id, tax_rate_id, supplier_id,
                     barcode, sku, purchase_price, selling_price, mrp, retail_price, wholesale_price, customer_price,
                     stock_qty, low_stock_threshold, track_serial, attributes)
                 VALUES
                    (:uuid, :business_type, :name, :category_id, :brand_id, :unit_id, :tax_rate_id, :supplier_id,
                     :barcode, :sku, :purchase_price, :selling_price, :mrp, :retail_price, :wholesale_price, :customer_price,
                     :stock_qty, :low_stock_threshold, :track_serial, :attributes)'
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
                'selling_price' => $sellingPrice,
                'mrp' => (float) ($body['mrp'] ?? 0),
                'retail_price' => $retailPrice,
                'wholesale_price' => $wholesalePrice,
                'customer_price' => $customerPrice,
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

        // On edit, update stock_qty directly as requested, and record a movement if changed
        $curStockStmt = $this->pdo->prepare('SELECT stock_qty FROM products WHERE id = :id');
        $curStockStmt->execute(['id' => $id]);
        $oldStock = (float) ($curStockStmt->fetchColumn() ?? 0);

        $newStock = isset($body['stock_qty']) ? (float) $body['stock_qty'] : $oldStock;

        $stmt = $this->pdo->prepare(
            'UPDATE products SET
                business_type = :business_type, name = :name, category_id = :category_id, brand_id = :brand_id,
                unit_id = :unit_id, tax_rate_id = :tax_rate_id, supplier_id = :supplier_id, barcode = :barcode,
                sku = :sku, purchase_price = :purchase_price, selling_price = :selling_price, mrp = :mrp,
                retail_price = :retail_price, wholesale_price = :wholesale_price, customer_price = :customer_price,
                stock_qty = :stock_qty, low_stock_threshold = :low_stock_threshold, track_serial = :track_serial,
                attributes = :attributes
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
            'selling_price' => $sellingPrice,
            'mrp' => (float) ($body['mrp'] ?? 0),
            'retail_price' => $retailPrice,
            'wholesale_price' => $wholesalePrice,
            'customer_price' => $customerPrice,
            'stock_qty' => $newStock,
            'low_stock_threshold' => $body['low_stock_threshold'] ?? null,
            'track_serial' => !empty($body['track_serial']) ? 1 : 0,
            'attributes' => $attributesJson,
            'id' => $id,
        ]);

        if (abs($newStock - $oldStock) > 0.0001) {
            $diff = $newStock - $oldStock;
            $this->pdo->prepare(
                'INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, notes)
                 VALUES (:uuid, :pid, :qty, \'adjustment\', \'manual\', \'Manual edit from product form\')'
            )->execute(['uuid' => UuidHelper::v4(), 'pid' => $id, 'qty' => $diff]);
        }

        return $id;
    }

    private function assertCategoryMatchesBusinessType(mixed $categoryId, string $businessType): void
    {
        if ($categoryId === null) {
            return;
        }
        $stmt = $this->pdo->prepare('SELECT business_type FROM categories WHERE id = :id');
        $stmt->execute(['id' => $categoryId]);
        $row = $stmt->fetch();
        if ($row && $row['business_type'] !== $businessType) {
            throw new ValidationException('Category does not belong to the active business type');
        }
    }

    private function assertBrandMatchesBusinessType(mixed $brandId, string $businessType): void
    {
        if ($brandId === null) {
            return;
        }
        $stmt = $this->pdo->prepare('SELECT business_type FROM brands WHERE id = :id');
        $stmt->execute(['id' => $brandId]);
        $row = $stmt->fetch();
        if ($row && $row['business_type'] !== null && $row['business_type'] !== $businessType) {
            throw new ValidationException('Brand does not belong to the active business type');
        }
    }
}
