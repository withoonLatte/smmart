import { describe, it, expect } from "vitest";

// Simulation of server checkout invariant validations
interface ProductRecord {
  id: string;
  name: string;
  retail_price: number;
  cost_price: number;
  is_active: number;
  loc_shelf: number;
}

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number; // Client claimed price
}

function validateAndCalculateCheckout(
  dbProducts: Map<string, ProductRecord>,
  cartItems: CartItem[]
): {
  valid: boolean;
  error?: string;
  serverSubtotal?: number;
  itemsToDeduct?: { product_id: string; quantity: number }[];
} {
  let serverSubtotal = 0;
  const itemsToDeduct: { product_id: string; quantity: number }[] = [];

  for (const item of cartItems) {
    const product = dbProducts.get(item.product_id);
    if (!product || !product.is_active) {
      return { valid: false, error: `Product not found or inactive: ${item.product_id}` };
    }

    // Strict Anti-Overselling Invariant
    if (product.loc_shelf < item.quantity) {
      return {
        valid: false,
        error: `สินค้า '${product.name}' มีสต๊อกหน้าร้านไม่เพียงพอ (มี ${product.loc_shelf} ชิ้น, ต้องการ ${item.quantity} ชิ้น)`,
      };
    }

    // Strict Server-side Price Re-verification (disregards client sent item.price)
    const officialPrice = product.retail_price;
    serverSubtotal += officialPrice * item.quantity;
    itemsToDeduct.push({ product_id: item.product_id, quantity: item.quantity });
  }

  return { valid: true, serverSubtotal, itemsToDeduct };
}

describe("POS Atomic Checkout Invariants", () => {
  const dbProducts = new Map<string, ProductRecord>([
    [
      "prod_01",
      {
        id: "prod_01",
        name: "ข้าวหอมมะลิ 5 กก.",
        retail_price: 215.0,
        cost_price: 180.0,
        is_active: 1,
        loc_shelf: 10,
      },
    ],
    [
      "prod_02",
      {
        id: "prod_02",
        name: "น้ำมันถั่วเหลือง 1 ลิตร",
        retail_price: 55.0,
        cost_price: 45.0,
        is_active: 1,
        loc_shelf: 2, // Low stock
      },
    ],
  ]);

  it("should re-calculate total using server prices and ignore client price manipulation", () => {
    // Malicious client tries to send price 1.0 THB instead of 215.0 THB
    const manipulatedCart: CartItem[] = [
      { id: "1", product_id: "prod_01", quantity: 2, price: 1.0 },
    ];

    const result = validateAndCalculateCheckout(dbProducts, manipulatedCart);
    expect(result.valid).toBe(true);
    // 2 * 215.0 = 430.0, NOT 2 * 1.0 = 2.0
    expect(result.serverSubtotal).toBe(430.0);
  });

  it("should strictly reject checkout when shelf stock is insufficient (Anti-Overselling)", () => {
    // Attempting to buy 5 units when shelf has only 2 units
    const excessiveCart: CartItem[] = [
      { id: "2", product_id: "prod_02", quantity: 5, price: 55.0 },
    ];

    const result = validateAndCalculateCheckout(dbProducts, excessiveCart);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("สต๊อกหน้าร้านไม่เพียงพอ");
  });

  it("should approve valid checkout within stock limits", () => {
    const validCart: CartItem[] = [
      { id: "1", product_id: "prod_01", quantity: 1, price: 215.0 },
      { id: "2", product_id: "prod_02", quantity: 2, price: 55.0 },
    ];

    const result = validateAndCalculateCheckout(dbProducts, validCart);
    expect(result.valid).toBe(true);
    expect(result.serverSubtotal).toBe(215.0 + 110.0);
    expect(result.itemsToDeduct).toHaveLength(2);
  });
});
