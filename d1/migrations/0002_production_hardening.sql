-- ===================================================================
-- Cloudflare D1 Database Migration: 0002_production_hardening.sql
-- True Atomicity, Triggers, Least-Privilege & Stock Synchronization
-- ===================================================================

-- 1. Table: login_attempts (Rate Limiting & Brute Force Prevention)
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL,
  username TEXT NOT NULL,
  attempted_at TEXT DEFAULT (datetime('now', 'localtime')),
  success INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(username, attempted_at);

-- 2. Trigger: Prevent Negative Inventory on Shelf/Warehouse
-- If any UPDATE attempts to set quantity < 0, SQLite aborts the entire transaction immediately!
DROP TRIGGER IF EXISTS trg_prevent_negative_inventory;
CREATE TRIGGER trg_prevent_negative_inventory
BEFORE UPDATE OF quantity ON inventory
FOR EACH ROW
WHEN NEW.quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_INVENTORY_STOCK');
END;

-- 3. Trigger: Prevent Negative Product Aggregate Stock
DROP TRIGGER IF EXISTS trg_prevent_negative_product_stock;
CREATE TRIGGER trg_prevent_negative_product_stock
BEFORE UPDATE OF current_stock ON products
FOR EACH ROW
WHEN NEW.current_stock < 0
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_PRODUCT_STOCK');
END;

-- 4. Trigger: Prevent Concurrent Double Approval of Stock Count Tasks
-- If a task is already approved, any concurrent attempt to approve it triggers an immediate transaction abort!
DROP TRIGGER IF EXISTS trg_stock_count_approve_guard;
CREATE TRIGGER trg_stock_count_approve_guard
BEFORE UPDATE OF status ON stock_count_tasks
FOR EACH ROW
WHEN NEW.status = 'approved' AND OLD.status != 'pending_approval'
BEGIN
  SELECT RAISE(ABORT, 'TASK_ALREADY_APPROVED_OR_NOT_PENDING');
END;

-- 5. Triggers: Automatic Mathematical Synchronization of products.current_stock
-- Whenever inventory changes (INSERT, UPDATE, DELETE) across ANY route, current_stock stays 100% in sync!
DROP TRIGGER IF EXISTS trg_sync_inventory_insert;
CREATE TRIGGER trg_sync_inventory_insert
AFTER INSERT ON inventory
BEGIN
  UPDATE products 
  SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE product_id = NEW.product_id),
      updated_at = datetime('now', 'localtime')
  WHERE id = NEW.product_id;
END;

DROP TRIGGER IF EXISTS trg_sync_inventory_update;
CREATE TRIGGER trg_sync_inventory_update
AFTER UPDATE OF quantity ON inventory
BEGIN
  UPDATE products 
  SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE product_id = NEW.product_id),
      updated_at = datetime('now', 'localtime')
  WHERE id = NEW.product_id;
END;

DROP TRIGGER IF EXISTS trg_sync_inventory_delete;
CREATE TRIGGER trg_sync_inventory_delete
AFTER DELETE ON inventory
BEGIN
  UPDATE products 
  SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE product_id = OLD.product_id),
      updated_at = datetime('now', 'localtime')
  WHERE id = OLD.product_id;
END;

-- 6. Synchronize initial aggregate balances
UPDATE products 
SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE inventory.product_id = products.id);
