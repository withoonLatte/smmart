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
      <header className="h-16 bg-white/95 backdrop-blur-xl border-b border-[#A8DADC]/40 px-3 sm:px-6 flex items-center justify-between z-10 sticky top-0 shadow-[0_2px_12px_-2px_rgba(29,53,87,0.06)]">
        {/* Left: Hamburger menu toggle + Store identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-2xl hover:bg-[#A8DADC]/20 text-[#1D3557] transition-all flex items-center justify-center border border-[#A8DADC]/50 shadow-xs active:scale-95 bg-white"
            title="เปิด/ปิด แถบเมนู (Menu)"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5 text-[#1D3557]" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F1FAEE] border border-[#A8DADC]/60 text-[#1D3557] text-xs font-semibold truncate shadow-xs">
            <Store className="w-3.5 h-3.5 text-[#457B9D] shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">สาขาหลัก 00000</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A8DADC]/25 text-[#1D3557] border border-[#A8DADC]/70 text-[11px] font-bold">
            <Database className="w-3.5 h-3.5 text-[#457B9D]" />
            <span>Cloudflare D1 (Remote DB)</span>
          </div>
        </div>

        {/* Right: Authenticated User Info & Logout */}
        <div className="flex items-center gap-3">
          {/* User Profile Info Pill */}
          <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full bg-[#F1FAEE] border border-[#A8DADC]/70 shadow-xs">
            <div className="w-7 h-7 rounded-full bg-[#1D3557] text-[#F1FAEE] flex items-center justify-center font-bold text-xs shadow-sm">
              <UserIcon className="w-3.5 h-3.5" />
            </div>

            <div className="text-left hidden sm:block">
              <div className="text-xs font-extrabold text-[#1D3557] leading-tight flex items-center gap-1.5">
                <span>{currentUser?.full_name || "ผู้ใช้งาน"}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#E63946] text-white text-[10px] font-black tracking-wide shadow-xs">
                  {activeRole || "USER"}
                </span>
              </div>
              <p className="text-[10px] text-[#457B9D] font-medium">
                {currentUser?.position || "พนักงาน"} • {currentUser?.employee_code || "EMP"}
              </p>
            </div>

            {/* Change Password Button */}
            <button
              onClick={() => setShowChangePassword(true)}
              title="เปลี่ยนรหัสผ่าน"
              className="p-1.5 rounded-full hover:bg-[#A8DADC]/40 text-[#457B9D] hover:text-[#1D3557] transition-colors"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* Real Logout Button */}
            <button
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="p-1.5 rounded-full hover:bg-[#E63946]/15 text-[#457B9D] hover:text-[#E63946] transition-colors"
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
