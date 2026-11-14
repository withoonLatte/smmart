import { create } from "zustand";
import { RoleCode, User } from "@/types";

interface AuthState {
  currentUser: User | null;
  activeRole: RoleCode;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  switchRole: (role: RoleCode) => void;
  logout: () => void;
}

// Preset profiles for the 7 roles according to the specification
export const ROLE_PRESETS: Record<RoleCode, { name: string; position: string; description: string; defaultPath: string }> = {
  OWNER_ADMIN: {
    name: "คุณวิทูรย์ ลาเต้",
    position: "เจ้าของกิจการ / CEO",
    description: "สิทธิ์สูงสุด ทุกโมดูล และจัดการ Permission Builder",
    defaultPath: "dashboard",
  },
  MANAGER: {
    name: "คุณสมชาย บริหารดี",
    position: "ผู้จัดการร้าน (Store Manager)",
    description: "ดูยอดขาย บริหารสต๊อก อนุมัติส่วนลด และปรับยอด",
    defaultPath: "dashboard",
  },
  CASHIER: {
    name: "คุณนภา ขายคล่อง",
    position: "พนักงานแคชเชียร์หน้าร้าน",
    description: "สแกนบาร์โค้ด คิดเงิน เปิด-ปิดกะ ดูเฉพาะบิลตนเอง",
    defaultPath: "pos",
  },
  STOCK_CHECKER: {
    name: "คุณธีระ นับตรง",
    position: "พนักงานตรวจนับสต๊อก",
    description: "นับสินค้าแบบ Blind Count (ไม่เห็นยอดในระบบ/ต้นทุน)",
    defaultPath: "stock-count",
  },
  WAREHOUSE: {
    name: "คุณมนัส จัดคลัง",
    position: "หัวหน้าคลังสินค้า",
    description: "รับสินค้าเข้าคลัง เบิกจ่าย และย้ายจุดจัดเก็บภายใน",
    defaultPath: "warehouse",
  },
  PURCHASING: {
    name: "คุณสุดา หาเก่ง",
    position: "เจ้าหน้าที่จัดซื้อ",
    description: "จัดการข้อมูลคู่ค้า สร้างและติดตามใบสั่งซื้อ (PO)",
    defaultPath: "purchasing",
  },
  ACCOUNTING: {
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

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: initialUser,
  activeRole: "OWNER_ADMIN",
  isAuthenticated: true,

  setUser: (user) => set({ currentUser: user, activeRole: user.role_code, isAuthenticated: true }),

  switchRole: (role) => {
    const preset = ROLE_PRESETS[role];
    set({
      activeRole: role,
      currentUser: {
        id: `emp_${role.toLowerCase()}`,
        employee_code: `EMP-${role.slice(0, 3)}`,
        username: role.toLowerCase(),
        full_name: preset.name,
        role_code: role,
        position: preset.position,
        permissions: role === "OWNER_ADMIN" ? ["*"] : [],
      },
    });
  },

  logout: () => set({ currentUser: null, isAuthenticated: false }),
}));
