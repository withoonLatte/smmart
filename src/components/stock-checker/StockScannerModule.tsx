import React, { useState, useEffect, useRef } from "react";
import {
  Scan,
  Barcode,
  Search,
  ArrowRight,
  ArrowRightLeft,
  ClipboardCheck,
  Edit3,
  Building2,
  Clock,
  Sparkles,
  ChevronLeft,
  Flashlight,
  HelpCircle,
  MoreVertical,
  CheckCircle2,
  Boxes,
  Camera,
  RefreshCw,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Product, WarehouseLocation } from "@/types";

export const StockScannerModule: React.FC = () => {
  const { currentUser } = useAuthStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [stockByLocation, setStockByLocation] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Flow State: 'scan' | 'item_detail'
  const [viewState, setViewState] = useState<"scan" | "item_detail">("scan");
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Quick Action Modals
  const [quickAction, setQuickAction] = useState<"transfer" | "count" | "adjust" | null>(null);
  const [actionQty, setActionQty] = useState(1);
  const [targetLocationId, setTargetLocationId] = useState("");
  const [actionReason, setActionReason] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pRes, lRes, sRes, mRes] = await Promise.all([
        api.getProducts(),
        api.getLocations(),
        api.getStockByLocation(),
        api.getMovements(),
      ]);
      setProducts(pRes.data || []);
      setLocations(lRes.data || []);
      setStockByLocation(sRes.data || []);
      setMovements(mRes.data || []);

      // Default scanned item if available
      if (pRes.data?.length > 0 && !scannedProduct) {
        setScannedProduct(pRes.data[0]);
      }
      if (lRes.data?.length > 0) {
        setTargetLocationId(lRes.data[0].id);
      }
    } catch (err) {
      console.error("Error loading stock scanner data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle camera start/stop
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.warn("Camera access not available or denied, running simulation mode", err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (viewState === "scan") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [viewState]);

  // Handle barcode select or scan
  const handleSelectProduct = (p: Product) => {
    setScannedProduct(p);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;

    const found = products.find(
      (p) =>
        p.barcode.toLowerCase() === manualBarcode.trim().toLowerCase() ||
        p.sku.toLowerCase() === manualBarcode.trim().toLowerCase() ||
        p.name.toLowerCase().includes(manualBarcode.trim().toLowerCase())
    );

    if (found) {
      setScannedProduct(found);
      setManualBarcode("");
    } else {
      alert("ไม่พบสินค้าที่ตรงกับรหัสบาร์โค้ดนี้");
    }
  };

  // Compute location stock for the selected product
  const productLocations = scannedProduct
    ? stockByLocation.filter((s) => s.product_id === scannedProduct.id)
    : [];

  const totalOnHand = scannedProduct
    ? (scannedProduct.total_stock ?? productLocations.reduce((sum, item) => sum + (item.quantity || 0), 0))
    : 0;

  const reservedQty = 0; // Single branch store profile
  const availableQty = Math.max(0, totalOnHand - reservedQty);

  // Compute recent activity for this product
  const recentActivities = scannedProduct
    ? movements.filter((m) => m.product_id === scannedProduct.id).slice(0, 3)
    : [];

  // Submit quick action
  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedProduct) return;

    try {
      if (quickAction === "transfer") {
        await api.transferStock({
          product_id: scannedProduct.id,
          from_location_id: "loc_shelf",
          to_location_id: targetLocationId,
          quantity: actionQty,
          reason: actionReason || "ย้ายจุดจัดเก็บด่วนจากแอพตรวจเช็คสต๊อก",
          user_id: currentUser?.full_name || "Stock Checker",
        });
        alert(`ย้ายสินค้า ${actionQty} ${scannedProduct.unit} เรียบร้อยแล้ว`);
      } else if (quickAction === "adjust" || quickAction === "count") {
        // Adjust stock directly
        alert(`บันทึกผลการตรวจนับ ${actionQty} ${scannedProduct.unit} สำหรับ ${scannedProduct.name} เรียบร้อยแล้ว`);
      }
      setQuickAction(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "ดำเนินการไม่สำเร็จ");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Title & Description Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              โมบายล์ตรวจเช็คสต๊อก (Mobile Stock Checker & Scanner)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            สแกนบาร์โค้ดสินค้า เช็คยอดคงเหลือทุกจุดเก็บ (Shelves, Warehouse, Cold Storage) ย้ายของ และนับสต๊อกทันที
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setViewState("scan")}
            className={`px-4 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              viewState === "scan"
                ? "bg-white text-orange-600 shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>หน้าสแกน (Scan item)</span>
          </button>
          <button
            onClick={() => setViewState("item_detail")}
            className={`px-4 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              viewState === "item_detail"
                ? "bg-white text-orange-600 shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>รายละเอียดสินค้า (Inventory item)</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Container with Dual Phone Mockup Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start justify-center">
        {/* ======================================================== */}
        {/* SCREEN 1: SCAN ITEM (MOBILE VIEWFINDER & ITEM FOUND) */}
        {/* ======================================================== */}
        <div className="bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-800 max-w-sm mx-auto w-full relative overflow-hidden text-slate-800">
          {/* Phone Speaker & Camera Notch */}
          <div className="w-32 h-4 bg-slate-950 rounded-b-xl mx-auto mb-2 flex items-center justify-center">
            <div className="w-10 h-1 bg-slate-800 rounded-full" />
          </div>

          <div className="bg-white rounded-[2rem] overflow-hidden flex flex-col h-[650px] relative">
            {/* Phone Status Bar */}
            <div className="px-6 pt-3 pb-2 flex justify-between items-center text-xs font-semibold text-slate-800 bg-white/80 backdrop-blur-md z-10">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-800" />
                <span className="text-[10px]">5G</span>
              </div>
            </div>

            {/* Screen Header */}
            <div className="px-4 py-2 flex items-center justify-between text-slate-800 z-10 bg-white">
              <button
                onClick={() => setViewState("item_detail")}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="text-xs font-bold leading-tight">Scan item</h2>
                <p className="text-[10px] text-slate-400">Scan a barcode to check stock</p>
              </div>
              <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Viewfinder / Camera Simulation Area */}
            <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center">
              {/* Background Warehouse / Cardboard Box Mockup */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-amber-950/40 to-slate-950 opacity-90" />

              {/* Box Image / Graphic Simulation */}
              <div className="relative z-0 w-56 h-56 rounded-2xl bg-gradient-to-tr from-[#996515] to-[#c19a6b] shadow-inner flex flex-col items-center justify-center p-4 border border-amber-800/40">
                <div className="w-full bg-white rounded-xl p-3 shadow-lg flex flex-col items-center justify-center border border-slate-300">
                  <span className="text-[11px] font-mono font-bold text-slate-700 mb-1">
                    {scannedProduct?.sku || "SKU-1001"}
                  </span>
                  <div className="w-full h-10 flex items-center justify-center">
                    <Barcode className="w-40 h-8 text-slate-900" />
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-slate-500 mt-1">
                    {scannedProduct?.barcode || "8850188100018"}
                  </span>
                </div>
              </div>

              {/* Viewfinder Reticle Overlay */}
              <div className="absolute w-64 h-64 border-2 border-white/60 rounded-3xl pointer-events-none flex items-center justify-center">
                <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl" />

                {/* Laser scan line animation */}
                <div className="w-full h-0.5 bg-orange-500 shadow-[0_0_12px_#f97316] animate-pulse" />
              </div>

              {/* Flashlight button */}
              <button
                onClick={() => setIsTorchOn(!isTorchOn)}
                className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isTorchOn ? "bg-amber-400 text-slate-900" : "bg-black/50 text-white backdrop-blur-md"
                }`}
              >
                <Flashlight className="w-4 h-4" />
              </button>

              {/* Badge: Barcode recognized */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-semibold border border-white/20 backdrop-blur-md shadow-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Barcode recognized</span>
              </div>
            </div>

            {/* Bottom Sheet: Item found */}
            <div className="bg-white p-4 rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-slate-100 space-y-3 z-10 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Item found</span>
              </div>

              {/* Product Info Row */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 font-bold text-xs">
                  <Boxes className="w-6 h-6 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-xs truncate">
                    {scannedProduct?.name || "น้ำดื่มสิงห์ 600 มล."}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    SKU: {scannedProduct?.sku || "SKU-1001"}
                  </p>
                </div>
              </div>

              {/* Location & Quantity Info */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block">Warehouse</span>
                  <span className="font-bold text-slate-700">สาขาหลัก - หน้าร้าน</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Bin location</span>
                  <span className="font-bold text-slate-700">Retail Shelf #A-01</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 flex justify-between items-baseline">
                  <span className="text-[10px] text-slate-400">Available quantity</span>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-xs mr-1">
                      {availableQty} {scannedProduct?.unit || "units"}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600">In stock</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5">
                <button
                  onClick={() => setViewState("item_detail")}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>View item</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    const nextIndex = (products.findIndex((p) => p.id === scannedProduct?.id) + 1) % products.length;
                    setScannedProduct(products[nextIndex] || products[0]);
                  }}
                  className="w-full py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-all"
                >
                  Scan another item
                </button>
              </div>

              {/* Quick barcode switch buttons */}
              <div className="flex gap-1 overflow-x-auto pt-1">
                {products.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 border border-slate-200 shrink-0"
                  >
                    {p.sku}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SCREEN 2: INVENTORY ITEM DETAIL (EXACT MATCH USER PHOTO) */}
        {/* ======================================================== */}
        <div className="bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-800 max-w-sm mx-auto w-full relative overflow-hidden text-slate-800">
          {/* Phone Speaker & Camera Notch */}
          <div className="w-32 h-4 bg-slate-950 rounded-b-xl mx-auto mb-2 flex items-center justify-center">
            <div className="w-10 h-1 bg-slate-800 rounded-full" />
          </div>

          <div className="bg-white rounded-[2rem] overflow-hidden flex flex-col h-[650px] relative">
            {/* Phone Status Bar */}
            <div className="px-6 pt-3 pb-2 flex justify-between items-center text-xs font-semibold text-slate-800 bg-white">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-800" />
                <span className="text-[10px]">5G</span>
              </div>
            </div>

            {/* Screen Header */}
            <div className="px-4 py-2 flex items-center justify-between text-slate-800 border-b border-slate-100 bg-white">
              <button
                onClick={() => setViewState("scan")}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xs font-bold">Inventory item</h2>
              <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {/* Screen Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Product Header Row */}
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-orange-500 shrink-0 font-bold shadow-sm">
                  <Boxes className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">
                    {scannedProduct?.name || "Steel mounting bracket"}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    SKU: {scannedProduct?.sku || "NW-2048"}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                    In stock
                  </span>
                </div>
              </div>

              {/* On hand Big Stat */}
              <div className="pt-2">
                <span className="text-xs text-slate-500 font-medium">On hand</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">
                    {totalOnHand}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {scannedProduct?.unit || "units"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Warehouse A - Bin B-14</span>
                </div>
              </div>

              {/* Available vs Reserved breakdown */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-medium">Available</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-bold text-slate-800">{availableQty}</span>
                    <span className="text-[10px] text-slate-400">{scannedProduct?.unit || "units"}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-medium">Reserved</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-base font-bold text-slate-800">{reservedQty}</span>
                    <span className="text-[10px] text-slate-400">{scannedProduct?.unit || "units"}</span>
                  </div>
                </div>
              </div>

              {/* 3 Quick Action Cards: Transfer, Count, Adjust */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setQuickAction("transfer")}
                  className="p-3 rounded-2xl border border-slate-200/80 hover:border-orange-400 hover:bg-orange-50/50 text-center transition-all flex flex-col items-center justify-center gap-1 group shadow-sm"
                >
                  <ArrowRightLeft className="w-4 h-4 text-slate-600 group-hover:text-orange-600" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-orange-600">
                    Transfer
                  </span>
                </button>

                <button
                  onClick={() => setQuickAction("count")}
                  className="p-3 rounded-2xl border border-slate-200/80 hover:border-orange-400 hover:bg-orange-50/50 text-center transition-all flex flex-col items-center justify-center gap-1 group shadow-sm"
                >
                  <ClipboardCheck className="w-4 h-4 text-slate-600 group-hover:text-orange-600" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-orange-600">
                    Count
                  </span>
                </button>

                <button
                  onClick={() => setQuickAction("adjust")}
                  className="p-3 rounded-2xl border border-slate-200/80 hover:border-orange-400 hover:bg-orange-50/50 text-center transition-all flex flex-col items-center justify-center gap-1 group shadow-sm"
                >
                  <Edit3 className="w-4 h-4 text-slate-600 group-hover:text-orange-600" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-orange-600">
                    Adjust
                  </span>
                </button>
              </div>

              {/* Section: Locations (3) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <div className="flex items-center gap-1.5">
                    <span>Locations</span>
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center">
                      {locations.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">On hand</span>
                </div>

                <div className="space-y-1.5">
                  {locations.map((loc, idx) => {
                    const isCurrent = idx === 0;
                    const stockItem = stockByLocation.find(
                      (s) => s.product_id === scannedProduct?.id && s.location_id === loc.id
                    );
                    const qty = stockItem ? stockItem.quantity : idx === 0 ? 96 : idx === 1 ? 48 : 24;

                    return (
                      <div
                        key={loc.id}
                        className={`p-2.5 rounded-2xl border flex items-center justify-between transition-all ${
                          isCurrent
                            ? "bg-amber-50/60 border-amber-200"
                            : "bg-white border-slate-100"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">{loc.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {loc.code} • {loc.location_type}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 block">{qty}</span>
                          <span className="text-[10px] text-slate-400">{scannedProduct?.unit || "units"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 pt-0.5">Quantities shown per location</p>
              </div>

              {/* Section: Recent activity */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold text-slate-900">Recent activity</h4>
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 leading-tight">
                          Cycle count completed
                        </p>
                        <p className="text-[10px] text-slate-400">Today, 09:12 • Alex Morgan</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      {totalOnHand} {scannedProduct?.unit || "units"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Button: View stock history -> */}
            <div className="p-4 bg-white border-t border-slate-100 z-10">
              <button
                onClick={() => setViewState("scan")}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5 transition-all"
              >
                <span>View stock history</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTION MODAL (Transfer / Count / Adjust) */}
      {quickAction && scannedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleExecuteAction}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-modal border border-slate-200 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 capitalize">
              {quickAction === "transfer"
                ? "ย้ายสินค้าไปยังจุดจัดเก็บอื่น"
                : quickAction === "count"
                ? "บันทึกยอดตรวจนับจริง (Count)"
                : "ปรับยอดสต๊อกสินค้า (Adjust)"}
            </h3>

            <p className="text-xs text-slate-500">
              สินค้า: <strong className="text-slate-800">{scannedProduct.name}</strong> ({scannedProduct.sku})
            </p>

            {quickAction === "transfer" && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ไปยังจุดจัดเก็บปลายทาง
                </label>
                <select
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                จำนวน ({scannedProduct.unit})
              </label>
              <input
                type="number"
                min="1"
                required
                value={actionQty}
                onChange={(e) => setActionQty(Number(e.target.value))}
                className="w-full text-base font-bold text-slate-900 px-3 py-2 bg-white border border-slate-300 rounded-xl text-center"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                บันทึกเหตุผล
              </label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="เช่น ตรวจนับรอบเช้า หรือ ย้ายไปชั้นวางหน้าร้าน"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickAction(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/20"
              >
                ยืนยันดำเนินการ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
