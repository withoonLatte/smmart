import { describe, it, expect } from "vitest";

// Permission evaluation logic from server middleware
function hasPermission(userPermissions: string[], requiredPerm: string): boolean {
  if (userPermissions.includes("*")) return true;
  return userPermissions.includes(requiredPerm);
}

function checkAccess(
  user: { role_code: string; permissions: string[]; is_active: number } | null,
  requiredPerm?: string,
  ownerOnly: boolean = false
): { authorized: boolean; status: number; message: string } {
  if (!user) {
    return { authorized: false, status: 401, message: "Unauthorized: Missing or invalid token" };
  }
  if (!user.is_active) {
    return { authorized: false, status: 403, message: "Account is suspended" };
  }
  if (ownerOnly && user.role_code !== "OWNER_ADMIN") {
    return { authorized: false, status: 403, message: "Forbidden: Super Admin only" };
  }
  if (requiredPerm && !hasPermission(user.permissions, requiredPerm)) {
    return { authorized: false, status: 403, message: `Forbidden: Missing permission ${requiredPerm}` };
  }
  return { authorized: true, status: 200, message: "Authorized" };
}

describe("RBAC Authorization & Permission Enforcement", () => {
  const ownerUser = {
    role_code: "OWNER_ADMIN",
    permissions: ["*"],
    is_active: 1,
  };

  const cashierUser = {
    role_code: "CASHIER",
    permissions: [
      "pos.access",
      "pos.scan",
      "pos.cart",
      "pos.checkout",
      "pos.print_receipt",
      "pos.open_shift",
      "pos.close_shift",
      "pos.view_own_transactions",
      "pos.request_void",
    ],
    is_active: 1,
  };

  const suspendedUser = {
    role_code: "MANAGER",
    permissions: ["dashboard.view", "sales.view"],
    is_active: 0,
  };

  it("should allow OWNER_ADMIN to access any endpoint due to wildcard '*'", () => {
    const res = checkAccess(ownerUser, "financial.audit_logs", true);
    expect(res.authorized).toBe(true);
    expect(res.status).toBe(200);
  });

  it("should permit CASHIER to execute pos.checkout", () => {
    const res = checkAccess(cashierUser, "pos.checkout");
    expect(res.authorized).toBe(true);
    expect(res.status).toBe(200);
  });

  it("should deny CASHIER from accessing owner-only financial audit logs", () => {
    const res = checkAccess(cashierUser, "financial.audit_logs", true);
    expect(res.authorized).toBe(false);
    expect(res.status).toBe(403);
    expect(res.message).toContain("Forbidden");
  });

  it("should deny CASHIER from accessing ungranted permissions like purchasing.approve", () => {
    const res = checkAccess(cashierUser, "purchasing.approve");
    expect(res.authorized).toBe(false);
    expect(res.status).toBe(403);
  });

  it("should reject requests from suspended employees immediately with 403", () => {
    const res = checkAccess(suspendedUser, "dashboard.view");
    expect(res.authorized).toBe(false);
    expect(res.status).toBe(403);
    expect(res.message).toBe("Account is suspended");
  });

  it("should reject unauthenticated requests with 401", () => {
    const res = checkAccess(null, "dashboard.view");
    expect(res.authorized).toBe(false);
    expect(res.status).toBe(401);
  });
});
