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
      <div className="p-8 flex items-center justify-center min-h-[60vh] text-[#457B9D] font-semibold text-sm">
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1D3557] tracking-tight">
            ภาพรวมผลประกอบการ (Executive Dashboard)
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-[#457B9D] mt-0.5">
            ข้อมูลอัปเดตแบบเรียลไทม์จาก Cloudflare D1 Remote Database
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold px-3.5 py-1.5 rounded-full bg-[#A8DADC]/30 text-[#1D3557] border border-[#A8DADC]/80 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#E63946]" />
          <span>สาขาหลัก 00000 (Single Branch Mode)</span>
        </div>
      </div>

      {/* KPI Cards Row 1: Sales & Transactions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Sales (Coral Red Accent) */}
        <div className="bg-white rounded-3xl p-5 border border-[#E63946]/30 shadow-modern flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#E63946]" />
          <div className="flex items-center justify-between text-[#457B9D] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1D3557]">ยอดขายวันนี้</span>
            <div className="w-9 h-9 rounded-2xl bg-[#E63946]/10 text-[#E63946] flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#E63946] tracking-tight">
              ฿{Number(today.sales).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-semibold text-[#457B9D] mt-1">
              {today.transactions} รายการขายที่เสร็จสิ้น
            </p>
          </div>
        </div>

        {/* Monthly Sales (Steel Blue Accent) */}
        <div className="bg-white rounded-3xl p-5 border border-[#457B9D]/30 shadow-modern flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#457B9D]" />
          <div className="flex items-center justify-between text-[#457B9D] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1D3557]">ยอดขายเดือนนี้</span>
            <div className="w-9 h-9 rounded-2xl bg-[#457B9D]/15 text-[#457B9D] flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#1D3557] tracking-tight">
              ฿{Number(monthly.sales).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-semibold text-[#457B9D] mt-1">
              {monthly.transactions} บิลในเดือนปัจจุบัน
            </p>
          </div>
        </div>

        {/* Gross Profit (Aqua Accent) */}
        <div className="bg-white rounded-3xl p-5 border border-[#A8DADC] shadow-modern flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#A8DADC]" />
          <div className="flex items-center justify-between text-[#457B9D] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1D3557]">กำไรขั้นต้นสะสม</span>
            <div className="w-9 h-9 rounded-2xl bg-[#A8DADC]/30 text-[#1D3557] flex items-center justify-center font-bold">
              <CircleDollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#1D3557] tracking-tight">
              ฿{Number(profit.gross_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-semibold text-[#457B9D] mt-1">
              จากรายได้ ฿{Number(profit.revenue).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Inventory Valuation (Deep Navy Accent) */}
        <div className="bg-white rounded-3xl p-5 border border-[#1D3557]/20 shadow-modern flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#1D3557]" />
          <div className="flex items-center justify-between text-[#457B9D] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1D3557]">มูลค่าสต๊อก (ราคาทุน)</span>
            <div className="w-9 h-9 rounded-2xl bg-[#1D3557]/10 text-[#1D3557] flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#1D3557] tracking-tight">
              ฿{Number(inventory.cost_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-semibold text-[#457B9D] mt-1">
              {Number(inventory.total_items).toLocaleString()} ชิ้นในทุกจุดเก็บ
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Top Selling & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white rounded-3xl p-5 border border-[#A8DADC]/60 shadow-modern">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-[#457B9D]/15 text-[#457B9D]">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-extrabold text-[#1D3557]">สินค้าขายดี 5 อันดับแรก</h2>
            </div>
            <span className="text-[11px] font-bold text-[#457B9D] bg-[#F1FAEE] px-2 py-0.5 rounded-md">ตามจำนวนชิ้น</span>
          </div>

          <div className="space-y-2.5">
            {topProducts.map((p: any, idx: number) => (
              <div
                key={p.product_id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#F1FAEE] border border-[#A8DADC]/50 hover:border-[#457B9D] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#1D3557] text-[#F1FAEE] font-black text-xs flex items-center justify-center shadow-xs">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1D3557]">{p.product_name}</p>
                    <p className="text-[11px] font-semibold text-[#457B9D]">ขายได้ {p.sold_qty} หน่วย</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-[#1D3557]">
                    ฿{Number(p.total_revenue).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}

            {topProducts.length === 0 && (
              <div className="text-center py-8 text-xs font-semibold text-[#457B9D]">
                ยังไม่มีข้อมูลการขายบันทึกในระบบ
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-3xl p-5 border border-[#E63946]/30 shadow-modern">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-[#E63946]/10 text-[#E63946]">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-extrabold text-[#1D3557]">แจ้งเตือนสินค้าใกล้หมด (Low Stock)</h2>
            </div>
            <span className="text-[11px] font-bold text-[#E63946] bg-[#E63946]/10 px-2 py-0.5 rounded-md">ต่ำกว่าเกณฑ์ขั้นต่ำ</span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {lowStock.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#F1FAEE] border border-[#E63946]/30"
              >
                <div>
                  <p className="text-xs font-bold text-[#1D3557]">{item.name}</p>
                  <p className="text-[11px] font-semibold text-[#457B9D]">
                    SKU: {item.sku} • เกณฑ์ขั้นต่ำ: {item.min_stock} {item.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-[#E63946] text-white font-black text-xs shadow-xs">
                    เหลือ {item.current_stock} {item.unit}
                  </span>
                </div>
              </div>
            ))}

            {lowStock.length === 0 && (
              <div className="text-center py-8 text-xs font-semibold text-[#457B9D]">
                สินค้าทุกรายการมีระดับสต๊อกเพียงพอ ไม่พบสินค้าใกล้หมด
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
