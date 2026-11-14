import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  RotateCcw,
  User,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Product, Category, Customer, CashierShift } from "@/types";
import { generatePromptPayQR } from "@/utils/promptpay";
import { printReceiptIsolated } from "@/utils/printEngine";

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export const POSModule: React.FC = () => {
  const { currentUser, activeRole } = useAuthStore();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Customer & Discount
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customDiscount, setCustomDiscount] = useState<number>(0);

  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "promptpay" | "card" | "transfer">("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [promptPayQR, setPromptPayQR] = useState<{ qrDataUrl: string; fallbackUrl: string } | null>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Success / Receipt modal
  const [completedSale, setCompletedSale] = useState<any>(null);

  // Shift Open/Close modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState<string>("1000");
  const [closingCashInput, setClosingCashInput] = useState<string>("");
  const [shiftSummary, setShiftSummary] = useState<any>(null);

  // Store profile for receipt
  const [storeProfile, setStoreProfile] = useState<any>(null);

  // Barcode input ref
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes, shiftRes, custRes, storeRes] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getActiveShift(currentUser?.id),
        api.getCustomers(),
        api.getStoreProfile(),
      ]);

      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setActiveShift(shiftRes.shift || null);
      setCustomers(custRes.data || []);
      setStoreProfile(storeRes.data || null);
    } catch (err) {
      console.error("Error loading POS data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Calculations
  const rawSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const memberDiscountAmount = selectedCustomer
    ? (rawSubtotal * (selectedCustomer.discount_pct || 0)) / 100
    : 0;
  const totalDiscount = memberDiscountAmount + customDiscount;
  const netSubtotal = Math.max(0, rawSubtotal - totalDiscount);
  const vatRate = storeProfile?.vat_rate || 7.0;
  // Inclusive VAT calculation (standard Thailand retail)
  const vatAmount = (netSubtotal * vatRate) / (100 + vatRate);
  const grandTotal = netSubtotal;
  const changeAmount = Math.max(0, (Number(cashReceived) || 0) - grandTotal);

  // Cart actions
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.unit_price,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unit_price: product.selling_price,
          discount: 0,
          subtotal: product.selling_price,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? {
                  ...item,
                  quantity: newQty,
                  subtotal: newQty * item.unit_price,
                }
              : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setCustomDiscount(0);
  };

  // Barcode scanner handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const matched = products.find(
      (p) =>
        p.barcode.toLowerCase() === searchQuery.trim().toLowerCase() ||
        p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
    );

    if (matched) {
      addToCart(matched);
      setSearchQuery("");
    }
  };

  // Open Shift
  const handleOpenShift = async () => {
    try {
      const res = await api.openShift({
        cashier_id: currentUser?.id,
        cashier_name: currentUser?.full_name,
        opening_cash: Number(openingCashInput) || 0,
        notes: "เปิดกะขายประจำวัน",
      });
      setActiveShift(res.shift);
      setIsShiftModalOpen(false);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการเปิดกะ");
    }
  };

  // Close Shift
  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      const res = await api.closeShift({
        shift_id: activeShift.id,
        actual_cash: Number(closingCashInput) || 0,
        notes: "ปิดกะขายและนับเงินสดส่งมอบ",
      });
      setShiftSummary(res.data);
      setActiveShift(null);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการปิดกะ");
    }
  };

  // PromptPay QR generation on payment selection
  useEffect(() => {
    if (paymentMethod === "promptpay" && isCheckoutOpen && grandTotal > 0) {
      generatePromptPayQR(storeProfile?.promptpay_id || "0812345678", grandTotal).then((res) => {
        setPromptPayQR(res);
      });
    }
  }, [paymentMethod, isCheckoutOpen, grandTotal, storeProfile]);

  // Complete Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "cash" && (Number(cashReceived) || 0) < grandTotal) {
      alert("ยอดเงินที่รับมาไม่เพียงพอกับยอดชำระ");
      return;
    }

    setIsProcessingCheckout(true);
    try {
      const checkoutData = {
        shift_id: activeShift?.id || null,
        cashier_id: currentUser?.id,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || "ลูกค้าทั่วไป",
        items: cart.map((item) => ({
          product_id: item.product.id,
          name: item.product.name,
          barcode: item.product.barcode,
          unit: item.product.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.product.cost_price || 0,
          discount_amount: item.discount,
          subtotal: item.subtotal,
        })),
        subtotal: rawSubtotal,
        discount_amount: totalDiscount,
        vat_amount: vatAmount,
        grand_total: grandTotal,
        payment_method: paymentMethod,
        received_amount: paymentMethod === "cash" ? Number(cashReceived) : grandTotal,
        change_amount: paymentMethod === "cash" ? changeAmount : 0,
      };

      const res = await api.checkout(checkoutData);

      setCompletedSale({
        ...res.sale,
        items: res.items || cart,
        change_amount: checkoutData.change_amount,
        customer_name: selectedCustomer?.name,
      });

      // Clear cart
      setCart([]);
      setSelectedCustomer(null);
      setCustomDiscount(0);
      setIsCheckoutOpen(false);
      setCashReceived("");

      // Refresh products stock
      const prodRes = await api.getProducts();
      setProducts(prodRes.data || []);
    } catch (err: any) {
      alert(err.message || "การชำระเงินไม่สำเร็จ");
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Thermal Slip Printing using Isolated Print Engine (Strict Rule #2!)
  const triggerPrintReceipt = (sale: any) => {
    const saleData = sale || completedSale;
    if (!saleData) return;

    const receiptHtml = `
      <div class="receipt-center">
        <h2 style="margin: 0; font-size: 16px;">${storeProfile?.store_name || "HappyMart"}</h2>
        <p style="margin: 2px 0;">${storeProfile?.branch_name || "สำนักงานใหญ่ (สาขาหลัก 00000)"}</p>
        <p style="margin: 2px 0;">โทร: ${storeProfile?.phone || "02-888-9999"}</p>
        <p style="margin: 2px 0;">เลขประจำตัวผู้เสียภาษี: ${storeProfile?.tax_id || "0105562089123"}</p>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-center receipt-bold">ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ</div>
      <div class="receipt-divider"></div>
      <table>
        <tr><td>เลขที่บิล:</td><td class="receipt-right">${saleData.invoice_no}</td></tr>
        <tr><td>วันที่:</td><td class="receipt-right">${new Date(saleData.created_at || Date.now()).toLocaleString("th-TH")}</td></tr>
        <tr><td>แคชเชียร์:</td><td class="receipt-right">${currentUser?.full_name || "Staff"}</td></tr>
        <tr><td>ลูกค้า:</td><td class="receipt-right">${saleData.customer_name || "ลูกค้าทั่วไป"}</td></tr>
      </table>
      <div class="receipt-divider"></div>
      <table>
        <tr class="receipt-bold"><td>รายการ</td><td class="receipt-right">จำนวน</td><td class="receipt-right">รวม</td></tr>
        ${(saleData.items || [])
          .map(
            (it: any) => `
          <tr>
            <td>${it.product_name || it.name}</td>
            <td class="receipt-right">${it.quantity} ${it.unit || "ชิ้น"}</td>
            <td class="receipt-right">${Number(it.subtotal).toFixed(2)}</td>
          </tr>
        `
          )
          .join("")}
      </table>
      <div class="receipt-divider"></div>
      <table>
        <tr><td>รวมเป็นเงิน:</td><td class="receipt-right">${Number(saleData.subtotal).toFixed(2)} บาท</td></tr>
        ${
          Number(saleData.discount_amount) > 0
            ? `<tr><td>ส่วนลด:</td><td class="receipt-right">-${Number(saleData.discount_amount).toFixed(2)} บาท</td></tr>`
            : ""
        }
        <tr class="receipt-bold" style="font-size: 14px;">
          <td>ยอดชำระสุทธิ:</td>
          <td class="receipt-right">${Number(saleData.grand_total).toFixed(2)} บาท</td>
        </tr>
        <tr><td>วิธีชำระ:</td><td class="receipt-right">${saleData.payment_method?.toUpperCase()}</td></tr>
        <tr><td>รับเงินมา:</td><td class="receipt-right">${Number(saleData.received_amount).toFixed(2)} บาท</td></tr>
        <tr><td>เงินทอน:</td><td class="receipt-right">${Number(saleData.change_amount).toFixed(2)} บาท</td></tr>
      </table>
      <div class="receipt-divider"></div>
      <div class="receipt-center" style="font-size: 11px;">
        (ราคารวมภาษีมูลค่าเพิ่ม 7% แล้ว ${Number(saleData.vat_amount || 0).toFixed(2)} บาท)
      </div>
      <div class="receipt-double-divider"></div>
      <div class="receipt-center" style="font-size: 11px; white-space: pre-line;">
        ${storeProfile?.receipt_footer || "ขอบพระคุณที่ใช้บริการ\nกรุณาตรวจสอบสินค้าก่อนออกจากร้าน"}
      </div>
    `;

    printReceiptIsolated(receiptHtml, `Receipt-${saleData.invoice_no}`);
  };

  // Filter products by category & search
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === "ALL" || p.category_id === selectedCategory;
    const matchSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[#F8FAFC]">
      {/* LEFT: Product Catalog & Touch Pad (60% width) */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden border-r border-slate-200/70">
        {/* Top Controls: Barcode scan input & Shift status */}
        <div className="flex items-center gap-3 mb-3">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="สแกนบาร์โค้ด หรือพิมพ์ค้นหาสินค้า (กด Enter เพื่อเลือก)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Barcode className="w-4 h-4" />
            </div>
          </form>

          {/* Shift status button */}
          {activeShift ? (
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-all shrink-0"
            >
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>กะเปิด: {activeShift.shift_code}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all shrink-0"
            >
              <AlertCircle className="w-4 h-4" />
              <span>คลิกเพื่อเปิดกะขาย</span>
            </button>
          )}
        </div>

        {/* Category Pill Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-3">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all ${
              selectedCategory === "ALL"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            ทั้งหมด ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold shrink-0 transition-all ${
                selectedCategory === c.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProducts.map((p) => {
              const inStock = (p.shelf_stock ?? p.total_stock ?? 0) > 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="group bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm hover:shadow-float hover:border-blue-400 text-left transition-all duration-150 flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {p.barcode}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          inStock
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {p.shelf_stock ?? p.total_stock ?? 0} {p.unit}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-xs line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                      {p.name}
                    </h3>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                    <span className="text-sm font-black text-blue-600">
                      ฿{p.selling_price.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400">/{p.unit}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
              ไม่พบสินค้าที่ตรงกับการค้นหา
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Shopping Cart & Checkout Panel (40% width) */}
      <div className="w-96 md:w-[420px] bg-white flex flex-col h-full shadow-modern z-10">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              รายการสินค้า ({cart.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-all"
            >
              ล้างตะกร้า
            </button>
          )}
        </div>

        {/* Member Selector Pill */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium">
              {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.membership_tier} -${selectedCustomer.discount_pct}%)` : "ลูกค้าทั่วไป"}
            </span>
          </div>
          <select
            value={selectedCustomer?.id || ""}
            onChange={(e) => {
              const cust = customers.find((c) => c.id === e.target.value) || null;
              setSelectedCustomer(cust);
            }}
            className="text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">เลือกสมาชิกรับส่วนลด</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.membership_tier} ลด {c.discount_pct}%)
              </option>
            ))}
          </select>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {item.product.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  ฿{item.unit_price.toFixed(2)} x {item.quantity} {item.product.unit}
                </p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                <button
                  onClick={() => updateQuantity(item.product.id, -1)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-all"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-bold text-slate-800">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.product.id, 1)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Subtotal & Delete */}
              <div className="text-right">
                <p className="text-xs font-bold text-blue-600">
                  ฿{item.subtotal.toFixed(2)}
                </p>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 mt-0.5 ml-auto" />
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs">
              <ShoppingBag className="w-12 h-12 mb-2 stroke-1" />
              <span>ยังไม่มีสินค้าในตะกร้า</span>
              <span className="text-[10px] text-slate-400 mt-1">
                คลิกเลือกสินค้าหรือสแกนบาร์โค้ด
              </span>
            </div>
          )}
        </div>

        {/* Pricing Summary */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>ยอดรวมสินค้า</span>
            <span>฿{rawSubtotal.toFixed(2)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-xs font-medium text-emerald-600">
              <span>ส่วนลดสมาชิก ({selectedCustomer?.membership_tier})</span>
              <span>-฿{totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>ภาษีมูลค่าเพิ่ม (VAT 7% รวมแล้ว)</span>
            <span>฿{vatAmount.toFixed(2)}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-sm font-bold text-slate-800">ยอดชำระสุทธิ</span>
            <span className="text-2xl font-black text-blue-600">
              ฿{grandTotal.toFixed(2)}
            </span>
          </div>

          {/* Checkout CTA Button */}
          <button
            disabled={cart.length === 0 || !activeShift}
            onClick={() => {
              setCashReceived(Math.ceil(grandTotal).toString());
              setIsCheckoutOpen(true);
            }}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              cart.length > 0 && activeShift
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 active:scale-[0.99]"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <span>ชำระเงิน</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MODAL: Checkout & Payment */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-modal border border-slate-200 relative overflow-hidden">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              ชำระเงิน (Total: ฿{grandTotal.toFixed(2)})
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              เลือกช่องทางการชำระเงิน และตรวจสอบความถูกต้อง
            </p>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  paymentMethod === "cash"
                    ? "border-blue-600 bg-blue-50 text-blue-700 font-bold"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Banknote className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                <span className="text-xs">เงินสด</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("promptpay")}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  paymentMethod === "promptpay"
                    ? "border-blue-600 bg-blue-50 text-blue-700 font-bold"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <QrCode className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                <span className="text-xs">พร้อมเพย์ QR</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  paymentMethod === "card"
                    ? "border-blue-600 bg-blue-50 text-blue-700 font-bold"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CreditCard className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
                <span className="text-xs">บัตรเครดิต</span>
              </button>
            </div>

            {/* Cash Payment Flow */}
            {paymentMethod === "cash" && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 mb-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    รับเงินสดมา (บาท)
                  </label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full text-xl font-black text-slate-900 px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                {/* Quick cash denomination chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[20, 50, 100, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashReceived(amt.toString())}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                    >
                      +{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashReceived(grandTotal.toString())}
                    className="px-2.5 py-1 bg-blue-600 rounded-lg text-xs font-bold text-white shadow-sm"
                  >
                    พอดี (฿{grandTotal.toFixed(2)})
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-slate-600">เงินทอน:</span>
                  <span
                    className={`text-lg font-black ${
                      changeAmount >= 0 ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    ฿{changeAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* PromptPay QR Flow (Instant Client-side Rendering per Rule #3) */}
            {paymentMethod === "promptpay" && (
              <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-200/60 mb-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  สแกนชำระผ่าน PromptPay QR
                </p>
                {promptPayQR?.qrDataUrl ? (
                  <div className="inline-block p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                    <img
                      src={promptPayQR.qrDataUrl}
                      alt="PromptPay QR"
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 mx-auto bg-slate-200 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400">
                    กำลังสร้าง QR Code...
                  </div>
                )}
                <p className="text-sm font-black text-blue-600 mt-2">
                  ฿{grandTotal.toFixed(2)}
                </p>
              </div>
            )}

            {/* Card Flow */}
            {paymentMethod === "card" && (
              <div className="text-center bg-slate-50 p-6 rounded-2xl border border-slate-200/60 mb-4">
                <CreditCard className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs text-slate-600">
                  กรุณาแตะหรือเสียบบัตรที่เครื่องรูดบัตร (EDC) ยอด ฿{grandTotal.toFixed(2)}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isProcessingCheckout || (paymentMethod === "cash" && (Number(cashReceived) || 0) < grandTotal)}
                onClick={handleCheckout}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 disabled:bg-slate-300"
              >
                {isProcessingCheckout ? "กำลังบันทึก..." : "ยืนยันการรับเงิน (Done)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Success & Thermal Receipt Print */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-modal border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              การขายเสร็จสมบูรณ์!
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              เลขที่บิล: <span className="font-mono font-bold text-slate-800">{completedSale.invoice_no}</span>
            </p>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1 mb-4 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">ยอดชำระ:</span>
                <span className="font-bold text-slate-800">฿{Number(completedSale.grand_total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">เงินทอน:</span>
                <span className="font-bold text-emerald-600">฿{Number(completedSale.change_amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => triggerPrintReceipt(completedSale)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ใบเสร็จ (Isolated Thermal Slip)</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 text-xs"
              >
                เริ่มบิลใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Shift Management (Open / Close) */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-modal border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              จัดการกะการทำงานแคชเชียร์
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              แคชเชียร์: {currentUser?.full_name} ({currentUser?.employee_code})
            </p>

            {activeShift ? (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">รหัสกะ:</span>
                    <span className="font-mono font-bold text-slate-900">{activeShift.shift_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">เงินทอนตั้งต้น:</span>
                    <span className="font-bold">฿{activeShift.opening_cash}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">ยอดขายเงินสดสะสม:</span>
                    <span className="font-bold text-blue-600">฿{activeShift.cash_sales}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">ยอดขายรวมทุกช่องทาง:</span>
                    <span className="font-bold text-indigo-600">฿{activeShift.total_sales}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    นับเงินสดจริงในลิ้นชักเพื่อปิดกะ (บาท)
                  </label>
                  <input
                    type="number"
                    value={closingCashInput}
                    onChange={(e) => setClosingCashInput(e.target.value)}
                    placeholder="ป้อนยอดเงินสดที่นับได้จริง..."
                    className="w-full text-base font-bold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsShiftModalOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseShift}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20"
                  >
                    ยืนยันปิดกะและกระทบยอด
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    เงินทอนตั้งต้น (บาท)
                  </label>
                  <input
                    type="number"
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    className="w-full text-base font-bold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsShiftModalOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenShift}
                    className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
                  >
                    เปิดกะขายทันที
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
