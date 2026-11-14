import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { cors } from "hono/cors";

type D1Database = any;

type Bindings = {
  DB: D1Database;
};

// User type attached to context after verified session authentication
export interface AuthUser {
  id: string;
  employee_code: string;
  username: string;
  full_name: string;
  role_code: string;
  position: string;
  force_password_change?: boolean;
  permissions: string[];
}

type Variables = {
  user?: AuthUser;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath("/api");

// Enable CORS
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
}));

// Helper: ID generator
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
}

// -------------------------------------------------------------------
// CRYPTOGRAPHIC PASSWORD HASHING (PBKDF2-SHA256 with Unique Salt)
// -------------------------------------------------------------------
async function hashPassword(password: string, salt?: string): Promise<string> {
  const enc = new TextEncoder();
  const saltStr = salt || Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(saltStr),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltStr}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt] = parts;
  const computed = await hashPassword(password, salt);
  return computed === storedHash;
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// -------------------------------------------------------------------
// AUTHENTICATION & PERMISSION MIDDLEWARE (ZERO TRUST RBAC)
// -------------------------------------------------------------------
async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ success: false, error: "กรุณาเข้าสู่ระบบก่อนเข้าถึงข้อมูล (Unauthorized: Missing Bearer Token)" }, 401);
  }

  const token = authHeader.substring(7).trim();
  const db = c.env.DB;

  const session: any = await db.prepare(
    `SELECT s.*, e.employee_code, e.username, e.full_name, e.role_code as emp_role, e.position, e.status, e.force_password_change
     FROM user_sessions s
     JOIN employees e ON e.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now', 'localtime')`
  ).bind(token).first();

  if (!session) {
    return c.json({ success: false, error: "Session หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" }, 401);
  }

  if (session.status === "suspended") {
    // Revoke suspended session
    await db.prepare("DELETE FROM user_sessions WHERE id = ?").bind(session.id).run();
    return c.json({ success: false, error: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" }, 403);
  }

  // Load real permissions from database for this verified role
  const permRes = await db.prepare(
    `SELECT rp.permission_code 
     FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     WHERE r.code = ?`
  ).bind(session.emp_role).all();

  const perms = permRes.results.map((p: any) => p.permission_code);
  if (session.emp_role === "OWNER_ADMIN") {
    perms.push("*");
  }

  const user: AuthUser = {
    id: session.user_id,
    employee_code: session.employee_code,
    username: session.username,
    full_name: session.full_name,
    role_code: session.emp_role,
    position: session.position,
    force_password_change: !!session.force_password_change,
    permissions: perms,
  };

  c.set("user", user);
  await next();
}

function requirePermission(permissionCode: string) {
  return async (c: any, next: any) => {
    const user: AuthUser | undefined = c.get("user");
    if (!user) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const hasPerm =
      user.role_code === "OWNER_ADMIN" ||
      user.permissions.includes("*") ||
      user.permissions.includes(permissionCode);

    if (!hasPerm) {
      return c.json({
        success: false,
        error: `ปฏิเสธการเข้าถึง: บัญชีของคุณไม่มีสิทธิ์ดำเนินการในส่วนนี้ (${permissionCode})`,
      }, 403);
    }

    await next();
  };
}

function requireOwnerOnly() {
  return async (c: any, next: any) => {
    const user: AuthUser | undefined = c.get("user");
    if (!user || user.role_code !== "OWNER_ADMIN") {
      return c.json({ success: false, error: "สงวนสิทธิ์เฉพาะเจ้าของระบบสูงสุด (OWNER_ADMIN) เท่านั้น" }, 403);
    }
    await next();
  };
}

// -------------------------------------------------------------------
// 1. AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------------
app.post("/auth/login", async (c) => {
  const { username, password } = await c.req.json();
  const db = c.env.DB;

  if (!username || !password) {
    return c.json({ success: false, error: "กรุณาระบุชื่อผู้ใช้และรหัสผ่าน" }, 400);
  }

  const emp: any = await db.prepare(
    "SELECT * FROM employees WHERE username = ?"
  ).bind(username).first();

  if (!emp) {
    return c.json({ success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  if (emp.status === "suspended") {
    return c.json({ success: false, error: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" }, 403);
  }

  // Cryptographic hash check
  const isMatch = await verifyPassword(password, emp.password_hash);
  if (!isMatch) {
    return c.json({ success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  }

  // Generate cryptographically secure token & session record
  const token = generateSessionToken();
  const sessionId = genId("sess");
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const userAgent = c.req.header("User-Agent") || "";

  // 7-day session expiration
  await db.prepare(
    `INSERT INTO user_sessions (id, user_id, token, role_code, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+7 days'))`
  ).bind(sessionId, emp.id, token, emp.role_code, ip, userAgent).run();

  // Update last login
  await db.prepare("UPDATE employees SET last_login_at = datetime('now', 'localtime') WHERE id = ?").bind(emp.id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details, ip_address)
     VALUES (?, ?, ?, 'AUTH_LOGIN', 'AUTH', ?, 'เข้าสู่ระบบสำเร็จ', ?)`
  ).bind(genId("aud"), emp.id, emp.full_name, emp.id, ip).run();

  // Fetch verified permissions
  const perms = await db.prepare(
    `SELECT permission_code FROM role_permissions rp 
     JOIN roles r ON r.id = rp.role_id 
     WHERE r.code = ?`
  ).bind(emp.role_code).all();

  const permissionList = perms.results.map((p: any) => p.permission_code);
  if (emp.role_code === "OWNER_ADMIN") {
    permissionList.push("*");
  }

  return c.json({
    success: true,
    token,
    user: {
      id: emp.id,
      employee_code: emp.employee_code,
      username: emp.username,
      full_name: emp.full_name,
      role_code: emp.role_code,
      position: emp.position,
      email: emp.email,
      phone: emp.phone,
      force_password_change: !!emp.force_password_change,
      permissions: permissionList,
    }
  });
});

app.post("/auth/change-password", authMiddleware, async (c) => {
  const { current_password, new_password } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  if (!current_password || !new_password) {
    return c.json({ success: false, error: "กรุณาระบุรหัสผ่านปัจจุบันและรหัสผ่านใหม่" }, 400);
  }

  if (new_password.length < 8) {
    return c.json({ success: false, error: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร" }, 400);
  }

  const emp: any = await db.prepare("SELECT password_hash FROM employees WHERE id = ?").bind(user.id).first();
  if (!emp) {
    return c.json({ success: false, error: "ไม่พบข้อมูลพนักงาน" }, 404);
  }

  const isMatch = await verifyPassword(current_password, emp.password_hash);
  if (!isMatch) {
    return c.json({ success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, 400);
  }

  const newHash = await hashPassword(new_password);
  await db.prepare(
    `UPDATE employees SET password_hash = ?, force_password_change = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).bind(newHash, user.id).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
     VALUES (?, ?, ?, 'AUTH_CHANGE_PASSWORD', 'AUTH', ?, 'เปลี่ยนรหัสผ่านสำเร็จ')`
  ).bind(genId("aud"), user.id, user.full_name, user.id).run();

  return c.json({ success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
});

app.post("/auth/logout", authMiddleware, async (c) => {
  const authHeader = c.req.header("Authorization")!;
  const token = authHeader.substring(7).trim();
  const db = c.env.DB;
  const user = c.get("user")!;

  await db.prepare("DELETE FROM user_sessions WHERE token = ?").bind(token).run();

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
     VALUES (?, ?, ?, 'AUTH_LOGOUT', 'AUTH', ?, 'ออกจากระบบ')`
  ).bind(genId("aud"), user.id, user.full_name, user.id).run();

  return c.json({ success: true, message: "ออกจากระบบเรียบร้อยแล้ว" });
});

app.get("/auth/me", authMiddleware, async (c) => {
  const user = c.get("user")!;
  return c.json({ success: true, user });
});

// -------------------------------------------------------------------
// 2. STORE PROFILE & SYSTEM SETTINGS
// -------------------------------------------------------------------
app.get("/store-profile", authMiddleware, async (c) => {
  const db = c.env.DB;
  const store = await db.prepare("SELECT * FROM store_profile LIMIT 1").first();
  return c.json({ success: true, data: store });
});

app.put("/store-profile", authMiddleware, requirePermission("settings.manage"), async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

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

  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
     VALUES (?, ?, ?, 'STORE_PROFILE_UPDATE', 'SETTINGS', ?, 'แก้ไขข้อมูลร้านค้าและใบเสร็จ')`
  ).bind(genId("aud"), user.id, user.full_name, body.id || 'store_001').run();

  return c.json({ success: true, message: "บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว" });
});

// -------------------------------------------------------------------
// 3. OWNER DASHBOARD
// -------------------------------------------------------------------
app.get("/dashboard/summary", authMiddleware, requirePermission("dashboard.view"), async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const canSeeFinancial = user.role_code === "OWNER_ADMIN" || user.permissions.includes("dashboard.financial");

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

  // Gross profit
  let profitData = { revenue: 0, cost: 0, gross_profit: 0 };
  if (canSeeFinancial) {
    const profitEst: any = await db.prepare(
      `SELECT 
        COALESCE(SUM(si.subtotal), 0) as total_revenue,
        COALESCE(SUM(si.cost_price * si.quantity), 0) as total_cost
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed'`
    ).first();
    profitData = {
      revenue: profitEst?.total_revenue || 0,
      cost: profitEst?.total_cost || 0,
      gross_profit: (profitEst?.total_revenue || 0) - (profitEst?.total_cost || 0),
    };
  }

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

  // Recent 6 sales
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
      profit: profitData,
      inventory: {
        cost_value: canSeeFinancial ? (inventoryVal?.total_cost_value || 0) : 0,
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
// 4. POS (POINT OF SALE) - ATOMIC CHECKOUT & SERVER VERIFICATION
// -------------------------------------------------------------------

// Check Active Shift
app.get("/pos/shift/active", authMiddleware, requirePermission("pos.access"), async (c) => {
  const user = c.get("user")!;
  const db = c.env.DB;

  let query = "SELECT * FROM cashier_shifts WHERE status = 'open'";
  let params: any[] = [];

  // Cashier only sees own active shift; Manager/Owner can see any
  if (user.role_code === "CASHIER") {
    query += " AND cashier_id = ?";
    params.push(user.id);
  }
  query += " ORDER BY opened_at DESC LIMIT 1";

  const shift = await db.prepare(query).bind(...params).first();
  return c.json({ success: true, shift: shift || null });
});

// Open Shift
app.post("/pos/shift/open", authMiddleware, requirePermission("pos.shift"), async (c) => {
  const { opening_cash, notes } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  // Check if cashier already has an open shift
  const existing = await db.prepare(
    "SELECT id FROM cashier_shifts WHERE cashier_id = ? AND status = 'open'"
  ).bind(user.id).first();

  if (existing) {
    return c.json({ success: false, error: "คุณมีกะการทำงานที่ยังเปิดค้างอยู่แล้ว" }, 400);
  }

  const shiftId = genId("shift");
  const shiftCode = `SFT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const batch = [
    db.prepare(
      `INSERT INTO cashier_shifts (id, shift_code, cashier_id, cashier_name, opening_cash, expected_cash, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(shiftId, shiftCode, user.id, user.full_name, Number(opening_cash) || 0, Number(opening_cash) || 0, notes || ''),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'SHIFT_OPEN', 'POS', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, shiftId, `เปิดกะขาย รหัส ${shiftCode} เงินทอน ${opening_cash} บาท`)
  ];

  await db.batch(batch);

  const newShift = await db.prepare("SELECT * FROM cashier_shifts WHERE id = ?").bind(shiftId).first();
  return c.json({ success: true, shift: newShift, message: "เปิดกะขายเรียบร้อยแล้ว พร้อมให้บริการ" });
});

// Close Shift
app.post("/pos/shift/close", authMiddleware, requirePermission("pos.shift"), async (c) => {
  const { shift_id, actual_cash, notes } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  const shift: any = await db.prepare("SELECT * FROM cashier_shifts WHERE id = ?").bind(shift_id).first();
  if (!shift) {
    return c.json({ success: false, error: "ไม่พบข้อมูลกะนี้" }, 404);
  }

  // Prevent closing someone else's shift unless manager/owner
  if (shift.cashier_id !== user.id && user.role_code !== "OWNER_ADMIN" && user.role_code !== "MANAGER") {
    return c.json({ success: false, error: "คุณไม่มีสิทธิ์ปิดกะของพนักงานท่านอื่น" }, 403);
  }

  const expectedCash = (Number(shift.opening_cash) || 0) + (Number(shift.cash_sales) || 0) + (Number(shift.cash_in) || 0) - (Number(shift.cash_out) || 0);
  const diff = Number(actual_cash) - expectedCash;

  const batch = [
    db.prepare(
      `UPDATE cashier_shifts SET 
        closed_at = datetime('now', 'localtime'),
        expected_cash = ?,
        actual_cash = ?,
        difference = ?,
        status = 'closed',
        notes = ?
       WHERE id = ?`
    ).bind(expectedCash, Number(actual_cash), diff, notes || '', shift_id),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'SHIFT_CLOSE', 'POS', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, shift_id, `ปิดกะขาย เงินจริง ${actual_cash} ผลต่าง ${diff} บาท`)
  ];

  await db.batch(batch);

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

// ATOMIC CHECKOUT WITH IDEMPOTENCY KEY & SERVER PRICE RE-VERIFICATION
app.post("/pos/checkout", authMiddleware, requirePermission("pos.checkout"), async (c) => {
  const user = c.get("user")!;
  const db = c.env.DB;
  const body = await c.req.json();
  const idempotencyKey = c.req.header("Idempotency-Key") || body.idempotency_key;

  // 1. Check Idempotency Key bound to this user to prevent duplicate charges
  if (idempotencyKey) {
    const existingKey: any = await db.prepare(
      "SELECT response_body FROM idempotency_keys WHERE key = ? AND user_id = ?"
    ).bind(idempotencyKey, user.id).first();

    if (existingKey) {
      return c.json(JSON.parse(existingKey.response_body));
    }
  }

  const {
    shift_id,
    customer_id,
    items, // array of { product_id, quantity }
    payment_method, // cash, promptpay, card, transfer
    received_amount,
    custom_discount,
  } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return c.json({ success: false, error: "ตะกร้าสินค้าว่างเปล่า กรุณาสแกนสินค้าก่อนชำระเงิน" }, 400);
  }

  // 2. Aggregate duplicate product entries in cart to verify total demanded quantity
  const aggregatedQtyMap = new Map<string, number>();
  for (const it of items) {
    const qty = Number(it.quantity);
    if (!qty || qty <= 0) {
      return c.json({ success: false, error: `จำนวนสินค้าไม่ถูกต้อง (${qty})` }, 400);
    }
    aggregatedQtyMap.set(it.product_id, (aggregatedQtyMap.get(it.product_id) || 0) + qty);
  }

  // Check shelf inventory: DO NOT ALLOW OVERSELL!
  for (const [productId, totalDemandQty] of aggregatedQtyMap.entries()) {
    const product: any = await db.prepare(
      "SELECT id, sku, barcode, name, unit, cost_price, selling_price, is_active FROM products WHERE id = ?"
    ).bind(productId).first();

    if (!product || product.is_active === 0) {
      return c.json({ success: false, error: `สินค้าไม่พบในระบบหรือถูกปิดใช้งาน (ID: ${productId})` }, 400);
    }

    const shelfInv: any = await db.prepare(
      "SELECT quantity FROM inventory WHERE product_id = ? AND location_id = 'loc_shelf'"
    ).bind(productId).first();

    const currentShelfStock = shelfInv?.quantity || 0;
    if (currentShelfStock < totalDemandQty) {
      return c.json({
        success: false,
        error: `สต๊อกสินค้าหน้าร้านไม่เพียงพอ: "${product.name}" มีอยู่ ${currentShelfStock} ${product.unit} (ต้องการขายรวม ${totalDemandQty} ${product.unit})`,
      }, 400);
    }
  }

  // Calculate official server prices and subtotals
  let verifiedSubtotal = 0;
  const verifiedItems: any[] = [];
  const batchStatements: any[] = [];

  for (const it of items) {
    const qty = Number(it.quantity);
    const product: any = await db.prepare(
      "SELECT id, sku, barcode, name, unit, cost_price, selling_price FROM products WHERE id = ?"
    ).bind(it.product_id).first();

    const itemSubtotal = product.selling_price * qty;
    verifiedSubtotal += itemSubtotal;

    verifiedItems.push({
      product_id: product.id,
      name: product.name,
      barcode: product.barcode,
      unit: product.unit,
      quantity: qty,
      unit_price: product.selling_price,
      cost_price: product.cost_price || 0,
      subtotal: itemSubtotal,
    });
  }

  // 3. Discount calculation on server
  let memberDiscount = 0;
  let customerName = "ลูกค้าทั่วไป";
  if (customer_id) {
    const cust: any = await db.prepare(
      "SELECT id, name, discount_pct, points FROM customers WHERE id = ? AND is_active = 1"
    ).bind(customer_id).first();

    if (cust) {
      customerName = cust.name;
      memberDiscount = (verifiedSubtotal * (Number(cust.discount_pct) || 0)) / 100;
    }
  }

  const clientCustomDiscount = Math.max(0, Number(custom_discount) || 0);
  const totalDiscount = Math.min(verifiedSubtotal, memberDiscount + clientCustomDiscount);
  const verifiedGrandTotal = Math.max(0, verifiedSubtotal - totalDiscount);
  const vatRate = 7.0;
  const verifiedVat = (verifiedGrandTotal * vatRate) / (100 + vatRate);

  const numReceived = Number(received_amount) || verifiedGrandTotal;
  if (payment_method === "cash" && numReceived < verifiedGrandTotal) {
    return c.json({ success: false, error: "ยอดเงินสดที่รับมาไม่เพียงพอกับยอดที่ต้องชำระ" }, 400);
  }
  const changeAmount = payment_method === "cash" ? Math.max(0, numReceived - verifiedGrandTotal) : 0;

  const saleId = genId("sale");
  const invoiceNo = `INV-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(10000 + Math.random() * 90000)}`;

  // 4. Assemble atomic batch execution
  // A. Insert Sale
  batchStatements.push(
    db.prepare(
      `INSERT INTO sales (
        id, invoice_no, shift_id, cashier_id, customer_id, customer_name,
        subtotal, discount_amount, vat_amount, grand_total, payment_method,
        received_amount, change_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`
    ).bind(
      saleId, invoiceNo, shift_id || null, user.id, customer_id || null, customerName,
      verifiedSubtotal, totalDiscount, verifiedVat, verifiedGrandTotal,
      payment_method, numReceived, changeAmount
    )
  );

  // B. Insert Sale Items
  for (const item of verifiedItems) {
    const itemId = genId("item");
    batchStatements.push(
      db.prepare(
        `INSERT INTO sale_items (
          id, sale_id, product_id, product_name, barcode, unit, quantity,
          unit_price, cost_price, discount_amount, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
      ).bind(
        itemId, saleId, item.product_id, item.name, item.barcode, item.unit,
        item.quantity, item.unit_price, item.cost_price, item.subtotal
      )
    );

    // Record movement
    batchStatements.push(
      db.prepare(
        `INSERT INTO inventory_movements (
          id, product_id, from_location_id, to_location_id, movement_type,
          quantity, unit_cost, reference_type, reference_id, reason, created_by
        ) VALUES (?, ?, 'loc_shelf', NULL, 'sale', ?, ?, 'sale', ?, 'จำหน่ายหน้าร้าน POS', ?)`
      ).bind(
        genId("mov"), item.product_id, item.quantity, item.cost_price,
        invoiceNo, user.full_name
      )
    );
  }

  // Deduct inventory per aggregated product with race condition guard: AND quantity >= ?
  for (const [productId, totalDemandQty] of aggregatedQtyMap.entries()) {
    batchStatements.push(
      db.prepare(
        `UPDATE inventory SET 
          quantity = quantity - ?,
          updated_at = datetime('now', 'localtime')
         WHERE product_id = ? AND location_id = 'loc_shelf' AND quantity >= ?`
      ).bind(totalDemandQty, productId, totalDemandQty)
    );

    batchStatements.push(
      db.prepare(
        `UPDATE products SET 
          current_stock = current_stock - ?,
          updated_at = datetime('now', 'localtime')
         WHERE id = ? AND current_stock >= ?`
      ).bind(totalDemandQty, productId, totalDemandQty)
    );
  }

  // C. Update Shift Drawer if shift_id provided
  if (shift_id) {
    let updateField = "total_sales = total_sales + ?, expected_cash = expected_cash + ?";
    let extraCash = 0;
    if (payment_method === "cash") {
      updateField += ", cash_sales = cash_sales + ?";
      extraCash = verifiedGrandTotal;
    } else if (payment_method === "promptpay") {
      updateField += ", promptpay_sales = promptpay_sales + ?";
    } else if (payment_method === "card") {
      updateField += ", card_sales = card_sales + ?";
    } else {
      updateField += ", transfer_sales = transfer_sales + ?";
    }

    if (payment_method === "cash") {
      batchStatements.push(
        db.prepare(`UPDATE cashier_shifts SET ${updateField} WHERE id = ?`)
          .bind(verifiedGrandTotal, extraCash, verifiedGrandTotal, shift_id)
      );
    } else {
      batchStatements.push(
        db.prepare(`UPDATE cashier_shifts SET ${updateField} WHERE id = ?`)
          .bind(verifiedGrandTotal, 0, verifiedGrandTotal, shift_id)
      );
    }
  }

  // D. Member Points Accumulation (1 pt per 50 THB)
  if (customer_id) {
    const earnedPoints = Math.floor(verifiedGrandTotal / 50);
    batchStatements.push(
      db.prepare(
        `UPDATE customers SET points = points + ?, total_spent = total_spent + ? WHERE id = ?`
      ).bind(earnedPoints, verifiedGrandTotal, customer_id)
    );
  }

  // E. Audit log
  batchStatements.push(
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'POS_CHECKOUT', 'POS', ?, ?)`
    ).bind(
      genId("aud"), user.id, user.full_name, saleId,
      `จำหน่ายสินค้า บิล ${invoiceNo} ยอด ฿${verifiedGrandTotal.toFixed(2)} ช่องทาง ${payment_method}`
    )
  );

  const responsePayload = {
    success: true,
    invoice_no: invoiceNo,
    sale: {
      id: saleId,
      invoice_no: invoiceNo,
      shift_id,
      cashier_id: user.id,
      customer_id,
      customer_name: customerName,
      subtotal: verifiedSubtotal,
      discount_amount: totalDiscount,
      vat_amount: verifiedVat,
      grand_total: verifiedGrandTotal,
      payment_method,
      received_amount: numReceived,
      change_amount: changeAmount,
      status: "completed",
    },
    items: verifiedItems,
    message: "บันทึกการขายและตัดสต๊อกสำเร็จเรียบร้อย",
  };

  // F. Record Idempotency Key
  if (idempotencyKey) {
    batchStatements.push(
      db.prepare(
        "INSERT INTO idempotency_keys (key, user_id, response_body) VALUES (?, ?, ?)"
      ).bind(idempotencyKey, user.id, JSON.stringify(responsePayload))
    );
  }

  // EXECUTE ALL IN SINGLE ATOMIC TRANSACTION
  await db.batch(batchStatements);

  return c.json(responsePayload);
});

// Sales List (Strict role-based data filtering)
app.get("/pos/sales", authMiddleware, requirePermission("pos.access"), async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;

  let query = `SELECT s.*, e.full_name as cashier_name 
               FROM sales s 
               LEFT JOIN employees e ON e.id = s.cashier_id `;
  let params: any[] = [];

  // Cashiers can ONLY view their own sales!
  if (user.role_code === "CASHIER") {
    query += " WHERE s.cashier_id = ? ";
    params.push(user.id);
  }

  query += " ORDER BY s.created_at DESC LIMIT 100";
  const sales = await db.prepare(query).bind(...params).all();

  return c.json({ success: true, data: sales.results });
});

// Void / Refund Sale (Manager/Admin Approval Required)
app.post("/pos/sales/:id/void", authMiddleware, requirePermission("pos.void_approve"), async (c) => {
  const saleId = c.req.param("id");
  const { reason } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  const sale: any = await db.prepare("SELECT * FROM sales WHERE id = ?").bind(saleId).first();
  if (!sale) return c.json({ success: false, error: "ไม่พบบิลการขาย" }, 404);
  if (sale.status === "voided") return c.json({ success: false, error: "บิลนี้ถูกยกเลิกไปแล้ว" }, 400);

  const items = await db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").bind(saleId).all();

  const batch = [
    db.prepare(
      `UPDATE sales SET 
        status = 'voided',
        void_reason = ?,
        void_approved_by = ?
       WHERE id = ?`
    ).bind(reason || 'ลูกค้ายกเลิก/คืนสินค้า', user.full_name, saleId),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'POS_VOID', 'POS', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, saleId, `ยกเลิกบิล ${sale.invoice_no} เหตุผล: ${reason}`)
  ];

  // Restock items back to loc_shelf atomically
  for (const item of items.results as any[]) {
    batch.push(
      db.prepare(
        `UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now', 'localtime')
         WHERE product_id = ? AND location_id = 'loc_shelf'`
      ).bind(Number(item.quantity), item.product_id)
    );
    batch.push(
      db.prepare(
        `INSERT INTO inventory_movements (
          id, product_id, from_location_id, to_location_id, movement_type,
          quantity, unit_cost, reference_type, reference_id, reason, created_by
        ) VALUES (?, ?, NULL, 'loc_shelf', 'return', ?, ?, 'void', ?, ?, ?)`
      ).bind(
        genId("mov"), item.product_id, Number(item.quantity), Number(item.cost_price) || 0,
        sale.invoice_no, reason || 'ยกเลิกบิล คืนสต๊อก', user.full_name
      )
    );
  }

  await db.batch(batch);
  return c.json({ success: true, message: `ยกเลิกบิล ${sale.invoice_no} และคืนสต๊อกเข้าสู่ชั้นวางเรียบร้อยแล้ว` });
});

// -------------------------------------------------------------------
// 5. PRODUCTS & CATALOG
// -------------------------------------------------------------------
app.get("/products", authMiddleware, async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
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

  // Strip cost_price if user has no cost permission
  const canSeeCost = user.role_code === "OWNER_ADMIN" || user.permissions.includes("product.cost_view");
  const results = prods.results.map((p: any) => {
    if (!canSeeCost) {
      const { cost_price, wholesale_price, ...safe } = p;
      return safe;
    }
    return p;
  });

  return c.json({ success: true, data: results });
});

app.post("/products", authMiddleware, requirePermission("product.manage"), async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;
  const prodId = genId("prod");

  const batch = [
    db.prepare(
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
    ),
    db.prepare(
      `INSERT INTO inventory (id, product_id, location_id, quantity, reserved_quantity)
       VALUES (?, ?, 'loc_shelf', ?, 0)`
    ).bind(genId("inv"), prodId, Number(body.initial_stock) || 0),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'PRODUCT_CREATE', 'PRODUCT', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, prodId, `เพิ่มสินค้าใหม่: ${body.name} (${body.barcode})`)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: "เพิ่มสินค้าใหม่เรียบร้อยแล้ว", id: prodId });
});

app.put("/products/:id", authMiddleware, requirePermission("product.manage"), async (c) => {
  const prodId = c.req.param("id");
  const body = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  const batch = [
    db.prepare(
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
    ),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'PRODUCT_UPDATE', 'PRODUCT', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, prodId, `แก้ไขข้อมูลสินค้า: ${body.name}`)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: "อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว" });
});

app.delete("/products/:id", authMiddleware, requirePermission("product.manage"), async (c) => {
  const prodId = c.req.param("id");
  const db = c.env.DB;
  const user = c.get("user")!;

  const batch = [
    db.prepare("UPDATE products SET is_active = 0 WHERE id = ?").bind(prodId),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'PRODUCT_DELETE', 'PRODUCT', ?, 'ปิดการใช้งานสินค้า')`
    ).bind(genId("aud"), user.id, user.full_name, prodId)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: "ปิดการใช้งานสินค้าเรียบร้อยแล้ว" });
});

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
// 6. INVENTORY & ATOMIC INTERNAL TRANSFERS
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

app.get("/inventory/stock-by-location", authMiddleware, requirePermission("inventory.view"), async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;
  const canSeeCost = user.role_code === "OWNER_ADMIN" || user.permissions.includes("product.cost_view");

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

  const results = stocks.results.map((item: any) => {
    if (!canSeeCost) {
      const { cost_price, ...safe } = item;
      return safe;
    }
    return item;
  });

  return c.json({ success: true, data: results });
});

// ATOMIC INTERNAL TRANSFER BETWEEN STORAGE LOCATIONS
app.post("/inventory/transfer", authMiddleware, requirePermission("inventory.transfer"), async (c) => {
  const { product_id, from_location_id, to_location_id, quantity, reason } = await c.req.json();
  const user = c.get("user")!;
  const qty = Number(quantity);

  if (!qty || qty <= 0) return c.json({ success: false, error: "จำนวนที่ย้ายต้องมากกว่า 0" }, 400);
  if (from_location_id === to_location_id) return c.json({ success: false, error: "จุดต้นทางและปลายทางต้องไม่เป็นที่เดียวกัน" }, 400);

  const db = c.env.DB;

  // Check source inventory sufficiency
  const fromStock: any = await db.prepare(
    "SELECT quantity FROM inventory WHERE product_id = ? AND location_id = ?"
  ).bind(product_id, from_location_id).first();

  if (!fromStock || fromStock.quantity < qty) {
    return c.json({ success: false, error: `สต๊อกต้นทางไม่เพียงพอ (มีอยู่ ${fromStock?.quantity || 0}, ต้องการย้าย ${qty})` }, 400);
  }

  // ATOMIC BATCH FOR TRANSFER
  const batch = [
    // Deduct from source with atomic race-condition guard
    db.prepare(
      "UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now', 'localtime') WHERE product_id = ? AND location_id = ? AND quantity >= ?"
    ).bind(qty, product_id, from_location_id, qty),
    // Add to destination
    db.prepare(
      `INSERT INTO inventory (id, product_id, location_id, quantity, reserved_quantity)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(product_id, location_id) DO UPDATE SET 
        quantity = quantity + excluded.quantity,
        updated_at = datetime('now', 'localtime')`
    ).bind(genId("inv"), product_id, to_location_id, qty),
    // Record movement
    db.prepare(
      `INSERT INTO inventory_movements (
        id, product_id, from_location_id, to_location_id, movement_type,
        quantity, reference_type, reason, created_by
      ) VALUES (?, ?, ?, ?, 'internal_transfer', ?, 'transfer', ?, ?)`
    ).bind(genId("mov"), product_id, from_location_id, to_location_id, qty, reason || 'ย้ายจุดจัดเก็บภายใน', user.full_name),
    // Audit log
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'STOCK_TRANSFER', 'INVENTORY', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, product_id, `ย้ายสินค้าจำนวน ${qty} ชิ้น จาก ${from_location_id} ไปยัง ${to_location_id}`)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: `ย้ายสินค้าจำนวน ${qty} ชิ้น เรียบร้อยแล้ว (Atomic Transaction)` });
});

app.get("/inventory/movements", authMiddleware, requirePermission("inventory.view"), async (c) => {
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
// 7. STOCK COUNTING (BLIND COUNT & ANTI-DOUBLE APPROVAL)
// -------------------------------------------------------------------
app.get("/stock-count/tasks", authMiddleware, requirePermission("stock_count.access"), async (c) => {
  const db = c.env.DB;
  const user = c.get("user")!;

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
  // Stock checker ONLY sees tasks assigned to them!
  if (user.role_code === "STOCK_CHECKER") {
    query += " WHERE sct.assigned_to = ? ";
    params.push(user.id);
  }

  query += " GROUP BY sct.id ORDER BY sct.created_at DESC";
  const tasks = await db.prepare(query).bind(...params).all();

  return c.json({ success: true, data: tasks.results });
});

app.post("/stock-count/tasks", authMiddleware, requirePermission("stock_count.manage"), async (c) => {
  const { title, location_id, category_id, assigned_to, notes } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;
  const taskId = genId("task");
  const taskCode = `CNT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  const batch = [
    db.prepare(
      `INSERT INTO stock_count_tasks (id, task_code, title, location_id, category_id, status, assigned_to, created_by, notes)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    ).bind(taskId, taskCode, title, location_id, category_id || null, assigned_to || user.id, user.id, notes || ''),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'STOCK_COUNT_CREATE', 'STOCK_COUNT', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, taskId, `สร้างใบงานนับสต๊อก ${taskCode}: ${title}`)
  ];

  // Populate items from location
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
    batch.push(
      db.prepare(
        `INSERT INTO stock_count_items (id, task_id, product_id, system_quantity, status)
         VALUES (?, ?, ?, ?, 'pending')`
      ).bind(genId("sci"), taskId, p.product_id, p.system_quantity)
    );
  }

  await db.batch(batch);
  return c.json({ success: true, message: `สร้างใบงานนับสต๊อก ${taskCode} สำเร็จแล้ว`, id: taskId });
});

// Task Details (Strict Blind Count for Stock Checkers based on verified session)
app.get("/stock-count/tasks/:id", authMiddleware, requirePermission("stock_count.access"), async (c) => {
  const taskId = c.req.param("id");
  const user = c.get("user")!;
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

  // STRICT RULE: If user is STOCK_CHECKER or has no approve permission, hide system_quantity & difference!
  const isChecker = user.role_code === "STOCK_CHECKER";
  const safeItems = items.results.map((item: any) => {
    if (isChecker) {
      const { system_quantity, difference, ...blind } = item;
      return blind;
    }
    return item;
  });

  return c.json({ success: true, task, items: safeItems });
});

// Checker Submits counts
app.post("/stock-count/tasks/:id/submit", authMiddleware, requirePermission("stock_count.access"), async (c) => {
  const taskId = c.req.param("id");
  const { counts } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  const task: any = await db.prepare("SELECT * FROM stock_count_tasks WHERE id = ?").bind(taskId).first();
  if (!task) return c.json({ success: false, error: "ไม่พบใบงาน" }, 404);
  if (task.status === "approved") return c.json({ success: false, error: "ใบงานนี้ได้รับการอนุมัติไปแล้ว ไม่สามารถแก้ไขได้" }, 400);

  // Check if assigned to this checker
  if (user.role_code === "STOCK_CHECKER" && task.assigned_to !== user.id) {
    return c.json({ success: false, error: "คุณไม่ได้เป็นผู้รับมอบหมายในใบงานตรวจนับนี้" }, 403);
  }

  const batch: any[] = [];
  for (const item of counts) {
    const sci: any = await db.prepare("SELECT id, system_quantity FROM stock_count_items WHERE id = ? AND task_id = ?").bind(item.id, taskId).first();
    if (!sci) {
      return c.json({ success: false, error: `รายการสินค้า (ID: ${item.id}) ไม่ได้อยู่ในใบงานนี้` }, 400);
    }
    const counted = Number(item.counted_quantity);
    const diff = counted - (sci.system_quantity || 0);
    const status = diff === 0 ? "matched" : "discrepancy";

    batch.push(
      db.prepare(
        `UPDATE stock_count_items SET 
          counted_quantity = ?,
          difference = ?,
          status = ?,
          counted_at = datetime('now', 'localtime')
         WHERE id = ? AND task_id = ?`
      ).bind(counted, diff, status, item.id, taskId)
    );
  }

  batch.push(
    db.prepare("UPDATE stock_count_tasks SET status = 'pending_approval', updated_at = datetime('now', 'localtime') WHERE id = ?").bind(taskId)
  );

  batch.push(
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'STOCK_COUNT_SUBMIT', 'STOCK_COUNT', ?, 'ส่งผลการตรวจนับรออนุมัติ')`
    ).bind(genId("aud"), user.id, user.full_name, taskId)
  );

  await db.batch(batch);
  return c.json({ success: true, message: "บันทึกและส่งผลการตรวจนับให้ผู้จัดการตรวจสอบเรียบร้อยแล้ว" });
});

// Manager Approves count discrepancies (Anti-double approval & Atomic batch)
app.post("/stock-count/tasks/:id/approve", authMiddleware, requirePermission("stock_count.approve"), async (c) => {
  const taskId = c.req.param("id");
  const db = c.env.DB;
  const user = c.get("user")!;

  const task: any = await db.prepare("SELECT * FROM stock_count_tasks WHERE id = ?").bind(taskId).first();
  if (!task) return c.json({ success: false, error: "ไม่พบใบงาน" }, 404);

  // Atomic Conditional update: Lock & verify status in single DB operation (Race Condition Prevention)
  const lockUpdate: any = await db.prepare(
    `UPDATE stock_count_tasks SET 
      status = 'approved',
      approved_by = ?,
      approved_at = datetime('now', 'localtime'),
      updated_at = datetime('now', 'localtime')
     WHERE id = ? AND status = 'pending_approval'`
  ).bind(user.full_name, taskId).run();

  if (!lockUpdate || lockUpdate.meta?.changes === 0) {
    return c.json({
      success: false,
      error: "ใบงานนี้ได้รับการอนุมัติหรือเปลี่ยนสถานะไปแล้ว ป้องกันการอนุมัติซ้ำ (Concurrency Conflict)",
    }, 409);
  }

  const items = await db.prepare("SELECT * FROM stock_count_items WHERE task_id = ?").bind(taskId).all();
  const batch: any[] = [];

  for (const item of items.results as any[]) {
    if (item.counted_quantity !== null && item.difference !== 0) {
      // Adjust inventory to match counted_quantity
      batch.push(
        db.prepare(
          `UPDATE inventory SET quantity = ?, updated_at = datetime('now', 'localtime')
           WHERE product_id = ? AND location_id = ?`
        ).bind(item.counted_quantity, item.product_id, task.location_id)
      );

      // Record adjustment
      const adjId = genId("adj");
      const adjCode = `ADJ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      batch.push(
        db.prepare(
          `INSERT INTO stock_adjustments (
            id, adjustment_code, task_id, product_id, location_id,
            before_quantity, after_quantity, diff_quantity, reason, approved_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          adjId, adjCode, taskId, item.product_id, task.location_id,
          item.system_quantity, item.counted_quantity, item.difference,
          `ปรับยอดตามผลตรวจนับใบงาน ${task.task_code}`, user.full_name
        )
      );

      // Record movement
      const moveType = item.difference > 0 ? "adjust_plus" : "adjust_minus";
      batch.push(
        db.prepare(
          `INSERT INTO inventory_movements (
            id, product_id, from_location_id, to_location_id, movement_type,
            quantity, reference_type, reference_id, reason, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, 'stock_count', ?, ?, ?)`
        ).bind(
          genId("mov"), item.product_id,
          item.difference < 0 ? task.location_id : null,
          item.difference > 0 ? task.location_id : null,
          moveType, Math.abs(item.difference), task.task_code,
          `ปรับยอดสต๊อกจากการตรวจนับ (ผลต่าง ${item.difference})`, user.full_name
        )
      );
    }
  }

  // Update Task Status
  batch.push(
    db.prepare(
      `UPDATE stock_count_tasks SET 
        status = 'approved',
        approved_by = ?,
        approved_at = datetime('now', 'localtime'),
        updated_at = datetime('now', 'localtime')
       WHERE id = ?`
    ).bind(user.full_name, taskId)
  );

  batch.push(
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'STOCK_COUNT_APPROVE', 'STOCK_COUNT', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, taskId, `อนุมัติผลตรวจนับใบงาน ${task.task_code}`)
  );

  // ATOMIC COMMIT
  await db.batch(batch);
  return c.json({ success: true, message: "อนุมัติผลตรวจนับและปรับปรุงยอดสต๊อกเรียบร้อยแล้ว (Atomic Transaction)" });
});

// -------------------------------------------------------------------
// 8. PURCHASING & SUPPLIERS
// -------------------------------------------------------------------
app.get("/suppliers", authMiddleware, async (c) => {
  const db = c.env.DB;
  const sups = await db.prepare("SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC").all();
  return c.json({ success: true, data: sups.results });
});

app.post("/suppliers", authMiddleware, requirePermission("supplier.manage"), async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;
  const supId = genId("sup");

  const batch = [
    db.prepare(
      `INSERT INTO suppliers (id, code, name, tax_id, contact_person, phone, email, address, credit_terms_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      supId, body.code, body.name, body.tax_id || '', body.contact_person || '',
      body.phone || '', body.email || '', body.address || '', Number(body.credit_terms_days) || 30
    ),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'SUPPLIER_CREATE', 'PURCHASING', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, supId, `เพิ่มคู่ค้า: ${body.name}`)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: "เพิ่มคู่ค้า/ซัพพลายเออร์เรียบร้อยแล้ว" });
});

app.get("/purchasing/orders", authMiddleware, requirePermission("purchasing.access"), async (c) => {
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

app.post("/purchasing/orders", authMiddleware, requirePermission("purchasing.create_po"), async (c) => {
  const { supplier_id, order_date, expected_date, items, notes } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;
  const poId = genId("po");
  const poNumber = `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  let totalAmount = 0;
  for (const it of items) {
    totalAmount += Number(it.quantity) * Number(it.unit_cost);
  }
  const vatAmount = totalAmount * 0.07;
  const grandTotal = totalAmount + vatAmount;

  const batch = [
    db.prepare(
      `INSERT INTO purchase_orders (id, po_number, supplier_id, order_date, expected_date, status, total_amount, vat_amount, grand_total, notes, created_by)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
    ).bind(poId, poNumber, supplier_id, order_date || new Date().toISOString().slice(0, 10), expected_date || null, totalAmount, vatAmount, grandTotal, notes || '', user.id)
  ];

  for (const it of items) {
    batch.push(
      db.prepare(
        `INSERT INTO purchase_order_items (id, po_id, product_id, quantity, unit_cost, total_cost)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(genId("poi"), poId, it.product_id, Number(it.quantity), Number(it.unit_cost), Number(it.quantity) * Number(it.unit_cost))
    );
  }

  batch.push(
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'PO_CREATE', 'PURCHASING', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, poId, `สร้างใบสั่งซื้อ ${poNumber} ยอด ฿${grandTotal.toFixed(2)}`)
  );

  await db.batch(batch);
  return c.json({ success: true, message: `สร้างใบสั่งซื้อ ${poNumber} เรียบร้อยแล้ว`, id: poId });
});

app.post("/purchasing/orders/:id/approve", authMiddleware, requirePermission("purchasing.approve"), async (c) => {
  const poId = c.req.param("id");
  const db = c.env.DB;
  const user = c.get("user")!;

  const batch = [
    db.prepare(
      `UPDATE purchase_orders SET 
        status = 'approved',
        approved_by = ?,
        approved_at = datetime('now', 'localtime')
       WHERE id = ?`
    ).bind(user.full_name, poId),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'PO_APPROVE', 'PURCHASING', ?, 'อนุมัติใบสั่งซื้อ')`
    ).bind(genId("aud"), user.id, user.full_name, poId)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: "อนุมัติใบสั่งซื้อเรียบร้อยแล้ว ส่งต่อไปยังแผนกรับสินค้า" });
});

app.post("/purchasing/orders/:id/receive", authMiddleware, requirePermission("warehouse.receive"), async (c) => {
  const poId = c.req.param("id");
  const { location_id, invoice_number } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  const po: any = await db.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(poId).first();
  if (!po) return c.json({ success: false, error: "ไม่พบใบสั่งซื้อ" }, 404);
  if (po.status === "completed") return c.json({ success: false, error: "ใบสั่งซื้อนี้รับสินค้าครบถ้วนไปแล้ว" }, 400);

  const items = await db.prepare("SELECT * FROM purchase_order_items WHERE po_id = ?").bind(poId).all();
  const targetLocation = location_id || 'loc_main';
  const grnNumber = `GRN-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  const batch: any[] = [];

  for (const it of items.results as any[]) {
    // Increase stock in warehouse
    batch.push(
      db.prepare(
        `INSERT INTO inventory (id, product_id, location_id, quantity, reserved_quantity)
         VALUES (?, ?, ?, ?, 0)
         ON CONFLICT(product_id, location_id) DO UPDATE SET 
          quantity = quantity + excluded.quantity,
          updated_at = datetime('now', 'localtime')`
      ).bind(genId("inv"), it.product_id, targetLocation, it.quantity)
    );

    // Movement
    batch.push(
      db.prepare(
        `INSERT INTO inventory_movements (
          id, product_id, from_location_id, to_location_id, movement_type,
          quantity, unit_cost, reference_type, reference_id, reason, created_by
        ) VALUES (?, ?, NULL, ?, 'purchase_in', ?, ?, 'po', ?, 'รับสินค้าเข้าคลังตามใบสั่งซื้อ', ?)`
      ).bind(genId("mov"), it.product_id, targetLocation, it.quantity, it.unit_cost, po.po_number, user.full_name)
    );

    // Update PO item
    batch.push(
      db.prepare("UPDATE purchase_order_items SET received_quantity = quantity WHERE id = ?").bind(it.id)
    );
  }

  // Update PO status
  batch.push(
    db.prepare("UPDATE purchase_orders SET status = 'completed' WHERE id = ?").bind(poId)
  );

  // Create GRN
  batch.push(
    db.prepare(
      `INSERT INTO goods_receipts (id, grn_number, po_id, supplier_id, location_id, receipt_date, invoice_number, total_amount, received_by)
       VALUES (?, ?, ?, ?, ?, date('now', 'localtime'), ?, ?, ?)`
    ).bind(genId("grn"), grnNumber, poId, po.supplier_id, targetLocation, invoice_number || '', po.grand_total, user.full_name)
  );

  // Update Supplier balance (Accounts Payable)
  batch.push(
    db.prepare("UPDATE suppliers SET balance = balance + ? WHERE id = ?").bind(po.grand_total, po.supplier_id)
  );

  // Audit log
  batch.push(
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'GOODS_RECEIVE', 'WAREHOUSE', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, poId, `รับสินค้าตาม PO ${po.po_number} เข้าคลัง ${targetLocation} ใบรับของ ${grnNumber}`)
  );

  await db.batch(batch);
  return c.json({ success: true, message: `รับสินค้าตามใบสั่งซื้อ ${po.po_number} เข้าคลังสำเร็จ (ใบรับของ ${grnNumber})` });
});

// -------------------------------------------------------------------
// 9. CUSTOMERS & MEMBERSHIP
// -------------------------------------------------------------------
app.get("/customers", authMiddleware, async (c) => {
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

app.post("/customers", authMiddleware, requirePermission("customer.manage"), async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;
  const custId = genId("cust");
  const memberCode = `MB-${Math.floor(1000 + Math.random() * 9000)}`;

  const batch = [
    db.prepare(
      `INSERT INTO customers (id, member_code, name, phone, email, address, membership_tier, discount_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      custId, memberCode, body.name, body.phone, body.email || '',
      body.address || '', body.membership_tier || 'Silver', Number(body.discount_pct) || 0
    ),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'CUSTOMER_CREATE', 'CUSTOMER', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, custId, `ลงทะเบียนสมาชิกใหม่: ${body.name} (${memberCode})`)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: `ลงทะเบียนสมาชิกรหัส ${memberCode} สำเร็จแล้ว` });
});

// -------------------------------------------------------------------
// 10. ACCOUNTING & EXPENSES
// -------------------------------------------------------------------
app.get("/accounting/expenses", authMiddleware, requirePermission("accounting.access"), async (c) => {
  const db = c.env.DB;
  const exps = await db.prepare("SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 100").all();
  return c.json({ success: true, data: exps.results });
});

app.post("/accounting/expenses", authMiddleware, requirePermission("accounting.expenses"), async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;
  const expId = genId("exp");
  const expNo = `EXP-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

  const amount = Number(body.amount);
  const vat = body.has_vat ? amount * 0.07 : 0;
  const grandTotal = amount + vat;

  const batch = [
    db.prepare(
      `INSERT INTO expenses (id, expense_no, category, description, amount, vat_amount, grand_total, recipient, paid_by, payment_method, expense_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      expId, expNo, body.category || 'ทั่วไป', body.description,
      amount, vat, grandTotal, body.recipient || '', user.full_name,
      body.payment_method || 'cash', body.expense_date || new Date().toISOString().slice(0, 10)
    ),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'EXPENSE_CREATE', 'ACCOUNTING', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, expId, `บันทึกค่าใช้จ่าย ${expNo}: ${body.description} ฿${grandTotal.toFixed(2)}`)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: `บันทึกค่าใช้จ่าย ${expNo} เรียบร้อยแล้ว` });
});

app.get("/accounting/summary", authMiddleware, requirePermission("accounting.access"), async (c) => {
  const db = c.env.DB;

  const rev: any = await db.prepare(
    "SELECT COALESCE(SUM(grand_total), 0) as total_sales, COALESCE(SUM(vat_amount), 0) as sales_vat FROM sales WHERE status = 'completed'"
  ).first();

  const exp: any = await db.prepare(
    "SELECT COALESCE(SUM(grand_total), 0) as total_expense, COALESCE(SUM(vat_amount), 0) as expense_vat FROM expenses"
  ).first();

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
app.get("/employees", authMiddleware, requirePermission("employees.manage"), async (c) => {
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

app.post("/employees", authMiddleware, requirePermission("employees.manage"), async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;
  const empId = genId("emp");
  const empCode = `EMP-${Math.floor(100 + Math.random() * 900)}`;

  // Securely hash initial password
  const hashedPassword = await hashPassword(body.password || "123456");

  const batch = [
    db.prepare(
      `INSERT INTO employees (id, employee_code, username, password_hash, full_name, role_code, email, phone, position, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
    ).bind(
      empId, empCode, body.username, hashedPassword, body.full_name,
      body.role_code, body.email || '', body.phone || '', body.position || ''
    ),
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'EMP_CREATE', 'EMPLOYEES', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, empId, `เพิ่มพนักงานใหม่: ${body.full_name} (${empCode}) บทบาท ${body.role_code}`)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: `เพิ่มพนักงาน ${body.full_name} เรียบร้อยแล้ว` });
});

app.put("/employees/:id/status", authMiddleware, requireOwnerOnly(), async (c) => {
  const empId = c.req.param("id");
  const { status } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  const batch = [
    db.prepare("UPDATE employees SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").bind(status, empId),
    db.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(empId), // Revoke active sessions immediately
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'EMP_STATUS_UPDATE', 'EMPLOYEES', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, empId, `เปลี่ยนสถานะพนักงานเป็น ${status}`)
  ];

  await db.batch(batch);
  return c.json({ success: true, message: `ปรับสถานะพนักงานเป็น ${status} เรียบร้อยแล้ว` });
});

app.get("/roles", authMiddleware, async (c) => {
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

app.get("/permissions", authMiddleware, async (c) => {
  const db = c.env.DB;
  const perms = await db.prepare("SELECT * FROM permissions ORDER BY module, code").all();
  return c.json({ success: true, data: perms.results });
});

// Update Role Permissions (Permission Builder - Strict Owner Only)
app.put("/roles/:id/permissions", authMiddleware, requireOwnerOnly(), async (c) => {
  const roleId = c.req.param("id");
  const { permissions } = await c.req.json();
  const db = c.env.DB;
  const user = c.get("user")!;

  const role: any = await db.prepare("SELECT code, name FROM roles WHERE id = ?").bind(roleId).first();
  if (role?.code === "OWNER_ADMIN") {
    return c.json({ success: false, error: "ไม่สามารถลดสิทธิ์ของบทบาท OWNER_ADMIN ได้" }, 403);
  }

  const batch = [
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").bind(roleId)
  ];

  for (const p of permissions) {
    batch.push(
      db.prepare("INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)").bind(roleId, p)
    );
  }

  batch.push(
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details)
       VALUES (?, ?, ?, 'ROLE_PERM_UPDATE', 'SETTINGS', ?, ?)`
    ).bind(genId("aud"), user.id, user.full_name, roleId, `อัปเดตสิทธิ์บทบาท ${role?.name || roleId} จำนวน ${permissions.length} สิทธิ์`)
  );

  await db.batch(batch);
  return c.json({ success: true, message: "อัปเดตชุดสิทธิ์การใช้งานสำหรับบทบาทนี้เรียบร้อยแล้ว" });
});

// -------------------------------------------------------------------
// 12. AUDIT LOGS (RESTRICTED AUDITING)
// -------------------------------------------------------------------
app.get("/audit-logs", authMiddleware, requireOwnerOnly(), async (c) => {
  const db = c.env.DB;
  const logs = await db.prepare(
    "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100"
  ).all();
  return c.json({ success: true, data: logs.results });
});

// -------------------------------------------------------------------
// 13. NOTIFICATIONS
// -------------------------------------------------------------------
app.get("/notifications", authMiddleware, async (c) => {
  const db = c.env.DB;
  const notifs = await db.prepare(
    "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20"
  ).all();
  return c.json({ success: true, data: notifs.results });
});

export const onRequest = handle(app);
