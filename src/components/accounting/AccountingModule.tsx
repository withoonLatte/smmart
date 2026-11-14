import React, { useState, useEffect } from "react";
import {
  CircleDollarSign,
  Plus,
  TrendingDown,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/services/api";
import { Expense } from "@/types";

export const AccountingModule: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New Expense modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState("สาธารณูปโภค");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [hasVat, setHasVat] = useState(true);
  const [recipient, setRecipient] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [eRes, sRes] = await Promise.all([
        api.getExpenses(),
        api.getAccountingSummary(),
      ]);
      setExpenses(eRes.data || []);
      setSummary(sRes.data || null);
    } catch (err) {
      console.error("Error loading accounting", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      alert("กรุณากรอกรายการและจำนวนเงินให้ถูกต้อง");
      return;
    }

    try {
      await api.createExpense({
        category,
        description,
        amount,
        has_vat: hasVat,
        recipient,
        payment_method: "cash",
      });
      alert("บันทึกค่าใช้จ่ายเรียบร้อยแล้ว");
      setIsModalOpen(false);
      setDescription("");
      setAmount(0);
      setRecipient("");
      loadData();
    } catch (err: any) {
      alert(err.message || "บันทึกค่าใช้จ่ายไม่สำเร็จ");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            ระบบบัญชีและการเงิน (Accounting & Finance)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกค่าใช้จ่าย รายได้จากการขาย และคำนวณภาษีมูลค่าเพิ่ม (VAT 7%) ประจำงวด
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>บันทึกค่าใช้จ่าย (Record Expense)</span>
        </button>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern">
          <span className="text-xs font-semibold text-slate-500">รายรับรวมจากการขาย</span>
          <div className="text-2xl font-black text-blue-600 mt-2">
            ฿{Number(summary?.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">ภาษีขาย: ฿{Number(summary?.sales_vat || 0).toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern">
          <span className="text-xs font-semibold text-slate-500">ค่าใช้จ่ายรวมดำเนินงาน</span>
          <div className="text-2xl font-black text-rose-600 mt-2">
            ฿{Number(summary?.total_expense || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">ภาษีซื้อ: ฿{Number(summary?.expense_vat || 0).toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern">
          <span className="text-xs font-semibold text-slate-500">ภาษีมูลค่าเพิ่มที่ต้องชำระ (Net VAT)</span>
          <div className="text-2xl font-black text-indigo-600 mt-2">
            ฿{Number(summary?.net_vat_payable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">ภ.พ. 30 (ภาษีขาย - ภาษีซื้อ)</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-modern">
          <span className="text-xs font-semibold text-slate-500">กำไรสุทธิเบื้องต้น (Net Income)</span>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            ฿{Number(summary?.net_income || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">รายรับหักค่าใช้จ่ายร้าน</p>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            รายการบันทึกค่าใช้จ่ายล่าสุด (Operating Expenses)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">เลขที่ใบสำคัญ</th>
                <th className="py-3 px-4 font-semibold">วันที่</th>
                <th className="py-3 px-4 font-semibold">หมวดหมู่</th>
                <th className="py-3 px-4 font-semibold">รายละเอียด</th>
                <th className="py-3 px-4 font-semibold">ผู้รับเงิน / ร้านค้า</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดก่อน VAT</th>
                <th className="py-3 px-4 font-semibold text-right">VAT 7%</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดสุทธิ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">{e.expense_no}</td>
                  <td className="py-3 px-4 text-slate-500">{e.expense_date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">{e.description}</td>
                  <td className="py-3 px-4 text-slate-600">{e.recipient || "-"}</td>
                  <td className="py-3 px-4 text-right text-slate-600">฿{Number(e.amount).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-slate-500">฿{Number(e.vat_amount).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-black text-rose-600">
                    ฿{Number(e.grand_total).toFixed(2)}
                  </td>
                </tr>
              ))}

              {expenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    ยังไม่มีรายการค่าใช้จ่ายที่บันทึก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Add Expense */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateExpense}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-modal border border-slate-200 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">
              บันทึกค่าใช้จ่ายใหม่
            </h2>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                หมวดหมู่ค่าใช้จ่าย
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              >
                <option value="สาธารณูปโภค">ค่าน้ำ ค่าไฟ ค่าอินเทอร์เน็ต</option>
                <option value="ค่าเช่า">ค่าเช่าสถานที่ / อาคาร</option>
                <option value="ค่าซ่อมบำรุง">ค่าซ่อมบำรุงและอุปกรณ์</option>
                <option value="ค่าขนส่ง">ค่าขนส่งและโลจิสติกส์</option>
                <option value="เงินเดือนและค่าจ้าง">เงินเดือนและสวัสดิการพนักงาน</option>
                <option value="ทั่วไป">ค่าใช้จ่ายเบ็ดเตล็ดทั่วไป</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                รายละเอียดค่าใช้จ่าย
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น ค่าไฟฟ้าประจำเดือนตุลาคม 2569"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full text-sm font-bold px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ผู้รับเงิน / ร้านค้า
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="เช่น การไฟฟ้านครหลวง"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="has_vat"
                checked={hasVat}
                onChange={(e) => setHasVat(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600"
              />
              <label htmlFor="has_vat" className="text-xs font-medium text-slate-700">
                มีภาษีมูลค่าเพิ่ม (VAT 7%) นำไปเคลมภาษีซื้อได้
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
              >
                บันทึกค่าใช้จ่าย
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
