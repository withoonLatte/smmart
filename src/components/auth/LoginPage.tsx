import React, { useState } from "react";
import {
  ShoppingBag,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Store,
  Sparkles,
} from "lucide-react";
import { useAuthStore, ROLE_DEFAULT_PATHS } from "@/store/useAuthStore";

interface LoginPageProps {
  onLoginSuccess: (defaultModule: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await login(username.trim(), password);
    setIsLoading(false);

    if (res.success) {
      const activeRole = useAuthStore.getState().activeRole;
      const defaultMod = activeRole ? ROLE_DEFAULT_PATHS[activeRole] : "dashboard";
      onLoginSuccess(defaultMod);
    } else {
      setError(res.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-[#F1FAEE] p-4 antialiased selection:bg-[#A8DADC] selection:text-[#1D3557]">
      {/* Decorative blurred background shapes using Ocean Breeze palette */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#A8DADC]/40 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#457B9D]/20 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-60 h-60 bg-[#E63946]/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#A8DADC]/60 shadow-[0_8px_30px_-6px_rgba(29,53,87,0.12)] p-8 sm:p-10 relative overflow-hidden">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1D3557] flex items-center justify-center text-[#F1FAEE] shadow-md shadow-[#1D3557]/20">
              <ShoppingBag className="w-6 h-6 text-[#A8DADC]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1D3557] tracking-tight leading-none">
                HAPPY MART
              </h1>
              <span className="text-xs text-[#457B9D] font-bold mt-0.5 block">
                Supermarket ERP v2.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F1FAEE] border border-[#A8DADC]/70 text-[11px] font-bold text-[#1D3557] shadow-xs">
            <Store className="w-3.5 h-3.5 text-[#457B9D]" />
            <span>สาขาหลัก 00000</span>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-black text-[#1D3557] tracking-tight">
            เข้าสู่ระบบปฏิบัติการ
          </h2>
          <p className="text-sm font-medium text-[#457B9D] mt-1">
            กรุณายืนยันตัวตนด้วยรหัสประจำตัวพนักงานเพื่อเข้าใช้งาน
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[#E63946]/10 border border-[#E63946]/30 text-[#E63946] flex items-start gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E63946]" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1D3557] mb-1.5 uppercase tracking-wider">
              ชื่อผู้ใช้งาน (Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#457B9D]">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="เช่น owner, manager, cashier"
                autoComplete="username"
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#F1FAEE]/60 border border-[#A8DADC]/70 text-[#1D3557] text-sm focus:outline-none focus:ring-2 focus:ring-[#457B9D]/30 focus:border-[#457B9D] transition-all placeholder:text-[#457B9D]/50 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1D3557] mb-1.5 uppercase tracking-wider">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#457B9D]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านของคุณ"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-11 py-3 rounded-2xl bg-[#F1FAEE]/60 border border-[#A8DADC]/70 text-[#1D3557] text-sm focus:outline-none focus:ring-2 focus:ring-[#457B9D]/30 focus:border-[#457B9D] transition-all placeholder:text-[#457B9D]/50 font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#457B9D] hover:text-[#1D3557] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#457B9D] via-[#1D3557] to-[#1D3557] hover:from-[#386581] hover:to-[#15263F] text-white font-extrabold text-sm shadow-md shadow-[#1D3557]/20 hover:shadow-lg hover:shadow-[#1D3557]/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#A8DADC]" />
                <span>กำลังตรวจสอบข้อมูล...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-[#A8DADC]" />
                <span>เข้าสู่ระบบอย่างปลอดภัย</span>
              </>
            )}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div className="mt-8 pt-5 border-t border-[#A8DADC]/40 flex items-center justify-center gap-2 text-xs text-[#457B9D] font-bold">
          <Sparkles className="w-3.5 h-3.5 text-[#E63946]" />
          <span>เข้ารหัสด้วย PBKDF2-SHA256 (100,000 Iterations)</span>
        </div>
      </div>
    </div>
  );
};
