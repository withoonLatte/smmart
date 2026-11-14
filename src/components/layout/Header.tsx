import React, { useState } from "react";
import {
  ShieldCheck,
  User,
  Store,
  ChevronDown,
  Sparkles,
  Database,
  Check,
} from "lucide-react";
import { useAuthStore, ROLE_PRESETS } from "@/store/useAuthStore";
import { RoleCode } from "@/types";

interface HeaderProps {
  onSelectModule: (mod: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSelectModule }) => {
  const { currentUser, activeRole, switchRole } = useAuthStore();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const handleRoleSelect = async (role: RoleCode) => {
    setShowRoleMenu(false);
    await switchRole(role);
    onSelectModule(ROLE_PRESETS[role].defaultPath);
  };

  return (
    <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/70 px-6 flex items-center justify-between z-10 sticky top-0 shadow-sm">
      {/* Left: Store identity & Architecture note */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/70 text-slate-700 text-xs font-medium">
          <Store className="w-3.5 h-3.5 text-blue-600" />
          <span>สาขาหลัก 00000 (Single Branch Central DB)</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-medium">
          <Database className="w-3 h-3 text-emerald-500" />
          <span>Cloudflare D1 (Remote DB)</span>
        </div>
      </div>

      {/* Right: Role Switcher & User Profile */}
      <div className="flex items-center gap-3">
        {/* Instant Role Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all text-xs font-semibold shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">สลับบทบาททดสอบ:</span>
            <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px] font-bold">
              {activeRole}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
          </button>

          {/* Role Dropdown */}
          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-modal border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  สลับบทบาทเพื่อทดสอบสิทธิ์ (RBAC Least Privilege)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ระบบจะเปลี่ยนหน้าจอและชุดสิทธิ์จำกัดตามตำแหน่งทันที
                </p>
              </div>

              <div className="py-1 max-h-96 overflow-y-auto space-y-1">
                {(Object.keys(ROLE_PRESETS) as RoleCode[]).map((r) => {
                  const preset = ROLE_PRESETS[r];
                  const isCurrent = activeRole === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handleRoleSelect(r)}
                      className={`w-full text-left p-2.5 rounded-2xl transition-all flex items-start justify-between ${
                        isCurrent
                          ? "bg-blue-50 border border-blue-200 text-blue-900"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">
                            {preset.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 font-semibold text-slate-600">
                            {r}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {preset.description}
                        </p>
                      </div>
                      {isCurrent && (
                        <Check className="w-4 h-4 text-blue-600 shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-none">
              {currentUser?.full_name || "ผู้ใช้งาน"}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {currentUser?.position}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
