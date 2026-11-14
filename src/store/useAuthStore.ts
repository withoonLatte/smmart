import { create } from "zustand";
import { RoleCode, User } from "@/types";

interface AuthState {
  currentUser: User | null;
  activeRole: RoleCode;
  sessionToken: string | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: User) => void;
  switchRole: (role: RoleCode) => Promise<void>;
  logout: () => void;
}

export const ROLE_PRESETS: Record<RoleCode, { username: string; name: string; position: string; description: string; defaultPath: string }> = {
  OWNER_ADMIN: {
    username: "owner",
    name: "คุณวิทูรย์ ลาเต้",
    position: "เจ้าของกิจการ / CEO",
    description: "สิทธิ์สูงสุด ทุกโมดูล และจัดการ Permission Builder",
    defaultPath: "dashboard",
  },
  MANAGER: {
    username: "manager",
    name: "คุณสมชาย บริหารดี",
    position: "ผู้จัดการร้าน (Store Manager)",
    description: "ดูยอดขาย บริหารสต๊อก อนุมัติการปรับยอดและใบสั่งซื้อ",
    defaultPath: "dashboard",
  },
  CASHIER: {
    username: "cashier",
    name: "คุณนภา ขายคล่อง",
    position: "พนักงานแคชเชียร์หน้าร้าน",
    description: "สแกนบาร์โค้ด คิดเงิน เปิด-ปิดกะ ดูเฉพาะบิลตนเอง",
    defaultPath: "pos",
  },
  STOCK_CHECKER: {
    username: "checker",
    name: "คุณธีระ นับตรง",
    position: "พนักงานตรวจนับสต๊อก",
    description: "นับสินค้าแบบ Blind Count (ไม่เห็นยอดในระบบ/ต้นทุน)",
    defaultPath: "stock-count",
  },
  WAREHOUSE: {
    username: "warehouse",
    name: "คุณมนัส จัดคลัง",
    position: "หัวหน้าคลังสินค้า",
    description: "รับสินค้าเข้าคลัง เบิกจ่าย และย้ายจุดจัดเก็บภายใน",
    defaultPath: "warehouse",
  },
  PURCHASING: {
    username: "purchaser",
    name: "คุณสุดา หาเก่ง",
    position: "เจ้าหน้าที่จัดซื้อ",
    description: "จัดการข้อมูลคู่ค้า สร้างและติดตามใบสั่งซื้อ (PO)",
    defaultPath: "purchasing",
  },
  ACCOUNTING: {
    username: "accountant",
    name: "คุณปรียา คิดเป๊ะ",
    position: "สมุห์บัญชีและการเงิน",
    description: "บันทึกค่าใช้จ่าย รายงานภาษีซื้อ-ขาย งบกำไรขาดทุน",
    defaultPath: "accounting",
  },
};

const initialUser: User = {
  id: "emp_owner",
  employee_code: "EMP-001",
  username: "owner",
  full_name: "คุณวิทูรย์ ลาเต้",
  role_code: "OWNER_ADMIN",
  position: "เจ้าของกิจการ / CEO",
  email: "owner@happymart.co.th",
  phone: "089-111-2222",
  permissions: ["*"],
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: initialUser,
  activeRole: "OWNER_ADMIN",
  sessionToken: typeof window !== "undefined" ? localStorage.getItem("happymart_auth_token") : null,
  isAuthenticated: true,

  setSession: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("happymart_auth_token", token);
    }
    set({
      sessionToken: token,
      currentUser: user,
      activeRole: user.role_code,
      isAuthenticated: true,
    });
  },

  // Switch role: authentically login as the preset role user to obtain a real cryptographic session token!
  switchRole: async (role) => {
    const preset = ROLE_PRESETS[role];
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: preset.username,
          password: "123456",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.token) {
          get().setSession(data.token, data.user);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not authenticate role switch with backend, falling back to local user state", err);
    }

    // Fallback if network issue
    set({
      activeRole: role,
      currentUser: {
        id: `emp_${role.toLowerCase()}`,
        employee_code: `EMP-${role.slice(0, 3)}`,
        username: preset.username,
        full_name: preset.name,
        role_code: role,
        position: preset.position,
        permissions: role === "OWNER_ADMIN" ? ["*"] : [],
      },
    });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("happymart_auth_token");
    }
    set({ currentUser: null, sessionToken: null, isAuthenticated: false });
  },
}));
