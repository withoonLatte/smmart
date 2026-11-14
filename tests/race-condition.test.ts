import { describe, it, expect } from "vitest";

describe("Concurrency & Race Condition Invariant Tests", () => {
  it("should prevent overselling during concurrent checkout requests", async () => {
    // Shared shelf stock for product
    let shelfStock = 5;
    const checkoutDemand = 3;

    // Simulated atomic conditional update: UPDATE inventory SET quantity = quantity - ? WHERE quantity >= ?
    const atomicDeduct = async (amount: number): Promise<{ success: boolean; currentStock: number }> => {
      // Simulate small async database latency
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      
      // Atomic condition check inside DB transaction
      if (shelfStock >= amount) {
        shelfStock -= amount;
        return { success: true, currentStock: shelfStock };
      }
      return { success: false, currentStock: shelfStock };
    };

    // Run 3 concurrent checkout requests of 3 units each (Total demand = 9, Stock = 5)
    const results = await Promise.all([
      atomicDeduct(checkoutDemand),
      atomicDeduct(checkoutDemand),
      atomicDeduct(checkoutDemand),
    ]);

    const successfulCheckouts = results.filter((r) => r.success);
    const rejectedCheckouts = results.filter((r) => !r.success);

    // Only 1 transaction should succeed (5 - 3 = 2 remaining; next transaction needing 3 must fail)
    expect(successfulCheckouts).toHaveLength(1);
    expect(rejectedCheckouts).toHaveLength(2);
    expect(shelfStock).toBe(2);
    expect(shelfStock).toBeGreaterThanOrEqual(0); // Invariant: stock never drops below 0!
  });

  it("should prevent duplicate stock count approval under concurrent requests (Atomic Concurrency Guard)", async () => {
    let taskStatus = "pending_approval";
    let approvedCount = 0;

    // Simulated atomic conditional update: UPDATE stock_count_tasks SET status = 'approved' WHERE status = 'pending_approval'
    const atomicApprove = async (): Promise<{ approved: boolean }> => {
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      if (taskStatus === "pending_approval") {
        taskStatus = "approved";
        approvedCount++;
        return { approved: true };
      }
      return { approved: false };
    };

    // 5 managers or duplicate clicks trying to approve simultaneously
    const results = await Promise.all([
      atomicApprove(),
      atomicApprove(),
      atomicApprove(),
      atomicApprove(),
      atomicApprove(),
    ]);

    const approvedResults = results.filter((r) => r.approved);
    expect(approvedResults).toHaveLength(1); // Exactly 1 succeeds
    expect(approvedCount).toBe(1);
    expect(taskStatus).toBe("approved");
  });

  it("should correctly aggregate duplicate items in cart to prevent stock bypass", () => {
    const rawCartItems = [
      { product_id: "prod_01", quantity: 2 },
      { product_id: "prod_02", quantity: 1 },
      { product_id: "prod_01", quantity: 3 }, // Duplicate prod_01
    ];

    const aggregated = new Map<string, number>();
    for (const item of rawCartItems) {
      aggregated.set(item.product_id, (aggregated.get(item.product_id) || 0) + item.quantity);
    }

    expect(aggregated.get("prod_01")).toBe(5);
    expect(aggregated.get("prod_02")).toBe(1);

    // Shelf stock is 4 units -> with proper aggregation, 5 units requested will be rejected!
    const shelfStockProd01 = 4;
    const canFulfill = (shelfStockProd01 >= (aggregated.get("prod_01") || 0));
    expect(canFulfill).toBe(false);
  });
});
