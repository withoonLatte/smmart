import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "@/services/api";

export const ReportsModule: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getSales(), api.getDashboardSummary()]).then(([sRes, dRes]) => {
      setSales(sRes.data || []);
      setDashboardData(dRes.data || null);
      setIsLoading(false);
    });
  }, []);

  const exportSalesCSV = () => {
    if (sales.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }

    const headers = ["Invoice No", "Date", "Cashier", "Customer", "Payment Method", "Grand Total", "Status"];
    const rows = sales.map((s) => [
      s.invoice_no,
      `"${s.created_at}"`,
      `"${s.cashier_name || 'Cashier'}"`,
      `"${s.customer_name || 'General'}"`,
      s.payment_method,
      s.grand_total,
      s.status,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `supermarket_sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            รายงานและสถิติการขาย (Reports & Analytics)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            รายงานยอดขายรายวัน แคชเชียร์ รายการยกเลิก และส่งออกไฟล์ CSV
          </p>
        </div>

        <button
          onClick={exportSalesCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>ส่งออกรายงานยอดขาย (Export CSV)</span>
        </button>
      </div>

      {/* Sales Transactions Report Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            ประวัติธุรกรรมการขายทั้งหมด ({sales.length} บิล)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">เลขที่บิล</th>
                <th className="py-3 px-4 font-semibold">วัน-เวลา</th>
                <th className="py-3 px-4 font-semibold">แคชเชียร์</th>
                <th className="py-3 px-4 font-semibold">ลูกค้า</th>
                <th className="py-3 px-4 font-semibold">ช่องทางชำระ</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดก่อนลด</th>
                <th className="py-3 px-4 font-semibold text-right">ส่วนลด</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดสุทธิ</th>
                <th className="py-3 px-4 font-semibold text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">{s.invoice_no}</td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(s.created_at).toLocaleString("th-TH")}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{s.cashier_name || "Cashier"}</td>
                  <td className="py-3 px-4 text-slate-600">{s.customer_name || "ลูกค้าทั่วไป"}</td>
                  <td className="py-3 px-4 uppercase font-medium text-slate-600">{s.payment_method}</td>
                  <td className="py-3 px-4 text-right text-slate-500">฿{Number(s.subtotal).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-emerald-600">
                    {Number(s.discount_amount) > 0 ? `-฿${Number(s.discount_amount).toFixed(2)}` : "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">
                    ฿{Number(s.grand_total).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {s.status === "completed" ? "สำเร็จ" : "ยกเลิก (Void)"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
