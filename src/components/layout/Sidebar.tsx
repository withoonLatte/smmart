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
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { RoleCode } from "@/types";

interface SidebarProps {
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onSelectModule }) => {
  const { activeRole } = useAuthStore();

  const authorizedMenu = MENU_ITEMS.filter((item) =>
    item.allowedRoles.includes(activeRole)
  );

  return (
    <aside className="w-64 bg-white border-r border-slate-200/70 flex flex-col h-screen select-none shrink-0 shadow-modern z-20">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight tracking-tight">
              HappyMart
            </h1>
            <p className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
              ERP v2.0 • สาขาเดี่ยว
            </p>
          </div>
        </div>
      </div>

      {/* Role Badge Banner */}
      <div className="mx-4 mt-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <div className="overflow-hidden">
          <p className="text-[11px] text-slate-500">บทบาทปัจจุบัน</p>
          <p className="text-xs font-semibold text-slate-800 truncate">{activeRole}</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {authorizedMenu.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all duration-150 ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 font-semibold translate-x-1"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/60 text-slate-600"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {authorizedMenu.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-400">
            <ShieldAlert className="w-8 h-8 mx-auto text-amber-500 mb-2 opacity-75" />
            ไม่มีสิทธิ์เข้าถึงโมดูลใดๆ
          </div>
        )}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
        Cloudflare D1 Remote • APAC
      </div>
    </aside>
  );
};
