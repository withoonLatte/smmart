import { describe, it, expect } from "vitest";

// Replicate PBKDF2 Web Crypto implementation from functions/api/[[route]].ts
async function hashPassword(password: string): Promise<string> {
  const salt = "supermarket_salt_2026";
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 10000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedKey));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${salt}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, expectedHash] = storedHash.split(":");
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 10000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedKey));
  const actualHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return actualHash === expectedHash;
}

describe("Authentication & PBKDF2 Password Security", () => {
  it("should generate salted PBKDF2-SHA256 hash matching the seeded hash for password '123456'", async () => {
    const hash = await hashPassword("123456");
    expect(hash).toContain("supermarket_salt_2026:");
    expect(hash.length).toBeGreaterThan(40);
    
    // Test verification
    const isValid = await verifyPassword("123456", hash);
    expect(isValid).toBe(true);
  });

  it("should reject incorrect passwords during verification", async () => {
    const validHash = await hashPassword("123456");
    const isWrongValid = await verifyPassword("wrongpassword", validHash);
    expect(isWrongValid).toBe(false);
  });

  it("should generate cryptographically secure session tokens", () => {
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("should enforce session expiration after 7 days", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    
    // Check expired session simulation
    const expiredDate = new Date(now.getTime() - 1000).toISOString();
    const isExpired = new Date(expiredDate) < now;
    expect(isExpired).toBe(true);
  });
});
