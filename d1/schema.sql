-- ========================================================
-- SUPER MARKET ERP v2.0.0 (Single Branch Architecture)
-- Cloudflare D1 Remote Database Schema
-- ========================================================

-- 1. Store Profile (Single Branch Identity)
CREATE TABLE IF NOT EXISTS store_profile (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL DEFAULT 'ซุปเปอร์มาร์เก็ต แฮปปี้มาร์ท',
  branch_name TEXT NOT NULL DEFAULT 'สำนักงานใหญ่ (สาขาหลัก 00000)',
  tax_id TEXT NOT NULL DEFAULT '0105562089123',
  phone TEXT NOT NULL DEFAULT '02-888-9999',
  email TEXT DEFAULT 'contact@happymart.co.th',
  address TEXT NOT NULL DEFAULT '99/9 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
  promptpay_id TEXT NOT NULL DEFAULT '0812345678',
  vat_rate REAL NOT NULL DEFAULT 7.0,
  receipt_header TEXT DEFAULT 'ยินดีต้อนรับสู่ ซุปเปอร์มาร์เก็ต แฮปปี้มาร์ท\nสินค้าคุณภาพ สดใหม่ สะอาด ราคาประหยัดทุกวัน',
  receipt_footer TEXT DEFAULT 'ขอบพระคุณที่ใช้บริการ\nกรุณาตรวจสอบสินค้าและเงินทอนก่อนออกจากร้าน\nเปลี่ยนคืนสินค้าภายใน 7 วันพร้อมใบเสร็จ',
  logo_url TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'THB',
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 2. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 3. Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 4. Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT
);

-- 5. Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_code TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_code)
);

-- 6. Employees & Users
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_code TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT,
  status TEXT DEFAULT 'active', -- active, suspended
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 7. Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Package',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 8. Brands
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 9. Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT,
  brand_id TEXT,
  unit TEXT NOT NULL DEFAULT 'ชิ้น',
  cost_price REAL NOT NULL DEFAULT 0.0,
  selling_price REAL NOT NULL DEFAULT 0.0,
  wholesale_price REAL DEFAULT 0.0,
  min_stock REAL DEFAULT 5,
  max_stock REAL DEFAULT 500,
  is_vat INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  image_url TEXT,
  expiry_date TEXT,
  batch_number TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

-- 10. Product Barcodes (Multiple barcodes for same product)
CREATE TABLE IF NOT EXISTS product_barcodes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  barcode TEXT NOT NULL,
  unit TEXT DEFAULT 'ชิ้น',
  price REAL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 11. Product Units
CREATE TABLE IF NOT EXISTS product_units (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  conversion_rate REAL NOT NULL DEFAULT 1.0,
  price REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 12. Warehouses (Internal Storage Facility)
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'internal', -- retail, warehouse, cold_chain
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 13. Warehouse Locations (Specific Storage areas inside the supermarket)
CREATE TABLE IF NOT EXISTS warehouse_locations (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'shelf', -- shelf, backstore, cold_storage, freezer
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

-- 14. Inventory (Stock by Product and Location)
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  reserved_quantity REAL NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date TEXT,
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(product_id, location_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES warehouse_locations(id)
);

-- 15. Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  from_location_id TEXT,
  to_location_id TEXT,
  movement_type TEXT NOT NULL, -- sale, purchase_in, internal_transfer, adjust_plus, adjust_minus, return, waste
  quantity REAL NOT NULL,
  unit_cost REAL DEFAULT 0,
  reference_type TEXT, -- sale, po, count, manual
  reference_id TEXT,
  reason TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (from_location_id) REFERENCES warehouse_locations(id),
  FOREIGN KEY (to_location_id) REFERENCES warehouse_locations(id)
);

-- 16. Stock Count Tasks
CREATE TABLE IF NOT EXISTS stock_count_tasks (
  id TEXT PRIMARY KEY,
  task_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  location_id TEXT,
  category_id TEXT,
  status TEXT DEFAULT 'draft', -- draft, in_progress, pending_approval, approved, rejected
  assigned_to TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (location_id) REFERENCES warehouse_locations(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 17. Stock Count Items
CREATE TABLE IF NOT EXISTS stock_count_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  system_quantity REAL NOT NULL DEFAULT 0,
  counted_quantity REAL,
  difference REAL,
  status TEXT DEFAULT 'pending', -- pending, counted, matched, discrepancy
  counted_at TEXT,
  notes TEXT,
  FOREIGN KEY (task_id) REFERENCES stock_count_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 18. Stock Adjustments (Generated on approval)
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  adjustment_code TEXT UNIQUE NOT NULL,
  task_id TEXT,
  product_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  before_quantity REAL NOT NULL,
  after_quantity REAL NOT NULL,
  diff_quantity REAL NOT NULL,
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (location_id) REFERENCES warehouse_locations(id)
);

-- 19. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_terms_days INTEGER DEFAULT 30,
  balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 20. Purchase Orders (PO)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id TEXT NOT NULL,
  order_date TEXT NOT NULL,
  expected_date TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, partially_received, completed, cancelled
  total_amount REAL DEFAULT 0,
  vat_amount REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- 21. Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  received_quantity REAL DEFAULT 0,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 22. Goods Receipts (GRN)
CREATE TABLE IF NOT EXISTS goods_receipts (
  id TEXT PRIMARY KEY,
  grn_number TEXT UNIQUE NOT NULL,
  po_id TEXT,
  supplier_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  receipt_date TEXT NOT NULL,
  invoice_number TEXT,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'received',
  received_by TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (location_id) REFERENCES warehouse_locations(id)
);

-- 23. Customers & Members
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  member_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  address TEXT,
  points INTEGER DEFAULT 0,
  membership_tier TEXT DEFAULT 'Silver',
  discount_pct REAL DEFAULT 0.0,
  total_spent REAL DEFAULT 0.0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 24. Cashier Shifts
CREATE TABLE IF NOT EXISTS cashier_shifts (
  id TEXT PRIMARY KEY,
  shift_code TEXT UNIQUE NOT NULL,
  cashier_id TEXT NOT NULL,
  cashier_name TEXT NOT NULL,
  opened_at TEXT DEFAULT (datetime('now', 'localtime')),
  closed_at TEXT,
  opening_cash REAL NOT NULL DEFAULT 0,
  cash_sales REAL DEFAULT 0,
  promptpay_sales REAL DEFAULT 0,
  card_sales REAL DEFAULT 0,
  transfer_sales REAL DEFAULT 0,
  total_sales REAL DEFAULT 0,
  cash_in REAL DEFAULT 0,
  cash_out REAL DEFAULT 0,
  expected_cash REAL DEFAULT 0,
  actual_cash REAL,
  difference REAL,
  status TEXT DEFAULT 'open', -- open, closed
  notes TEXT
);

-- 25. Cash Movements (In/Out from Shift Drawer)
CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL,
  type TEXT NOT NULL, -- cash_in, cash_out
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  authorized_by TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (shift_id) REFERENCES cashier_shifts(id)
);

-- 26. Sales Transactions
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  shift_id TEXT,
  cashier_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  subtotal REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  vat_amount REAL DEFAULT 0,
  grand_total REAL NOT NULL,
  payment_method TEXT NOT NULL, -- cash, promptpay, card, transfer, split
  received_amount REAL NOT NULL,
  change_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'completed', -- completed, voided, refunded
  void_reason TEXT,
  void_approved_by TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (shift_id) REFERENCES cashier_shifts(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 27. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  barcode TEXT,
  unit TEXT DEFAULT 'ชิ้น',
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  cost_price REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  subtotal REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 28. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  expense_no TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  vat_amount REAL DEFAULT 0,
  grand_total REAL NOT NULL,
  recipient TEXT,
  paid_by TEXT,
  payment_method TEXT DEFAULT 'cash',
  expense_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 29. Accounting Entries
CREATE TABLE IF NOT EXISTS accounting_entries (
  id TEXT PRIMARY KEY,
  entry_no TEXT UNIQUE NOT NULL,
  entry_date TEXT NOT NULL,
  entry_type TEXT NOT NULL, -- sales, purchase, expense, cash_in, cash_out
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 30. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, warning, danger, success
  role_target TEXT DEFAULT 'ALL',
  is_read INTEGER DEFAULT 0,
  link TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 31. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Indexes for Speed
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory(product_id, location_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
CREATE INDEX IF NOT EXISTS idx_movements_prod ON inventory_movements(product_id);
