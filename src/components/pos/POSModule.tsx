import React, { useState, useEffect, useRef } from "react";
import {
  Barcode,
  Search,
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
  Delete,
  PauseCircle,
  PlayCircle,
  Receipt,
  Percent,
  Layers,
  ChevronRight,
  RefreshCw,
  Coins,
  Edit3,
  Ban,
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Product, Customer, CashierShift } from "@/types";
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
  const { currentUser } = useAuthStore();

  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);

  // Cart & Orders (Persisted in localStorage across refreshes)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("happymart_pos_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [heldOrders, setHeldOrders] = useState<{ id: string; timestamp: string; items: CartItem[]; customer: Customer | null }[]>(() => {
    try {
      const saved = localStorage.getItem("happymart_pos_held_orders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save cart and held orders to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("happymart_pos_cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem("happymart_pos_held_orders", JSON.stringify(heldOrders));
    } catch {}
  }, [heldOrders]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [orderNumber, setOrderNumber] = useState<number>(1001);
  const [activeBillKey, setActiveBillKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("happymart_pos_active_bill_key");
      if (saved) return saved;
      const newKey = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `bill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("happymart_pos_active_bill_key", newKey);
      return newKey;
    }
    return `bill_${Date.now()}`;
  });

  // Barcode search input
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Payment & Numpad State
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "promptpay" | "card" | "transfer">("cash");
  const [tenderedInput, setTenderedInput] = useState<string>("");
  const [promptPayQR, setPromptPayQR] = useState<{ qrDataUrl: string; fallbackUrl: string } | null>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [mobileTab, setMobileTab] = useState<"cart" | "checkout">("cart");

  // Modals
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState<string>("1000");
  const [closingCashInput, setClosingCashInput] = useState<string>("");
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [showRecentSalesModal, setShowRecentSalesModal] = useState(false);

  // Recent Sales & Void / Edit State
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<{ id: string; items: any[] } | null>(null);
  const [saleDetailLoading, setSaleDetailLoading] = useState(false);
  const [voidConfirmSale, setVoidConfirmSale] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState<string>("ลูกค้าเปลี่ยนใจ / คืนสินค้า");
  const [isVoiding, setIsVoiding] = useState(false);
  const [searchRecentSales, setSearchRecentSales] = useState("");

  const handleViewSaleDetail = async (sale: any) => {
    if (selectedSaleDetail?.id === sale.id) {
      setSelectedSaleDetail(null);
      return;
    }
    setSaleDetailLoading(true);
    try {
      const res = await api.getSale(sale.id);
      setSelectedSaleDetail({ id: sale.id, items: res.items || [] });
    } catch (err) {
      console.error("Failed to load sale items", err);
    } finally {
      setSaleDetailLoading(false);
    }
  };

  const handleVoidSale = async (sale: any, reason: string) => {
    if (!reason.trim()) {
      alert("กรุณาระบุเหตุผลในการยกเลิกบิล");
      return;
    }
    setIsVoiding(true);
    try {
      const res = await api.voidSale(sale.id, { reason: reason.trim() });
      if (res.success) {
        alert(`ยกเลิกบิล ${sale.invoice_no} เรียบร้อยแล้ว สต๊อกสินค้าถูกคืนเข้าสู่ระบบ`);
        setVoidConfirmSale(null);
        setVoidReason("ลูกค้าเปลี่ยนใจ / คืนสินค้า");
        loadData();
      } else {
        alert(res.message || "ไม่สามารถยกเลิกบิลได้");
      }
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการยกเลิกบิล");
    } finally {
      setIsVoiding(false);
    }
  };

  const handleEditBill = async (sale: any) => {
    if (cart.length > 0) {
      const confirmOverwrite = window.confirm(
        "มีรายการสินค้าอยู่ในตะกร้าปัจจุบัน หากดึงบิลนี้มาแก้ไข รายการในตะกร้าปัจจุบันจะถูกแทนที่ ต้องการดำเนินการต่อหรือไม่?"
      );
      if (!confirmOverwrite) return;
    }

    const confirmVoidAndEdit = window.confirm(
      `ต้องการยกเลิกบิล ${sale.invoice_no} และดึงรายการสินค้ากลับมาแก้ไขในตะกร้า POS หรือไม่?\n\n(ระบบจะทำการคืนสต๊อกของบิลเดิมอัตโนมัติ เพื่อให้ท่านปรับแก้จำนวนหรือเพิ่มลดสินค้าและคิดเงินใหม่)`
    );
    if (!confirmVoidAndEdit) return;

    setIsVoiding(true);
    try {
      // 1. Fetch item details of the bill
      const detailRes = await api.getSale(sale.id);
      const items = detailRes.items || [];

      // 2. Void original bill
      await api.voidSale(sale.id, { reason: "ดึงบิลกลับมาแก้ไข (Void & Edit to Cart)" });

      // 3. Map items to Cart
      const newCart: CartItem[] = items.map((it: any) => {
        const matchedProd = products.find((p) => p.id === it.product_id) || {
          id: it.product_id,
          sku: it.barcode || "",
          barcode: it.barcode || "",
          name: it.product_name,
          unit: it.unit || "ชิ้น",
          selling_price: Number(it.unit_price),
          cost_price: Number(it.cost_price) || 0,
          current_stock: 999,
          min_stock: 0,
          max_stock: 999,
          category_id: "",
          is_vat: 1,
          is_active: 1,
        };
        return {
          product: matchedProd as Product,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          discount: Number(it.discount_amount) || 0,
          subtotal: Number(it.subtotal),
        };
      });

      setCart(newCart);
      setCustomDiscount(Number(sale.discount_amount) || 0);

      if (sale.customer_id) {
        const matchedCust = customers.find((c) => c.id === sale.customer_id);
        if (matchedCust) setSelectedCustomer(matchedCust);
      }

      setShowRecentSalesModal(false);
      setVoidConfirmSale(null);
      loadData();
      alert(`ดึงรายการสินค้าจากบิล ${sale.invoice_no} มายังตะกร้าเรียบร้อยแล้ว สามารถแก้ไขและคิดเงินใหม่ได้ทันที`);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการดึงบิลมาแก้ไข");
    } finally {
      setIsVoiding(false);
    }
  };

  // Audio beep for barcode scan
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (_) {}
  };

  // Load Data
  const loadData = async () => {
    try {
      const [prodRes, shiftRes, custRes, storeRes, salesRes] = await Promise.all([
        api.getProducts(),
        api.getActiveShift(currentUser?.id),
        api.getCustomers(),
        api.getStoreProfile(),
        api.getSales(),
      ]);

      setProducts(prodRes.data || []);
      setActiveShift(shiftRes.shift || null);
      setCustomers(custRes.data || []);
      setStoreProfile(storeRes.data || null);
      setRecentSales(salesRes.data || []);
      setOrderNumber(Math.floor(1000 + Math.random() * 9000));
    } catch (err) {
      console.error("Error loading POS", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Keep barcode input focused for physical USB / Bluetooth scanners
  useEffect(() => {
    barcodeRef.current?.focus();
  }, [cart, paymentMethod]);

  // Calculations
  const rawSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const memberDiscount = selectedCustomer ? (rawSubtotal * (selectedCustomer.discount_pct || 0)) / 100 : 0;
  const totalDiscount = memberDiscount + customDiscount;
  const grandTotal = Math.max(0, rawSubtotal - totalDiscount);
  const vatRate = storeProfile?.vat_rate || 7.0;
  const vatAmount = (grandTotal * vatRate) / (100 + vatRate);

  const tenderedNumber = Number(tenderedInput) || 0;
  const changeDue = Math.max(0, tenderedNumber - grandTotal);
  const isSufficient = tenderedNumber >= grandTotal;

  // Add product to cart
  const addProductToCart = (p: Product) => {
    playBeep();
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === p.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === p.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        );
      }
      return [
        ...prev,
        {
          product: p,
          quantity: 1,
          unit_price: p.selling_price,
          discount: 0,
          subtotal: p.selling_price,
        },
      ];
    });
  };

  // Barcode Submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    const matched = products.find(
      (p) =>
        p.barcode.toLowerCase() === query.toLowerCase() ||
        p.sku.toLowerCase() === query.toLowerCase() ||
        p.name.toLowerCase().includes(query.toLowerCase())
    );

    if (matched) {
      addProductToCart(matched);
      setBarcodeInput("");
    } else {
      alert(`ไม่พบสินค้าสำหรับบาร์โค้ด: ${query}`);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? { ...item, quantity: newQty, subtotal: newQty * item.unit_price }
              : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // Numpad handlers
  const handleNumpadPress = (val: string) => {
    if (val === "C") {
      setTenderedInput("");
    } else if (val === "BACK") {
      setTenderedInput((prev) => prev.slice(0, -1));
    } else if (val === ".") {
      if (!tenderedInput.includes(".")) {
        setTenderedInput((prev) => (prev ? prev + "." : "0."));
      }
    } else {
      setTenderedInput((prev) => prev + val);
    }
  };

  const handleAddDenomination = (amount: number) => {
    const current = Number(tenderedInput) || 0;
    setTenderedInput((current + amount).toString());
  };

  const handleExactCash = () => {
    setTenderedInput(grandTotal.toFixed(2));
  };

  // PromptPay QR Generation (Only when storeProfile has a configured promptpay_id)
  useEffect(() => {
    if (paymentMethod === "promptpay" && grandTotal > 0) {
      if (storeProfile?.promptpay_id && storeProfile.promptpay_id.trim() !== "") {
        generatePromptPayQR(storeProfile.promptpay_id.trim(), grandTotal).then((res) => {
          setPromptPayQR(res);
        });
      } else {
        setPromptPayQR(null);
      }
    }
  }, [paymentMethod, grandTotal, storeProfile]);

  const resetActiveBill = () => {
    setCart([]);
    setSelectedCustomer(null);
    setTenderedInput("");
    setCustomDiscount(0);
    const newKey = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `bill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    if (typeof window !== "undefined") {
      localStorage.setItem("happymart_pos_active_bill_key", newKey);
    }
    setActiveBillKey(newKey);
  };

  // Hold & Resume Orders
  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString("th-TH"),
      items: [...cart],
      customer: selectedCustomer,
    };
    setHeldOrders((prev) => [...prev, newHold]);
    resetActiveBill();
    alert(`พักบิลชั่วคราวเรียบร้อยแล้ว (${newHold.id})`);
  };

  const handleResumeOrder = (hold: any) => {
    setCart(hold.items);
    setSelectedCustomer(hold.customer);
    setHeldOrders((prev) => prev.filter((h) => h.id !== hold.id));
    setShowHeldModal(false);
  };

  // Checkout (Atomic Cloudflare D1 Deduction)
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert("กรุณาสแกนสินค้าก่อนชำระเงิน");
      return;
    }
    if (paymentMethod === "cash" && tenderedNumber < grandTotal) {
      alert("ยอดเงินที่รับมาไม่เพียงพอกับยอดชำระ");
      return;
    }

    setIsProcessingCheckout(true);
    try {
      const checkoutData = {
        shift_id: activeShift?.id || null,
        customer_id: selectedCustomer?.id || null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        custom_discount: customDiscount,
        payment_method: paymentMethod,
        received_amount: paymentMethod === "cash" ? tenderedNumber : grandTotal,
        idempotency_key: activeBillKey,
      };

      const res = await api.checkout(checkoutData, activeBillKey);

      setCompletedSale({
        ...res.sale,
        items: res.items || cart,
        change_amount: res.sale?.change_amount ?? (paymentMethod === "cash" ? Math.max(0, tenderedNumber - grandTotal) : 0),
        customer_name: selectedCustomer?.name,
      });

      // Clear current bill and generate fresh bill idempotency key for next transaction
      resetActiveBill();
      setOrderNumber((prev) => prev + 1);

      // Reload products stock & recent sales
      loadData();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการบันทึกการขาย");
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Thermal Slip Printing (Strict Rule #2 - Isolated Hidden Iframe)
  const handlePrintSlip = (saleData: any) => {
    const sale = saleData || completedSale;
    if (!sale) return;

    const receiptHtml = `
      <div class="receipt-center">
        <h2 style="margin: 0; font-size: 16px;">${storeProfile?.store_name || "HappyMart Supermarket"}</h2>
        <p style="margin: 2px 0;">${storeProfile?.branch_name || "สาขาหลัก 00000"}</p>
        <p style="margin: 2px 0;">โทร: ${storeProfile?.phone || "02-888-9999"}</p>
        <p style="margin: 2px 0;">TAX: ${storeProfile?.tax_id || "0105562089123"}</p>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-center receipt-bold">ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ</div>
      <div class="receipt-divider"></div>
      <table>
        <tr><td>เลขที่บิล:</td><td class="receipt-right">${sale.invoice_no}</td></tr>
        <tr><td>วันที่:</td><td class="receipt-right">${new Date(sale.created_at || Date.now()).toLocaleString("th-TH")}</td></tr>
        <tr><td>แคชเชียร์:</td><td class="receipt-right">${currentUser?.full_name || "Cashier"}</td></tr>
        <tr><td>ลูกค้า:</td><td class="receipt-right">${sale.customer_name || "ลูกค้าทั่วไป"}</td></tr>
      </table>
      <div class="receipt-divider"></div>
      <table>
        <tr class="receipt-bold"><td>รายการ</td><td class="receipt-right">จำนวน</td><td class="receipt-right">รวม</td></tr>
        ${(sale.items || [])
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
        <tr><td>รวมเป็นเงิน:</td><td class="receipt-right">${Number(sale.subtotal).toFixed(2)} บาท</td></tr>
        ${
          Number(sale.discount_amount) > 0
            ? `<tr><td>ส่วนลด:</td><td class="receipt-right">-${Number(sale.discount_amount).toFixed(2)} บาท</td></tr>`
            : ""
        }
        <tr class="receipt-bold" style="font-size: 14px;">
          <td>ยอดชำระสุทธิ:</td>
          <td class="receipt-right">${Number(sale.grand_total).toFixed(2)} บาท</td>
        </tr>
        <tr><td>ชำระด้วย:</td><td class="receipt-right">${sale.payment_method?.toUpperCase()}</td></tr>
        <tr><td>รับเงินมา:</td><td class="receipt-right">${Number(sale.received_amount).toFixed(2)} บาท</td></tr>
        <tr><td>เงินทอน:</td><td class="receipt-right">${Number(sale.change_amount).toFixed(2)} บาท</td></tr>
      </table>
      <div class="receipt-divider"></div>
      <div class="receipt-center" style="font-size: 11px;">
        (ราคารวมภาษีมูลค่าเพิ่ม 7% แล้ว ${Number(sale.vat_amount || 0).toFixed(2)} บาท)
      </div>
      <div class="receipt-double-divider"></div>
      <div class="receipt-center" style="font-size: 11px; white-space: pre-line;">
        ${storeProfile?.receipt_footer || "ขอบพระคุณที่ใช้บริการ\nกรุณาตรวจสอบสินค้าก่อนออกจากร้าน"}
      </div>
    `;

    printReceiptIsolated(receiptHtml, `Receipt-${sale.invoice_no}`);
  };

  // Open/Close Shift Handlers
  const handleOpenShift = async () => {
    try {
      const res = await api.openShift({
        cashier_id: currentUser?.id,
        cashier_name: currentUser?.full_name,
        opening_cash: Number(openingCashInput) || 0,
      });
      setActiveShift(res.shift);
      setIsShiftModalOpen(false);
    } catch (err: any) {
      alert(err.message || "เปิดกะไม่สำเร็จ");
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      await api.closeShift({
        shift_id: activeShift.id,
        actual_cash: Number(closingCashInput) || 0,
      });
      setActiveShift(null);
      setIsShiftModalOpen(false);
      alert("ปิดกะและกระทบยอดเงินสดเรียบร้อยแล้ว");
    } catch (err: any) {
      alert(err.message || "ปิดกะไม่สำเร็จ");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-100 overflow-hidden font-sarabun select-none">
      {/* ======================================================== */}
      {/* TOP SCANNER & STATUS BAR */}
      {/* ======================================================== */}
      <div className="h-14 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-4 flex items-center justify-between text-white shadow-md z-20 shrink-0">
        {/* Left: Barcode Scan Field */}
        <form onSubmit={handleBarcodeSubmit} className="flex-1 max-w-xl relative flex items-center">
          <Barcode className="w-5 h-5 text-white/80 absolute left-3 pointer-events-none" />
          <input
            ref={barcodeRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="สแกนบาร์โค้ด หรือพิมพ์รหัส/ชื่อสินค้า แล้วกด Enter..."
            className="w-full pl-10 pr-24 py-2 bg-white/20 border border-white/30 rounded-xl text-white placeholder:text-white/60 text-sm font-semibold focus:outline-none focus:bg-white focus:text-slate-900 focus:ring-2 focus:ring-blue-300 transition-all shadow-inner"
          />
          <button
            type="submit"
            className="absolute right-1.5 px-3 py-1 bg-white text-blue-700 text-xs font-bold rounded-lg shadow-sm hover:bg-blue-50 transition-all"
          >
            ค้นหา
          </button>
        </form>

        {/* Right: Cashier, Shift Status & Quick Member */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMemberModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-all"
          >
            <User className="w-4 h-4 text-amber-300" />
            <span>
              {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.membership_tier} -${selectedCustomer.discount_pct}%)` : "เลือกลูกค้าสมาชิก"}
            </span>
          </button>

          {activeShift ? (
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white shadow-sm transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>กะ: {activeShift.shift_code}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white shadow-sm transition-all"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>คลิกเพื่อเปิดกะขาย</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MOBILE TAB SWITCHER (< md) */}
      {/* ======================================================== */}
      <div className="flex md:hidden bg-slate-100 p-1.5 border-b border-slate-200 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab("cart")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "cart"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>ตะกร้า ({cart.reduce((s, i) => s + i.quantity, 0)} ชิ้น)</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("checkout")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "checkout"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>คิดเงิน (฿{grandTotal.toFixed(2)})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* MAIN TWO-COLUMN WORKSPACE (Responsive Dual-Pane) */}
      {/* ======================================================== */}
      <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
        {/* ======================================================== */}
        {/* LEFT COLUMN: SCANNED CART & RECEIPT LIST (50% on desktop/tablet, 100% on mobile) */}
        {/* Large readable text for cashiers */}
        {/* ======================================================== */}
        <div
          className={`w-full md:w-1/2 bg-white flex-col h-full border-r-2 border-slate-300 shadow-sm ${
            mobileTab === "cart" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Cart Header */}
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div>
              <span className="text-xs font-bold text-slate-500">แคชเชียร์ 01 • สาขาหลัก</span>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Order# {orderNumber}</span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {heldOrders.length > 0 && (
                <button
                  onClick={() => setShowHeldModal(true)}
                  className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-700 text-xs font-bold flex items-center gap-1"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>พักไว้ ({heldOrders.length})</span>
                </button>
              )}
              {cart.length > 0 && (
                <button
                  onClick={resetActiveBill}
                  className="px-2.5 py-1 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all"
                >
                  ล้างบิล (Clear)
                </button>
              )}
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 px-5 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600">
            <span className="col-span-6">รายการสินค้า (Name)</span>
            <span className="col-span-2 text-center">จำนวน (Qty)</span>
            <span className="col-span-2 text-right">ราคา (Each)</span>
            <span className="col-span-2 text-right">รวม (Total)</span>
          </div>

          {/* Scanned Items List (Large readable font) */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="grid grid-cols-12 items-center p-2.5 rounded-xl bg-white hover:bg-blue-50/40 border border-slate-100 text-slate-900 transition-all group"
              >
                {/* Name & Barcode */}
                <div className="col-span-6 pr-2">
                  <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                    {item.product.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>{item.product.barcode}</span>
                    <span>• {item.product.unit}</span>
                  </div>
                </div>

                {/* Qty +/- Controls */}
                <div className="col-span-2 flex items-center justify-center gap-1">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center shadow-sm"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-7 text-center text-sm font-black text-slate-900">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Unit Price */}
                <div className="col-span-2 text-right text-xs font-semibold text-slate-600">
                  ฿{item.unit_price.toFixed(2)}
                </div>

                {/* Line Total */}
                <div className="col-span-2 text-right font-black text-sm text-slate-900 flex items-center justify-end gap-2">
                  <span>฿{item.subtotal.toFixed(2)}</span>
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
                <Barcode className="w-16 h-16 stroke-1 text-slate-300 mb-2" />
                <span className="font-bold">รอการสแกนบาร์โค้ดสินค้า</span>
                <span className="text-xs text-slate-400 mt-1">ใช้เครื่องสแกนบาร์โค้ด หรือพิมพ์รหัสที่แถบด้านบน</span>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* LEFT BOTTOM: BIG SUMMARY & ACTION BUTTONS */}
          {/* ======================================================== */}
          <div className="p-4 bg-slate-50 border-t-2 border-slate-200 space-y-2">
            {/* Small stats rows */}
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>ยอดรวมสินค้า:</span>
                <span className="font-bold">฿{rawSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>ภาษี (VAT 7% รวมแล้ว):</span>
                <span className="font-semibold text-slate-500">฿{vatAmount.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>ส่วนลดรวม:</span>
                  <span>-฿{totalDiscount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* GIANT TOTAL BOX (อ่านง่าย ชัดเจน ตรงตามที่ขอ) */}
            <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  ยอดสุทธิที่ต้องชำระ (TOTAL)
                </span>
                <span className="text-sm font-semibold text-slate-600">
                  {cart.reduce((s, i) => s + i.quantity, 0)} รายการ
                </span>
              </div>
              <div className="text-4xl font-black text-blue-700 tracking-tight">
                ฿{grandTotal.toFixed(2)}
              </div>
            </div>

            {/* Quick Action Ribbon */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={handleHoldOrder}
                disabled={cart.length === 0}
                className="py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs text-slate-700 flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
              >
                <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>พักบิล (Hold)</span>
              </button>

              <button
                onClick={() => setShowMemberModal(true)}
                className="py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs text-slate-700 flex items-center justify-center gap-1 shadow-sm"
              >
                <Percent className="w-3.5 h-3.5 text-indigo-500" />
                <span>ส่วนลด/สมาชิก</span>
              </button>

              <button
                onClick={() => {
                  setShowRecentSalesModal(true);
                  loadData();
                }}
                className="py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 font-bold text-xs text-blue-700 flex items-center justify-center gap-1 shadow-sm transition-all"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>บิลล่าสุด / จัดการ</span>
              </button>

              <button
                onClick={resetActiveBill}
                disabled={cart.length === 0}
                className="py-2 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 font-bold text-xs text-rose-700 flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยกเลิกบิล</span>
              </button>
            </div>

            {/* Mobile Jump to Payment button (< md) */}
            <div className="p-3 pt-0 md:hidden">
              <button
                onClick={() => setMobileTab("checkout")}
                disabled={cart.length === 0}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>ไปที่หน้าชำระเงิน (฿{grandTotal.toFixed(2)})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: NUMPAD, TENDERED CASH & PAYMENT (Responsive) */}
        {/* Exactly styled after Revel iPad POS layout */}
        {/* ======================================================== */}
        <div
          className={`w-full md:w-1/2 bg-slate-50 flex-col h-full p-3 sm:p-4 justify-between overflow-y-auto ${
            mobileTab === "checkout" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Top 3 Stat Displays */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {/* Balance Due */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 block">Balance Due (ยอดชำระ)</span>
              <div className="text-xl font-black text-blue-700 mt-0.5 truncate">
                ฿{grandTotal.toFixed(2)}
              </div>
            </div>

            {/* Amount Tendered (รับเงินมา) */}
            <div className="bg-white p-3 rounded-2xl border-2 border-blue-500 shadow-sm relative">
              <span className="text-[11px] font-bold text-blue-600 block">Amount Tendered (รับมา)</span>
              <div className="text-xl font-black text-slate-900 mt-0.5 truncate">
                {tenderedInput ? `฿${Number(tenderedInput).toFixed(2)}` : "฿0.00"}
              </div>
            </div>

            {/* Change Due (เงินทอน) */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 block">Change (เงินทอน)</span>
              <div
                className={`text-xl font-black mt-0.5 truncate ${
                  isSufficient && tenderedNumber > 0 ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                ฿{changeDue.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Payment Method Selector Bar */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <button
              onClick={() => setPaymentMethod("cash")}
              className={`py-2 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                paymentMethod === "cash"
                  ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/20"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Banknote className="w-4 h-4 text-emerald-500" />
              <span>เงินสด (Cash)</span>
            </button>

            <button
              onClick={() => setPaymentMethod("promptpay")}
              className={`py-2 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                paymentMethod === "promptpay"
                  ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/20"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <QrCode className="w-4 h-4 text-blue-400" />
              <span>พร้อมเพย์ QR</span>
            </button>

            <button
              onClick={() => setPaymentMethod("card")}
              className={`py-2 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                paymentMethod === "card"
                  ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/20"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>บัตรเครดิต</span>
            </button>

            <button
              onClick={() => setPaymentMethod("transfer")}
              className={`py-2 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                paymentMethod === "transfer"
                  ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/20"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Coins className="w-4 h-4 text-amber-500" />
              <span>โอนเงิน</span>
            </button>
          </div>

          {/* Interactive Middle Area: Numpad OR PromptPay QR */}
          {paymentMethod === "promptpay" ? (
            /* PromptPay Instant QR Display (Rule #3) */
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col items-center justify-center mb-3">
              <span className="text-xs font-bold text-slate-700 mb-2">
                สแกนจ่ายผ่าน PromptPay QR (Instant Render)
              </span>
              {storeProfile?.promptpay_id ? (
                promptPayQR?.qrDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl border-2 border-blue-100 shadow-inner">
                    <img src={promptPayQR.qrDataUrl} alt="PromptPay" className="w-44 h-44" />
                  </div>
                ) : (
                  <div className="w-44 h-44 bg-slate-100 rounded-2xl animate-pulse" />
                )
              ) : (
                <div className="p-6 text-center text-xs text-amber-700 bg-amber-50 rounded-2xl border border-amber-200">
                  <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                  ยังไม่ได้กำหนดเลขพร้อมเพย์ร้านค้า กรุณาระบุในเมนู "ตั้งค่าระบบ &gt; ข้อมูลร้านค้า"
                </div>
              )}
              <div className="mt-2 text-2xl font-black text-blue-700">
                ฿{grandTotal.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5">
                {storeProfile?.promptpay_id ? `พร้อมเพย์ร้านค้า: ${storeProfile.promptpay_id}` : "รอการตั้งค่า"}
              </span>
            </div>
          ) : (
            /* Large Touch Numpad & Quick Denomination Buttons */
            <div className="grid grid-cols-4 gap-2 mb-3">
              {/* Row 1 */}
              {["7", "8", "9"].map((n) => (
                <button
                  key={n}
                  onClick={() => handleNumpadPress(n)}
                  className="h-14 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-2xl font-bold text-slate-800 shadow-sm transition-all"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => handleAddDenomination(50)}
                className="h-14 rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-black text-base shadow-sm transition-all flex flex-col items-center justify-center leading-none"
              >
                <span>+฿50</span>
              </button>

              {/* Row 2 */}
              {["4", "5", "6"].map((n) => (
                <button
                  key={n}
                  onClick={() => handleNumpadPress(n)}
                  className="h-14 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-2xl font-bold text-slate-800 shadow-sm transition-all"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => handleAddDenomination(100)}
                className="h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-black text-base shadow-sm transition-all flex flex-col items-center justify-center leading-none"
              >
                <span>+฿100</span>
              </button>

              {/* Row 3 */}
              {["1", "2", "3"].map((n) => (
                <button
                  key={n}
                  onClick={() => handleNumpadPress(n)}
                  className="h-14 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-2xl font-bold text-slate-800 shadow-sm transition-all"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => handleAddDenomination(500)}
                className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-base shadow-sm transition-all flex flex-col items-center justify-center leading-none"
              >
                <span>+฿500</span>
              </button>

              {/* Row 4 */}
              <button
                onClick={() => handleNumpadPress("C")}
                className="h-14 rounded-2xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 font-black text-xl shadow-sm transition-all"
              >
                C
              </button>
              <button
                onClick={() => handleNumpadPress("0")}
                className="h-14 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-2xl font-bold text-slate-800 shadow-sm transition-all"
              >
                0
              </button>
              <button
                onClick={() => handleNumpadPress(".")}
                className="h-14 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-2xl font-bold text-slate-800 shadow-sm transition-all"
              >
                .
              </button>
              <button
                onClick={() => handleAddDenomination(1000)}
                className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-black text-base shadow-sm transition-all flex flex-col items-center justify-center leading-none"
              >
                <span>+฿1,000</span>
              </button>

              {/* Row 5: Backspace & Exact Cash */}
              <button
                onClick={() => handleNumpadPress("BACK")}
                className="col-span-2 h-12 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm shadow-sm flex items-center justify-center gap-1"
              >
                <Delete className="w-4 h-4" />
                <span>ลบ (Backspace)</span>
              </button>

              <button
                onClick={handleExactCash}
                className="col-span-2 h-12 rounded-2xl bg-emerald-50 border-2 border-emerald-500 hover:bg-emerald-100 text-emerald-800 font-black text-sm shadow-sm"
              >
                จ่ายพอดี (Exact ฿{grandTotal.toFixed(2)})
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* BIG "DONE" CHECKOUT BUTTON */}
          {/* ======================================================== */}
          <button
            disabled={cart.length === 0 || isProcessingCheckout || (paymentMethod === "cash" && !isSufficient)}
            onClick={handleCompleteSale}
            className={`w-full py-4 rounded-3xl font-black text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${
              cart.length > 0 && !isProcessingCheckout && (paymentMethod !== "cash" || isSufficient)
                ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-blue-500/25 active:scale-[0.99]"
                : "bg-slate-300 text-slate-500 cursor-not-allowed"
            }`}
          >
            <span>
              {isProcessingCheckout
                ? "กำลังบันทึกและตัดสต๊อก..."
                : `ยืนยันชำระเงิน (DONE) • ฿${grandTotal.toFixed(2)}`}
            </span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: SUCCESS & THERMAL RECEIPT PRINT (ISOLATED ENGINE) */}
      {/* ======================================================== */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-modal border border-slate-200 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900">การขายเสร็จสมบูรณ์</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              เลขที่บิล: <span className="font-mono font-bold text-slate-800">{completedSale.invoice_no}</span>
            </p>

            <div className="my-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">ยอดชำระ:</span>
                <span className="font-bold text-slate-800">฿{Number(completedSale.grand_total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">รับเงินมา:</span>
                <span className="font-semibold text-slate-700">฿{Number(completedSale.received_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-700">เงินทอน (Change):</span>
                <span className="text-base font-black text-emerald-600">
                  ฿{Number(completedSale.change_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handlePrintSlip(completedSale)}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์สลิปใบเสร็จ (Isolated Engine)</span>
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="w-full py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
              >
                เริ่มบิลถัดไป (Next Order)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: HELD ORDERS */}
      {/* ======================================================== */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-modal border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">รายการบิลที่พักไว้ (Held Orders)</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {heldOrders.map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600">{h.id}</span>
                    <span className="text-xs text-slate-500 block">
                      เวลา {h.timestamp} • {h.items.length} รายการ
                    </span>
                  </div>
                  <button
                    onClick={() => handleResumeOrder(h)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm"
                  >
                    เรียกคืนบิล
                  </button>
                </div>
              ))}
              {heldOrders.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">ไม่มีบิลที่พักไว้</div>
              )}
            </div>
            <button
              onClick={() => setShowHeldModal(false)}
              className="mt-4 w-full py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RECENT SALES (VIEW, REPRINT, EDIT, VOID) */}
      {/* ======================================================== */}
      {showRecentSalesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-modal border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">รายการขายล่าสุด & จัดการบิล</h3>
                  <p className="text-[11px] text-slate-500">พิมพ์สลิปซ้ำ แก้ไขรายการ หรือยกเลิกบิลเพื่อคืนสต๊อก</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRecentSalesModal(false);
                  setSelectedSaleDetail(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Search */}
            <div className="pt-3 pb-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขที่บิล (เช่น INV-...) หรือชื่อพนักงาน..."
                  value={searchRecentSales}
                  onChange={(e) => setSearchRecentSales(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Sales List */}
            <div className="space-y-3 overflow-y-auto pr-1 flex-1 py-2">
              {recentSales
                .filter((s) => {
                  if (!searchRecentSales.trim()) return true;
                  const term = searchRecentSales.toLowerCase();
                  return (
                    s.invoice_no?.toLowerCase().includes(term) ||
                    s.cashier_name?.toLowerCase().includes(term) ||
                    s.customer_name?.toLowerCase().includes(term)
                  );
                })
                .slice(0, 20)
                .map((s) => {
                  const isVoided = s.status === "voided";
                  const isExpanded = selectedSaleDetail?.id === s.id;

                  return (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isVoided
                          ? "bg-rose-50/40 border-rose-200"
                          : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      {/* Top Bar of Sale Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-blue-600">{s.invoice_no}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isVoided
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {isVoided ? "ยกเลิกแล้ว" : "สำเร็จ"}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {s.payment_method === "cash"
                                ? "เงินสด"
                                : s.payment_method === "promptpay"
                                ? "พร้อมเพย์"
                                : s.payment_method === "card"
                                ? "บัตร"
                                : "โอน"}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {new Date(s.created_at).toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              น.
                            </span>
                            <span>•</span>
                            <span>แคชเชียร์: {s.cashier_name || "พนักงาน"}</span>
                            {s.customer_name && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600 font-medium">ลูกค้า: {s.customer_name}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="text-right flex flex-col items-end">
                          <span
                            className={`text-base font-black tracking-tight ${
                              isVoided ? "text-slate-400 line-through" : "text-slate-900"
                            }`}
                          >
                            ฿{Number(s.grand_total).toFixed(2)}
                          </span>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1.5 mt-2">
                            {/* View detail button */}
                            <button
                              onClick={() => handleViewSaleDetail(s)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center gap-1 transition-colors"
                              title="ดูรายการสินค้า"
                            >
                              <Eye className="w-3 h-3 text-slate-500" />
                              <span>{isExpanded ? "ซ่อน" : "สินค้า"}</span>
                            </button>

                            {/* Reprint button */}
                            <button
                              onClick={() => handlePrintSlip(s)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                              title="พิมพ์สลิปใบเสร็จ"
                            >
                              <Printer className="w-3 h-3" />
                              <span>พิมพ์</span>
                            </button>

                            {/* Edit bill button */}
                            {!isVoided && (
                              <button
                                onClick={() => handleEditBill(s)}
                                disabled={isVoiding}
                                className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                                title="ดึงบิลกลับมาแก้ไขในตะกร้า"
                              >
                                <Edit3 className="w-3 h-3 text-amber-600" />
                                <span>แก้ไขบิล</span>
                              </button>
                            )}

                            {/* Void bill button */}
                            {!isVoided && (
                              <button
                                onClick={() => setVoidConfirmSale(s)}
                                disabled={isVoiding}
                                className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                                title="ยกเลิกบิลและคืนสต๊อก"
                              >
                                <Ban className="w-3 h-3" />
                                <span>ยกเลิกบิล</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Void Reason Notice */}
                      {isVoided && (
                        <div className="mt-2.5 pt-2 border-t border-rose-100 text-[11px] text-rose-700 flex items-center justify-between">
                          <span>
                            <strong>เหตุผลที่ยกเลิก:</strong> {s.void_reason || "ลูกค้ายกเลิก/คืนสินค้า"}
                          </span>
                          <span className="text-[10px] text-rose-500">
                            อนุมัติโดย: {s.void_approved_by || "-"}
                          </span>
                        </div>
                      )}

                      {/* Expanded Items Table */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in">
                          <h4 className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-blue-500" /> รายการสินค้าในบิล
                          </h4>
                          {saleDetailLoading ? (
                            <div className="py-3 text-center text-xs text-slate-400">กำลังโหลดรายการ...</div>
                          ) : (
                            <div className="bg-slate-50/80 rounded-xl p-2 space-y-1 text-xs">
                              {selectedSaleDetail?.items.map((it: any) => (
                                <div key={it.id} className="flex justify-between items-center text-[11px]">
                                  <span className="font-medium text-slate-700">
                                    {it.product_name}{" "}
                                    <span className="text-slate-400 font-mono text-[10px]">
                                      x{it.quantity} {it.unit || "ชิ้น"}
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-slate-900">
                                    ฿{Number(it.subtotal).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {recentSales.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">ยังไม่มีรายการขายในระบบ</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setShowRecentSalesModal(false);
                  setSelectedSaleDetail(null);
                }}
                className="px-5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-MODAL: CONFIRM VOID BILL */}
      {/* ======================================================== */}
      {voidConfirmSale && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in zoom-in-95">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-modal border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-slate-900">ยืนยันการยกเลิกบิล</h3>
            <p className="text-xs text-slate-500 mt-1">
              บิลเลขที่ <span className="font-mono font-bold text-blue-600">{voidConfirmSale.invoice_no}</span> • ยอดรวม{" "}
              <span className="font-bold text-slate-900">฿{Number(voidConfirmSale.grand_total).toFixed(2)}</span>
            </p>

            <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
              ⚠️ การยกเลิกบิลจะทำการ <strong>คืนสต๊อกสินค้าทุกชิ้นเข้าสู่ชั้นวาง</strong> และ{" "}
              <strong>ปรับลดยอดเงินในกะแคชเชียร์</strong> อัตโนมัติในระดับฐานข้อมูล
            </div>

            {/* Quick Reason Selector */}
            <div className="mt-3">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">เลือกเหตุผลในการยกเลิกบิล:</label>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {[
                  "ลูกค้าเปลี่ยนใจ / คืนสินค้า",
                  "คิดเงินผิด / สแกนสินค้าซ้ำ",
                  "ลูกค้าเงินไม่พอ / ขอยกเลิก",
                  "สินค้าชำรุด / มีตำหนิ",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setVoidReason(reason)}
                    className={`p-2 rounded-xl text-[10px] font-bold border text-left transition-all ${
                      voidReason === reason
                        ? "bg-rose-50 border-rose-300 text-rose-800 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="ระบุเหตุผลเพิ่มเติม (ถ้ามี)..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setVoidConfirmSale(null)}
                disabled={isVoiding}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={() => handleVoidSale(voidConfirmSale, voidReason)}
                disabled={isVoiding || !voidReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isVoiding ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>ยืนยันยกเลิกบิล</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MEMBER SELECTOR */}
      {/* ======================================================== */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-modal border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">เลือกลูกค้าสมาชิกรับส่วนลด</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setShowMemberModal(false);
                }}
                className={`w-full p-2.5 rounded-2xl border text-left text-xs font-semibold ${
                  !selectedCustomer ? "bg-blue-50 border-blue-300 text-blue-800" : "hover:bg-slate-50"
                }`}
              >
                ลูกค้าทั่วไป (ไม่มีส่วนลดสมาชิก)
              </button>
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setShowMemberModal(false);
                  }}
                  className={`w-full p-2.5 rounded-2xl border text-left text-xs transition-all ${
                    selectedCustomer?.id === c.id
                      ? "bg-blue-50 border-blue-300 text-blue-800 font-bold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold">{c.name}</span>
                    <span className="text-emerald-600 font-bold">ลด {c.discount_pct}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {c.member_code} • {c.phone}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMemberModal(false)}
              className="mt-4 w-full py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SHIFT OPEN/CLOSE */}
      {/* ======================================================== */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-modal border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">จัดการกะขายแคชเชียร์</h3>
            {activeShift ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">รหัสกะ:</span>
                    <span className="font-mono font-bold">{activeShift.shift_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">เงินตั้งต้น:</span>
                    <span className="font-bold">฿{activeShift.opening_cash}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ยอดขายรวม:</span>
                    <span className="font-black text-blue-600">฿{activeShift.total_sales}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    นับเงินสดจริงในลิ้นชัก (บาท)
                  </label>
                  <input
                    type="number"
                    value={closingCashInput}
                    onChange={(e) => setClosingCashInput(e.target.value)}
                    placeholder="ป้อนเงินสดที่นับได้จริง..."
                    className="w-full text-base font-black px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsShiftModalOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleCloseShift}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20"
                  >
                    ปิดกะขาย
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    เงินทอนตั้งต้น (บาท)
                  </label>
                  <input
                    type="number"
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    className="w-full text-base font-black px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsShiftModalOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                  >
                    ยกเลิก
                  </button>
                  <button
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
