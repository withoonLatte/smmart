import React, { useState, useEffect } from "react";
import {
  Settings,
  Store,
  Shield,
  Save,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { StoreProfile, RoleCode } from "@/types";

export const SettingsModule: React.FC = () => {
  const { currentUser } = useAuthStore();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("role_cashier");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "permissions">("profile");

  const loadData = async () => {
    try {
      const [pRes, rRes, permRes] = await Promise.all([
        api.getStoreProfile(),
        api.getRoles(),
        api.getPermissions(),
      ]);
      setProfile(pRes.data || null);
      setRoles(rRes.data || []);
      setPermissions(permRes.data || []);

      const cashierRole = (rRes.data || []).find((r: any) => r.id === "role_cashier");
      if (cashierRole) {
        setSelectedPerms(cashierRole.permissions || []);
      }
    } catch (err) {
      console.error("Error loading settings", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
    const r = roles.find((role) => role.id === roleId);
    if (r) {
      setSelectedPerms(r.permissions || []);
    }
  };

  const togglePermission = (code: string) => {
    setSelectedPerms((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    try {
      const res = await api.updateStoreProfile(profile);
      alert(res.message);
    } catch (err: any) {
      alert(err.message || "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    try {
      const res = await api.updateRolePermissions(selectedRole, selectedPerms);
      alert(res.message);
      loadData();
    } catch (err: any) {
      alert(err.message || "บันทึกสิทธิ์ไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            การตั้งค่าระบบ & Permission Builder
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ข้อมูลประจำตัวธุรกิจแบบสาขาเดี่ยว (Single Branch) และกำหนดสิทธิ์การใช้งานขั้นละเอียด (Granular RBAC)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              activeTab === "profile"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ข้อมูลร้านค้า & ใบเสร็จ
          </button>
          <button
            onClick={() => setActiveTab("permissions")}
            className={`px-4 py-1.5 rounded-xl transition-all ${
              activeTab === "permissions"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Permission Builder (Owner Only)
          </button>
        </div>
      </div>

      {/* TAB 1: Store Profile Settings */}
      {activeTab === "profile" && profile && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-modern space-y-4 max-w-3xl">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <Store className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              ข้อมูลร้านค้า & เอกสารภาษี (Single Branch Profile)
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่อร้านค้า / นิติบุคคล
              </label>
              <input
                type="text"
                required
                value={profile.store_name}
                onChange={(e) => setProfile({ ...profile, store_name: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่อสาขา (Single Branch Principle)
              </label>
              <input
                type="text"
                required
                value={profile.branch_name}
                onChange={(e) => setProfile({ ...profile, branch_name: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เลขประจำตัวผู้เสียภาษี
              </label>
              <input
                type="text"
                required
                value={profile.tax_id}
                onChange={(e) => setProfile({ ...profile, tax_id: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เบอร์/เลข พร้อมเพย์รับเงิน (PromptPay ID)
              </label>
              <input
                type="text"
                required
                value={profile.promptpay_id}
                onChange={(e) => setProfile({ ...profile, promptpay_id: e.target.value })}
                className="w-full text-xs font-mono font-bold text-blue-600 px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              ที่อยู่ร้านค้าตามทะเบียนภาษี
            </label>
            <input
              type="text"
              required
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ข้อความหัวใบเสร็จรับเงิน
              </label>
              <textarea
                rows={2}
                value={profile.receipt_header}
                onChange={(e) => setProfile({ ...profile, receipt_header: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ข้อความท้ายใบเสร็จรับเงิน
              </label>
              <textarea
                rows={2}
                value={profile.receipt_footer}
                onChange={(e) => setProfile({ ...profile, receipt_footer: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่าร้านค้า"}</span>
          </button>
        </form>
      )}

      {/* TAB 2: Permission Builder */}
      {activeTab === "permissions" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-modern space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Granular Permission Builder (Least Privilege Security)
                </h2>
                <p className="text-xs text-slate-500">
                  กำหนดสิทธิ์รายโมดูลและรายฟังก์ชันการทำงานสำหรับแต่ละบทบาทพนักงาน
                </p>
              </div>
            </div>

            <button
              onClick={handleSavePermissions}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "กำลังบันทึก..." : "บันทึกชุดสิทธิ์บทบาทนี้"}</span>
            </button>
          </div>

          {/* Role Pill Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              เลือกบทบาทที่ต้องการปรับแต่งสิทธิ์
            </label>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleRoleChange(r.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                    selectedRole === r.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {r.name} ({r.code})
                </button>
              ))}
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {permissions.map((perm) => {
              const isChecked = selectedPerms.includes(perm.code);
              return (
                <div
                  key={perm.id}
                  onClick={() => togglePermission(perm.code)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isChecked
                      ? "bg-blue-50/60 border-blue-300 text-blue-900"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by parent click
                    className="w-4 h-4 mt-0.5 rounded text-blue-600"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-blue-700">
                        {perm.code}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">
                      {perm.description}
                    </p>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">
                      โมดูล: {perm.module}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
