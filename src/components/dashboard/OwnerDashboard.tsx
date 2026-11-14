import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  ShoppingBag,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Receipt,
  Sparkles,
} from "lucide-react";
import { api } from "@/services/api";

export const OwnerDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getDashboardSummary()
      .then((res) => setData(res.data))
      .catch((err) => console.error("Error fetching dashboard", err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">
        กำลังโหลดข้อมูลแดชบอร์ดภาพรวม...
      </div>
    );
  }

  const today = data?.today || { sales: 0, transactions: 0 };
  const monthly = data?.monthly || { sales: 0, transactions: 0 };
  const profit = data?.profit || { revenue: 0, cost: 0, gross_profit: 0 };
  const inventory = data?.inventory || { cost_value: 0, retail_value: 0, total_items: 0 };
  const lowStock = data?.low_stock || [];
  const topProducts = data?.top_products || [];
  const recentSales = data?.recent_sales || [];
  const monthlyExpense = data?.monthly_expense || 0;
  const netEstimate = (monthly.sales || 0) - monthlyExpense;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            ภาพรวมผลประกอบการ (Executive Dashboard)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ข้อมูลอัปเดตแบบเรียลไทม์จาก Cloudflare D1 Remote Database
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">
          <Sparkles className="w-3.5 h-3.5" />
          <span>สาขาหลัก 00000 (Single Branch Mode)</span>
        </div>
      </div>

      {/* KPI Cards Row 1: Sales & Transactions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Sales */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">ยอดขายวันนี้</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              ฿{Number(today.sales).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {today.transactions} รายการขายที่เสร็จสิ้น
            </p>
          </div>
        </div>

        {/* Monthly Sales */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">ยอดขายเดือนนี้</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              ฿{Number(monthly.sales).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {monthly.transactions} บิลในเดือนปัจจุบัน
            </p>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">กำไรขั้นต้นสะสม (Gross Profit)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              ฿{Number(profit.gross_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              จากรายได้ ฿{Number(profit.revenue).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">มูลค่าสินค้าในสต๊อก (ราคาทุน)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              ฿{Number(inventory.cost_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {Number(inventory.total_items).toLocaleString()} ชิ้นในทุกจุดเก็บ
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Top Selling & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">สินค้าขายดี 5 อันดับแรก</h2>
            </div>
            <span className="text-[11px] text-slate-400">ตามยอดจำนวนชิ้น</span>
          </div>

          <div className="space-y-3">
            {topProducts.map((p: any, idx: number) => (
              <div
                key={p.product_id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{p.product_name}</p>
                    <p className="text-[11px] text-slate-400">ขายได้ {p.sold_qty} หน่วย</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900">
                    ฿{Number(p.total_revenue).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}

            {topProducts.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                ยังไม่มีข้อมูลการขายบันทึกในระบบ
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">แจ้งเตือนสินค้าใกล้หมด (Low Stock)</h2>
            </div>
            <span className="text-[11px] text-slate-400">ต่ำกว่าเกณฑ์ขั้นต่ำ</span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {lowStock.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800">{item.name}</p>
                  <p className="text-[11px] text-slate-500">
                    SKU: {item.sku} • เกณฑ์ขั้นต่ำ: {item.min_stock} {item.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-xs">
                    เหลือ {item.current_stock} {item.unit}
                  </span>
                </div>
              </div>
            ))}

            {lowStock.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400">
                สินค้าทุกรายการมีสต๊อกเพียงพอ ไม่ต่ำกว่าเกณฑ์
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Recent Sales List */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">รายการขายล่าสุด (POS Transactions)</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 pb-2">
                <th className="py-2.5 font-semibold">เลขที่บิล</th>
                <th className="py-2.5 font-semibold">เวลา</th>
                <th className="py-2.5 font-semibold">แคชเชียร์</th>
                <th className="py-2.5 font-semibold">ลูกค้า</th>
                <th className="py-2.5 font-semibold">ช่องทาง</th>
                <th className="py-2.5 font-semibold text-right">ยอดสุทธิ</th>
                <th className="py-2.5 font-semibold text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSales.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 font-mono font-bold text-blue-600">{s.invoice_no}</td>
                  <td className="py-2.5 text-slate-500">{new Date(s.created_at).toLocaleTimeString("th-TH")}</td>
                  <td className="py-2.5 text-slate-700">{s.cashier_name || "Cashier"}</td>
                  <td className="py-2.5 text-slate-600">{s.customer_name || "ลูกค้าทั่วไป"}</td>
                  <td className="py-2.5 uppercase font-medium text-slate-500">{s.payment_method}</td>
                  <td className="py-2.5 text-right font-black text-slate-900">฿{Number(s.grand_total).toFixed(2)}</td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {s.status === "completed" ? "สำเร็จ" : "ยกเลิก"}
                    </span>
                  </td>
                </tr>
              ))}

              {recentSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    ยังไม่มีรายการขายในวันนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
