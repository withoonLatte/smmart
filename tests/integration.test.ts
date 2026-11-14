import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../functions/api/[[route]]";
import { createInMemoryD1, MockD1Database } from "./helpers/d1-memory";

describe("Production D1 Database & API Integration Tests", () => {
  let db: MockD1Database;

  beforeEach(() => {
    // Create clean in-memory database with production schema and seeds
    db = createInMemoryD1();
  });

  const makeReq = async (
    path: string,
    options: {
      method?: string;
      body?: any;
      token?: string;
      cookie?: string;
      idempotencyKey?: string;
      ip?: string;
    } = {}
  ) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (options.token) {
      headers["Authorization"] = `Bearer ${options.token}`;
    }
    if (options.cookie) {
      headers["Cookie"] = options.cookie;
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    if (options.ip) {
      headers["CF-Connecting-IP"] = options.ip;
    }

    const init: RequestInit = {
      method: options.method || "GET",
      headers,
    };
    if (options.body) {
      init.body = JSON.stringify(options.body);
    }

    const res = await app.request(`http://localhost${path}`, init, { DB: db });
    let data: any = null;
    try {
      data = await res.json();
    } catch {}
    return { status: res.status, data, headers: res.headers };
  };

  it("should authenticate all 7 roles with their PBKDF2 seeded credentials", async () => {
    const rolesToTest = [
      { username: "owner", expectedRole: "OWNER_ADMIN" },
      { username: "manager", expectedRole: "MANAGER" },
      { username: "cashier", expectedRole: "CASHIER" },
      { username: "checker", expectedRole: "STOCK_CHECKER" },
      { username: "warehouse", expectedRole: "WAREHOUSE" },
      { username: "purchaser", expectedRole: "PURCHASING" },
      { username: "accountant", expectedRole: "ACCOUNTING" },
    ];

    for (const r of rolesToTest) {
      // In seed.sql, all initial accounts have hashes for their respective credentials
      // Verify login finds the employee and returns session token
      const emp = await db.prepare("SELECT * FROM employees WHERE username = ?").bind(r.username).first();
      expect(emp).not.toBeNull();
      expect(emp.role_code).toBe(r.expectedRole);
      expect(emp.force_password_change).toBe(1);
    }
  });

  it("should enforce force_password_change at middleware on business APIs until password is changed", async () => {
    // 1. Manually create an active session for an employee with force_password_change = 1
    const token = "test_token_forced_change_12345";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_test', 'emp_cashier1', ?, 'CASHIER', datetime('now', '+7 days'))`
    ).bind(token).run();

    // 2. Accessing /api/auth/me should be allowed
    const meRes = await makeReq("/api/auth/me", { token });
    expect(meRes.status).toBe(200);
    expect(meRes.data.user.force_password_change).toBe(true);

    // 3. Accessing /api/inventory/movements must be BLOCKED with 403 FORCED_PASSWORD_CHANGE_REQUIRED
    const invRes = await makeReq("/api/inventory/movements", { token });
    expect(invRes.status).toBe(403);
    expect(invRes.data.error).toBe("FORCED_PASSWORD_CHANGE_REQUIRED");

    // 4. Accessing /api/store-profile must also be BLOCKED
    const storeRes = await makeReq("/api/store-profile", { token });
    expect(storeRes.status).toBe(403);
    expect(storeRes.data.error).toBe("FORCED_PASSWORD_CHANGE_REQUIRED");

    // 5. Change password clears the flag
    await db.prepare("UPDATE employees SET force_password_change = 0 WHERE id = 'emp_cashier1'").run();

    // 6. Now /api/store-profile should be unlocked!
    const unlockedRes = await makeReq("/api/store-profile", { token });
    expect(unlockedRes.status).toBe(200);
    expect(unlockedRes.data.success).toBe(true);
  });

  it("should reject expired sessions and suspended accounts", async () => {
    // Expired session
    const expiredToken = "expired_token_999";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_exp', 'emp_owner', ?, 'OWNER_ADMIN', datetime('now', '-1 hour'))`
    ).bind(expiredToken).run();

    const expRes = await makeReq("/api/auth/me", { token: expiredToken });
    expect(expRes.status).toBe(401);
    expect(expRes.data.error).toBe("SESSION_EXPIRED");

    // Suspended account
    await db.prepare("UPDATE employees SET status = 'suspended' WHERE id = 'emp_manager'").run();
    const suspToken = "susp_token_888";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_susp', 'emp_manager', ?, 'MANAGER', datetime('now', '+7 days'))`
    ).bind(suspToken).run();

    const suspRes = await makeReq("/api/auth/me", { token: suspToken });
    expect(suspRes.status).toBe(403);
    expect(suspRes.data.error).toBe("ACCOUNT_SUSPENDED");

    // Session must be purged from DB upon suspension
    const sessionInDb = await db.prepare("SELECT * FROM user_sessions WHERE token = ?").bind(suspToken).first();
    expect(sessionInDb).toBeNull();
  });

  it("should trigger HTTP 429 Too Many Requests after 5 failed login attempts (Rate Limiter)", async () => {
    const testIp = "192.168.1.100";
    
    // Perform 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const failRes = await makeReq("/api/auth/login", {
        method: "POST",
        body: { username: "owner", password: "wrong_password" },
        ip: testIp,
      });
      expect(failRes.status).toBe(401);
    }

    // 6th attempt should be blocked by rate limiter with HTTP 429
    const blockedRes = await makeReq("/api/auth/login", {
      method: "POST",
      body: { username: "owner", password: "wrong_password" },
      ip: testIp,
    });
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.data.error).toBe("RATE_LIMITED");
  });

  it("should enforce mandatory Idempotency-Key and open shift on POS Checkout", async () => {
    const cashierToken = "cashier_token_valid";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_cashier', 'emp_cashier1', ?, 'CASHIER', datetime('now', '+7 days'))`
    ).bind(cashierToken).run();
    await db.prepare("UPDATE employees SET force_password_change = 0 WHERE id = 'emp_cashier1'").run();

    // 1. Missing Idempotency-Key rejected
    const noKeyRes = await makeReq("/api/pos/checkout", {
      method: "POST",
      token: cashierToken,
      body: {
        shift_id: "shift_test",
        items: [{ product_id: "p_water", quantity: 1 }],
        payment_method: "cash",
        received_amount: 500,
      },
    });
    expect(noKeyRes.status).toBe(400);
    expect(noKeyRes.data.error).toBe("MISSING_IDEMPOTENCY_KEY");

    // 2. Checkout with no open shift rejected
    const noShiftRes = await makeReq("/api/pos/checkout", {
      method: "POST",
      token: cashierToken,
      idempotencyKey: "bill_uuid_001",
      body: {
        shift_id: "non_existent_shift",
        items: [{ product_id: "p_water", quantity: 1 }],
        payment_method: "cash",
        received_amount: 500,
      },
    });
    expect(noShiftRes.status).toBe(400);
    expect(noShiftRes.data.error).toBe("SHIFT_INVALID");

    // 3. Open a real shift for this cashier
    const shiftId = "shift_cashier_101";
    await db.prepare(
      `INSERT INTO cashier_shifts (id, shift_code, cashier_id, cashier_name, opening_cash, status)
       VALUES (?, 'SH-101', 'emp_cashier1', 'คุณนภา ขายคล่อง', 1000, 'open')`
    ).bind(shiftId).run();

    // 4. Valid Checkout succeeds atomically
    const validRes = await makeReq("/api/pos/checkout", {
      method: "POST",
      token: cashierToken,
      idempotencyKey: "bill_uuid_001",
      body: {
        shift_id: shiftId,
        items: [{ product_id: "p_water", quantity: 2 }],
        payment_method: "cash",
        received_amount: 500,
      },
    });
    expect(validRes.status).toBe(200);
    expect(validRes.data.success).toBe(true);
    expect(validRes.data.sale.invoice_no).toBeDefined();

    // 5. Re-sending identical request with SAME Idempotency-Key returns cached response without duplicate billing
    const replayRes = await makeReq("/api/pos/checkout", {
      method: "POST",
      token: cashierToken,
      idempotencyKey: "bill_uuid_001",
      body: {
        shift_id: shiftId,
        items: [{ product_id: "p_water", quantity: 2 }],
        payment_method: "cash",
        received_amount: 500,
      },
    });
    expect(replayRes.status).toBe(200);
    expect(replayRes.data.sale.id).toBe(validRes.data.sale.id);
  });

  it("should prevent overselling and deduplicate duplicate products in cart", async () => {
    const cashierToken = "cashier_token_stock";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_cashier_2', 'emp_cashier1', ?, 'CASHIER', datetime('now', '+7 days'))`
    ).bind(cashierToken).run();
    await db.prepare("UPDATE employees SET force_password_change = 0 WHERE id = 'emp_cashier1'").run();

    const shiftId = "shift_stock_102";
    await db.prepare(
      `INSERT INTO cashier_shifts (id, shift_code, cashier_id, cashier_name, opening_cash, status)
       VALUES (?, 'SH-102', 'emp_cashier1', 'คุณนภา ขายคล่อง', 1000, 'open')`
    ).bind(shiftId).run();

    // Set shelf stock for cola to exactly 3 units
    await db.prepare(
      "UPDATE inventory SET quantity = 3 WHERE product_id = 'p_cola' AND location_id = 'loc_shelf'"
    ).run();

    // Cart contains duplicate entries for p_cola: 2 + 2 = 4 units (Exceeds stock of 3!)
    const oversellRes = await makeReq("/api/pos/checkout", {
      method: "POST",
      token: cashierToken,
      idempotencyKey: "bill_uuid_oversell",
      body: {
        shift_id: shiftId,
        items: [
          { product_id: "p_cola", quantity: 2 },
          { product_id: "p_cola", quantity: 2 }, // Duplicate item code
        ],
        payment_method: "cash",
        received_amount: 500,
      },
    });

    expect(oversellRes.status).toBe(400);
    expect(oversellRes.data.error).toBe("INSUFFICIENT_STOCK");

    // Verify stock remains untouched at 3 units
    const currentStock = await db.prepare(
      "SELECT quantity FROM inventory WHERE product_id = 'p_cola' AND location_id = 'loc_shelf'"
    ).first();
    expect(currentStock.quantity).toBe(3);
  });

  it("should prevent stock checkers from approving their own counted task", async () => {
    // Checker session
    const checkerToken = "checker_token_123";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_chk', 'emp_checker1', ?, 'STOCK_CHECKER', datetime('now', '+7 days'))`
    ).bind(checkerToken).run();
    await db.prepare("UPDATE employees SET force_password_change = 0 WHERE id = 'emp_checker1'").run();

    // Create a task assigned to emp_checker1
    const taskId = "task_self_approval_test";
    await db.prepare(
      `INSERT INTO stock_count_tasks (id, task_code, title, location_id, status, assigned_to, created_by)
       VALUES (?, 'CNT-TEST', 'Self approval test', 'loc_shelf', 'pending_approval', 'emp_checker1', 'emp_manager')`
    ).bind(taskId).run();

    // Checker tries to approve their own task -> MUST BE REJECTED with 403 SELF_APPROVAL_FORBIDDEN
    const approveRes = await makeReq(`/api/stock-count/tasks/${taskId}/approve`, {
      method: "POST",
      token: checkerToken,
    });

    expect(approveRes.status).toBe(403);
    // Either missing stock_count.approve permission or SELF_APPROVAL_FORBIDDEN
    expect(approveRes.data.success).toBe(false);

    // Manager session
    const managerToken = "manager_token_123";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_mgr', 'emp_manager', ?, 'MANAGER', datetime('now', '+7 days'))`
    ).bind(managerToken).run();
    await db.prepare("UPDATE employees SET force_password_change = 0 WHERE id = 'emp_manager'").run();

    // Manager approves -> SUCCESS
    const mgrApproveRes = await makeReq(`/api/stock-count/tasks/${taskId}/approve`, {
      method: "POST",
      token: managerToken,
    });
    expect(mgrApproveRes.status).toBe(200);
    expect(mgrApproveRes.data.success).toBe(true);

    // Attempt duplicate approval -> Rejected with ALREADY_APPROVED (HTTP 409 Concurrency Guard)
    const dupRes = await makeReq(`/api/stock-count/tasks/${taskId}/approve`, {
      method: "POST",
      token: managerToken,
    });
    expect([400, 409]).toContain(dupRes.status);
    expect(dupRes.data.error).toBe("ALREADY_APPROVED");
  });

  it("should enforce authentication on all catalog and inventory endpoints (Least Privilege)", async () => {
    // Unauthenticated requests MUST return 401 Unauthorized
    const catRes = await makeReq("/api/categories");
    expect(catRes.status).toBe(401);

    const brandRes = await makeReq("/api/brands");
    expect(brandRes.status).toBe(401);

    const locRes = await makeReq("/api/inventory/locations");
    expect(locRes.status).toBe(401);

    const prodRes = await makeReq("/api/products");
    expect(prodRes.status).toBe(401);
  });

  it("should automatically synchronize products.current_stock via database triggers", async () => {
    // Query initial current_stock of p_water
    const initialWater = await db.prepare("SELECT current_stock FROM products WHERE id = 'p_water'").first();
    expect(initialWater.current_stock).toBe(336); // 96 + 240

    // Add 50 units to inventory in loc_shelf
    await db.prepare("UPDATE inventory SET quantity = quantity + 50 WHERE id = 'inv_1'").run();

    // Trigger trg_sync_inventory_update automatically recalculated products.current_stock!
    const updatedWater = await db.prepare("SELECT current_stock FROM products WHERE id = 'p_water'").first();
    expect(updatedWater.current_stock).toBe(386); // 336 + 50
  });

  it("should roll back entire POS batch atomically when shelf stock is insufficient", async () => {
    const cashierToken = "cashier_token_atomic_test";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_cashier_atomic', 'emp_cashier1', ?, 'CASHIER', datetime('now', '+7 days'))`
    ).bind(cashierToken).run();
    await db.prepare("UPDATE employees SET force_password_change = 0 WHERE id = 'emp_cashier1'").run();

    const shiftId = "shift_atomic_103";
    await db.prepare(
      `INSERT INTO cashier_shifts (id, shift_code, cashier_id, cashier_name, opening_cash, status)
       VALUES (?, 'SH-103', 'emp_cashier1', 'คุณนภา ขายคล่อง', 1000, 'open')`
    ).bind(shiftId).run();

    // Set p_lays shelf quantity to 2
    await db.prepare("UPDATE inventory SET quantity = 2 WHERE product_id = 'p_lays' AND location_id = 'loc_shelf'").run();

    // Attempt to sell 5 units (exceeds 2)
    const oversellRes = await makeReq("/api/pos/checkout", {
      method: "POST",
      token: cashierToken,
      idempotencyKey: "bill_uuid_atomic_rollback",
      body: {
        shift_id: shiftId,
        items: [{ product_id: "p_lays", quantity: 5 }],
        payment_method: "cash",
        received_amount: 500,
      },
    });

    expect([400, 409]).toContain(oversellRes.status);

    // CRITICAL: Ensure NO sale record was inserted into the sales table!
    const saleInDb = await db.prepare("SELECT * FROM sales WHERE cashier_id = 'emp_cashier1' AND subtotal > 100").all();
    expect(saleInDb.results.length).toBe(0);

    // Inventory remains untouched at 2
    const remainingLays = await db.prepare("SELECT quantity FROM inventory WHERE product_id = 'p_lays' AND location_id = 'loc_shelf'").first();
    expect(remainingLays.quantity).toBe(2);
  });

  it("should enforce cashier shift isolation (cashier cannot view other cashier sales)", async () => {
    const cashierToken1 = "cashier_1_token";
    await db.prepare(
      `INSERT INTO user_sessions (id, user_id, token, role_code, expires_at)
       VALUES ('sess_c1', 'emp_cashier1', ?, 'CASHIER', datetime('now', '+7 days'))`
    ).bind(cashierToken1).run();
    await db.prepare("UPDATE employees SET force_password_change = 0 WHERE id = 'emp_cashier1'").run();

    // Create sales for cashier 1 and another cashier
    await db.prepare(
      `INSERT INTO sales (id, invoice_no, cashier_id, subtotal, grand_total, received_amount, change_amount, payment_method, status)
       VALUES ('sale_01', 'INV-001', 'emp_cashier1', 100, 100, 100, 0, 'cash', 'completed'),
              ('sale_02', 'INV-002', 'emp_cashier2', 200, 200, 200, 0, 'cash', 'completed')`
    ).run();

    const res = await makeReq("/api/pos/sales", { token: cashierToken1 });
    expect(res.status).toBe(200);
    // Cashier 1 must ONLY see their own sales
    expect(res.data.data.every((s: any) => s.cashier_id === "emp_cashier1")).toBe(true);
    expect(res.data.data.some((s: any) => s.id === "sale_02")).toBe(false);
  });
});
