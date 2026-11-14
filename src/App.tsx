import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { POSModule } from "@/components/pos/POSModule";
import { OwnerDashboard } from "@/components/dashboard/OwnerDashboard";
import { ProductModule } from "@/components/products/ProductModule";
import { InventoryModule } from "@/components/inventory/InventoryModule";
import { StockCountModule } from "@/components/stock-count/StockCountModule";
import { StockScannerModule } from "@/components/stock-checker/StockScannerModule";
import { WarehouseModule } from "@/components/warehouse/WarehouseModule";
import { PurchasingModule } from "@/components/purchasing/PurchasingModule";
import { SupplierModule } from "@/components/suppliers/SupplierModule";
import { CustomerModule } from "@/components/customers/CustomerModule";
import { AccountingModule } from "@/components/accounting/AccountingModule";
import { EmployeeModule } from "@/components/employees/EmployeeModule";
import { SettingsModule } from "@/components/settings/SettingsModule";
import { ReportsModule } from "@/components/reports/ReportsModule";
import { LoginPage } from "@/components/auth/LoginPage";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { useAuthStore, ROLE_DEFAULT_PATHS } from "@/store/useAuthStore";
import { Loader2 } from "lucide-react";

export function App() {
  const { activeRole, isAuthenticated, isLoading, requirePasswordChange, checkAuth } = useAuthStore();
  const [currentModule, setCurrentModule] = useState<string>("dashboard");

  // Validate session token on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Enforce role-based redirect when activeRole changes
  useEffect(() => {
    if (activeRole) {
      const defaultMod = ROLE_DEFAULT_PATHS[activeRole] || "dashboard";
      setCurrentModule(defaultMod);
    }
  }, [activeRole]);

  // Loading state while verifying token with Cloudflare API
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
            กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...
          </span>
        </div>
      </div>
    );
  }

  // Not authenticated: Show production Login Screen
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={(defaultMod) => setCurrentModule(defaultMod)}
      />
    );
  }

  const renderModule = () => {
    switch (currentModule) {
      case "dashboard":
        return <OwnerDashboard />;
      case "pos":
        return <POSModule />;
      case "products":
        return <ProductModule />;
      case "inventory":
        return <InventoryModule />;
      case "stock-count":
        return <StockCountModule />;
      case "stock-scanner":
        return <StockScannerModule />;
      case "warehouse":
        return <WarehouseModule />;
      case "purchasing":
        return <PurchasingModule />;
      case "suppliers":
        return <SupplierModule />;
      case "customers":
        return <CustomerModule />;
      case "accounting":
        return <AccountingModule />;
      case "employees":
        return <EmployeeModule />;
      case "reports":
        return <ReportsModule />;
      case "settings":
        return <SettingsModule />;
      default:
        return <OwnerDashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar Navigation */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={(mod) => setCurrentModule(mod)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <Header onSelectModule={(mod) => setCurrentModule(mod)} />

        {/* Dynamic Active Module Container */}
        <main className="flex-1 overflow-y-auto">
          {renderModule()}
        </main>
      </div>

      {/* Forced Password Change Modal for new accounts */}
      <ChangePasswordModal
        isOpen={requirePasswordChange}
        isForced={true}
        onClose={() => {}}
      />
    </div>
  );
}

export default App;
