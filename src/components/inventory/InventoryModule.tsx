import React, { useState, useEffect } from "react";
import {
  Boxes,
  ArrowRightLeft,
  History,
  Building2,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { WarehouseLocation, Product } from "@/types";

export const InventoryModule: React.FC = () => {
  const { currentUser, activeRole } = useAuthStore();
  const canSeeCost = activeRole !== "CASHIER" && activeRole !== "STOCK_CHECKER" && activeRole !== "WAREHOUSE";

  const [stockData, setStockData] = useState<any[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<"balances" | "transfer" | "movements">("balances");
  const [isLoading, setIsLoading] = useState(true);

  // Transfer form
  const [transferProduct, setTransferProduct] = useState("");
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferReason, setTransferReason] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sRes, locRes, movRes, pRes] = await Promise.all([
        api.getStockByLocation(),
        api.getLocations(),
        api.getMovements(),
        api.getProducts(),
      ]);
      setStockData(sRes.data || []);
      setLocations(locRes.data || []);
      setMovements(movRes.data || []);
      setProducts(pRes.data || []);
      if (locRes.data?.length >= 2) {
        setFromLoc(locRes.data[1].id); // e.g. loc_main
        setToLoc(locRes.data[0].id);   // e.g. loc_shelf
      }
      if (pRes.data?.length > 0) {
        setTransferProduct(pRes.data[0].id);
      }
    } catch (err) {
      console.error("Error loading inventory", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProduct || !fromLoc || !toLoc) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    if (fromLoc === toLoc) {
      alert("จุดจัดเก็บต้นทางและปลายทางต้องไม่เป็นที่เดียวกัน");
      return;
    }
    if (transferQty <= 0) {
      alert("จำนวนต้องมากกว่า 0");
      return;
    }

    setIsTransferring(true);
    try {
      const res = await api.transferStock({
        product_id: transferProduct,
        from_location_id: fromLoc,
        to_location_id: toLoc,
        quantity: transferQty,
        reason: transferReason || "เติมสินค้าขึ้นชั้นวางหน้าร้าน",
        user_id: currentUser?.full_name || "Staff",
      });
      alert(res.message);
      setTransferQty(1);
      setTransferReason("");
      loadData();
      setActiveTab("balances");
    } catch (err: any) {
      alert(err.message || "ย้ายสินค้าไม่สำเร็จ");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            ระบบจัดการสต๊อก & ย้ายจุดจัดเก็บภายใน (Internal Inventory)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            สถาปัตยกรรม 1 ซุปเปอร์มาร์เก็ต • ฐานข้อมูลกลางเดี่ยว • หลายจุดจัดเก็บ (Shelves, Backstore, Depot, Cold Storage)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("balances")}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              activeTab === "balances"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ยอดคงเหลือรายจุด
          </button>
          <button
            onClick={() => setActiveTab("transfer")}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              activeTab === "transfer"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ย้ายสินค้าระหว่างจุด
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              activeTab === "movements"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ประวัติการเคลื่อนไหว
          </button>
        </div>
      </div>

      {/* TAB 1: Stock Balances by Location */}
      {activeTab === "balances" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">จุดจัดเก็บ (Storage Location)</th>
                  <th className="py-3 px-4 font-semibold">บาร์โค้ด</th>
                  <th className="py-3 px-4 font-semibold">ชื่อสินค้า</th>
                  <th className="py-3 px-4 font-semibold">หน่วย</th>
                  <th className="py-3 px-4 font-semibold text-right">จำนวนคงเหลือ</th>
                  {canSeeCost && (
                    <th className="py-3 px-4 font-semibold text-right">มูลค่าทุนรวม</th>
                  )}
                  <th className="py-3 px-4 font-semibold text-center">ประเภทจุดเก็บ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>{item.location_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{item.barcode}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{item.product_name}</td>
                    <td className="py-3 px-4 text-slate-500">{item.unit}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    {canSeeCost && (
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        ฿{(Number(item.quantity) * Number(item.cost_price || 0)).toFixed(2)}
                      </td>
                    )}
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                        {item.location_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Internal Transfer Form */}
      {activeTab === "transfer" && (
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 border border-slate-200 shadow-modern">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              ย้ายสินค้าภายในร้าน (Internal Stock Transfer)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            ย้ายสินค้าระหว่างคลังหลัก สต๊อกหลังร้าน และชั้นวางสินค้าหน้าร้าน โดยรักษายอดสต๊อกรวมให้ถูกต้อง 100%
          </p>

          <form onSubmit={handleTransfer} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เลือกสินค้า
              </label>
              <select
                value={transferProduct}
                onChange={(e) => setTransferProduct(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.barcode}) - คงเหลือรวม: {p.total_stock || 0} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  จากจุดจัดเก็บ (ต้นทาง)
                </label>
                <select
                  value={fromLoc}
                  onChange={(e) => setFromLoc(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ไปยังจุดจัดเก็บ (ปลายทาง)
                </label>
                <select
                  value={toLoc}
                  onChange={(e) => setToLoc(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                จำนวนที่ต้องการย้าย
              </label>
              <input
                type="number"
                min="1"
                required
                value={transferQty}
                onChange={(e) => setTransferQty(Number(e.target.value))}
                className="w-full text-sm font-bold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เหตุผลหรือบันทึกช่วยจำ
              </label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="เช่น เติมสินค้าขึ้นชั้นวางหน้าร้านรอบบ่าย"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isTransferring}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
            >
              {isTransferring ? "กำลังบันทึกการย้าย..." : "ยืนยันการย้ายสินค้า"}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Movements Log */}
      {activeTab === "movements" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">วัน-เวลา</th>
                  <th className="py-3 px-4 font-semibold">สินค้า</th>
                  <th className="py-3 px-4 font-semibold">ประเภทการเคลื่อนไหว</th>
                  <th className="py-3 px-4 font-semibold">จากจุดเก็บ</th>
                  <th className="py-3 px-4 font-semibold">ไปยังจุดเก็บ</th>
                  <th className="py-3 px-4 font-semibold text-right">จำนวน</th>
                  <th className="py-3 px-4 font-semibold">บันทึก / อ้างอิง</th>
                  <th className="py-3 px-4 font-semibold">ผู้ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(m.created_at).toLocaleString("th-TH")}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{m.product_name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700">
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{m.from_location_name || "-"}</td>
                    <td className="py-3 px-4 text-slate-600">{m.to_location_name || "-"}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {m.quantity} {m.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{m.reason || m.reference_id || "-"}</td>
                    <td className="py-3 px-4 text-slate-600">{m.created_by || "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
