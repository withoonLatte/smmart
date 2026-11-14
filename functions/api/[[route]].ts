import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { cors } from "hono/cors";

type D1Database = any;

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Role", "X-User-Id"],
}));

// Helper: generate IDs
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// -------------------------------------------------------------------
// 1. AUTHENTICATION & SESSIONS
// -------------------------------------------------------------------
app.post("/auth/login", async (c) => {
  const { username, password } = await c.req.json();
  const db = c.env.DB;

  const emp: any = await db.prepare(
    "SELECT * FROM employees WHERE username = ? AND password_hash = ?"
  ).bind(username, password).first();

  if (!emp) {
    return c.json({ success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  if (emp.status === "suspended") {
    return c.json({ success: false, error: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" }, 403);
  }

  // Update last login
  await db.prepare("UPDATE employees SET last_login_at = datetime('now', 'localtime') WHERE id = ?").bind(emp.id).run();

  // Fetch permissions for this role
  const perms = await db.prepare(
    `SELECT permission_code FROM role_permissions rp 
     JOIN roles r ON r.id = rp.role_id 
     WHERE r.code = ?`
  ).bind(emp.role_code).all();

  const permissionList = perms.results.map((p: any) => p.permission_code);

  return c.json({
    success: true,
    user: {
      id: emp.id,
      employee_code: emp.employee_code,
      username: emp.username,
      full_name: emp.full_name,
      role_code: emp.role_code,
      position: emp.position,
      email: emp.email,
      phone: emp.phone,
      permissions: permissionList,
    }
  });
});

// -------------------------------------------------------------------
// 2. STORE PROFILE & SYSTEM SETTINGS
// -------------------------------------------------------------------
app.get("/store-profile", async (c) => {
  const db = c.env.DB;
  const store = await db.prepare("SELECT * FROM store_profile LIMIT 1").first();
  return c.json({ success: true, data: store });
});

app.put("/store-profile", async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;

  await db.prepare(
    `UPDATE store_profile SET 
      store_name = ?, branch_name = ?, tax_id = ?, phone = ?, email = ?, 
      address = ?, promptpay_id = ?, vat_rate = ?, receipt_header = ?, receipt_footer = ?,
      updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).bind(
    body.store_name, body.branch_name, body.tax_id, body.phone, body.email,
    body.address, body.promptpay_id, Number(body.vat_rate) || 7.0, body.receipt_header, body.receipt_footer,
    body.id || 'store_001'
  ).run();

  return c.json({ success: true, message: "บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว" });
});

app.get("/settings", async (c) => {
  const db = c.env.DB;
  const settings = await db.prepare("SELECT * FROM system_settings").all();
  return c.json({ success: true, data: settings.results });
});

// -------------------------------------------------------------------
// 3. OWNER DASHBOARD
// -------------------------------------------------------------------
app.get("/dashboard/summary", async (c) => {
  const db = c.env.DB;

  // Today Sales
  const todaySales: any = await db.prepare(
    `SELECT 
      COALESCE(SUM(grand_total), 0) as total_sales,
      COUNT(id) as total_transactions
     FROM sales 
     WHERE date(created_at) = date('now', 'localtime') AND status = 'completed'`
  ).first();

  // Monthly Sales
  const monthSales: any = await db.prepare(
    `SELECT 
      COALESCE(SUM(grand_total), 0) as month_sales,
      COUNT(id) as month_transactions
     FROM sales 
     WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime') AND status = 'completed'`
  ).first();

  // Gross profit estimate (Sales subtotal - total costs)
  const profitEst: any = await db.prepare(
    `SELECT 
      COALESCE(SUM(si.subtotal), 0) as total_revenue,
      COALESCE(SUM(si.cost_price * si.quantity), 0) as total_cost
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed'`
  ).first();

  // Inventory valuation
  const inventoryVal: any = await db.prepare(
    `SELECT 
      COALESCE(SUM(inv.quantity * p.cost_price), 0) as total_cost_value,
      COALESCE(SUM(inv.quantity * p.selling_price), 0) as total_retail_value,
      COALESCE(SUM(inv.quantity), 0) as total_stock_items
     FROM inventory inv
     JOIN products p ON p.id = inv.product_id`
  ).first();

  // Low stock products
  const lowStock = await db.prepare(
    `SELECT p.id, p.sku, p.name, p.min_stock, p.unit, COALESCE(SUM(inv.quantity), 0) as current_stock
     FROM products p
     LEFT JOIN inventory inv ON inv.product_id = p.id
     WHERE p.is_active = 1
     GROUP BY p.id
     HAVING current_stock <= p.min_stock
     ORDER BY current_stock ASC LIMIT 8`
  ).all();

  // Top selling products
  const topProducts = await db.prepare(
    `SELECT si.product_id, si.product_name, SUM(si.quantity) as sold_qty, SUM(si.subtotal) as total_revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed'
     GROUP BY si.product_id
     ORDER BY sold_qty DESC LIMIT 5`
  ).all();

  // Recent 5 sales
  const recentSales = await db.prepare(
    `SELECT s.*, e.full_name as cashier_name 
     FROM sales s 
     LEFT JOIN employees e ON e.id = s.cashier_id
     ORDER BY s.created_at DESC LIMIT 6`
  ).all();

  // Monthly Expenses
  const monthExpense: any = await db.prepare(
    `SELECT COALESCE(SUM(grand_total), 0) as total_expense 
     FROM expenses 
     WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now', 'localtime')`
  ).first();

  return c.json({
    success: true,
    data: {
      today: {
        sales: todaySales?.total_sales || 0,
        transactions: todaySales?.total_transactions || 0,
      },
      monthly: {
        sales: monthSales?.month_sales || 0,
        transactions: monthSales?.month_transactions || 0,
      },
      profit: {
        revenue: profitEst?.total_revenue || 0,
        cost: profitEst?.total_cost || 0,
        gross_profit: (profitEst?.total_revenue || 0) - (profitEst?.total_cost || 0),
      },
      inventory: {
        cost_value: inventoryVal?.total_cost_value || 0,
        retail_value: inventoryVal?.total_retail_value || 0,
        total_items: inventoryVal?.total_stock_items || 0,
      },
      low_stock: lowStock.results,
      top_products: topProducts.results,
      recent_sales: recentSales.results,
      monthly_expense: monthExpense?.total_expense || 0,
    }
  });
});

// -------------------------------------------------------------------
// 4. POS (POINT OF SALE)
// -------------------------------------------------------------------

// Check Active Shift for Cashier
app.get("/pos/shift/active", async (c) => {
  const cashierId = c.req.query("cashier_id");
  const db = c.env.DB;

  let query = "SELECT * FROM cashier_shifts WHERE status = 'open'";
  let params: any[] = [];
  if (cashierId) {
    query += " AND cashier_id = ?";
    params.push(cashierId);
  }
  query += " ORDER BY opened_at DESC LIMIT 1";

  const shift = await db.prepare(query).bind(...params).first();
  return c.json({ success: true, shift: shift || null });
});

// Open Shift
app.post("/pos/shift/open", async (c) => {
  const { cashier_id, cashier_name, opening_cash, notes } = await c.req.json();
  const db = c.env.DB;

  // Check if already open
  const existing = await db.prepare(
    "SELECT id FROM cashier_shifts WHERE cashier_id = ? AND status = 'open'"
  ).bind(cashier_id).first();

  if (existing) {
    return c.json({ success: false, error: "คุณมีกะการทำงานที่ยังเปิดค้างอยู่แล้ว" }, 400);
  }

  const shiftId = genId("shift");
  const shiftCode = `SFT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  await db.prepare(
    `INSERT INTO cashier_shifts (id, shift_code, cashier_id, cashier_name, opening_cash, expected_cash, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(shiftId, shiftCode, cashier_id, cashier_name, Number(opening_cash) || 0, Number(opening_cash) || 0, notes || '').run();

  const newShift = await db.prepare("SELECT * FROM cashier_shifts WHERE id = ?").bind(shiftId).first();
  return c.json({ success: true, shift: newShift, message: "เปิดกะขายเรียบร้อยแล้ว พร้อมให้บริการ" });
});

// Close Shift
app.post("/pos/shift/close", async (c) => {
  const { shift_id, actual_cash, notes } = await c.req.json();
  const db = c.env.DB;

  const shift: any = await db.prepare("SELECT * FROM cashier_shifts WHERE id = ?").bind(shift_id).first();
  if (!shift) {
    return c.json({ success: false, error: "ไม่พบข้อมูลกะนี้" }, 404);
  }

  const expectedCash = (Number(shift.opening_cash) || 0) + (Number(shift.cash_sales) || 0) + (Number(shift.cash_in) || 0) - (Number(shift.cash_out) || 0);
  const diff = Number(actual_cash) - expectedCash;

  await db.prepare(
    `UPDATE cashier_shifts SET 
      closed_at = datetime('now', 'localtime'),
      expected_cash = ?,
      actual_cash = ?,
      difference = ?,
      status = 'closed',
      notes = ?
     WHERE id = ?`
  ).bind(expectedCash, Number(actual_cash), diff, notes || '', shift_id).run();

  return c.json({
    success: true,
    data: {
      opening_cash: shift.opening_cash,
      cash_sales: shift.cash_sales,
      total_sales: shift.total_sales,
      expected_cash: expectedCash,
      actual_cash: Number(actual_cash),
      difference: diff,
    },
    message: "ปิดกะขายและสรุปยอดเรียบร้อยแล้ว"
  });
});

// POS Checkout
app.post("/pos/checkout", async (c) => {
  const {
    shift_id,
    cashier_id,
    customer_id,
    customer_name,
    items, // array of { product_id, name, barcode, unit, quantity, unit_price, cost_price, discount_amount, subtotal }
    subtotal,
    discount_amount,
    vat_amount,
    grand_total,
    payment_method, // cash, promptpay, card, transfer
    received_amount,
    change_amount
  } = await c.req.json();

  if (!items || items.length === 0) {
    return c.json({ success: false, error: "ตะกร้าสินค้าว่างเปล่า" }, 400);
  }

  const db = c.env.DB;
  const saleId = genId("sale");
  const invoiceNo = `INV-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Insert into sales
  await db.prepare(
    `INSERT INTO sales (
      id, invoice_no, shift_id, cashier_id, customer_id, customer_name,
      subtotal, discount_amount, vat_amount, grand_total, payment_method,
      received_amount, change_amount, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`
  ).bind(
    saleId, invoiceNo, shift_id || null, cashier_id, customer_id || null, customer_name || 'ลูกค้าทั่วไป',
    Number(subtotal), Number(discount_amount) || 0, Number(vat_amount) || 0, Number(grand_total),
    payment_method, Number(received_amount), Number(change_amount) || 0
  ).run();

  // 2. Insert items and deduct stock atomically from retail shelves (loc_shelf)
  for (const item of items) {
    const saleItemId = genId("item");
    await db.prepare(
      `INSERT INTO sale_items (
        id, sale_id, product_id, product_name, barcode, unit, quantity,
        unit_price, cost_price, discount_amount, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      saleItemId, saleId, item.product_id, item.name, item.barcode || '', item.unit || 'ชิ้น',
      Number(item.quantity), Number(item.unit_price), Number(item.cost_price) || 0,
      Number(item.discount_amount) || 0, Number(item.subtotal)
    ).run();

    // Deduct inventory from loc_shelf (or any location holding the product)
    await db.prepare(
      `UPDATE inventory SET 
        quantity = MAX(0, quantity - ?),
        updated_at = datetime('now', 'localtime')
       WHERE product_id = ? AND location_id = 'loc_shelf'`
    ).bind(Number(item.quantity), item.product_id).run();

    // Record stock movement
    await db.prepare(
      `INSERT INTO inventory_movements (
        id, product_id, from_location_id, to_location_id, movement_type,
        quantity, unit_cost, reference_type, reference_id, reason, created_by
      ) VALUES (?, ?, 'loc_shelf', NULL, 'sale', ?, ?, 'sale', ?, 'จำหน่ายหน้าร้าน POS', ?)`
    ).bind(
      genId("mov"), item.product_id, Number(item.quantity), Number(item.cost_price) || 0,
      invoiceNo, cashier_id
    ).run();
  }

  // 3. Update shift sales if shift_id provided
  if (shift_id) {
    let updateField = "total_sales = total_sales + ?, expected_cash = expected_cash + ?";
    let extraCash = 0;
    if (payment_method === "cash") {
      updateField += ", cash_sales = cash_sales + ?";
      extraCash = Number(grand_total);
    } else if (payment_method === "promptpay") {
      updateField += ", promptpay_sales = promptpay_sales + ?";
    } else if (payment_method === "card") {
      updateField += ", card_sales = card_sales + ?";
    } else {
      updateField += ", transfer_sales = transfer_sales + ?";
    }

    if (payment_method === "cash") {
      await db.prepare(
        `UPDATE cashier_shifts SET ${updateField} WHERE id = ?`
      ).bind(Number(grand_total), extraCash, Number(grand_total), shift_id).run();
    } else {
      await db.prepare(
        `UPDATE cashier_shifts SET ${updateField} WHERE id = ?`
      ).bind(Number(grand_total), 0, Number(grand_total), shift_id).run();
    }
  }

  // 4. Update member points (1 point per 50 THB)
  if (customer_id) {
    const earnedPoints = Math.floor(Number(grand_total) / 50);
    await db.prepare(
      `UPDATE customers SET 
        points = points + ?,
        total_spent = total_spent + ?
       WHERE id = ?`
    ).bind(earnedPoints, Number(grand_total), customer_id).run();
  }

  // Fetch full created sale with items
  const createdSale = await db.prepare("SELECT * FROM sales WHERE id = ?").bind(saleId).first();
  const createdItems = await db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").bind(saleId).all();

  return c.json({
    success: true,
    invoice_no: invoiceNo,
    sale: createdSale,
    items: createdItems.results,
    message: "บันทึกการขายสำเร็จเรียบร้อย"
  });
});

// Sales List (Role-filtered)
app.get("/pos/sales", async (c) => {
  const db = c.env.DB;
  const cashierId = c.req.header("X-User-Id");
  const role = c.req.header("X-Role");

  let query = `SELECT s.*, e.full_name as cashier_name 
               FROM sales s 
               LEFT JOIN employees e ON e.id = s.cashier_id `;
  let params: any[] = [];

  // Cashiers can ONLY view their own sales
  if (role === "CASHIER" && cashierId) {
    query += " WHERE s.cashier_id = ? ";
    params.push(cashierId);
  }

  query += " ORDER BY s.created_at DESC LIMIT 100";
  const sales = await db.prepare(query).bind(...params).all();

  return c.json({ success: true, data: sales.results });
});

// Sale Details
app.get("/pos/sales/:id", async (c) => {
  const db = c.env.DB;
  const saleId = c.req.param("id");

  const sale = await db.prepare("SELECT * FROM sales WHERE id = ?").bind(saleId).first();
  if (!sale) {
    return c.json({ success: false, error: "ไม่พบบิลการขาย" }, 404);
  }

  const items = await db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").bind(saleId).all();
  return c.json({ success: true, sale, items: items.results });
});

// Void / Refund Sale (Manager/Admin Approval Required)
app.post("/pos/sales/:id/void", async (c) => {
  const saleId = c.req.param("id");
  const { reason, approved_by } = await c.req.json();
  const db = c.env.DB;

  const sale: any = await db.prepare("SELECT * FROM sales WHERE id = ?").bind(saleId).first();
  if (!sale) return c.json({ success: false, error: "ไม่พบการขาย" }, 404);
  if (sale.status === "voided") return c.json({ success: false, error: "บิลนี้ถูกยกเลิกไปแล้ว" }, 400);

  // Mark void
  await db.prepare(
    `UPDATE sales SET 
      status = 'voided',
      void_reason = ?,
      void_approved_by = ?
     WHERE id = ?`
  ).bind(reason || 'ลูกค้ายกเลิก', approved_by || 'Manager', saleId).run();

  // Restock items back to loc_shelf
  const items = await db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").bind(saleId).all();
  for (const item of items.results as any[]) {
    await db.prepare(
      `UPDATE inventory SET 
        quantity = quantity + ?,
        updated_at = datetime('now', 'localtime')
       WHERE product_id = ? AND location_id = 'loc_shelf'`
    ).bind(Number(item.quantity), item.product_id).run();

    await db.prepare(
      `INSERT INTO inventory_movements (
        id, product_id, from_location_id, to_location_id, movement_type,
        quantity, unit_cost, reference_type, reference_id, reason, created_by
      ) VALUES (?, ?, NULL, 'loc_shelf', 'return', ?, ?, 'void', ?, ?, ?)`
    ).bind(
      genId("mov"), item.product_id, Number(item.quantity), Number(item.cost_price) || 0,
      sale.invoice_no, reason || 'ยกเลิกบิลขาย คืนสต๊อก', approved_by
    ).run();
  }

  return c.json({ success: true, message: `ยกเลิกบิล ${sale.invoice_no} และคืนสต๊อกเข้าสู่ชั้นวางเรียบร้อยแล้ว` });
});

// -------------------------------------------------------------------
// 5. PRODUCTS & CATALOG
// -------------------------------------------------------------------
app.get("/products", async (c) => {
  const db = c.env.DB;
  const role = c.req.header("X-Role");
  const search = c.req.query("q") || "";
  const cat = c.req.query("cat") || "";

  let query = `
    SELECT p.*, c.name as category_name, b.name as brand_name,
           COALESCE(SUM(inv.quantity), 0) as total_stock,
           COALESCE(SUM(CASE WHEN inv.location_id = 'loc_shelf' THEN inv.quantity ELSE 0 END), 0) as shelf_stock
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN inventory inv ON inv.product_id = p.id
    WHERE p.is_active = 1
  `;
  const params: any[] = [];

  if (search) {
    query += " AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (cat) {
    query += " AND p.category_id = ?";
    params.push(cat);
  }

  query += " GROUP BY p.id ORDER BY p.name ASC";
  const prods = await db.prepare(query).bind(...params).all();

  // Strip cost_price if user is CASHIER or STOCK_CHECKER (Least Privilege Rule)
  const results = prods.results.map((p: any) => {
    if (role === "CASHIER" || role === "STOCK_CHECKER") {
      const { cost_price, wholesale_price, ...safe } = p;
      return safe;
    }
    return p;
  });

  return c.json({ success: true, data: results });
});

app.post("/products", async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const prodId = genId("prod");

  await db.prepare(
    `INSERT INTO products (
      id, sku, barcode, name, category_id, brand_id, unit,
      cost_price, selling_price, wholesale_price, min_stock, max_stock,
      is_vat, is_active, expiry_date, batch_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(
    prodId, body.sku, body.barcode, body.name, body.category_id || null, body.brand_id || null,
    body.unit || 'ชิ้น', Number(body.cost_price) || 0, Number(body.selling_price) || 0,
    Number(body.wholesale_price) || 0, Number(body.min_stock) || 5, Number(body.max_stock) || 500,
    body.is_vat ? 1 : 0, body.expiry_date || null, body.batch_number || null
  ).run();

  // Create default inventory row for shelf
  await db.prepare(
    `INSERT INTO inventory (id, product_id, location_id, quantity, reserved_quantity)
     VALUES (?, ?, 'loc_shelf', ?, 0)`
  ).bind(genId("inv"), prodId, Number(body.initial_stock) || 0).run();

  return c.json({ success: true, message: "เพิ่มสินค้าใหม่เรียบร้อยแล้ว", id: prodId });
});

app.put("/products/:id", async (c) => {
  const prodId = c.req.param("id");
  const body = await c.req.json();
  const db = c.env.DB;

  await db.prepare(
    `UPDATE products SET 
      sku = ?, barcode = ?, name = ?, category_id = ?, brand_id = ?, unit = ?,
      cost_price = ?, selling_price = ?, wholesale_price = ?, min_stock = ?, max_stock = ?,
      is_vat = ?, expiry_date = ?, batch_number = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).bind(
    body.sku, body.barcode, body.name, body.category_id || null, body.brand_id || null, body.unit || 'ชิ้น',
    Number(body.cost_price) || 0, Number(body.selling_price) || 0, Number(body.wholesale_price) || 0,
    Number(body.min_stock) || 5, Number(body.max_stock) || 500, body.is_vat ? 1 : 0,
    body.expiry_date || null, body.batch_number || null, prodId
  ).run();

  return c.json({ success: true, message: "อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว" });
});

app.delete("/products/:id", async (c) => {
  const prodId = c.req.param("id");
  const db = c.env.DB;
  await db.prepare("UPDATE products SET is_active = 0 WHERE id = ?").bind(prodId).run();
  return c.json({ success: true, message: "ปิดการใช้งานสินค้าเรียบร้อยแล้ว" });
});

// Categories & Brands
app.get("/categories", async (c) => {
  const db = c.env.DB;
  const cats = await db.prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC").all();
  return c.json({ success: true, data: cats.results });
});

app.get("/brands", async (c) => {
  const db = c.env.DB;
  const brands = await db.prepare("SELECT * FROM brands ORDER BY name ASC").all();
  return c.json({ success: true, data: brands.results });
});

// -------------------------------------------------------------------
// 6. INVENTORY & WAREHOUSE LOCATIONS
// -------------------------------------------------------------------
app.get("/inventory/locations", async (c) => {
  const db = c.env.DB;
  const locs = await db.prepare(
    `SELECT wl.*, w.name as warehouse_name 
     FROM warehouse_locations wl
     JOIN warehouses w ON w.id = wl.warehouse_id
     WHERE wl.is_active = 1
     ORDER BY wl.name ASC`
  ).all();
  return c.json({ success: true, data: locs.results });
});

app.get("/inventory/stock-by-location", async (c) => {
  const db = c.env.DB;
  const role = c.req.header("X-Role");

  const stocks = await db.prepare(
    `SELECT inv.*, p.name as product_name, p.sku, p.barcode, p.unit, p.cost_price, p.selling_price,
            wl.name as location_name, wl.location_type, w.name as warehouse_name
     FROM inventory inv
     JOIN products p ON p.id = inv.product_id
     JOIN warehouse_locations wl ON wl.id = inv.location_id
     JOIN warehouses w ON w.id = wl.warehouse_id
     WHERE p.is_active = 1
     ORDER BY wl.name, p.name`
  ).all();

  // Strip cost_price if unauthorized
  const results = stocks.results.map((item: any) => {
    if (role === "CASHIER" || role === "STOCK_CHECKER" || role === "WAREHOUSE") {
      const { cost_price, ...safe } = item;
      return safe;
    }
    return item;
  });

  return c.json({ success: true, data: results });
});

// Internal Stock Transfer between storage locations
app.post("/inventory/transfer", async (c) => {
  const { product_id, from_location_id, to_location_id, quantity, reason, user_id } = await c.req.json();
  const qty = Number(quantity);

  if (qty <= 0) return c.json({ success: false, error: "จำนวนที่ย้ายต้องมากกว่า 0" }, 400);
  if (from_location_id === to_location_id) return c.json({ success: false, error: "จุดต้นทางและปลายทางต้องไม่เป็นที่เดียวกัน" }, 400);

  const db = c.env.DB;

  // Check from stock
  const fromStock: any = await db.prepare(
    "SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ?"
  ).bind(product_id, from_location_id).first();

  if (!fromStock || fromStock.quantity < qty) {
    return c.json({ success: false, error: `สต๊อกต้นทางไม่เพียงพอ (มีอยู่ ${fromStock?.quantity || 0})` }, 400);
  }

  // Deduct from source
  await db.prepare(
    "UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now', 'localtime') WHERE product_id = ? AND location_id = ?"
  ).bind(qty, product_id, from_location_id).run();

  // Add to destination (Insert if not exists)
  await db.prepare(
    `INSERT INTO inventory (id, product_id, location_id, quantity, reserved_quantity)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(product_id, location_id) DO UPDATE SET 
      quantity = quantity + excluded.quantity,
      updated_at = datetime('now', 'localtime')`
  ).bind(genId("inv"), product_id, to_location_id, qty).run();

  // Record movement
  await db.prepare(
    `INSERT INTO inventory_movements (
      id, product_id, from_location_id, to_location_id, movement_type,
      quantity, reference_type, reason, created_by
    ) VALUES (?, ?, ?, ?, 'internal_transfer', ?, 'transfer', ?, ?)`
  ).bind(genId("mov"), product_id, from_location_id, to_location_id, qty, reason || 'ย้ายจุดจัดเก็บภายใน', user_id || 'Staff').run();

  return c.json({ success: true, message: `ย้ายสินค้าจำนวน ${qty} ชิ้น เรียบร้อยแล้ว` });
});

// Inventory Movements Log
app.get("/inventory/movements", async (c) => {
  const db = c.env.DB;
  const movements = await db.prepare(
    `SELECT im.*, p.name as product_name, p.sku, p.unit,
            fl.name as from_location_name, tl.name as to_location_name
     FROM inventory_movements im
     JOIN products p ON p.id = im.product_id
     LEFT JOIN warehouse_locations fl ON fl.id = im.from_location_id
     LEFT JOIN warehouse_locations tl ON tl.id = im.to_location_id
     ORDER BY im.created_at DESC LIMIT 100`
  ).all();

  return c.json({ success: true, data: movements.results });
});

// -------------------------------------------------------------------
// 7. STOCK COUNTING (DEDICATED APP WITH BLIND COUNT)
// -------------------------------------------------------------------
app.get("/stock-count/tasks", async (c) => {
  const db = c.env.DB;
  const role = c.req.header("X-Role");
  const userId = c.req.header("X-User-Id");

  let query = `
    SELECT sct.*, wl.name as location_name, cat.name as category_name,
           e1.full_name as assigned_to_name, e2.full_name as created_by_name,
           COUNT(sci.id) as total_items,
           SUM(CASE WHEN sci.counted_quantity IS NOT NULL THEN 1 ELSE 0 END) as counted_items
    FROM stock_count_tasks sct
    LEFT JOIN warehouse_locations wl ON wl.id = sct.location_id
    LEFT JOIN categories cat ON cat.id = sct.category_id
    LEFT JOIN employees e1 ON e1.id = sct.assigned_to
    LEFT JOIN employees e2 ON e2.id = sct.created_by
    LEFT JOIN stock_count_items sci ON sci.task_id = sct.id
  `;

  let params: any[] = [];
  if (role === "STOCK_CHECKER" && userId) {
    query += " WHERE sct.assigned_to = ? ";
    params.push(userId);
  }

  query += " GROUP BY sct.id ORDER BY sct.created_at DESC";
  const tasks = await db.prepare(query).bind(...params).all();

  return c.json({ success: true, data: tasks.results });
});

app.post("/stock-count/tasks", async (c) => {
  const { title, location_id, category_id, assigned_to, user_id, notes } = await c.req.json();
  const db = c.env.DB;
  const taskId = genId("task");
  const taskCode = `CNT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  await db.prepare(
    `INSERT INTO stock_count_tasks (id, task_code, title, location_id, category_id, status, assigned_to, created_by, notes)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
  ).bind(taskId, taskCode, title, location_id, category_id || null, assigned_to, user_id, notes || '').run();

  // Populate items from inventory for this location
  let itemQuery = `
    SELECT p.id as product_id, COALESCE(inv.quantity, 0) as system_quantity
    FROM products p
    LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.location_id = ?
    WHERE p.is_active = 1
  `;
  const params: any[] = [location_id];
  if (category_id) {
    itemQuery += " AND p.category_id = ?";
    params.push(category_id);
  }

  const prods = await db.prepare(itemQuery).bind(...params).all();
  for (const p of prods.results as any[]) {
    await db.prepare(
      `INSERT INTO stock_count_items (id, task_id, product_id, system_quantity, status)
       VALUES (?, ?, ?, ?, 'pending')`
    ).bind(genId("sci"), taskId, p.product_id, p.system_quantity).run();
  }

  return c.json({ success: true, message: `สร้างใบงานนับสต๊อก ${taskCode} สำเร็จแล้ว พร้อม ${prods.results.length} รายการ`, id: taskId });
});

// Task Details (Strict Blind Count for Stock Checker!)
app.get("/stock-count/tasks/:id", async (c) => {
  const taskId = c.req.param("id");
  const role = c.req.header("X-Role");
  const db = c.env.DB;

  const task = await db.prepare(
    `SELECT sct.*, wl.name as location_name 
     FROM stock_count_tasks sct
     LEFT JOIN warehouse_locations wl ON wl.id = sct.location_id
     WHERE sct.id = ?`
  ).bind(taskId).first();

  if (!task) return c.json({ success: false, error: "ไม่พบใบงานตรวจนับ" }, 404);

  const items = await db.prepare(
    `SELECT sci.*, p.name as product_name, p.barcode, p.sku, p.unit, p.selling_price
     FROM stock_count_items sci
     JOIN products p ON p.id = sci.product_id
     WHERE sci.task_id = ?
     ORDER BY p.name ASC`
  ).bind(taskId).all();

  // STRICT RULE: Never display expected stock quantity, cost, or difference to STOCK_CHECKER!
  const safeItems = items.results.map((item: any) => {
    if (role === "STOCK_CHECKER") {
      const { system_quantity, difference, ...blind } = item;
      return blind;
    }
    return item;
  });

  return c.json({ success: true, task, items: safeItems });
});

// Checker Submits count results
app.post("/stock-count/tasks/:id/submit", async (c) => {
  const taskId = c.req.param("id");
  const { counts } = await c.req.json(); // array of { id: sci_id, counted_quantity: number }
  const db = c.env.DB;

  for (const c of counts) {
    const item: any = await db.prepare("SELECT system_quantity FROM stock_count_items WHERE id = ?").bind(c.id).first();
    const counted = Number(c.counted_quantity);
    const diff = counted - (item?.system_quantity || 0);
    const status = diff === 0 ? 'matched' : 'discrepancy';

    await db.prepare(
      `UPDATE stock_count_items SET 
        counted_quantity = ?,
        difference = ?,
        status = ?,
        counted_at = datetime('now', 'localtime')
       WHERE id = ?`
    ).bind(counted, diff, status, c.id).run();
  }

  await db.prepare(
    "UPDATE stock_count_tasks SET status = 'pending_approval', updated_at = datetime('now', 'localtime') WHERE id = ?"
  ).bind(taskId).run();

  return c.json({ success: true, message: "บันทึกและส่งผลการตรวจนับให้ผู้จัดการตรวจสอบเรียบร้อยแล้ว" });
});

// Manager Approves count discrepancies & generates stock adjustment
app.post("/stock-count/tasks/:id/approve", async (c) => {
  const taskId = c.req.param("id");
  const { approved_by } = await c.req.json();
  const db = c.env.DB;

  const task: any = await db.prepare("SELECT * FROM stock_count_tasks WHERE id = ?").bind(taskId).first();
  if (!task) return c.json({ success: false, error: "ไม่พบใบงาน" }, 404);

  const items = await db.prepare("SELECT * FROM stock_count_items WHERE task_id = ?").bind(taskId).all();

  for (const item of items.results as any[]) {
    if (item.counted_quantity !== null && item.difference !== 0) {
      // Adjust inventory to match counted_quantity
      await db.prepare(
        `UPDATE inventory SET 
          quantity = ?,
          updated_at = datetime('now', 'localtime')
         WHERE product_id = ? AND location_id = ?`
      ).bind(item.counted_quantity, item.product_id, task.location_id).run();

      // Record adjustment record
      const adjId = genId("adj");
      const adjCode = `ADJ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      await db.prepare(
        `INSERT INTO stock_adjustments (
          id, adjustment_code, task_id, product_id, location_id,
          before_quantity, after_quantity, diff_quantity, reason, approved_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        adjId, adjCode, taskId, item.product_id, task.location_id,
        item.system_quantity, item.counted_quantity, item.difference,
        `ปรับยอดตามผลตรวจนับใบงาน ${task.task_code}`, approved_by || 'Manager'
      ).run();

      // Record movement
      const moveType = item.difference > 0 ? 'adjust_plus' : 'adjust_minus';
      await db.prepare(
        `INSERT INTO inventory_movements (
          id, product_id, from_location_id, to_location_id, movement_type,
          quantity, reference_type, reference_id, reason, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'stock_count', ?, ?, ?)`
      ).bind(
        genId("mov"), item.product_id,
        item.difference < 0 ? task.location_id : null,
        item.difference > 0 ? task.location_id : null,
        moveType, Math.abs(item.difference), task.task_code,
        `ปรับยอดสต๊อกจากการตรวจนับ (ผลต่าง ${item.difference})`, approved_by
      ).run();
    }
  }

  await db.prepare(
    `UPDATE stock_count_tasks SET 
      status = 'approved',
      approved_by = ?,
      approved_at = datetime('now', 'localtime'),
      updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).bind(approved_by || 'Manager', taskId).run();

  return c.json({ success: true, message: `อนุมัติผลตรวจนับและปรับปรุงยอดสต๊อกเรียบร้อยแล้ว` });
});

// -------------------------------------------------------------------
// 8. PURCHASING & SUPPLIERS
// -------------------------------------------------------------------
app.get("/suppliers", async (c) => {
  const db = c.env.DB;
  const sups = await db.prepare("SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC").all();
  return c.json({ success: true, data: sups.results });
});

app.post("/suppliers", async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const supId = genId("sup");

  await db.prepare(
    `INSERT INTO suppliers (id, code, name, tax_id, contact_person, phone, email, address, credit_terms_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    supId, body.code, body.name, body.tax_id || '', body.contact_person || '',
    body.phone || '', body.email || '', body.address || '', Number(body.credit_terms_days) || 30
  ).run();

  return c.json({ success: true, message: "เพิ่มคู่ค้า/ซัพพลายเออร์เรียบร้อยแล้ว" });
});

app.get("/purchasing/orders", async (c) => {
  const db = c.env.DB;
  const orders = await db.prepare(
    `SELECT po.*, s.name as supplier_name, e.full_name as creator_name
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN employees e ON e.id = po.created_by
     ORDER BY po.order_date DESC`
  ).all();

  return c.json({ success: true, data: orders.results });
});

app.post("/purchasing/orders", async (c) => {
  const { supplier_id, order_date, expected_date, items, notes, user_id } = await c.req.json();
  const db = c.env.DB;
  const poId = genId("po");
  const poNumber = `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  let totalAmount = 0;
  for (const it of items) {
    totalAmount += Number(it.quantity) * Number(it.unit_cost);
  }
  const vatAmount = totalAmount * 0.07;
  const grandTotal = totalAmount + vatAmount;

  await db.prepare(
    `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_date, status, total_amount, vat_amount, grand_total, notes, created_by)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
  ).bind(poId, poNumber, supplier_id, order_date || new Date().toISOString().slice(0, 10), expected_date || null, totalAmount, vatAmount, grandTotal, notes || '', user_id).run();

  for (const it of items) {
    await db.prepare(
      `INSERT INTO purchase_order_items (id, po_id, product_id, quantity, unit_cost, total_cost)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(genId("poi"), poId, it.product_id, Number(it.quantity), Number(it.unit_cost), Number(it.quantity) * Number(it.unit_cost)).run();
  }

  return c.json({ success: true, message: `สร้างใบสั่งซื้อ ${poNumber} เรียบร้อยแล้ว`, id: poId });
});

app.post("/purchasing/orders/:id/approve", async (c) => {
  const poId = c.req.param("id");
  const { user_id } = await c.req.json();
  const db = c.env.DB;

  await db.prepare(
    `UPDATE purchase_orders SET 
      status = 'approved',
      approved_by = ?,
      approved_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).bind(user_id || 'Manager', poId).run();

  return c.json({ success: true, message: "อนุมัติใบสั่งซื้อเรียบร้อยแล้ว ส่งต่อไปยังแผนกรับสินค้า" });
});

// Receive Goods (GRN) from PO into Main Warehouse
app.post("/purchasing/orders/:id/receive", async (c) => {
  const poId = c.req.param("id");
  const { location_id, invoice_number, user_id } = await c.req.json();
  const db = c.env.DB;

  const po: any = await db.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(poId).first();
  if (!po) return c.json({ success: false, error: "ไม่พบใบสั่งซื้อ" }, 404);

  const items = await db.prepare("SELECT * FROM purchase_order_items WHERE po_id = ?").bind(poId).all();
  const targetLocation = location_id || 'loc_main';

  for (const it of items.results as any[]) {
    // Increase stock in warehouse
    await db.prepare(
      `INSERT INTO inventory (id, product_id, location_id, quantity, reserved_quantity)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(product_id, location_id) DO UPDATE SET 
        quantity = quantity + excluded.quantity,
        updated_at = datetime('now', 'localtime')`
    ).bind(genId("inv"), it.product_id, targetLocation, it.quantity).run();

    // Movement
    await db.prepare(
      `INSERT INTO inventory_movements (
        id, product_id, from_location_id, to_location_id, movement_type,
        quantity, unit_cost, reference_type, reference_id, reason, created_by
      ) VALUES (?, ?, NULL, ?, 'purchase_in', ?, ?, 'po', ?, 'รับสินค้าเข้าคลังตามใบสั่งซื้อ', ?)`
    ).bind(genId("mov"), it.product_id, targetLocation, it.quantity, it.unit_cost, po.po_number, user_id).run();

    // Update PO item received qty
    await db.prepare("UPDATE purchase_order_items SET received_quantity = quantity WHERE id = ?").bind(it.id).run();
  }

  // Update PO status
  await db.prepare("UPDATE purchase_orders SET status = 'completed' WHERE id = ?").bind(poId).run();

  // Create GRN
  const grnNumber = `GRN-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
  await db.prepare(
    `INSERT INTO goods_receipts (id, grn_number, po_id, supplier_id, location_id, receipt_date, invoice_number, total_amount, received_by)
     VALUES (?, ?, ?, ?, ?, date('now', 'localtime'), ?, ?, ?)`
  ).bind(genId("grn"), grnNumber, poId, po.supplier_id, targetLocation, invoice_number || '', po.grand_total, user_id).run();

  return c.json({ success: true, message: `รับสินค้าตามใบสั่งซื้อ ${po.po_number} เข้าคลังสำเร็จ (ใบรับของ ${grnNumber})` });
});

// -------------------------------------------------------------------
// 9. CUSTOMERS & MEMBERSHIP
// -------------------------------------------------------------------
app.get("/customers", async (c) => {
  const db = c.env.DB;
  const search = c.req.query("q") || "";

  let query = "SELECT * FROM customers WHERE is_active = 1";
  const params: any[] = [];
  if (search) {
    query += " AND (name LIKE ? OR phone LIKE ? OR member_code LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += " ORDER BY name ASC";

  const custs = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: custs.results });
});

app.post("/customers", async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const custId = genId("cust");
  const memberCode = `MB-${Math.floor(1000 + Math.random() * 9000)}`;

  await db.prepare(
    `INSERT INTO customers (id, member_code, name, phone, email, address, membership_tier, discount_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    custId, memberCode, body.name, body.phone, body.email || '',
    body.address || '', body.membership_tier || 'Silver', Number(body.discount_pct) || 0
  ).run();

  return c.json({ success: true, message: `ลงทะเบียนสมาชิกรหัส ${memberCode} สำเร็จแล้ว` });
});

// -------------------------------------------------------------------
// 10. ACCOUNTING & EXPENSES
// -------------------------------------------------------------------
app.get("/accounting/expenses", async (c) => {
  const db = c.env.DB;
  const exps = await db.prepare("SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 100").all();
  return c.json({ success: true, data: exps.results });
});

app.post("/accounting/expenses", async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const expId = genId("exp");
  const expNo = `EXP-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  const amount = Number(body.amount);
  const vat = body.has_vat ? amount * 0.07 : 0;
  const grandTotal = amount + vat;

  await db.prepare(
    `INSERT INTO expenses (id, expense_no, category, description, amount, vat_amount, grand_total, recipient, paid_by, payment_method, expense_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    expId, expNo, body.category || 'ทั่วไป', body.description,
    amount, vat, grandTotal, body.recipient || '', body.paid_by || '',
    body.payment_method || 'cash', body.expense_date || new Date().toISOString().slice(0, 10)
  ).run();

  return c.json({ success: true, message: `บันทึกค่าใช้จ่าย ${expNo} เรียบร้อยแล้ว` });
});

app.get("/accounting/summary", async (c) => {
  const db = c.env.DB;

  // Sales Revenue
  const rev: any = await db.prepare(
    "SELECT COALESCE(SUM(grand_total), 0) as total_sales, COALESCE(SUM(vat_amount), 0) as sales_vat FROM sales WHERE status = 'completed'"
  ).first();

  // Expenses
  const exp: any = await db.prepare(
    "SELECT COALESCE(SUM(grand_total), 0) as total_expense, COALESCE(SUM(vat_amount), 0) as expense_vat FROM expenses"
  ).first();

  // Purchases
  const pur: any = await db.prepare(
    "SELECT COALESCE(SUM(grand_total), 0) as total_purchase FROM purchase_orders WHERE status = 'completed'"
  ).first();

  const netIncome = (rev?.total_sales || 0) - (exp?.total_expense || 0);

  return c.json({
    success: true,
    data: {
      total_sales: rev?.total_sales || 0,
      sales_vat: rev?.sales_vat || 0,
      total_expense: exp?.total_expense || 0,
      expense_vat: exp?.expense_vat || 0,
      net_vat_payable: (rev?.sales_vat || 0) - (exp?.expense_vat || 0),
      total_purchase: pur?.total_purchase || 0,
      net_income: netIncome
    }
  });
});

// -------------------------------------------------------------------
// 11. EMPLOYEES & RBAC
// -------------------------------------------------------------------
app.get("/employees", async (c) => {
  const db = c.env.DB;
  const emps = await db.prepare(
    `SELECT e.id, e.employee_code, e.username, e.full_name, e.role_code, e.email, e.phone, e.position, e.status, e.last_login_at,
            r.name as role_name
     FROM employees e
     LEFT JOIN roles r ON r.code = e.role_code
     ORDER BY e.created_at ASC`
  ).all();

  return c.json({ success: true, data: emps.results });
});

app.post("/employees", async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const empId = genId("emp");
  const empCode = `EMP-${Math.floor(100 + Math.random() * 900)}`;

  await db.prepare(
    `INSERT INTO employees (id, employee_code, username, password_hash, full_name, role_code, email, phone, position, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  ).bind(
    empId, empCode, body.username, body.password || '123456', body.full_name,
    body.role_code, body.email || '', body.phone || '', body.position || ''
  ).run();

  return c.json({ success: true, message: `เพิ่มพนักงาน ${body.full_name} เรียบร้อยแล้ว` });
});

app.put("/employees/:id/status", async (c) => {
  const empId = c.req.param("id");
  const { status } = await c.req.json();
  const db = c.env.DB;

  await db.prepare("UPDATE employees SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").bind(status, empId).run();
  return c.json({ success: true, message: `ปรับสถานะพนักงานเป็น ${status} เรียบร้อยแล้ว` });
});

// Roles & Permissions Master
app.get("/roles", async (c) => {
  const db = c.env.DB;
  const roles = await db.prepare("SELECT * FROM roles ORDER BY created_at ASC").all();

  const roleList = [];
  for (const r of roles.results as any[]) {
    const perms = await db.prepare("SELECT permission_code FROM role_permissions WHERE role_id = ?").bind(r.id).all();
    roleList.push({
      ...r,
      permissions: perms.results.map((p: any) => p.permission_code)
    });
  }

  return c.json({ success: true, data: roleList });
});

app.get("/permissions", async (c) => {
  const db = c.env.DB;
  const perms = await db.prepare("SELECT * FROM permissions ORDER BY module, code").all();
  return c.json({ success: true, data: perms.results });
});

// Update Role Permissions (Permission Builder for Owner)
app.put("/roles/:id/permissions", async (c) => {
  const roleId = c.req.param("id");
  const { permissions } = await c.req.json();
  const db = c.env.DB;

  await db.prepare("DELETE FROM role_permissions WHERE role_id = ?").bind(roleId).run();

  for (const p of permissions) {
    await db.prepare("INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)").bind(roleId, p).run();
  }

  return c.json({ success: true, message: "อัปเดตชุดสิทธิ์การใช้งานสำหรับบทบาทนี้เรียบร้อยแล้ว" });
});

// -------------------------------------------------------------------
// 12. NOTIFICATIONS
// -------------------------------------------------------------------
app.get("/notifications", async (c) => {
  const db = c.env.DB;
  const notifs = await db.prepare(
    "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20"
  ).all();
  return c.json({ success: true, data: notifs.results });
});

export const onRequest = handle(app);
