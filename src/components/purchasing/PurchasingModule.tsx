import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Plus,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
  PackageCheck,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { PurchaseOrder, Supplier, Product } from "@/types";

export const PurchasingModule: React.FC = () => {
  const { currentUser, activeRole } = useAuthStore();
  const canApprove = activeRole === "OWNER_ADMIN" || activeRole === "MANAGER";

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New PO modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [poItems, setPoItems] = useState<{ product_id: string; quantity: number; unit_cost: number }[]>([]);
  const [notes, setNotes] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [oRes, sRes, pRes] = await Promise.all([
        api.getPurchaseOrders(),
        api.getSuppliers(),
        api.getProducts(),
      ]);
      setOrders(oRes.data || []);
      setSuppliers(sRes.data || []);
      setProducts(pRes.data || []);
      if (sRes.data?.length > 0) setSelectedSupplier(sRes.data[0].id);
    } catch (err) {
      console.error("Error loading purchasing data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleAddItem = () => {
    if (products.length === 0) return;
    setPoItems([
      ...poItems,
      {
        product_id: products[0].id,
        quantity: 24,
        unit_cost: products[0].cost_price || 10,
      },
    ]);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) {
      alert("กรุณาเพิ่มรายการสินค้าที่ต้องการสั่งซื้ออย่างน้อย 1 รายการ");
      return;
    }

    try {
      await api.createPurchaseOrder({
        supplier_id: selectedSupplier,
        items: poItems,
        notes,
        user_id: currentUser?.id,
      });
      alert("จัดทำใบสั่งซื้อ (PO) เรียบร้อยแล้ว");
      setIsModalOpen(false);
      setPoItems([]);
      setNotes("");
      loadData();
    } catch (err: any) {
      alert(err.message || "สร้างใบสั่งซื้อไม่สำเร็จ");
    }
  };

  const handleApprovePO = async (id: string) => {
    if (!confirm("อนุมัติใบสั่งซื้อนี้เพื่อส่งไปยังซัพพลายเออร์และฝ่ายคลังสินค้า?")) return;
    try {
      await api.approvePurchaseOrder(id);
      alert("อนุมัติใบสั่งซื้อเรียบร้อยแล้ว");
      loadData();
    } catch (err: any) {
      alert(err.message || "อนุมัติไม่สำเร็จ");
    }
  };

  const handleReceiveGoods = async (id: string) => {
    const invNo = prompt("กรุณาระบุเลขที่ใบส่งของ / ใบกำกับภาษีจากคู่ค้า (Invoice No.):", `INV-${Math.floor(1000 + Math.random() * 9000)}`);
    if (!invNo) return;

    try {
      const res = await api.receivePurchaseOrder(id, {
        location_id: "loc_main",
        invoice_number: invNo,
        user_id: currentUser?.full_name || "Warehouse Staff",
      });
      alert(res.message);
      loadData();
    } catch (err: any) {
      alert(err.message || "รับสินค้าเข้าคลังไม่สำเร็จ");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            ระบบจัดซื้อสินค้า (Purchase Order Management)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            จัดทำใบสั่งซื้อ อนุมัติโดยผู้จัดการ และรับสินค้าเข้าคลังส่วนกลาง (Main Warehouse Depot)
          </p>
        </div>

        <button
          onClick={() => {
            handleAddItem();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>จัดทำใบสั่งซื้อ (Create PO)</span>
        </button>
      </div>

      {/* PO List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">เลขที่ PO</th>
                <th className="py-3 px-4 font-semibold">วันที่สั่ง</th>
                <th className="py-3 px-4 font-semibold">ซัพพลายเออร์</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดก่อน VAT</th>
                <th className="py-3 px-4 font-semibold text-right">ยอดสุทธิ (Inc. VAT)</th>
                <th className="py-3 px-4 font-semibold text-center">สถานะ</th>
                <th className="py-3 px-4 font-semibold text-center">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">{po.po_number}</td>
                  <td className="py-3 px-4 text-slate-500">{po.order_date}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">{po.supplier_name}</td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    ฿{Number(po.total_amount).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">
                    ฿{Number(po.grand_total).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        po.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : po.status === "approved"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {po.status === "completed"
                        ? "รับสินค้าเข้าคลังแล้ว"
                        : po.status === "approved"
                        ? "อนุมัติแล้ว (รอของส่ง)"
                        : "รออนุมัติ"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {po.status === "pending" && canApprove && (
                        <button
                          onClick={() => handleApprovePO(po.id)}
                          className="px-3 py-1 rounded-xl bg-blue-600 text-white font-bold text-[11px] shadow-sm hover:bg-blue-700"
                        >
                          อนุมัติ PO
                        </button>
                      )}
                      {po.status === "approved" && (
                        <button
                          onClick={() => handleReceiveGoods(po.id)}
                          className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-[11px] shadow-sm hover:bg-emerald-700 flex items-center gap-1"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>รับเข้าคลัง</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    ยังไม่มีประวัติใบสั่งซื้อสินค้า
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create Purchase Order */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreatePO}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-modal border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-base font-bold text-slate-900">
              จัดทำใบสั่งซื้อสินค้า (New Purchase Order)
            </h2>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เลือกคู่ค้า / ซัพพลายเออร์
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - เครดิตเทอม {s.phone || ""}
                  </option>
                ))}
              </select>
            </div>

            {/* PO Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  รายการสินค้าที่สั่งซื้อ
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> เพิ่มรายการ
                </button>
              </div>

              {poItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                  <select
                    value={item.product_id}
                    onChange={(e) => {
                      const p = products.find((pr) => pr.id === e.target.value);
                      const updated = [...poItems];
                      updated[idx].product_id = e.target.value;
                      if (p?.cost_price) updated[idx].unit_cost = p.cost_price;
                      setPoItems(updated);
                    }}
                    className="flex-1 text-xs px-2 py-1.5 bg-white border border-slate-300 rounded-xl"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="จำนวน"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...poItems];
                      updated[idx].quantity = Number(e.target.value);
                      setPoItems(updated);
                    }}
                    className="w-20 text-xs px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-center font-bold"
                  />

                  <input
                    type="number"
                    step="0.01"
                    placeholder="ราคาทุน/หน่วย"
                    value={item.unit_cost}
                    onChange={(e) => {
                      const updated = [...poItems];
                      updated[idx].unit_cost = Number(e.target.value);
                      setPoItems(updated);
                    }}
                    className="w-24 text-xs px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-right font-bold"
                  />

                  <span className="text-xs font-black text-slate-800 w-24 text-right">
                    ฿{(item.quantity * item.unit_cost).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                หมายเหตุใบสั่งซื้อ
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น กำหนดส่งสินค้าภายในวันศุกร์นี้"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
              >
                ยืนยันการจัดทำ PO
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
