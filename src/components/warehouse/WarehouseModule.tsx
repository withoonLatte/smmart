import React, { useState, useEffect } from "react";
import { Warehouse, MapPin, Plus, Package, Snowflake, Archive } from "lucide-react";
import { api } from "@/services/api";
import { WarehouseLocation } from "@/types";

export const WarehouseModule: React.FC = () => {
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [stockByLoc, setStockByLoc] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [lRes, sRes] = await Promise.all([
        api.getLocations(),
        api.getStockByLocation(),
      ]);
      setLocations(lRes.data || []);
      setStockByLoc(sRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            คลังสินค้า & จุดจัดเก็บภายใน (Storage Facility & Depots)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            สถาปัตยกรรม 1 ซุปเปอร์มาร์เก็ต • จัดการจุดเก็บสินค้า ชั้นวางหน้าร้าน สต๊อกหลังร้าน และห้องควบคุมอุณหภูมิ
          </p>
        </div>
      </div>

      {/* Storage Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => {
          const itemsInLoc = stockByLoc.filter((s) => s.location_id === loc.id);
          const totalUnits = itemsInLoc.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

          return (
            <div
              key={loc.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-modern flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    {loc.location_type === "cold_storage" || loc.location_type === "freezer" ? (
                      <Snowflake className="w-5 h-5 text-cyan-600" />
                    ) : loc.location_type === "shelf" ? (
                      <Package className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Archive className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {loc.code}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-1">{loc.name}</h3>
                <p className="text-xs text-slate-500 mb-4">{loc.description || loc.warehouse_name}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">คงเหลือในจุดนี้:</span>
                <span className="font-black text-slate-900 text-sm">
                  {totalUnits} ชิ้น ({itemsInLoc.length} SKU)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
