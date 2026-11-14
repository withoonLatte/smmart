import React, { useState, useEffect } from "react";
import { Truck, Plus, Phone, Mail, FileText, CheckCircle2 } from "lucide-react";
import { api } from "@/services/api";
import { Supplier } from "@/types";

export const SupplierModule: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    tax_id: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    credit_terms_days: 30,
  });

  const loadData = async () => {
    try {
      const res = await api.getSuppliers();
      setSuppliers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createSupplier(formData);
      alert(res.message);
      setIsModalOpen(false);
      setFormData({
        code: "",
        name: "",
        tax_id: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        credit_terms_days: 30,
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "บันทึกซัพพลายเออร์ไม่สำเร็จ");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            คู่ค้า & ซัพพลายเออร์ (Supplier Management)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ข้อมูลบริษัทคู่ค้า ผู้แทนจำหน่าย เงื่อนไขการชำระเงินและเครดิตเทอม
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              ...formData,
              code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มซัพพลายเออร์ใหม่</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">รหัสคู่ค้า</th>
                <th className="py-3 px-4 font-semibold">ชื่อบริษัท / ร้านค้า</th>
                <th className="py-3 px-4 font-semibold">ผู้ติดต่อ</th>
                <th className="py-3 px-4 font-semibold">เบอร์โทรศัพท์</th>
                <th className="py-3 px-4 font-semibold">เลขผู้เสียภาษี</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดค้างจ่าย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">{s.code}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">{s.name}</td>
                  <td className="py-3 px-4 text-slate-600">{s.contact_person || "-"}</td>
                  <td className="py-3 px-4 text-slate-600">{s.phone || "-"}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{s.tax_id || "-"}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">
                    ฿{Number(s.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-modal border border-slate-200 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">
              เพิ่มข้อมูลซัพพลายเออร์ใหม่
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  รหัสคู่ค้า
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  เครดิตเทอม (วัน)
                </label>
                <input
                  type="number"
                  value={formData.credit_terms_days}
                  onChange={(e) => setFormData({ ...formData, credit_terms_days: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่อบริษัทคู่ค้า
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น บริษัท ซีพี-เมจิ จำกัด"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ชื่อผู้ติดต่อ
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เลขประจำตัวผู้เสียภาษี
              </label>
              <input
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
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
                บันทึกคู่ค้า
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
