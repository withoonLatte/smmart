import { describe, it, expect } from "vitest";

const PROD_URL = "https://smmart-1zp.pages.dev";

describe("Live Cloudflare Production D1 & API Verification", () => {
  it("should enforce authentication on all catalog & inventory endpoints in production", async () => {
    const endpoints = [
      "/api/categories",
      "/api/brands",
      "/api/inventory/locations",
      "/api/products",
      "/api/store-profile",
      "/api/pos/sales",
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${PROD_URL}${ep}`);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("UNAUTHORIZED");
    }
  });

  it("should enforce production CORS headers on Cloudflare Edge", async () => {
    const res = await fetch(`${PROD_URL}/api/categories`);
    expect(res.headers.get("access-control-allow-origin")).toBe(PROD_URL);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("should reject invalid login credentials on live Cloudflare Workers", async () => {
    const res = await fetch(`${PROD_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "non_existent_user_12345", password: "wrong_password" }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  });
});
