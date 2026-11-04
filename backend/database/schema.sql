-- Universal POS & Admin Management System
-- Standalone schema — independent of the e-commerce admin panel and veg-pos.
-- Normalized design: business-specific product fields are configurable via
-- `business_attribute_fields` + `products.attributes` (JSON) instead of one
-- table per business type.

CREATE DATABASE IF NOT EXISTS universal_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE universal_pos;

-- ---------------------------------------------------------------------------
-- Users & business configuration
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin','manager','cashier') NOT NULL DEFAULT 'cashier',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Single-row table holding the active business configuration.
CREATE TABLE business_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
    business_type ENUM('mobile','furniture','food') NOT NULL DEFAULT 'mobile',
    company_name VARCHAR(150) NOT NULL DEFAULT 'My Business',
    company_address VARCHAR(255) NULL,
    company_phone VARCHAR(30) NULL,
    company_gstin VARCHAR(20) NULL,
    invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'INV',
    invoice_next_number INT UNSIGNED NOT NULL DEFAULT 1,
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '₹',
    tax_inclusive TINYINT(1) NOT NULL DEFAULT 0,
    low_stock_threshold DECIMAL(10,2) NOT NULL DEFAULT 5,
    default_language VARCHAR(5) NOT NULL DEFAULT 'en',
    default_theme VARCHAR(10) NOT NULL DEFAULT 'light',
    receipt_paper_width VARCHAR(10) NOT NULL DEFAULT '80mm',
    auto_print_on_sale TINYINT(1) NOT NULL DEFAULT 1,
    barcode_scanner_mode VARCHAR(20) NOT NULL DEFAULT 'keyboard_wedge',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_business_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB;

-- Drives the dynamic Product Creation UI per business type. Adding a new
-- business type or field later is a data change, not a schema change.
CREATE TABLE business_attribute_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_type ENUM('mobile','furniture','food') NOT NULL,
    field_key VARCHAR(50) NOT NULL,
    label_en VARCHAR(100) NOT NULL,
    label_ta VARCHAR(100) NOT NULL,
    field_type ENUM('text','number','select','boolean','textarea') NOT NULL DEFAULT 'text',
    options JSON NULL COMMENT 'For field_type=select: [{"value":"...","label_en":"...","label_ta":"..."}]',
    unit_suffix VARCHAR(20) NULL,
    is_required TINYINT(1) NOT NULL DEFAULT 0,
    is_variant_attribute TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'If true, this field can be used to define product variants',
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_business_field (business_type, field_key)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Masters
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_type ENUM('mobile','furniture','food') NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_category_business (business_type)
) ENGINE=InnoDB;

CREATE TABLE brands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    business_type ENUM('mobile','furniture','food') NULL COMMENT 'NULL = usable under any business type',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_brand_business (business_type)
) ENGINE=InnoDB;

CREATE TABLE units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    short_code VARCHAR(10) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE tax_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    percent DECIMAL(5,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- Food/Hotel add-ons (e.g. Extra Cheese, Extra Chutney). Snapshot of name+price
-- is copied onto invoice_items.addons at sale time so historical bills never change.
CREATE TABLE addons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(100) NULL DEFAULT 'General',
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_mandatory TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE expense_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE income_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Parties
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    address VARCHAR(255) NULL,
    gstin VARCHAR(20) NULL,
    opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Positive = customer owes us',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    address VARCHAR(255) NULL,
    gstin VARCHAR(20) NULL,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Positive = we owe supplier',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Products, variants, serials
-- ---------------------------------------------------------------------------

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    business_type ENUM('mobile','furniture','food') NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    images JSON NULL COMMENT 'Array of image URLs',
    category_id INT NULL,
    brand_id INT NULL,
    unit_id INT NULL,
    tax_rate_id INT NULL,
    tax_inclusive TINYINT(1) NOT NULL DEFAULT 0,
    supplier_id INT NULL,
    barcode VARCHAR(50) NULL,
    hsn_code VARCHAR(50) NULL,
    sku VARCHAR(50) NULL,
    purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    mrp DECIMAL(12,2) NOT NULL DEFAULT 0,
    retail_price DECIMAL(12,2) NULL,
    wholesale_price DECIMAL(12,2) NULL,
    customer_price DECIMAL(12,2) NULL,
    stock_qty DECIMAL(12,3) NOT NULL DEFAULT 0 COMMENT 'Cached current stock - source of truth is stock_movements',
    opening_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
    low_stock_threshold DECIMAL(10,2) NULL,
    min_stock DECIMAL(12,3) NULL,
    max_stock DECIMAL(12,3) NULL,
    track_serial TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'IMEI/serial-level tracking (mobile shop)',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    pos_enabled TINYINT(1) NOT NULL DEFAULT 1,
    online_enabled TINYINT(1) NOT NULL DEFAULT 1,
    is_returnable TINYINT(1) NOT NULL DEFAULT 1,
    attributes JSON NULL COMMENT 'Business-specific fields keyed by business_attribute_fields.field_key',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_product_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
    CONSTRAINT fk_product_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
    CONSTRAINT fk_product_tax FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id) ON DELETE SET NULL,
    CONSTRAINT fk_product_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    INDEX idx_product_business (business_type),
    INDEX idx_product_barcode (barcode),
    INDEX idx_product_name (name)
) ENGINE=InnoDB;

-- Generic variant row (e.g. Food: Size=Large+Spice=Extra Spicy; Furniture: a
-- specific dimension/material combo). Keeps one flexible table instead of a
-- variant table per business type.
CREATE TABLE product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    variant_name VARCHAR(150) NOT NULL,
    sku VARCHAR(50) NULL,
    attributes JSON NULL,
    price_adjustment DECIMAL(10,2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(12,2) NULL,
    barcode VARCHAR(50) NULL,
    image VARCHAR(255) NULL,
    stock_qty DECIMAL(12,3) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_variant_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Per-unit IMEI/serial tracking for mobile shop (and any serialized item).
CREATE TABLE product_serials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    imei1 VARCHAR(20) NULL,
    imei2 VARCHAR(20) NULL,
    serial_no VARCHAR(50) NULL,
    color VARCHAR(50) NULL,
    warranty_months INT NULL,
    warranty_start DATE NULL,
    warranty_end DATE NULL,
    status ENUM('in_stock','sold','returned','damaged') NOT NULL DEFAULT 'in_stock',
    purchase_item_id INT NULL,
    invoice_item_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_serial_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_serial_imei1 (imei1),
    INDEX idx_serial_status (product_id, status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Billing: invoices (online + offline, idempotent via uuid)
-- ---------------------------------------------------------------------------

CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE COMMENT 'Client-generated - makes sync idempotent',
    invoice_no VARCHAR(30) NOT NULL UNIQUE,
    customer_id INT NULL,
    user_id INT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('completed','cancelled') NOT NULL DEFAULT 'completed',
    slogan VARCHAR(255) NULL,
    customer_type ENUM('retail','wholesale','regular') NOT NULL DEFAULT 'retail',
    source ENUM('online','offline') NOT NULL DEFAULT 'online',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoice_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_invoice_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    product_id INT NULL,
    variant_id INT NULL,
    serial_id INT NULL,
    product_name_snapshot VARCHAR(150) NOT NULL,
    qty DECIMAL(10,3) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    addons JSON NULL COMMENT 'Snapshot of selected add-ons: [{"name":"...","price":...}]',
    customization JSON NULL COMMENT 'Snapshot of variant/customization labels for receipt printing',
    CONSTRAINT fk_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_item_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    CONSTRAINT fk_item_serial FOREIGN KEY (serial_id) REFERENCES product_serials(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE invoice_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    payment_method_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    reference_no VARCHAR(50) NULL,
    CONSTRAINT fk_paymt_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT fk_paymt_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
) ENGINE=InnoDB;

-- Hold Bill / Resume Bill: full cart snapshot, not finalized into invoices yet.
CREATE TABLE held_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    label VARCHAR(100) NULL,
    customer_id INT NULL,
    payload JSON NOT NULL COMMENT 'Full cart state to restore the billing screen',
    user_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_held_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sales_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    invoice_id INT NOT NULL,
    user_id INT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_return_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB;

CREATE TABLE sales_return_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sales_return_id INT NOT NULL,
    invoice_item_id INT NOT NULL,
    qty DECIMAL(10,3) NOT NULL DEFAULT 1,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    serial_id INT NULL,
    CONSTRAINT fk_return_item_return FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    CONSTRAINT fk_return_item_invitem FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------------

CREATE TABLE purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    purchase_no VARCHAR(30) NOT NULL UNIQUE,
    supplier_id INT NOT NULL,
    user_id INT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('completed','cancelled') NOT NULL DEFAULT 'completed',
    source ENUM('online','offline') NOT NULL DEFAULT 'online',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB;

CREATE TABLE purchase_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    product_id INT NOT NULL,
    qty DECIMAL(10,3) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    serials JSON NULL COMMENT 'IMEI/serial numbers received in this line, for mobile shop',
    CONSTRAINT fk_pitem_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    CONSTRAINT fk_pitem_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE purchase_returns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    purchase_id INT NOT NULL,
    user_id INT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_preturn_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id)
) ENGINE=InnoDB;

CREATE TABLE purchase_return_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_return_id INT NOT NULL,
    purchase_item_id INT NOT NULL,
    qty DECIMAL(10,3) NOT NULL DEFAULT 1,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_pret_item_ret FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
    CONSTRAINT fk_pret_item_pitem FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Stock ledger (single source of truth for all inventory movement)
-- ---------------------------------------------------------------------------

CREATE TABLE stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    product_id INT NOT NULL,
    variant_id INT NULL,
    serial_id INT NULL,
    qty_change DECIMAL(12,3) NOT NULL COMMENT 'Positive = stock in, negative = stock out',
    movement_type ENUM('sale','purchase','adjustment','sale_return','purchase_return','opening') NOT NULL,
    ref_type VARCHAR(30) NULL COMMENT 'invoices | purchases | sales_returns | purchase_returns | manual',
    ref_id INT NULL,
    notes VARCHAR(255) NULL,
    user_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movement_product FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_movement_product (product_id, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Payments / ledgers
-- ---------------------------------------------------------------------------

CREATE TABLE customer_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    invoice_id INT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method_id INT NOT NULL,
    reference_no VARCHAR(50) NULL,
    notes VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cpay_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_cpay_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE supplier_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    supplier_id INT NOT NULL,
    purchase_id INT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method_id INT NOT NULL,
    reference_no VARCHAR(50) NULL,
    notes VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_spay_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_spay_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Expense / Income
-- ---------------------------------------------------------------------------

CREATE TABLE expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    category_id INT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method_id INT NULL,
    notes VARCHAR(255) NULL,
    expense_date DATE NOT NULL,
    user_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expense_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE income (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) NOT NULL UNIQUE,
    category_id INT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method_id INT NULL,
    notes VARCHAR(255) NULL,
    income_date DATE NOT NULL,
    user_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_income_category FOREIGN KEY (category_id) REFERENCES income_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Granular roles & permissions, and the audit trail
-- ---------------------------------------------------------------------------

CREATE TABLE permissions (
    code VARCHAR(50) NOT NULL PRIMARY KEY,
    category VARCHAR(30) NOT NULL,
    label_en VARCHAR(100) NOT NULL,
    label_ta VARCHAR(150) NULL,
    sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Default permission set per role. A user's effective permissions are this
-- role default, further adjusted by user_permission_overrides.
CREATE TABLE role_permissions (
    role ENUM('admin','manager','cashier') NOT NULL,
    permission_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (role, permission_code),
    CONSTRAINT fk_rp_permission FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Per-user grant/revoke on top of the role default — lets an individual
-- cashier be trusted with e.g. inventory.adjust without promoting them to
-- manager, or a manager be denied purchases.manage, without a whole new role.
CREATE TABLE user_permission_overrides (
    user_id INT NOT NULL,
    permission_code VARCHAR(50) NOT NULL,
    allowed TINYINT(1) NOT NULL,
    PRIMARY KEY (user_id, permission_code),
    CONSTRAINT fk_upo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_upo_permission FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(50) NULL,
    action VARCHAR(20) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id INT NULL,
    details JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;
