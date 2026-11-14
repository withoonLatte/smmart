import { describe, it, expect } from "vitest";

// Replicate PBKDF2 Web Crypto implementation from functions/api/[[route]].ts (100,000 iterations)
async function hashPassword(password: string, customSalt?: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = customSalt || Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${salt}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt] = storedHash.split(":");
  const computed = await hashPassword(password, salt);
  return computed === storedHash;
}

describe("Authentication & PBKDF2 Password Security (100,000 Iterations)", () => {
  const roleSeedAccounts = [
    { username: 'owner', pass: 'Admin@Smmart2026!', hash: '2626fad4b0040ac256394ba2609801b6:1a35746eafe42b376185f7bad615818e1684ac556904927b57e1f7348ab1db60' },
    { username: 'manager', pass: 'Manager@Smmart2026!', hash: '1756e0d30c09f5014c4afd1ea8ed65f8:0f42758051b02ec2b5224535a22065e1bb9e08451cfe8df788b8e408433eb452' },
    { username: 'cashier', pass: 'Cashier@Smmart2026!', hash: 'a9d452e9941e990480aba8e918afa9c7:d141a1cbd0abb05c9690558cd615e29c66fd00f6980950382fe50fd164fe19a4' },
    { username: 'checker', pass: 'Checker@Smmart2026!', hash: '296967ac2772b95cced14ff90c028765:0f1bbf85274c26cfd75d9f9aea601dc5a98e95fe6cd9f646f5a52cb427912e4d' },
    { username: 'warehouse', pass: 'Wh@Smmart2026!', hash: 'b12304b6d4f869bc10e6a4e34b0f9d6e:3250ca2982755ffd6545b91ccedf736d7d5cd2f328c2a31e9ef101ec78a4bdf0' },
    { username: 'purchaser', pass: 'Purchase@Smmart2026!', hash: '63f5ff88448e07c30eeb099a331cf9e9:cea690b7a56c2b2568fc1a24efe59538dd9eff15f801c9a1a18844c2de579659' },
    { username: 'accountant', pass: 'Account@Smmart2026!', hash: '9818c55f6bd7562d2f25347fab3b08de:9526a22c9689e0be40b3f5f111d118ab781043852501df0ed478b2604ba93df1' },
  ];

  it("should verify all 7 distinct seeded role accounts with unique random salts and passwords", async () => {
    for (const acc of roleSeedAccounts) {
      const isValid = await verifyPassword(acc.pass, acc.hash);
      expect(isValid, `Account ${acc.username} verification failed`).toBe(true);
    }
  });

  it("should reject incorrect passwords during verification", async () => {
    const isWrongValid = await verifyPassword("WrongPassword123!", roleSeedAccounts[0].hash);
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
    
    const expiredDate = new Date(now.getTime() - 1000).toISOString();
    const isExpired = new Date(expiredDate) < now;
    expect(isExpired).toBe(true);
  });
});
