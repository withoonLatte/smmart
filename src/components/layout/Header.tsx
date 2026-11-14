import React, { useState } from "react";
import {
  ShieldCheck,
  User as UserIcon,
  Store,
  Database,
  LogOut,
  KeyRound,
  Menu,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";

interface HeaderProps {
  onSelectModule: (mod: string) => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSelectModule: _onSelectModule, onToggleSidebar }) => {
  const { currentUser, activeRole, logout } = useAuthStore();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = async () => {
    if (confirm("คุณต้องการออกจากระบบหรือไม่?")) {
      await logout();
    }
  };

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-xl border-b border-slate-200/70 px-3 sm:px-6 flex items-center justify-between z-10 sticky top-0 shadow-xs">
        {/* Left: Hamburger menu toggle + Store identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-2xl hover:bg-slate-100 text-slate-700 transition-all flex items-center justify-center border border-slate-200/70 shadow-xs active:scale-95 bg-slate-50/50"
            title="เปิด/ปิด แถบเมนู (Menu)"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/70 text-slate-700 text-xs font-medium truncate">
            <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">สาขาหลัก 00000</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-medium">
            <Database className="w-3 h-3 text-emerald-500" />
            <span>Cloudflare D1 (Remote DB)</span>
          </div>
        </div>

        {/* Right: Authenticated User Info & Logout */}
        <div className="flex items-center gap-3">
          {/* User Profile Info Pill */}
          <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full bg-slate-50 border border-slate-200/80">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <UserIcon className="w-3.5 h-3.5" />
            </div>

            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                <span>{currentUser?.full_name || "ผู้ใช้งาน"}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
                  {activeRole || "USER"}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                {currentUser?.position || "พนักงาน"} • {currentUser?.employee_code || "EMP"}
              </p>
            </div>

            {/* Change Password Button */}
            <button
              onClick={() => setShowChangePassword(true)}
              title="เปลี่ยนรหัสผ่าน"
              className="p-1.5 rounded-full hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* Real Logout Button */}
            <button
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="p-1.5 rounded-full hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
};
