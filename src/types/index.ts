export type RoleCode = 
  | 'OWNER_ADMIN' 
  | 'MANAGER' 
  | 'CASHIER' 
  | 'STOCK_CHECKER' 
  | 'WAREHOUSE' 
  | 'PURCHASING' 
  | 'ACCOUNTING';

export interface User {
  id: string;
  employee_code: string;
  username: string;
  full_name: string;
  role_code: RoleCode;
  position: string;
  email?: string;
  phone?: string;
  permissions: string[];
}

export interface StoreProfile {
  id: string;
  store_name: string;
  branch_name: string;
  tax_id: string;
  phone: string;
  email: string;
  address: string;
  promptpay_id: string;
  vat_rate: number;
  receipt_header: string;
  receipt_footer: string;
  logo_url?: string;
  currency: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category_id?: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  unit: string;
  cost_price?: number;
  selling_price: number;
  wholesale_price?: number;
  min_stock: number;
  max_stock: number;
  is_vat: number;
  is_active: number;
  total_stock?: number;
  shelf_stock?: number;
  expiry_date?: string;
  batch_number?: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface Brand {
  id: string;
  code: string;
  name: string;
}

export interface WarehouseLocation {
  id: string;
  warehouse_id: string;
  warehouse_name?: string;
  code: string;
  name: string;
  location_type: 'shelf' | 'backstore' | 'cold_storage' | 'freezer';
  description?: string;
}

export interface CashierShift {
  id: string;
  shift_code: string;
  cashier_id: string;
  cashier_name: string;
  opened_at: string;
  closed_at?: string;
  opening_cash: number;
  cash_sales: number;
  promptpay_sales: number;
  card_sales: number;
  transfer_sales: number;
  total_sales: number;
  expected_cash: number;
  actual_cash?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export interface SaleTransaction {
  id: string;
  invoice_no: string;
  shift_id?: string;
  cashier_id: string;
  cashier_name?: string;
  customer_id?: string;
  customer_name?: string;
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  grand_total: number;
  payment_method: 'cash' | 'promptpay' | 'card' | 'transfer' | 'split';
  received_amount: number;
  change_amount: number;
  status: 'completed' | 'voided' | 'refunded';
  void_reason?: string;
  created_at: string;
}

export interface StockCountTask {
  id: string;
  task_code: string;
  title: string;
  location_id?: string;
  location_name?: string;
  category_id?: string;
  category_name?: string;
  status: 'draft' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected';
  assigned_to?: string;
  assigned_to_name?: string;
  created_by_name?: string;
  total_items: number;
  counted_items: number;
  notes?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  tax_id?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  balance: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  order_date: string;
  status: 'pending' | 'approved' | 'partially_received' | 'completed' | 'cancelled';
  total_amount: number;
  vat_amount: number;
  grand_total: number;
  notes?: string;
  creator_name?: string;
}

export interface Customer {
  id: string;
  member_code: string;
  name: string;
  phone: string;
  email?: string;
  points: number;
  membership_tier: string;
  discount_pct: number;
  total_spent: number;
}

export interface Expense {
  id: string;
  expense_no: string;
  category: string;
  description: string;
  amount: number;
  vat_amount: number;
  grand_total: number;
  recipient?: string;
  expense_date: string;
}
