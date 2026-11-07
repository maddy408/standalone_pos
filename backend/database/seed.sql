USE universal_pos;

-- Default admin user: username "admin", password "Admin@123"
INSERT INTO users (username, password_hash, full_name, role) VALUES
('admin', '$2y$10$nxT3MRGKfrG29gxT.ZHfMufsffrgHheqK5S9bvDYrkqAm.7XD3s..', 'Administrator', 'admin');

INSERT INTO business_settings (id, business_type, company_name, invoice_prefix, invoice_next_number)
VALUES (1, 'mobile', 'My Business', 'INV', 1);

-- ---------------------------------------------------------------------------
-- Granular permissions and the default per-role matrix
-- ---------------------------------------------------------------------------

INSERT INTO permissions (code, category, label_en, label_ta, sort_order) VALUES
('pos.access', 'pos', 'Access POS billing screen', 'POS பில்லிங் திரையை அணுகவும்', 1),
('pos.apply_discount', 'pos', 'Apply discounts in billing', 'பில்லிங்கில் தள்ளுபடி வழங்கவும்', 2),
('pos.cancel_invoice', 'pos', 'Cancel a completed invoice', 'முடிக்கப்பட்ட விலைப்பட்டியலை ரத்து செய்யவும்', 3),
('pos.sales_return', 'pos', 'Process a sales return', 'விற்பனை திரும்பப்பெறுதலை செயல்படுத்தவும்', 4),
('products.view', 'products', 'View product catalog', 'பொருள் பட்டியலைப் பார்க்கவும்', 1),
('products.manage', 'products', 'Create, edit, delete products', 'பொருட்களை உருவாக்கவும், திருத்தவும், அழிக்கவும்', 2),
('inventory.view', 'inventory', 'View stock movements and levels', 'சரக்கு நகர்வுகள் மற்றும் அளவுகளைப் பார்க்கவும்', 1),
('inventory.adjust', 'inventory', 'Make manual stock adjustments', 'கைமுறை சரக்கு சரிசெய்தல் செய்யவும்', 2),
('purchases.manage', 'purchases', 'Create purchases', 'கொள்முதல் உருவாக்கவும்', 1),
('purchases.return', 'purchases', 'Process purchase returns', 'கொள்முதல் திரும்பப்பெறுதலை செயல்படுத்தவும்', 2),
('customers.manage', 'parties', 'Create and edit customers', 'வாடிக்கையாளர்களை உருவாக்கவும், திருத்தவும்', 1),
('suppliers.manage', 'parties', 'Create and edit suppliers', 'சப்ளையர்களை உருவாக்கவும், திருத்தவும்', 2),
('expenses.manage', 'finance', 'Record expenses', 'செலவுகளை பதிவு செய்யவும்', 1),
('income.manage', 'finance', 'Record income', 'வருமானத்தை பதிவு செய்யவும்', 2),
('reports.view', 'admin', 'View reports', 'அறிக்கைகளைப் பார்க்கவும்', 1),
('settings.manage', 'admin', 'Change master settings', 'முதன்மை அமைப்புகளை மாற்றவும்', 2),
('users.manage', 'admin', 'Manage users and roles', 'பயனர்கள் மற்றும் பாத்திரங்களை நிர்வகிக்கவும்', 3),
('orders.view', 'orders', 'View customer orders', 'வாடிக்கையாளர் ஆர்டர்களைப் பார்க்கவும்', 1),
('orders.create', 'orders', 'Create customer orders', 'வாடிக்கையாளர் ஆர்டர்களை உருவாக்கவும்', 2),
('orders.manage_status', 'orders', 'Confirm/process/cancel orders', 'ஆர்டர்களை உறுதிப்படுத்த/செயல்படுத்த/ரத்து செய்ய', 3),
('van_sales.view', 'van_sales', 'View van sales / day return', 'வேன் விற்பனை / நாள் வருமானத்தைப் பார்க்கவும்', 1),
('van_sales.manage_orders', 'van_sales', 'Create/edit/cancel van orders and load stock', 'வேன் ஆர்டர்களை உருவாக்க/திருத்த/ரத்து செய்ய மற்றும் இருப்பை ஏற்ற', 2),
('van_sales.manage_returns', 'van_sales', 'Create/edit/cancel day returns', 'நாள் வருமானங்களை உருவாக்க/திருத்த/ரத்து செய்ய', 3),
('van_sales.manage_day_closing', 'van_sales', 'Close or reopen day closing', 'நாள் முடிவை மூட அல்லது மீண்டும் திறக்க', 4),
('van_sales.manage_vehicles', 'van_sales', 'Manage vehicles / vans master', 'வாகனங்கள் / வேன்களை நிர்வகிக்க', 5);

INSERT INTO role_permissions (role, permission_code)
SELECT 'admin', code FROM permissions;

INSERT INTO role_permissions (role, permission_code)
SELECT 'manager', code FROM permissions WHERE code != 'users.manage';

INSERT INTO role_permissions (role, permission_code) VALUES
('cashier', 'pos.access'),
('cashier', 'pos.apply_discount'),
('cashier', 'products.view'),
('cashier', 'inventory.view'),
('cashier', 'customers.manage'),
('cashier', 'reports.view'),
('cashier', 'orders.view'),
('cashier', 'orders.create');

INSERT INTO payment_methods (code, name) VALUES
('cash', 'Cash'), ('upi', 'UPI'), ('card', 'Card'), ('credit', 'Credit');

INSERT INTO vehicles (uuid, name, registration_no, driver_name) VALUES
(UUID(), 'Van 1', 'TN-01-AB-1234', 'Ravi Kumar'),
(UUID(), 'Van 2', 'TN-01-CD-5678', 'Suresh Babu');

INSERT INTO units (name, short_code) VALUES
('Piece', 'pcs'), ('Kilogram', 'kg'), ('Gram', 'g'), ('Inch', 'in'), ('Feet', 'ft'), ('Centimeter', 'cm'), ('Set', 'set');

INSERT INTO tax_rates (name, percent) VALUES
('No Tax', 0), ('GST 5%', 5), ('GST 12%', 12), ('GST 18%', 18), ('GST 28%', 28);

INSERT INTO expense_categories (name) VALUES ('Rent'), ('Electricity'), ('Salaries'), ('Transport'), ('Misc');
INSERT INTO income_categories (name) VALUES ('Sales'), ('Service Charges'), ('Other Income');

INSERT INTO categories (business_type, name) VALUES
('mobile', 'Smartphones'), ('mobile', 'Accessories'), ('mobile', 'Tablets'),
('furniture', 'Sofas'), ('furniture', 'Beds'), ('furniture', 'Dining Sets'), ('furniture', 'Chairs'),
('food', 'Starters'), ('food', 'Main Course'), ('food', 'Beverages'), ('food', 'Desserts');

INSERT INTO brands (name, business_type) VALUES
('Samsung', 'mobile'), ('Apple', 'mobile'), ('Xiaomi', 'mobile'), ('OnePlus', 'mobile'), ('Vivo', 'mobile'),
('Nilkamal', 'furniture'), ('Godrej Interio', 'furniture'), ('Urban Ladder', 'furniture'), ('Durian', 'furniture'),
('In-House', 'food'), ('Signature Recipe', 'food'),
('Generic', NULL);

-- ---------------------------------------------------------------------------
-- Dynamic business attribute fields (Master Settings -> Business Type drives
-- which of these render on the Product Creation page).
-- ---------------------------------------------------------------------------

INSERT INTO business_attribute_fields
(business_type, field_key, label_en, label_ta, field_type, options, unit_suffix, is_required, is_variant_attribute, sort_order) VALUES
-- Mobile Shop
('mobile', 'model', 'Model', 'மாடல்', 'text', NULL, NULL, 1, 0, 1),
('mobile', 'imei_mode', 'IMEI Tracking', 'IMEI கண்காணிப்பு', 'select', '[{"value":"none","label_en":"Not tracked","label_ta":"கண்காணிக்கப்படவில்லை"},{"value":"single","label_en":"Single IMEI","label_ta":"ஒற்றை IMEI"},{"value":"dual","label_en":"Dual IMEI","label_ta":"இரட்டை IMEI"}]', NULL, 1, 0, 2),
('mobile', 'ram', 'RAM', 'RAM', 'select', '[{"value":"2GB","label_en":"2GB","label_ta":"2GB"},{"value":"4GB","label_en":"4GB","label_ta":"4GB"},{"value":"6GB","label_en":"6GB","label_ta":"6GB"},{"value":"8GB","label_en":"8GB","label_ta":"8GB"},{"value":"12GB","label_en":"12GB","label_ta":"12GB"},{"value":"16GB","label_en":"16GB","label_ta":"16GB"}]', NULL, 0, 1, 3),
('mobile', 'storage', 'Storage', 'சேமிப்பு', 'select', '[{"value":"32GB","label_en":"32GB","label_ta":"32GB"},{"value":"64GB","label_en":"64GB","label_ta":"64GB"},{"value":"128GB","label_en":"128GB","label_ta":"128GB"},{"value":"256GB","label_en":"256GB","label_ta":"256GB"},{"value":"512GB","label_en":"512GB","label_ta":"512GB"},{"value":"1TB","label_en":"1TB","label_ta":"1TB"}]', NULL, 0, 1, 4),
('mobile', 'color', 'Color', 'நிறம்', 'text', NULL, NULL, 0, 1, 5),
('mobile', 'warranty_months', 'Warranty (months)', 'உத்தரவாதம் (மாதங்கள்)', 'number', NULL, 'months', 0, 0, 6),
-- Furniture Shop
('furniture', 'material', 'Material', 'பொருள்', 'select', '[{"value":"wood","label_en":"Wood","label_ta":"மரம்"},{"value":"metal","label_en":"Metal","label_ta":"உலோகம்"},{"value":"plastic","label_en":"Plastic","label_ta":"பிளாஸ்டிக்"},{"value":"glass","label_en":"Glass","label_ta":"கண்ணாடி"},{"value":"fabric","label_en":"Fabric","label_ta":"துணி"}]', NULL, 1, 1, 1),
('furniture', 'color', 'Color', 'நிறம்', 'text', NULL, NULL, 0, 1, 2),
('furniture', 'length', 'Length', 'நீளம்', 'number', NULL, NULL, 0, 0, 3),
('furniture', 'width', 'Width', 'அகலம்', 'number', NULL, NULL, 0, 0, 4),
('furniture', 'height', 'Height', 'உயரம்', 'number', NULL, NULL, 0, 0, 5),
('furniture', 'weight', 'Weight', 'எடை', 'number', NULL, 'kg', 0, 0, 6),
('furniture', 'dimension_unit', 'Dimension Unit', 'அளவு அலகு', 'select', '[{"value":"inch","label_en":"Inch","label_ta":"அங்குலம்"},{"value":"feet","label_en":"Feet","label_ta":"அடி"},{"value":"cm","label_en":"cm","label_ta":"செ.மீ"}]', NULL, 0, 0, 7),
-- Food / Hotel
('food', 'food_category', 'Food Category', 'உணவு வகை', 'text', NULL, NULL, 0, 0, 1),
('food', 'food_type', 'Food Type', 'உணவு வகை', 'select', '[{"value":"veg","label_en":"Veg","label_ta":"சைவம்"},{"value":"non_veg","label_en":"Non-Veg","label_ta":"அசைவம்"},{"value":"egg","label_en":"Egg","label_ta":"முட்டை"}]', NULL, 1, 0, 2),
('food', 'spice_level', 'Spice Level', 'மசாலா அளவு', 'select', '[{"value":"less_spicy","label_en":"Less Spicy","label_ta":"குறைந்த மசாலா"},{"value":"medium_spicy","label_en":"Medium Spicy","label_ta":"நடுத்தர மசாலா"},{"value":"extra_spicy","label_en":"Extra Spicy","label_ta":"அதிக மசாலா"}]', NULL, 0, 1, 3),
('food', 'sweetness', 'Sweetness', 'இனிப்பு', 'select', '[{"value":"less_sweet","label_en":"Less Sweet","label_ta":"குறைந்த இனிப்பு"},{"value":"normal","label_en":"Normal","label_ta":"சாதாரண"},{"value":"extra_sweet","label_en":"Extra Sweet","label_ta":"அதிக இனிப்பு"}]', NULL, 0, 1, 4),
('food', 'sourness', 'Sourness', 'காரம்/புளிப்பு', 'select', '[{"value":"low","label_en":"Low","label_ta":"குறைவு"},{"value":"normal","label_en":"Normal","label_ta":"சாதாரண"},{"value":"high","label_en":"High","label_ta":"அதிகம்"}]', NULL, 0, 0, 5),
('food', 'flavour', 'Flavour', 'சுவை', 'text', NULL, NULL, 0, 0, 6),
('food', 'portion', 'Portion / Size', 'பகுதி / அளவு', 'select', '[{"value":"small","label_en":"Small","label_ta":"சிறிய"},{"value":"medium","label_en":"Medium","label_ta":"நடுத்தர"},{"value":"large","label_en":"Large","label_ta":"பெரிய"}]', NULL, 0, 1, 7);
