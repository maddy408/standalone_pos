-- Migration script to bring any existing database up to date
-- Run this script if you pulled code and encounter "column not found" errors

-- 1. Invoices table
ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS slogan VARCHAR(255) NULL AFTER status,
    ADD COLUMN IF NOT EXISTS customer_type ENUM('retail','wholesale','regular') NOT NULL DEFAULT 'retail' AFTER slogan;

-- 2. Customers table
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER gstin;

-- 3. Addons table
ALTER TABLE addons
    ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) NULL DEFAULT 'General' AFTER id,
    ADD COLUMN IF NOT EXISTS is_mandatory TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

-- 4. Brands table
ALTER TABLE brands
    ADD COLUMN IF NOT EXISTS business_type ENUM('mobile','furniture','food') NULL AFTER name;

-- 5. Products table
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS description TEXT NULL AFTER name,
    ADD COLUMN IF NOT EXISTS images JSON NULL AFTER description,
    ADD COLUMN IF NOT EXISTS tax_inclusive TINYINT(1) NOT NULL DEFAULT 0 AFTER tax_rate_id,
    ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50) NULL AFTER barcode,
    ADD COLUMN IF NOT EXISTS retail_price DECIMAL(12,2) NULL AFTER mrp,
    ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(12,2) NULL AFTER retail_price,
    ADD COLUMN IF NOT EXISTS customer_price DECIMAL(12,2) NULL AFTER wholesale_price,
    ADD COLUMN IF NOT EXISTS opening_stock DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER stock_qty,
    ADD COLUMN IF NOT EXISTS min_stock DECIMAL(12,3) NULL AFTER low_stock_threshold,
    ADD COLUMN IF NOT EXISTS max_stock DECIMAL(12,3) NULL AFTER min_stock,
    ADD COLUMN IF NOT EXISTS pos_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active,
    ADD COLUMN IF NOT EXISTS online_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER pos_enabled,
    ADD COLUMN IF NOT EXISTS is_returnable TINYINT(1) NOT NULL DEFAULT 1 AFTER online_enabled;

-- 6. Product Variants table
ALTER TABLE product_variants
    ADD COLUMN IF NOT EXISTS sku VARCHAR(50) NULL AFTER variant_name,
    ADD COLUMN IF NOT EXISTS selling_price DECIMAL(12,2) NULL AFTER price_adjustment,
    ADD COLUMN IF NOT EXISTS image VARCHAR(255) NULL AFTER barcode;

-- 7. Product Serials table
ALTER TABLE product_serials
    ADD COLUMN IF NOT EXISTS color VARCHAR(50) NULL AFTER serial_no,
    ADD COLUMN IF NOT EXISTS warranty_months INT NULL AFTER color,
    ADD COLUMN IF NOT EXISTS warranty_start DATE NULL AFTER warranty_months,
    ADD COLUMN IF NOT EXISTS warranty_end DATE NULL AFTER warranty_start;
