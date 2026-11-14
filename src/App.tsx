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
import { useAuthStore, ROLE_PRESETS } from "@/store/useAuthStore";

export function App() {
  const { activeRole } = useAuthStore();
  const [currentModule, setCurrentModule] = useState<string>("dashboard");

  // Enforce role-based redirect when activeRole changes
  useEffect(() => {
    const defaultMod = ROLE_PRESETS[activeRole]?.defaultPath || "dashboard";
    setCurrentModule(defaultMod);
  }, [activeRole]);

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
        {/* Top Header with Instant Role Switcher */}
        <Header onSelectModule={(mod) => setCurrentModule(mod)} />

        {/* Dynamic Active Module Container */}
        <main className="flex-1 overflow-y-auto">
          {renderModule()}
        </main>
      </div>
    </div>
  );
}

export default App;
