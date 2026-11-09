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
        
        try {
            $this->pdo->exec("SET SESSION sort_buffer_size = 16777216");
        } catch (\Throwable) {}

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

        // We avoid ORDER BY inside MySQL to prevent MySQL 1038 Out of sort memory
        // on remote servers with strict sort_buffer limits when large text/JSON exists.
        $sql = "SELECT p.id, p.uuid, p.business_type, p.name, p.category_id, p.brand_id, p.unit_id,
                       p.tax_rate_id, p.tax_inclusive, p.supplier_id, p.barcode, p.hsn_code, p.sku,
                       p.purchase_price, p.selling_price, p.mrp, p.retail_price, p.wholesale_price,
                       p.customer_price, p.stock_qty, p.opening_stock, p.low_stock_threshold,
                       p.min_stock, p.max_stock, p.track_serial, p.pos_enabled, p.online_enabled,
                       p.is_returnable, p.is_active, p.created_at, p.updated_at,
                       p.attributes,
                       c.name AS category_name, b.name AS brand_name, u.short_code AS unit_code,
                       t.percent AS tax_percent
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                LEFT JOIN brands b ON b.id = p.brand_id
                LEFT JOIN units u ON u.id = p.unit_id
                LEFT JOIN tax_rates t ON t.id = p.tax_rate_id
                {$where}
                LIMIT 500";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll();

        // Sort in PHP memory where memory limit is high and never throws MySQL 1038
        usort($products, fn($a, $b) => ($b['id'] ?? 0) <=> ($a['id'] ?? 0));

        // Attach variants, images, serials, and format attributes
        foreach ($products as &$p) {
            $p['attributes'] = json_decode((string) ($p['attributes'] ?? '{}'), true) ?? (object) [];
            $p['images'] = json_decode((string) ($p['images'] ?? '[]'), true) ?? [];

            $vStmt = $this->pdo->prepare('SELECT * FROM product_variants WHERE product_id = :pid AND is_active = 1');
            $vStmt->execute(['pid' => $p['id']]);
            $p['variants'] = $vStmt->fetchAll();

            $sStmt = $this->pdo->prepare(
                "SELECT id, imei1, imei2, serial_no, color, warranty_months, warranty_start, warranty_end, status 
                 FROM product_serials WHERE product_id = :pid AND status = 'in_stock'"
            );
            $sStmt->execute(['pid' => $p['id']]);
            $p['available_serials'] = $sStmt->fetchAll();
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
            $product = $this->fetchProduct($id);
            Response::json($product, 201);
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
            $product = $this->fetchProduct((int) $id);
            Response::json($product);
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

    public function fetchProduct(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM products WHERE id = :id AND is_active = 1');
        $stmt->execute(['id' => $id]);
        $p = $stmt->fetch();
        if (!$p) {
            return null;
        }
        $p['attributes'] = json_decode((string) ($p['attributes'] ?? '{}'), true) ?? (object) [];
        $p['images'] = json_decode((string) ($p['images'] ?? '[]'), true) ?? [];

        $vStmt = $this->pdo->prepare('SELECT * FROM product_variants WHERE product_id = :pid AND is_active = 1');
        $vStmt->execute(['pid' => $id]);
        $p['variants'] = $vStmt->fetchAll();

        $sStmt = $this->pdo->prepare(
            "SELECT id, imei1, imei2, serial_no, color, warranty_months, warranty_start, warranty_end, status 
             FROM product_serials WHERE product_id = :pid AND status = 'in_stock'"
        );
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
            'INSERT INTO product_variants (product_id, variant_name, sku, attributes, price_adjustment, selling_price, barcode, image, stock_qty)
             VALUES (:pid, :name, :sku, :attributes, :price_adjustment, :selling_price, :barcode, :image, :stock_qty)'
        );
        $stmt->execute([
            'pid' => $productId,
            'name' => $body['variant_name'],
            'sku' => $body['sku'] ?? null,
            'attributes' => isset($body['attributes']) ? json_encode($body['attributes'], JSON_UNESCAPED_UNICODE) : null,
            'price_adjustment' => (float) ($body['price_adjustment'] ?? 0),
            'selling_price' => isset($body['selling_price']) ? (float) $body['selling_price'] : null,
            'barcode' => $body['barcode'] ?? null,
            'image' => $body['image'] ?? null,
            'stock_qty' => (float) ($body['stock_qty'] ?? 0),
        ]);
        Response::json(['id' => (int) $this->pdo->lastInsertId()], 201);
    }

    public function updateVariant(string $productId, string $variantId): void
    {
        AuthMiddleware::authenticate();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $stmt = $this->pdo->prepare(
            'UPDATE product_variants SET variant_name = :name, sku = :sku, attributes = :attributes,
                price_adjustment = :price_adjustment, selling_price = :selling_price, barcode = :barcode, image = :image, stock_qty = :stock_qty
             WHERE id = :id AND product_id = :pid'
        );
        $stmt->execute([
            'name' => $body['variant_name'] ?? '',
            'sku' => $body['sku'] ?? null,
            'attributes' => isset($body['attributes']) ? json_encode($body['attributes'], JSON_UNESCAPED_UNICODE) : null,
            'price_adjustment' => (float) ($body['price_adjustment'] ?? 0),
            'selling_price' => isset($body['selling_price']) ? (float) $body['selling_price'] : null,
            'barcode' => $body['barcode'] ?? null,
            'image' => $body['image'] ?? null,
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

        foreach (['category_id', 'brand_id', 'unit_id', 'tax_rate_id', 'supplier_id', 'low_stock_threshold', 'min_stock', 'max_stock'] as $nullable) {
            if (($body[$nullable] ?? null) === '') {
                $body[$nullable] = null;
            }
        }

        $this->assertCategoryMatchesBusinessType($body['category_id'] ?? null, $body['business_type']);
        $this->assertBrandMatchesBusinessType($body['brand_id'] ?? null, $body['business_type']);

        $attributes = $body['attributes'] ?? [];
        $attributesJson = json_encode($attributes, JSON_UNESCAPED_UNICODE);
        
        $images = $body['images'] ?? [];
        $imagesJson = json_encode(is_array($images) ? $images : [], JSON_UNESCAPED_UNICODE);

        $trackSerial = !empty($body['track_serial']);
        $serials = $trackSerial ? ($body['serials'] ?? []) : [];
        $variants = $body['variants'] ?? [];

        // Auto barcode generation if empty
        $barcode = !empty($body['barcode']) ? trim($body['barcode']) : null;
        if (empty($barcode)) {
            $prefix = strtoupper(substr($body['business_type'], 0, 3));
            $barcode = $prefix . mt_rand(10000000, 99999999);
        }

        $retailPrice = (float) ($body['retail_price'] ?? $body['selling_price'] ?? 0);
        $wholesalePrice = (float) ($body['wholesale_price'] ?? 0);
        $customerPrice = (float) ($body['customer_price'] ?? 0);
        $sellingPrice = (float) ($body['selling_price'] ?? $retailPrice);
        $purchasePrice = (float) ($body['purchase_price'] ?? 0);
        $mrp = (float) ($body['mrp'] ?? 0);

        $stockQty = $trackSerial ? count($serials) : (float) ($body['stock_qty'] ?? 0);
        $openingStock = isset($body['opening_stock']) ? (float)$body['opening_stock'] : $stockQty;

        if ($id === null) {
            $hasMfg = $this->hasProductColumn('mfg_date');
            $hasExp = $this->hasProductColumn('exp_date');

            $mfgCol = $hasMfg ? ', mfg_date' : '';
            $mfgVal = $hasMfg ? ', :mfg_date' : '';
            $expCol = $hasExp ? ', exp_date' : '';
            $expVal = $hasExp ? ', :exp_date' : '';

            $stmt = $this->pdo->prepare(
                "INSERT INTO products
                    (uuid, business_type, name, description, images, category_id, brand_id, unit_id, tax_rate_id, tax_inclusive, supplier_id,
                     barcode, sku, hsn_code, purchase_price, selling_price, mrp, retail_price, wholesale_price, customer_price,
                     stock_qty, opening_stock, low_stock_threshold, min_stock, max_stock, track_serial, pos_enabled, online_enabled, is_returnable, attributes{$mfgCol}{$expCol})
                 VALUES
                    (:uuid, :business_type, :name, :description, :images, :category_id, :brand_id, :unit_id, :tax_rate_id, :tax_inclusive, :supplier_id,
                     :barcode, :sku, :hsn_code, :purchase_price, :selling_price, :mrp, :retail_price, :wholesale_price, :customer_price,
                     :stock_qty, :opening_stock, :low_stock_threshold, :min_stock, :max_stock, :track_serial, :pos_enabled, :online_enabled, :is_returnable, :attributes{$mfgVal}{$expVal})"
            );

            $params = [
                'uuid' => $body['uuid'] ?? UuidHelper::v4(),
                'business_type' => $body['business_type'],
                'name' => $body['name'],
                'description' => $body['description'] ?? null,
                'images' => $imagesJson,
                'category_id' => $body['category_id'] ?? null,
                'brand_id' => $body['brand_id'] ?? null,
                'unit_id' => $body['unit_id'] ?? null,
                'tax_rate_id' => $body['tax_rate_id'] ?? null,
                'tax_inclusive' => !empty($body['tax_inclusive']) ? 1 : 0,
                'supplier_id' => $body['supplier_id'] ?? null,
                'barcode' => $barcode,
                'sku' => $body['sku'] ?? null,
                'hsn_code' => $body['hsn_code'] ?? null,
                'purchase_price' => $purchasePrice,
                'selling_price' => $sellingPrice,
                'mrp' => $mrp,
                'retail_price' => $retailPrice,
                'wholesale_price' => $wholesalePrice,
                'customer_price' => $customerPrice,
                'stock_qty' => $stockQty,
                'opening_stock' => $openingStock,
                'low_stock_threshold' => $body['low_stock_threshold'] ?? null,
                'min_stock' => $body['min_stock'] ?? null,
                'max_stock' => $body['max_stock'] ?? null,
                'track_serial' => $trackSerial ? 1 : 0,
                'pos_enabled' => isset($body['pos_enabled']) ? (!empty($body['pos_enabled']) ? 1 : 0) : 1,
                'online_enabled' => isset($body['online_enabled']) ? (!empty($body['online_enabled']) ? 1 : 0) : 1,
                'is_returnable' => isset($body['is_returnable']) ? (!empty($body['is_returnable']) ? 1 : 0) : 1,
                'attributes' => $attributesJson,
            ];

            if ($hasMfg) {
                $params['mfg_date'] = !empty($body['mfg_date']) ? $body['mfg_date'] : null;
            }
            if ($hasExp) {
                $params['exp_date'] = !empty($body['exp_date']) ? $body['exp_date'] : null;
            }

            $stmt->execute($params);
            $newId = (int) $this->pdo->lastInsertId();

            // Insert Serials / IMEIs
            if ($trackSerial && !empty($serials)) {
                $insertSerial = $this->pdo->prepare(
                    'INSERT INTO product_serials (product_id, imei1, imei2, serial_no, color, warranty_months, warranty_start, warranty_end, status) 
                     VALUES (:pid, :imei1, :imei2, :serial_no, :color, :w_months, :w_start, :w_end, \'in_stock\')'
                );
                foreach ($serials as $s) {
                    if (!empty($s['imei1']) || !empty($s['serial_no'])) {
                        $insertSerial->execute([
                            'pid' => $newId,
                            'imei1' => !empty($s['imei1']) ? trim($s['imei1']) : null,
                            'imei2' => !empty($s['imei2']) ? trim($s['imei2']) : null,
                            'serial_no' => !empty($s['serial_no']) ? trim($s['serial_no']) : null,
                            'color' => $s['color'] ?? ($attributes['color'] ?? null),
                            'w_months' => !empty($s['warranty_months']) ? (int)$s['warranty_months'] : (!empty($attributes['warranty_period']) ? (int)$attributes['warranty_period'] : null),
                            'w_start' => $s['warranty_start'] ?? ($attributes['warranty_start'] ?? null),
                            'w_end' => $s['warranty_end'] ?? ($attributes['warranty_end'] ?? null),
                        ]);
                    }
                }
            }

            // Insert Variants
            if (!empty($variants) && is_array($variants)) {
                $insVariant = $this->pdo->prepare(
                    'INSERT INTO product_variants (product_id, variant_name, sku, price_adjustment, selling_price, barcode, stock_qty)
                     VALUES (:pid, :name, :sku, :price_adj, :sell_price, :barcode, :stock)'
                );
                foreach ($variants as $v) {
                    if (!empty($v['variant_name'])) {
                        $insVariant->execute([
                            'pid' => $newId,
                            'name' => trim($v['variant_name']),
                            'sku' => $v['sku'] ?? null,
                            'price_adj' => (float)($v['price_adjustment'] ?? 0),
                            'sell_price' => isset($v['selling_price']) ? (float)$v['selling_price'] : ($sellingPrice + (float)($v['price_adjustment'] ?? 0)),
                            'barcode' => !empty($v['barcode']) ? trim($v['barcode']) : null,
                            'stock' => (float)($v['stock_qty'] ?? 0),
                        ]);
                    }
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

        // On edit update
        $curStockStmt = $this->pdo->prepare('SELECT stock_qty FROM products WHERE id = :id');
        $curStockStmt->execute(['id' => $id]);
        $oldStock = (float) ($curStockStmt->fetchColumn() ?? 0);
        $newStock = isset($body['stock_qty']) ? (float) $body['stock_qty'] : $oldStock;

        $hasMfg = $this->hasProductColumn('mfg_date');
        $hasExp = $this->hasProductColumn('exp_date');

        $mfgSet = $hasMfg ? ', mfg_date = :mfg_date' : '';
        $expSet = $hasExp ? ', exp_date = :exp_date' : '';

        $stmt = $this->pdo->prepare(
            "UPDATE products SET
                business_type = :business_type, name = :name, description = :description, images = :images,
                category_id = :category_id, brand_id = :brand_id, unit_id = :unit_id, tax_rate_id = :tax_rate_id,
                tax_inclusive = :tax_inclusive, supplier_id = :supplier_id, barcode = :barcode,
                sku = :sku,
                hsn_code = :hsn_code, purchase_price = :purchase_price, selling_price = :selling_price, mrp = :mrp,
                retail_price = :retail_price, wholesale_price = :wholesale_price, customer_price = :customer_price,
                stock_qty = :stock_qty, opening_stock = :opening_stock, low_stock_threshold = :low_stock_threshold,
                min_stock = :min_stock, max_stock = :max_stock, track_serial = :track_serial,
                pos_enabled = :pos_enabled, online_enabled = :online_enabled, is_returnable = :is_returnable,
                attributes = :attributes{$mfgSet}{$expSet}
             WHERE id = :id"
        );

        $params = [
            'business_type' => $body['business_type'],
            'name' => $body['name'],
            'description' => $body['description'] ?? null,
            'images' => $imagesJson,
            'category_id' => $body['category_id'] ?? null,
            'brand_id' => $body['brand_id'] ?? null,
            'unit_id' => $body['unit_id'] ?? null,
            'tax_rate_id' => $body['tax_rate_id'] ?? null,
            'tax_inclusive' => !empty($body['tax_inclusive']) ? 1 : 0,
            'supplier_id' => $body['supplier_id'] ?? null,
            'barcode' => $barcode,
            'sku' => $body['sku'] ?? null,
            'hsn_code' => $body['hsn_code'] ?? null,
            'purchase_price' => $purchasePrice,
            'selling_price' => $sellingPrice,
            'mrp' => $mrp,
            'retail_price' => $retailPrice,
            'wholesale_price' => $wholesalePrice,
            'customer_price' => $customerPrice,
            'stock_qty' => $newStock,
            'opening_stock' => $openingStock,
            'low_stock_threshold' => $body['low_stock_threshold'] ?? null,
            'min_stock' => $body['min_stock'] ?? null,
            'max_stock' => $body['max_stock'] ?? null,
            'track_serial' => $trackSerial ? 1 : 0,
            'pos_enabled' => isset($body['pos_enabled']) ? (!empty($body['pos_enabled']) ? 1 : 0) : 1,
            'online_enabled' => isset($body['online_enabled']) ? (!empty($body['online_enabled']) ? 1 : 0) : 1,
            'is_returnable' => isset($body['is_returnable']) ? (!empty($body['is_returnable']) ? 1 : 0) : 1,
            'attributes' => $attributesJson,
            'id' => $id,
        ];

        if ($hasMfg) {
            $params['mfg_date'] = !empty($body['mfg_date']) ? $body['mfg_date'] : null;
        }
        if ($hasExp) {
            $params['exp_date'] = !empty($body['exp_date']) ? $body['exp_date'] : null;
        }

        $stmt->execute($params);
            'max_stock' => $body['max_stock'] ?? null,
            'track_serial' => !empty($body['track_serial']) ? 1 : 0,
            'pos_enabled' => isset($body['pos_enabled']) ? (!empty($body['pos_enabled']) ? 1 : 0) : 1,
            'online_enabled' => isset($body['online_enabled']) ? (!empty($body['online_enabled']) ? 1 : 0) : 1,
            'is_returnable' => isset($body['is_returnable']) ? (!empty($body['is_returnable']) ? 1 : 0) : 1,
            'attributes' => $attributesJson,
            'id' => $id,
        ]);

        // If new serials provided in edit mode, insert any missing ones
        if ($trackSerial && !empty($serials)) {
            $insertSerial = $this->pdo->prepare(
                'INSERT INTO product_serials (product_id, imei1, imei2, serial_no, color, warranty_months, warranty_start, warranty_end, status) 
                 VALUES (:pid, :imei1, :imei2, :serial_no, :color, :w_months, :w_start, :w_end, \'in_stock\')'
            );
            foreach ($serials as $s) {
                if (!empty($s['imei1']) || !empty($s['serial_no'])) {
                    // Check if already exists for this product
                    $chk = $this->pdo->prepare("SELECT id FROM product_serials WHERE product_id = :pid AND (imei1 = :im1 OR serial_no = :sn)");
                    $chk->execute(['pid' => $id, 'im1' => $s['imei1'] ?? '', 'sn' => $s['serial_no'] ?? '']);
                    if (!$chk->fetch()) {
                        $insertSerial->execute([
                            'pid' => $id,
                            'imei1' => !empty($s['imei1']) ? trim($s['imei1']) : null,
                            'imei2' => !empty($s['imei2']) ? trim($s['imei2']) : null,
                            'serial_no' => !empty($s['serial_no']) ? trim($s['serial_no']) : null,
                            'color' => $s['color'] ?? ($attributes['color'] ?? null),
                            'w_months' => !empty($s['warranty_months']) ? (int)$s['warranty_months'] : (!empty($attributes['warranty_period']) ? (int)$attributes['warranty_period'] : null),
                            'w_start' => $s['warranty_start'] ?? ($attributes['warranty_start'] ?? null),
                            'w_end' => $s['warranty_end'] ?? ($attributes['warranty_end'] ?? null),
                        ]);
                    }
                }
            }
        }

        // If variants provided in edit mode
        if (isset($body['variants']) && is_array($body['variants'])) {
            $insVariant = $this->pdo->prepare(
                'INSERT INTO product_variants (product_id, variant_name, sku, price_adjustment, selling_price, barcode, stock_qty)
                 VALUES (:pid, :name, :sku, :price_adj, :sell_price, :barcode, :stock)'
            );
            $updVariant = $this->pdo->prepare(
                'UPDATE product_variants SET variant_name = :name, sku = :sku, price_adjustment = :price_adj,
                 selling_price = :sell_price, barcode = :barcode, stock_qty = :stock WHERE id = :id AND product_id = :pid'
            );
            foreach ($body['variants'] as $v) {
                if (!empty($v['id'])) {
                    $updVariant->execute([
                        'name' => trim($v['variant_name'] ?? ''),
                        'sku' => $v['sku'] ?? null,
                        'price_adj' => (float)($v['price_adjustment'] ?? 0),
                        'sell_price' => isset($v['selling_price']) ? (float)$v['selling_price'] : null,
                        'barcode' => !empty($v['barcode']) ? trim($v['barcode']) : null,
                        'stock' => (float)($v['stock_qty'] ?? 0),
                        'id' => $v['id'],
                        'pid' => $id,
                    ]);
                } else if (!empty($v['variant_name'])) {
                    $insVariant->execute([
                        'pid' => $id,
                        'name' => trim($v['variant_name']),
                        'sku' => $v['sku'] ?? null,
                        'price_adj' => (float)($v['price_adjustment'] ?? 0),
                        'sell_price' => isset($v['selling_price']) ? (float)$v['selling_price'] : ($sellingPrice + (float)($v['price_adjustment'] ?? 0)),
                        'barcode' => !empty($v['barcode']) ? trim($v['barcode']) : null,
                        'stock' => (float)($v['stock_qty'] ?? 0),
                    ]);
                }
            }
        }

        if (abs($newStock - $oldStock) > 0.0001) {
            $diff = $newStock - $oldStock;
            $this->pdo->prepare(
                'INSERT INTO stock_movements (uuid, product_id, qty_change, movement_type, ref_type, notes)
                 VALUES (:uuid, :pid, :qty, \'adjustment\', \'manual\', \'Manual edit from product form\')'
            )->execute(['uuid' => UuidHelper::v4(), 'pid' => $id, 'qty' => $diff]);
        }

        return $id;
    }

    /**
     * Safe sync creation endpoint for offline product push
     */
    public function createFromSync(array $body, array $claims): array
    {
        PermissionMiddleware::requireOrThrow($claims, 'products.manage');
        $uuid = $body['uuid'] ?? UuidHelper::v4();
        $existing = $this->pdo->prepare('SELECT * FROM products WHERE uuid = :uuid');
        $existing->execute(['uuid' => $uuid]);
        if ($row = $existing->fetch()) {
            return [$this->fetchProduct((int)$row['id']), 200];
        }

        $id = $this->saveProduct(null, $body);
        return [$this->fetchProduct($id), 201];
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

    private function hasProductColumn(string $column): bool
    {
        static $cols = null;
        if ($cols === null) {
            try {
                $cols = $this->pdo->query('DESCRIBE products')->fetchAll(PDO::FETCH_COLUMN) ?: [];
            } catch (\Throwable) {
                $cols = [];
            }
        }
        return in_array($column, $cols, true);
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
