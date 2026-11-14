import React, { useState, useEffect } from "react";
import { Users, Plus, Star, Award, Phone, Search } from "lucide-react";
import { api } from "@/services/api";
import { Customer } from "@/types";

export const CustomerModule: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    membership_tier: "Silver",
    discount_pct: 2,
  });

  const loadData = async () => {
    try {
      const res = await api.getCustomers(search);
      setCustomers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createCustomer(formData);
      alert(res.message);
      setIsModalOpen(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        address: "",
        membership_tier: "Silver",
        discount_pct: 2,
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "ลงทะเบียนไม่สำเร็จ");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            ระบบสมาชิกลูกค้า & แต้มสะสม (Customer Loyalty)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            จัดการข้อมูลสมาชิก ระดับบัตร (Silver, Gold, Platinum) และส่วนลดพิเศษประจำระดับ
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>ลงทะเบียนสมาชิกใหม่</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="ค้นหาชื่อ เบอร์โทร หรือรหัสสมาชิก..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">รหัสสมาชิก</th>
                <th className="py-3 px-4 font-semibold">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4 font-semibold">เบอร์โทรศัพท์</th>
                <th className="py-3 px-4 font-semibold text-center">ระดับสมาชิก</th>
                <th className="py-3 px-4 font-semibold text-center">ส่วนลด</th>
                <th className="py-3 px-4 font-semibold text-right">แต้มสะสม</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดซื้อสะสม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">{c.member_code}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">{c.name}</td>
                  <td className="py-3 px-4 text-slate-600">{c.phone}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.membership_tier === "Platinum"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : c.membership_tier === "Gold"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {c.membership_tier}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-600">
                    {c.discount_pct}%
                  </td>
                  <td className="py-3 px-4 text-right font-black text-blue-600">
                    {c.points} pt
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    ฿{Number(c.total_spent || 0).toLocaleString()}
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
              ลงทะเบียนสมาชิกลูกค้าใหม่
            </h2>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่อ-นามสกุล
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เบอร์โทรศัพท์ (ใช้สะสมแต้มที่ POS)
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ระดับบัตรสมาชิก
                </label>
                <select
                  value={formData.membership_tier}
                  onChange={(e) => {
                    const tier = e.target.value;
                    const disc = tier === "Platinum" ? 7 : tier === "Gold" ? 5 : 2;
                    setFormData({ ...formData, membership_tier: tier, discount_pct: disc });
                  }}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                >
                  <option value="Silver">Silver (ลด 2%)</option>
                  <option value="Gold">Gold (ลด 5%)</option>
                  <option value="Platinum">Platinum (ลด 7%)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ส่วนลดประจำบัตร (%)
                </label>
                <input
                  type="number"
                  value={formData.discount_pct}
                  onChange={(e) => setFormData({ ...formData, discount_pct: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                />
              </div>
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
                ลงทะเบียน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
