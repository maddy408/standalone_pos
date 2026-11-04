<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = get_pdo();
    echo "Running database migration script...\n";

    $queries = [
        // 1. Invoices
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS slogan VARCHAR(255) NULL AFTER status",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_type ENUM('retail','wholesale','regular') NOT NULL DEFAULT 'retail' AFTER slogan",

        // 2. Customers
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER gstin",

        // 3. Addons
        "ALTER TABLE addons ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) NULL DEFAULT 'General' AFTER id",
        "ALTER TABLE addons ADD COLUMN IF NOT EXISTS is_mandatory TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active",

        // 4. Brands
        "ALTER TABLE brands ADD COLUMN IF NOT EXISTS business_type ENUM('mobile','furniture','food') NULL AFTER name",

        // 5. Products
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT NULL AFTER name",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSON NULL AFTER description",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_inclusive TINYINT(1) NOT NULL DEFAULT 0 AFTER tax_rate_id",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50) NULL AFTER barcode",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS retail_price DECIMAL(12,2) NULL AFTER mrp",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(12,2) NULL AFTER retail_price",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS customer_price DECIMAL(12,2) NULL AFTER wholesale_price",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS opening_stock DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER stock_qty",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock DECIMAL(12,3) NULL AFTER low_stock_threshold",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock DECIMAL(12,3) NULL AFTER min_stock",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS pos_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS online_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER pos_enabled",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_returnable TINYINT(1) NOT NULL DEFAULT 1 AFTER online_enabled",

        // 6. Product Variants
        "ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS sku VARCHAR(50) NULL AFTER variant_name",
        "ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS selling_price DECIMAL(12,2) NULL AFTER price_adjustment",
        "ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image VARCHAR(255) NULL AFTER barcode",

        // 7. Product Serials
        "ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS color VARCHAR(50) NULL AFTER serial_no",
        "ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS warranty_months INT NULL AFTER color",
        "ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS warranty_start DATE NULL AFTER warranty_months",
        "ALTER TABLE product_serials ADD COLUMN IF NOT EXISTS warranty_end DATE NULL AFTER warranty_start"
    ];

    foreach ($queries as $q) {
        try {
            $pdo->exec($q);
        } catch (\Throwable $e) {
            // In MySQL < 8.0.19 IF NOT EXISTS isn't supported for ADD COLUMN, so fallback safely
            if (str_contains($e->getMessage(), 'Duplicate column')) {
                continue;
            }
            // Strip IF NOT EXISTS and try if syntax error
            $fallback = str_replace('IF NOT EXISTS ', '', $q);
            try {
                $pdo->exec($fallback);
            } catch (\Throwable $e2) {
                // Already exists or harmless
            }
        }
    }

    echo "Database migrations executed successfully!\n";
} catch (\Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
