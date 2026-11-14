import React, { useState, useEffect } from "react";
import {
  UserCheck,
  Plus,
  Shield,
  UserX,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { User, RoleCode } from "@/types";

export const EmployeeModule: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Employee modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    role_code: "CASHIER",
    position: "พนักงานแคชเชียร์",
    email: "",
    phone: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [eRes, rRes] = await Promise.all([
        api.getEmployees(),
        api.getRoles(),
      ]);
      setEmployees(eRes.data || []);
      setRoles(rRes.data || []);
    } catch (err) {
      console.error("Error loading employees", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEmployee(formData);
      alert("เพิ่มบัญชีพนักงานใหม่เรียบร้อยแล้ว");
      setIsModalOpen(false);
      setFormData({
        username: "",
        password: "",
        full_name: "",
        role_code: "CASHIER",
        position: "พนักงานแคชเชียร์",
        email: "",
        phone: "",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "เพิ่มพนักงานไม่สำเร็จ");
    }
  };

  const handleToggleStatus = async (emp: any) => {
    const newStatus = emp.status === "active" ? "suspended" : "active";
    if (!confirm(`ต้องการเปลี่ยนสถานะของ ${emp.full_name} เป็น ${newStatus}?`)) return;

    try {
      await api.updateEmployeeStatus(emp.id, newStatus);
      loadData();
    } catch (err: any) {
      alert(err.message || "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            การจัดการพนักงาน & บัญชีผู้ใช้งาน (Employee Management)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดบทบาทหน้าที่ สิทธิ์การเข้าใช้งาน และระงับบัญชีเมื่อพนักงานลาออก
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มพนักงานใหม่</span>
        </button>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">รหัส / ชื่อพนักงาน</th>
                <th className="py-3 px-4 font-semibold">ชื่อผู้ใช้ (Username)</th>
                <th className="py-3 px-4 font-semibold">บทบาท (Role)</th>
                <th className="py-3 px-4 font-semibold">ตำแหน่ง</th>
                <th className="py-3 px-4 font-semibold">ติดต่อ</th>
                <th className="py-3 px-4 font-semibold text-center">สถานะ</th>
                <th className="py-3 px-4 font-semibold text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900">{emp.full_name}</span>
                    <span className="block font-mono text-[10px] text-slate-400">{emp.employee_code}</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-blue-600">
                    {emp.username}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                      {emp.role_code}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{emp.position}</td>
                  <td className="py-3 px-4 text-slate-500">
                    <div>{emp.phone || "-"}</div>
                    <div className="text-[10px] text-slate-400">{emp.email || ""}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {emp.status === "active" ? "ใช้งานปกติ" : "ระงับการใช้งาน"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {emp.role_code !== "OWNER_ADMIN" && (
                      <button
                        onClick={() => handleToggleStatus(emp)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                          emp.status === "active"
                            ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {emp.status === "active" ? "ระงับสิทธิ์" : "เปิดใช้งาน"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create Employee */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-modal border border-slate-200 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">
              เพิ่มบัญชีพนักงานใหม่
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="เช่น somchai"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  รหัสผ่านเริ่มต้น
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่อ-นามสกุล พนักงาน
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="เช่น นายสมชาย ใจดี"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  บทบาท (Role RBAC)
                </label>
                <select
                  value={formData.role_code}
                  onChange={(e) => setFormData({ ...formData, role_code: e.target.value as RoleCode })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ตำแหน่งในร้าน
                </label>
                <input
                  type="text"
                  required
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  อีเมล
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
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
                สร้างบัญชีพนักงาน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
