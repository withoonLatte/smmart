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

  // Cart & Orders
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldOrders, setHeldOrders] = useState<{ id: string; timestamp: string; items: CartItem[]; customer: Customer | null }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [orderNumber, setOrderNumber] = useState<number>(1001);

  // Barcode search input
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Payment & Numpad State
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "promptpay" | "card" | "transfer">("cash");
  const [tenderedInput, setTenderedInput] = useState<string>("");
  const [promptPayQR, setPromptPayQR] = useState<{ qrDataUrl: string; fallbackUrl: string } | null>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Modals
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState<string>("1000");
  const [closingCashInput, setClosingCashInput] = useState<string>("");
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [showRecentSalesModal, setShowRecentSalesModal] = useState(false);

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

  // PromptPay QR Generation (Instant Client-side Rule #3)
  useEffect(() => {
    if (paymentMethod === "promptpay" && grandTotal > 0) {
      generatePromptPayQR(storeProfile?.promptpay_id || "0812345678", grandTotal).then((res) => {
        setPromptPayQR(res);
      });
    }
  }, [paymentMethod, grandTotal, storeProfile]);

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
    setCart([]);
    setSelectedCustomer(null);
    setTenderedInput("");
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
        received_amount: paymentMethod === "cash" ? tenderedNumber : grandTotal,
        change_amount: paymentMethod === "cash" ? changeDue : 0,
      };

      const res = await api.checkout(checkoutData);

      setCompletedSale({
        ...res.sale,
        items: res.items || cart,
        change_amount: checkoutData.change_amount,
        customer_name: selectedCustomer?.name,
      });

      // Clear current bill
      setCart([]);
      setSelectedCustomer(null);
      setTenderedInput("");
      setCustomDiscount(0);
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
      {/* MAIN TWO-COLUMN WORKSPACE */}
      {/* ======================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ======================================================== */}
        {/* LEFT COLUMN: SCANNED CART & RECEIPT LIST (50% WIDTH) */}
        {/* Large readable text for cashiers */}
        {/* ======================================================== */}
        <div className="w-1/2 bg-white flex flex-col h-full border-r-2 border-slate-300 shadow-sm">
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
                  onClick={() => setCart([])}
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
                onClick={() => setShowRecentSalesModal(true)}
                className="py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs text-slate-700 flex items-center justify-center gap-1 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>พิมพ์สลิปซ้ำ</span>
              </button>

              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="py-2 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 font-bold text-xs text-rose-700 flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยกเลิกบิล</span>
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: NUMPAD, TENDERED CASH & PAYMENT (50% WIDTH) */}
        {/* Exactly styled after Revel iPad POS layout */}
        {/* ======================================================== */}
        <div className="w-1/2 bg-slate-50 flex flex-col h-full p-4 justify-between overflow-y-auto">
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
                สแกนจ่ายผ่าน PromptPay QR (0.01s Instant Client Render)
              </span>
              {promptPayQR?.qrDataUrl ? (
                <div className="p-3 bg-white rounded-2xl border-2 border-blue-100 shadow-inner">
                  <img src={promptPayQR.qrDataUrl} alt="PromptPay" className="w-44 h-44" />
                </div>
              ) : (
                <div className="w-44 h-44 bg-slate-100 rounded-2xl animate-pulse" />
              )}
              <div className="mt-2 text-2xl font-black text-blue-700">
                ฿{grandTotal.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5">
                พร้อมเพย์: {storeProfile?.promptpay_id || "0812345678"}
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
      {/* MODAL: RECENT SALES (REPRINT) */}
      {/* ======================================================== */}
      {showRecentSalesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-modal border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-3">พิมพ์ใบเสร็จย้อนหลัง (Reprint Recent Receipt)</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {recentSales.slice(0, 10).map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-blue-600">{s.invoice_no}</span>
                    <span className="block text-slate-500">
                      {new Date(s.created_at).toLocaleTimeString("th-TH")} • ฿{Number(s.grand_total).toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      handlePrintSlip(s);
                      setShowRecentSalesModal(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-white font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" /> พิมพ์
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowRecentSalesModal(false)}
              className="mt-4 w-full py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ปิดหน้าต่าง
            </button>
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
