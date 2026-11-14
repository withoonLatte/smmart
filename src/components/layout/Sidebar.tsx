import React from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  ClipboardCheck,
  Warehouse,
  ShoppingBag,
  Truck,
  Users,
  CircleDollarSign,
  UserCheck,
  BarChart3,
  Settings,
  ShieldAlert,
  Scan,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { RoleCode } from "@/types";

interface SidebarProps {
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  icon: any;
  allowedRoles: RoleCode[];
  badge?: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "dashboard",
    name: "แดชบอร์ดภาพรวม",
    icon: LayoutDashboard,
    allowedRoles: ["OWNER_ADMIN", "MANAGER"],
  },
  {
    id: "pos",
    name: "จุดขายหน้าร้าน (POS)",
    icon: ShoppingCart,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "CASHIER"],
    badge: "Touch",
  },
  {
    id: "products",
    name: "จัดการสินค้า & บาร์โค้ด",
    icon: Package,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "PURCHASING"],
  },
  {
    id: "inventory",
    name: "สต๊อก & ย้ายจุดเก็บ",
    icon: Boxes,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "WAREHOUSE"],
  },
  {
    id: "stock-count",
    name: "ตรวจนับสต๊อก (Blind Count)",
    icon: ClipboardCheck,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "STOCK_CHECKER"],
    badge: "App",
  },
  {
    id: "stock-scanner",
    name: "สแกนตรวจสต๊อก (Mobile Scanner)",
    icon: Scan,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "STOCK_CHECKER", "WAREHOUSE"],
    badge: "Scan",
  },
  {
    id: "warehouse",
    name: "คลังสินค้า & รับ-เบิก",
    icon: Warehouse,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "WAREHOUSE"],
  },
  {
    id: "purchasing",
    name: "สั่งซื้อสินค้า (PO)",
    icon: ShoppingBag,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "PURCHASING"],
  },
  {
    id: "suppliers",
    name: "คู่ค้า / ซัพพลายเออร์",
    icon: Truck,
    allowedRoles: ["OWNER_ADMIN", "PURCHASING"],
  },
  {
    id: "customers",
    name: "สมาชิกลูกค้า & แต้ม",
    icon: Users,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "CASHIER"],
  },
  {
    id: "accounting",
    name: "บัญชี & ค่าใช้จ่าย & VAT",
    icon: CircleDollarSign,
    allowedRoles: ["OWNER_ADMIN", "ACCOUNTING"],
  },
  {
    id: "employees",
    name: "พนักงาน & สิทธิ์การใช้",
    icon: UserCheck,
    allowedRoles: ["OWNER_ADMIN", "MANAGER"],
  },
  {
    id: "reports",
    name: "รายงานวิเคราะห์การขาย",
    icon: BarChart3,
    allowedRoles: ["OWNER_ADMIN", "MANAGER", "ACCOUNTING"],
  },
  {
    id: "settings",
    name: "ตั้งค่าระบบ & Permission",
    icon: Settings,
    allowedRoles: ["OWNER_ADMIN"],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onSelectModule, isOpen, onClose }) => {
  const { activeRole } = useAuthStore();

  const authorizedMenu = MENU_ITEMS.filter((item) =>
    item.allowedRoles.includes(activeRole)
  );

  return (
    <>
      {/* Mobile/Tablet Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-[#1D3557]/50 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#A8DADC]/40 flex flex-col h-screen select-none shrink-0 shadow-2xl lg:shadow-none transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:-ml-64"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-[#A8DADC]/30 flex items-center justify-between bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E63946] flex items-center justify-center text-white shadow-md shadow-[#E63946]/30">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base leading-tight tracking-tight">
                HAPPY MART
              </h1>
              <p className="text-[11px] font-bold text-[#1D3557] bg-[#A8DADC] px-2 py-0.5 rounded-md inline-block mt-1 shadow-xs">
                ERP v2.0 • สาขาเดี่ยว
              </p>
            </div>
          </div>

          {/* Close button for mobile & desktop */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-[#A8DADC] hover:text-white transition-colors"
            title="ปิดเมนู (Close menu)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Badge Banner */}
        <div className="mx-3.5 mt-3 p-2.5 rounded-2xl bg-[#F1FAEE] border border-[#A8DADC]/70 flex items-center gap-2 shadow-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-[#E63946] animate-pulse" />
          <div className="overflow-hidden">
            <p className="text-[10px] font-bold text-[#457B9D] uppercase tracking-wider">บทบาทปัจจุบัน</p>
            <p className="text-xs font-black text-[#1D3557] truncate">{activeRole}</p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {authorizedMenu.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectModule(item.id);
                  if (typeof window !== "undefined" && window.innerWidth < 1024) {
                    onClose();
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-[#1D3557] text-[#F1FAEE] shadow-md shadow-[#1D3557]/20 font-bold translate-x-1"
                    : "text-[#1D3557]/80 hover:text-[#1D3557] hover:bg-[#A8DADC]/20 active:bg-[#A8DADC]/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#A8DADC]" : "text-[#457B9D]"}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black tracking-wide ${
                      isActive
                        ? "bg-[#E63946] text-white shadow-xs"
                        : "bg-[#A8DADC]/50 text-[#1D3557]"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {authorizedMenu.length === 0 && (
            <div className="p-4 text-center text-xs text-[#457B9D]">
              <ShieldAlert className="w-8 h-8 mx-auto text-[#E63946] mb-2 opacity-75" />
              ไม่มีสิทธิ์เข้าถึงโมดูลใดๆ
            </div>
          )}
        </nav>

        {/* Footer Info */}
        <div className="p-3 border-t border-[#A8DADC]/40 text-[11px] font-semibold text-[#457B9D] text-center bg-[#F1FAEE]/50">
          Cloudflare D1 Remote • APAC
        </div>
      </aside>
    </>
  );
};
