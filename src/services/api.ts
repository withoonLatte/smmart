import { useAuthStore } from "@/store/useAuthStore";

const API_BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { sessionToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Attach verified Bearer Session Token
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || json.error || `Error ${res.status}: ${res.statusText}`);
  }
  return json;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ success: boolean; token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),
  logout: () =>
    request<{ success: boolean; message: string }>("/auth/logout", {
      method: "POST",
    }),
  getMe: () => request<{ success: boolean; user: any }>("/auth/me"),

  // Store Profile
  getStoreProfile: () => request<{ success: boolean; data: any }>("/store-profile"),
  updateStoreProfile: (data: any) =>
    request<{ success: boolean; message: string }>("/store-profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Dashboard
  getDashboardSummary: () => request<{ success: boolean; data: any }>("/dashboard/summary"),

  // POS
  getActiveShift: (cashierId?: string) =>
    request<{ success: boolean; shift: any }>("/pos/shift/active"),
  openShift: (data: any) =>
    request<{ success: boolean; shift: any; message: string }>("/pos/shift/open", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  closeShift: (data: any) =>
    request<{ success: boolean; data: any; message: string }>("/pos/shift/close", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  checkout: (data: any, idempotencyKey?: string) =>
    request<{ success: boolean; invoice_no: string; sale: any; items: any[]; message: string }>("/pos/checkout", {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      body: JSON.stringify(data),
    }),
  getSales: () => request<{ success: boolean; data: any[] }>("/pos/sales"),
  getSale: (id: string) => request<{ success: boolean; sale: any; items: any[] }>(`/pos/sales/${id}`),
  voidSale: (id: string, data: { reason: string }) =>
    request<{ success: boolean; message: string; items?: any[] }>(`/pos/sales/${id}/void`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Products
  getProducts: (params?: { q?: string; cat?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/products${q ? `?${q}` : ""}`);
  },
  createProduct: (data: any) =>
    request<{ success: boolean; message: string; id: string }>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProduct: (id: string, data: any) =>
    request<{ success: boolean; message: string }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: string) =>
    request<{ success: boolean; message: string }>(`/products/${id}`, {
      method: "DELETE",
    }),

  getCategories: () => request<{ success: boolean; data: any[] }>("/categories"),
  getBrands: () => request<{ success: boolean; data: any[] }>("/brands"),

  // Inventory & Locations
  getLocations: () => request<{ success: boolean; data: any[] }>("/inventory/locations"),
  getStockByLocation: () => request<{ success: boolean; data: any[] }>("/inventory/stock-by-location"),
  transferStock: (data: any) =>
    request<{ success: boolean; message: string }>("/inventory/transfer", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMovements: () => request<{ success: boolean; data: any[] }>("/inventory/movements"),

  // Stock Counting
  getStockCountTasks: () => request<{ success: boolean; data: any[] }>("/stock-count/tasks"),
  createStockCountTask: (data: any) =>
    request<{ success: boolean; message: string; id: string }>("/stock-count/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getStockCountTask: (id: string) =>
    request<{ success: boolean; task: any; items: any[] }>(`/stock-count/tasks/${id}`),
  submitStockCount: (id: string, counts: any[]) =>
    request<{ success: boolean; message: string }>(`/stock-count/tasks/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ counts }),
    }),
  approveStockCount: (id: string) =>
    request<{ success: boolean; message: string }>(`/stock-count/tasks/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  // Suppliers & Purchasing
  getSuppliers: () => request<{ success: boolean; data: any[] }>("/suppliers"),
  createSupplier: (data: any) =>
    request<{ success: boolean; message: string }>("/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPurchaseOrders: () => request<{ success: boolean; data: any[] }>("/purchasing/orders"),
  createPurchaseOrder: (data: any) =>
    request<{ success: boolean; message: string; id: string }>("/purchasing/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approvePurchaseOrder: (id: string) =>
    request<{ success: boolean; message: string }>(`/purchasing/orders/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  receivePurchaseOrder: (id: string, data: any) =>
    request<{ success: boolean; message: string }>(`/purchasing/orders/${id}/receive`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Customers
  getCustomers: (q?: string) =>
    request<{ success: boolean; data: any[] }>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createCustomer: (data: any) =>
    request<{ success: boolean; message: string }>("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Accounting
  getExpenses: () => request<{ success: boolean; data: any[] }>("/accounting/expenses"),
  createExpense: (data: any) =>
    request<{ success: boolean; message: string }>("/accounting/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAccountingSummary: () => request<{ success: boolean; data: any }>("/accounting/summary"),

  // Employees & Roles
  getEmployees: () => request<{ success: boolean; data: any[] }>("/employees"),
  createEmployee: (data: any) =>
    request<{ success: boolean; message: string }>("/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEmployeeStatus: (id: string, status: string) =>
    request<{ success: boolean; message: string }>(`/employees/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  getRoles: () => request<{ success: boolean; data: any[] }>("/roles"),
  getPermissions: () => request<{ success: boolean; data: any[] }>("/permissions"),
  updateRolePermissions: (roleId: string, permissions: string[]) =>
    request<{ success: boolean; message: string }>(`/roles/${roleId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),

  // Audit Logs
  getAuditLogs: () => request<{ success: boolean; data: any[] }>("/audit-logs"),

  // Notifications
  getNotifications: () => request<{ success: boolean; data: any[] }>("/notifications"),

  // Live System & Code Audit
  getSystemAudit: () => request<{ success: boolean; data: any }>("/system/audit"),
};
