-- ========================================================
-- SUPER MARKET ERP v2.0.0 - Production Initial Seed Data
-- ========================================================

-- Store Profile
INSERT OR REPLACE INTO store_profile (id, store_name, branch_name, tax_id, phone, email, address, promptpay_id, vat_rate, receipt_header, receipt_footer)
VALUES (
  'store_001',
  'ซุปเปอร์มาร์เก็ต แฮปปี้มาร์ท (HappyMart)',
  'สำนักงานใหญ่ (สาขาหลัก 00000)',
  '0105562089123',
  '02-888-9999',
  'contact@happymart.co.th',
  '99/9 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
  '0812345678',
  7.0,
  'ซุปเปอร์มาร์เก็ต แฮปปี้มาร์ท\nสินค้าคุณภาพ สดใหม่ สะอาด ครบครันทุกวัน',
  'ขอบพระคุณที่ไว้วางใจใช้บริการ\nกรุณาตรวจสอบสินค้าและเงินทอนก่อนออกจากเคาน์เตอร์\nเปลี่ยนหรือคืนสินค้าภายใน 7 วันพร้อมใบเสร็จรับเงิน'
);

-- Default Roles
INSERT OR REPLACE INTO roles (id, code, name, description, is_system) VALUES
('role_owner', 'OWNER_ADMIN', 'เจ้าของร้าน / ผู้ดูแลระบบสูงสุด', 'สิทธิ์ระดับสูงสุด เข้าถึงได้ทุกฟังก์ชันและจัดการสิทธิ์ได้ทั้งหมด', 1),
('role_manager', 'MANAGER', 'ผู้จัดการร้าน (Store Manager)', 'บริหารงานร้าน ตรวจสอบยอดขาย อนุมัติการปรับสต๊อก และสั่งซื้อ', 1),
('role_cashier', 'CASHIER', 'พนักงานขายหน้าร้าน (Cashier)', 'เปิด-ปิดกะ สแกนขายสินค้า ชำระเงิน และออกใบเสร็จรับเงิน', 1),
('role_stock_checker', 'STOCK_CHECKER', 'พนักงานตรวจนับสต๊อก (Stock Checker)', 'นับสต๊อกแบบ Blind Count ป้อนยอดจริง บันทึกดราฟต์ ส่งตรวจ', 1),
('role_warehouse', 'WAREHOUSE', 'พนักงานคลังสินค้า (Warehouse)', 'รับสินค้าเข้า เบิกจ่าย ย้ายสินค้าระหว่างจุดเก็บ และตรวจสต๊อกคลัง', 1),
('role_purchasing', 'PURCHASING', 'พนักงานจัดซื้อ (Purchasing)', 'จัดการคู่ค้า/ซัพพลายเออร์ จัดทำและส่งใบสั่งซื้อ (PO)', 1),
('role_accounting', 'ACCOUNTING', 'พนักงานบัญชีและการเงิน (Accounting)', 'บันทึกค่าใช้จ่าย กระทบยอดเงินสด ภาษีซื้อ-ขาย งบกำไรขาดทุน', 1);

-- Permissions Master
INSERT OR REPLACE INTO permissions (id, code, module, action, description) VALUES
('p01', 'dashboard.view', 'DASHBOARD', 'view', 'ดูภาพรวมสถิติและยอดขายร้าน'),
('p02', 'dashboard.financial', 'DASHBOARD', 'financial_view', 'ดูกำไรขั้นต้นและต้นทุนสินค้า'),
('p03', 'pos.access', 'POS', 'access', 'เข้าใช้งานระบบขายหน้าร้าน POS'),
('p04', 'pos.checkout', 'POS', 'checkout', 'คิดเงินและรับชำระเงิน'),
('p05', 'pos.shift', 'POS', 'shift', 'เปิดและปิดกะการทำงาน'),
('p06', 'pos.void_request', 'POS', 'void_request', 'ขอยกเลิกหรือคืนบิลขาย'),
('p07', 'pos.void_approve', 'POS', 'void_approve', 'อนุมัติการยกเลิกบิลหรือคืนสินค้า'),
('p08', 'product.view', 'PRODUCT', 'view', 'ดูรายการสินค้า'),
('p09', 'product.manage', 'PRODUCT', 'manage', 'เพิ่ม แก้ไข ลบสินค้า'),
('p10', 'product.cost_view', 'PRODUCT', 'cost_view', 'ดูราคาต้นทุนสินค้า'),
('p11', 'inventory.view', 'INVENTORY', 'view', 'ดูจำนวนสต๊อกสินค้า'),
('p12', 'inventory.transfer', 'INVENTORY', 'transfer', 'ย้ายสินค้าระหว่างจุดเก็บภายใน'),
('p13', 'inventory.adjust', 'INVENTORY', 'adjust', 'ปรับยอดสต๊อกสินค้า'),
('p14', 'stock_count.access', 'STOCK_COUNT', 'access', 'เข้าใช้งานแอพตรวจนับสต๊อก'),
('p15', 'stock_count.manage', 'STOCK_COUNT', 'manage', 'สร้างและมอบหมายงานนับสต๊อก'),
('p16', 'stock_count.approve', 'STOCK_COUNT', 'approve', 'ตรวจสอบผลต่างและอนุมัติการนับ'),
('p17', 'warehouse.access', 'WAREHOUSE', 'access', 'เข้าใช้งานระบบคลังสินค้า'),
('p18', 'warehouse.receive', 'WAREHOUSE', 'receive', 'รับสินค้าเข้าคลัง'),
('p19', 'warehouse.issue', 'WAREHOUSE', 'issue', 'เบิกจ่ายสินค้า'),
('p20', 'purchasing.access', 'PURCHASING', 'access', 'เข้าใช้งานระบบจัดซื้อ'),
('p21', 'purchasing.create_po', 'PURCHASING', 'create_po', 'จัดทำใบสั่งซื้อ'),
('p22', 'purchasing.approve', 'PURCHASING', 'approve', 'อนุมัติใบสั่งซื้อ'),
('p23', 'supplier.manage', 'SUPPLIER', 'manage', 'จัดการข้อมูลคู่ค้า/ซัพพลายเออร์'),
('p24', 'customer.manage', 'CUSTOMER', 'manage', 'จัดการข้อมูลสมาชิกลูกค้า'),
('p25', 'accounting.access', 'ACCOUNTING', 'access', 'เข้าใช้งานระบบบัญชีการเงิน'),
('p26', 'accounting.expenses', 'ACCOUNTING', 'expenses', 'บันทึกและจัดการค่าใช้จ่าย'),
('p27', 'accounting.reports', 'ACCOUNTING', 'reports', 'ดูงบการเงินและรายงานภาษี'),
('p28', 'employees.manage', 'EMPLOYEES', 'manage', 'จัดการพนักงานและบัญชีผู้ใช้'),
('p29', 'reports.view', 'REPORTS', 'view', 'ดูรายงานวิเคราะห์การขาย'),
('p30', 'settings.manage', 'SETTINGS', 'manage', 'ตั้งค่าระบบและกำหนดสิทธิ์ผู้ใช้');

-- Role Permissions Assignment
-- OWNER: all
INSERT OR REPLACE INTO role_permissions (role_id, permission_code) VALUES
('role_owner', 'dashboard.view'), ('role_owner', 'dashboard.financial'),
('role_owner', 'pos.access'), ('role_owner', 'pos.checkout'), ('role_owner', 'pos.shift'), ('role_owner', 'pos.void_request'), ('role_owner', 'pos.void_approve'),
('role_owner', 'product.view'), ('role_owner', 'product.manage'), ('role_owner', 'product.cost_view'),
('role_owner', 'inventory.view'), ('role_owner', 'inventory.transfer'), ('role_owner', 'inventory.adjust'),
('role_owner', 'stock_count.access'), ('role_owner', 'stock_count.manage'), ('role_owner', 'stock_count.approve'),
('role_owner', 'warehouse.access'), ('role_owner', 'warehouse.receive'), ('role_owner', 'warehouse.issue'),
('role_owner', 'purchasing.access'), ('role_owner', 'purchasing.create_po'), ('role_owner', 'purchasing.approve'),
('role_owner', 'supplier.manage'), ('role_owner', 'customer.manage'),
('role_owner', 'accounting.access'), ('role_owner', 'accounting.expenses'), ('role_owner', 'accounting.reports'),
('role_owner', 'employees.manage'), ('role_owner', 'reports.view'), ('role_owner', 'settings.manage');

-- MANAGER
INSERT OR REPLACE INTO role_permissions (role_id, permission_code) VALUES
('role_manager', 'dashboard.view'),
('role_manager', 'pos.access'), ('role_manager', 'pos.checkout'), ('role_manager', 'pos.shift'), ('role_manager', 'pos.void_approve'),
('role_manager', 'product.view'), ('role_manager', 'product.manage'),
('role_manager', 'inventory.view'), ('role_manager', 'inventory.transfer'), ('role_manager', 'inventory.adjust'),
('role_manager', 'stock_count.access'), ('role_manager', 'stock_count.manage'), ('role_manager', 'stock_count.approve'),
('role_manager', 'warehouse.access'), ('role_manager', 'warehouse.receive'), ('role_manager', 'warehouse.issue'),
('role_manager', 'purchasing.access'), ('role_manager', 'purchasing.approve'),
('role_manager', 'supplier.manage'), ('role_manager', 'customer.manage'),
('role_manager', 'reports.view');

-- CASHIER
INSERT OR REPLACE INTO role_permissions (role_id, permission_code) VALUES
('role_cashier', 'pos.access'), ('role_cashier', 'pos.checkout'), ('role_cashier', 'pos.shift'), ('role_cashier', 'pos.void_request'),
('role_cashier', 'product.view'), ('role_cashier', 'customer.manage');

-- STOCK_CHECKER
INSERT OR REPLACE INTO role_permissions (role_id, permission_code) VALUES
('role_stock_checker', 'stock_count.access');

-- WAREHOUSE
INSERT OR REPLACE INTO role_permissions (role_id, permission_code) VALUES
('role_warehouse', 'warehouse.access'), ('role_warehouse', 'warehouse.receive'), ('role_warehouse', 'warehouse.issue'),
('role_warehouse', 'inventory.view'), ('role_warehouse', 'inventory.transfer');

-- PURCHASING
INSERT OR REPLACE INTO role_permissions (role_id, permission_code) VALUES
('role_purchasing', 'purchasing.access'), ('role_purchasing', 'purchasing.create_po'),
('role_purchasing', 'supplier.manage'), ('role_purchasing', 'product.view'), ('role_purchasing', 'product.cost_view');

-- ACCOUNTING
INSERT OR REPLACE INTO role_permissions (role_id, permission_code) VALUES
('role_accounting', 'accounting.access'), ('role_accounting', 'accounting.expenses'), ('role_accounting', 'accounting.reports'),
('role_accounting', 'reports.view');

-- Default Employees (PBKDF2-SHA256 salted hashes with 100,000 iterations, unique random salts per user)
-- Note: All provisioned accounts require forced password change on first authentication (force_password_change = 1)
INSERT OR REPLACE INTO employees (id, employee_code, username, password_hash, full_name, role_code, email, phone, position, status, force_password_change) VALUES
('emp_owner', 'EMP-001', 'owner', '2626fad4b0040ac256394ba2609801b6:1a35746eafe42b376185f7bad615818e1684ac556904927b57e1f7348ab1db60', 'คุณวิทูรย์ ลาเต้ (เจ้าของร้าน)', 'OWNER_ADMIN', 'owner@happymart.co.th', '089-111-2222', 'เจ้าของกิจการ / CEO', 'active', 1),
('emp_manager', 'EMP-002', 'manager', '1756e0d30c09f5014c4afd1ea8ed65f8:0f42758051b02ec2b5224535a22065e1bb9e08451cfe8df788b8e408433eb452', 'คุณสมชาย บริหารดี (ผู้จัดการ)', 'MANAGER', 'manager@happymart.co.th', '089-222-3333', 'ผู้จัดการร้าน', 'active', 1),
('emp_cashier1', 'EMP-003', 'cashier', 'a9d452e9941e990480aba8e918afa9c7:d141a1cbd0abb05c9690558cd615e29c66fd00f6980950382fe50fd164fe19a4', 'คุณนภา ขายคล่อง (แคชเชียร์ 1)', 'CASHIER', 'cashier1@happymart.co.th', '089-333-4444', 'พนักงานแคชเชียร์', 'active', 1),
('emp_checker1', 'EMP-004', 'checker', '296967ac2772b95cced14ff90c028765:0f1bbf85274c26cfd75d9f9aea601dc5a98e95fe6cd9f646f5a52cb427912e4d', 'คุณธีระ นับตรง (ตรวจนับ)', 'STOCK_CHECKER', 'checker@happymart.co.th', '089-444-5555', 'พนักงานตรวจสต๊อก', 'active', 1),
('emp_wh1', 'EMP-005', 'warehouse', 'b12304b6d4f869bc10e6a4e34b0f9d6e:3250ca2982755ffd6545b91ccedf736d7d5cd2f328c2a31e9ef101ec78a4bdf0', 'คุณมนัส จัดคลัง (พนักงานคลัง)', 'WAREHOUSE', 'warehouse@happymart.co.th', '089-555-6666', 'หัวหน้าคลังสินค้า', 'active', 1),
('emp_pur1', 'EMP-006', 'purchaser', '63f5ff88448e07c30eeb099a331cf9e9:cea690b7a56c2b2568fc1a24efe59538dd9eff15f801c9a1a18844c2de579659', 'คุณสุดา หาเก่ง (จัดซื้อ)', 'PURCHASING', 'purchaser@happymart.co.th', '089-666-7777', 'เจ้าหน้าที่จัดซื้อ', 'active', 1),
('emp_acc1', 'EMP-007', 'accountant', '9818c55f6bd7562d2f25347fab3b08de:9526a22c9689e0be40b3f5f111d118ab781043852501df0ed478b2604ba93df1', 'คุณปรียา คิดเป๊ะ (บัญชี)', 'ACCOUNTING', 'accountant@happymart.co.th', '089-777-8888', 'สมุห์บัญชี', 'active', 1);

-- Warehouses & Internal Storage Locations
INSERT OR REPLACE INTO warehouses (id, code, name, type) VALUES
('wh_main', 'WH-MAIN', 'คลังสินค้าหลัก (Central Supermarket Depot)', 'internal'),
('wh_store', 'WH-STORE', 'พื้นที่ร้านค้าและสต๊อกหน้าร้าน', 'retail'),
('wh_cold', 'WH-COLD', 'ศูนย์จัดเก็บควบคุมความเย็นและแช่แข็ง', 'cold_chain');

INSERT OR REPLACE INTO warehouse_locations (id, warehouse_id, code, name, location_type, description) VALUES
('loc_shelf', 'wh_store', 'LOC-SHELF', 'ชั้นวางสินค้าหน้าร้าน (Retail Shelves)', 'shelf', 'พื้นที่ขายและชั้นวางสินค้าสำหรับลูกค้าหยิบซื้อ'),
('loc_back', 'wh_store', 'LOC-BACK', 'สต๊อกสินค้าหลังร้าน (Back Store)', 'backstore', 'พื้นที่พักสินค้าหน้าร้านเพื่อรอเติมขึ้นชั้น'),
('loc_main', 'wh_main', 'LOC-MAIN', 'คลังสินค้าหลักส่วนกลาง (Main Warehouse)', 'shelf', 'พาเลทและแร็คจัดเก็บสินค้ายกลัง'),
('loc_chiller', 'wh_cold', 'LOC-CHILL', 'ตู้แช่เย็น / ห้องควบคุมอุณหภูมิ (Chiller 0-4°C)', 'cold_storage', 'จัดเก็บนมสด เครื่องดื่ม ผัก ผลไม้สด'),
('loc_freezer', 'wh_cold', 'LOC-FREEZ', 'ตู้แช่แข็ง / ห้องแช่เยือกแข็ง (Freezer -18°C)', 'freezer', 'จัดเก็บเนื้อสัตว์แช่แข็ง ไอศกรีม อาหารพร้อมปรุง');

-- Categories
INSERT OR REPLACE INTO categories (id, code, name, description, icon) VALUES
('cat_bev', 'CAT-BEV', 'เครื่องดื่มและน้ำดื่ม', 'น้ำดื่ม ชา กาแฟ น้ำอัดลม น้ำผลไม้', 'Coffee'),
('cat_snack', 'CAT-SNK', 'ขนมขบเคี้ยวและของหวาน', 'มันฝรั่งทอด บิสกิต ช็อกโกแลต เวเฟอร์', 'Cookie'),
('cat_fresh', 'CAT-FRS', 'อาหารสด ผักและผลไม้', 'ผักสด ผลไม้สด เนื้อสัตว์ ไข่ไก่', 'Apple'),
('cat_dairy', 'CAT-DRY', 'ผลิตภัณฑ์นมและเนย', 'นมสด โยเกิร์ต ชีส นมถั่วเหลือง', 'Milk'),
('cat_grocery', 'CAT-GRO', 'ของแห้งและเครื่องปรุงรส', 'ข้าวสาร น้ำมันพืช น้ำปลา ซอสปรุงรส บะหมี่กึ่งสำเร็จรูป', 'Wheat'),
('cat_home', 'CAT-HOM', 'ของใช้ในบ้านและของใช้ส่วนตัว', 'น้ำยาล้างจาน ผงซักฟอก ยาสระผม สบู่ กระดาษทิชชู', 'Home');

-- Brands
INSERT OR REPLACE INTO brands (id, code, name) VALUES
('br_singha', 'BR-SGH', 'สิงห์ (Singha)'),
('br_chang', 'BR-CHG', 'ช้าง (Chang)'),
('br_lay', 'BR-LAY', 'เลย์ (Lay''s)'),
('br_mama', 'BR-MMA', 'มาม่า (MAMA)'),
('br_meiji', 'BR-MJ', 'เมจิ (CP-Meiji)'),
('br_dutchmill', 'BR-DM', 'ดัชมิลล์ (Dutch Mill)'),
('br_breeze', 'BR-BRZ', 'บรีส (Breeze)'),
('br_sunlight', 'BR-SNL', 'ซันไลต์ (Sunlight)');

-- Products (Real supermarket inventory items)
INSERT OR REPLACE INTO products (id, sku, barcode, name, category_id, brand_id, unit, cost_price, selling_price, wholesale_price, min_stock, max_stock, is_vat, is_active, expiry_date, batch_number) VALUES
('p_water', 'SKU-1001', '8850188100018', 'น้ำดื่มสิงห์ 600 มล.', 'cat_bev', 'br_singha', 'ขวด', 5.50, 7.00, 6.00, 24, 500, 1, 1, '2027-12-31', 'LOT2026-001'),
('p_cola', 'SKU-1002', '8851959132014', 'โค้ก ออริจินัล 325 มล. กระป๋อง', 'cat_bev', 'br_chang', 'กระป๋อง', 11.00, 16.00, 14.50, 24, 300, 1, 1, '2027-08-30', 'LOT2026-002'),
('p_lays', 'SKU-1003', '8850718801123', 'เลย์ มันฝรั่งทอด รสคลาสสิค 48 กรัม', 'cat_snack', 'br_lay', 'ซอง', 16.50, 22.00, 20.00, 20, 200, 1, 1, '2027-04-15', 'LOT2026-003'),
('p_mama', 'SKU-1004', '8850987101017', 'มาม่า บะหมี่กึ่งสำเร็จรูป รสต้มยำกุ้ง 55 กรัม', 'cat_grocery', 'br_mama', 'ซอง', 5.80, 7.00, 6.20, 60, 600, 1, 1, '2027-09-01', 'LOT2026-004'),
('p_milk', 'SKU-1005', '8850329120199', 'นมสดพาสเจอร์ไรส์ เมจิ รสจืด 830 มล.', 'cat_dairy', 'br_meiji', 'ขวด', 41.00, 48.00, 45.00, 10, 80, 1, 1, '2026-12-05', 'LOT2026-005'),
('p_yogurt', 'SKU-1006', '8850188200121', 'โยเกิร์ต ดัชมิลล์ 4 อิน 1 รสสตรอเบอร์รี่ 135 กรัม', 'cat_dairy', 'br_dutchmill', 'ถ้วy', 10.50, 15.00, 13.50, 15, 120, 1, 1, '2026-11-28', 'LOT2026-006'),
('p_egg', 'SKU-1007', '8850999000101', 'ไข่ไก่สด เบอร์ 2 แผง 10 ฟอง', 'cat_fresh', 'br_singha', 'แพ็ค', 42.00, 52.00, 48.00, 15, 100, 0, 1, '2026-11-25', 'LOT2026-007'),
('p_sunlight', 'SKU-1008', '8851932381203', 'ซันไลต์ พลัส น้ำยาล้างจาน เลมอน 750 มล. ถุงเติม', 'cat_home', 'br_sunlight', 'ถุง', 28.00, 36.00, 32.00, 12, 150, 1, 1, '2028-01-01', 'LOT2026-008'),
('p_breeze', 'SKU-1009', '8851932400195', 'บรีส เอกเซล ผงซักฟอก สูตรเข้มข้น 1,400 กรัม', 'cat_home', 'br_breeze', 'ถุง', 108.00, 135.00, 122.00, 10, 80, 1, 1, '2028-06-30', 'LOT2026-009'),
('p_rice', 'SKU-1010', '8850123987654', 'ข้าวหอมมะลิ 100% คัดพิเศษ ถุง 5 กก.', 'cat_grocery', 'br_mama', 'ถุง', 185.00, 225.00, 205.00, 10, 100, 0, 1, '2027-10-31', 'LOT2026-010');

-- Stock Balances (Retail Shelves and Main Warehouse)
INSERT OR REPLACE INTO inventory (id, product_id, location_id, quantity, reserved_quantity, batch_number) VALUES
('inv_1', 'p_water', 'loc_shelf', 96, 0, 'LOT2026-001'),
('inv_2', 'p_water', 'loc_main', 240, 0, 'LOT2026-001'),
('inv_3', 'p_cola', 'loc_shelf', 48, 0, 'LOT2026-002'),
('inv_4', 'p_cola', 'loc_main', 120, 0, 'LOT2026-002'),
('inv_5', 'p_lays', 'loc_shelf', 35, 0, 'LOT2026-003'),
('inv_6', 'p_mama', 'loc_shelf', 120, 0, 'LOT2026-004'),
('inv_7', 'p_mama', 'loc_back', 300, 0, 'LOT2026-004'),
('inv_8', 'p_milk', 'loc_chiller', 24, 0, 'LOT2026-005'),
('inv_9', 'p_yogurt', 'loc_chiller', 30, 0, 'LOT2026-006'),
('inv_10', 'p_egg', 'loc_shelf', 20, 0, 'LOT2026-007'),
('inv_11', 'p_sunlight', 'loc_shelf', 25, 0, 'LOT2026-008'),
('inv_12', 'p_breeze', 'loc_shelf', 18, 0, 'LOT2026-009'),
('inv_13', 'p_rice', 'loc_shelf', 15, 0, 'LOT2026-010'),
('inv_14', 'p_rice', 'loc_main', 40, 0, 'LOT2026-010');

-- Sync product current_stock with aggregate inventory balances
UPDATE products SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE inventory.product_id = products.id);

-- Suppliers
INSERT OR REPLACE INTO suppliers (id, code, name, tax_id, contact_person, phone, email, address, credit_terms_days, balance) VALUES
('sup_cp', 'SUP-001', 'บริษัท ซีพี ออลล์ แอนด์ เบฟเวอเรจ จำกัด', '0105531023456', 'คุณกิตติชัย ส่งไว', '02-711-8888', 'contact@cpbeverage.co.th', '313 อาคารซีพีทาวเวอร์ ถ.สีลม บางรัก กทม.', 30, 15400.0),
('sup_singha', 'SUP-002', 'บริษัท บุญรอด บริเวอรี่ จำกัด', '0105501002341', 'คุณวรวิทย์ สายน้ำ', '02-242-4000', 'orders@boonrawd.co.th', '999 ถ.สามเสน แขวงถนนนครไชยศรี ดุสิต กทม.', 45, 8500.0),
('sup_unilever', 'SUP-003', 'บริษัท ยูนิลีเวอร์ ไทย เทรดดิ้ง จำกัด', '0105517004312', 'คุณสุพรรณี ดูแลดี', '02-554-2000', 'sales@unileverthailand.com', '161 อาคารยูนิลีเวอร์ ถ.พระราม 9 ห้วยขวาง กทม.', 60, 22000.0);

-- Customers & Members
INSERT OR REPLACE INTO customers (id, member_code, name, phone, email, points, membership_tier, discount_pct, total_spent) VALUES
('cust_01', 'MB-1001', 'คุณกิตติ์ ดิลกโสภณ', '0812345678', 'kitti@gmail.com', 250, 'Gold', 5.0, 12500.0),
('cust_02', 'MB-1002', 'คุณวรรณภา สุขสมหวัง', '0898765432', 'wanapa@hotmail.com', 80, 'Silver', 2.0, 4200.0),
('cust_03', 'MB-1003', 'คุณธนกฤต เจริญศิลป์', '0865551234', 'tanakrit@yahoo.com', 12, 'Silver', 0.0, 600.0);

-- System Settings
INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, category) VALUES
('s1', 'pos_default_receipt_copies', '1', 'pos'),
('s2', 'pos_allow_custom_discount', 'false', 'pos'),
('s3', 'pos_require_shift_open', 'true', 'pos'),
('s4', 'promptpay_account_name', 'ซุปเปอร์มาร์เก็ต แฮปปี้มาร์ท', 'payment'),
('s5', 'barcode_scanner_suffix', 'Enter', 'hardware');
