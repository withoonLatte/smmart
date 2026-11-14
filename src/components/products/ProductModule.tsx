import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  Barcode,
  Edit2,
  Trash2,
  Tag,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Product, Category, Brand } from "@/types";
import { printReceiptIsolated } from "@/utils/printEngine";

export const ProductModule: React.FC = () => {
  const { activeRole } = useAuthStore();
  const canSeeCost = activeRole !== "CASHIER" && activeRole !== "STOCK_CHECKER";
  const canManage = activeRole === "OWNER_ADMIN" || activeRole === "MANAGER" || activeRole === "PURCHASING";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Form modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: "",
    barcode: "",
    name: "",
    category_id: "",
    brand_id: "",
    unit: "ชิ้น",
    cost_price: 0,
    selling_price: 0,
    wholesale_price: 0,
    min_stock: 5,
    max_stock: 500,
    is_vat: true,
    initial_stock: 10,
    expiry_date: "",
    batch_number: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes, brandRes] = await Promise.all([
        api.getProducts({ q: search, cat: selectedCat }),
        api.getCategories(),
        api.getBrands(),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setBrands(brandRes.data || []);
    } catch (err) {
      console.error("Error loading products", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedCat]);

  const handleOpenAdd = () => {
    const nextNum = Math.floor(1000 + Math.random() * 9000);
    setEditingProduct(null);
    setFormData({
      sku: `SKU-${nextNum}`,
      barcode: `885${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: "",
      category_id: categories[0]?.id || "",
      brand_id: brands[0]?.id || "",
      unit: "ชิ้น",
      cost_price: 0,
      selling_price: 0,
      wholesale_price: 0,
      min_stock: 10,
      max_stock: 500,
      is_vat: true,
      initial_stock: 24,
      expiry_date: "",
      batch_number: `LOT2026-${Math.floor(100 + Math.random() * 900)}`,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      category_id: p.category_id || "",
      brand_id: p.brand_id || "",
      unit: p.unit,
      cost_price: p.cost_price || 0,
      selling_price: p.selling_price,
      wholesale_price: p.wholesale_price || 0,
      min_stock: p.min_stock,
      max_stock: p.max_stock,
      is_vat: p.is_vat === 1,
      initial_stock: 0,
      expiry_date: p.expiry_date || "",
      batch_number: p.batch_number || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, formData);
        alert("อัปเดตข้อมูลสินค้าเรียบร้อยแล้ว");
      } else {
        await api.createProduct(formData);
        alert("เพิ่มสินค้าใหม่สำเร็จ พร้อมจัดเก็บในชั้นวางหน้าร้าน");
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "บันทึกสินค้าไม่สำเร็จ");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ยืนยันการปิดใช้งานสินค้า "${name}"?`)) return;
    try {
      await api.deleteProduct(id);
      loadData();
    } catch (err: any) {
      alert(err.message || "ลบสินค้าไม่สำเร็จ");
    }
  };

  // Print Barcode Label
  const printBarcode = (p: Product) => {
    const html = `
      <div style="text-align: center; border: 1px solid #000; padding: 10px; border-radius: 8px;">
        <div style="font-size: 14px; font-weight: bold;">${p.name}</div>
        <div style="font-size: 20px; font-weight: 900; color: #000; margin: 4px 0;">฿${p.selling_price.toFixed(2)}</div>
        <div style="font-family: monospace; font-size: 16px; letter-spacing: 2px;">*${p.barcode}*</div>
        <div style="font-size: 11px; margin-top: 2px;">บาร์โค้ด: ${p.barcode} | หน่วย: ${p.unit}</div>
      </div>
    `;
    printReceiptIsolated(html, `Label-${p.barcode}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            แคตตาล็อกสินค้า & บาร์โค้ด (Product Catalog)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            จัดการรายการสินค้า ราคาขาย ราคาทุน และเกณฑ์สต๊อกขั้นต่ำ
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มสินค้าใหม่</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า, รหัสบาร์โค้ด หรือ SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        >
          <option value="">ทุกหมวดหมู่สินค้า</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">บาร์โค้ด / SKU</th>
                <th className="py-3 px-4 font-semibold">ชื่อสินค้า</th>
                <th className="py-3 px-4 font-semibold">หมวดหมู่</th>
                <th className="py-3 px-4 font-semibold">หน่วย</th>
                {canSeeCost && (
                  <th className="py-3 px-4 font-semibold text-right">ราคาทุน</th>
                )}
                <th className="py-3 px-4 font-semibold text-right">ราคาขาย</th>
                <th className="py-3 px-4 font-semibold text-center">สต๊อกหน้าร้าน</th>
                <th className="py-3 px-4 font-semibold text-center">สต๊อกรวม</th>
                <th className="py-3 px-4 font-semibold text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-800">{p.barcode}</span>
                    <span className="block font-mono text-[10px] text-slate-400">{p.sku}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">{p.name}</td>
                  <td className="py-3 px-4 text-slate-500">{p.category_name || "-"}</td>
                  <td className="py-3 px-4 text-slate-600">{p.unit}</td>
                  {canSeeCost && (
                    <td className="py-3 px-4 text-right text-slate-500">
                      ฿{Number(p.cost_price || 0).toFixed(2)}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-black text-blue-600">
                    ฿{Number(p.selling_price).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">
                      {p.shelf_stock ?? 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold ${
                        (p.total_stock ?? 0) <= p.min_stock
                          ? "bg-rose-50 text-rose-600"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {p.total_stock ?? 0} {p.unit}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        title="พิมพ์ป้ายราคา / บาร์โค้ด"
                        onClick={() => printBarcode(p)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {canManage && (
                        <>
                          <button
                            title="แก้ไข"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="ปิดใช้งาน"
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {products.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    ไม่พบรายการสินค้า
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Add/Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-modal border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-base font-bold text-slate-900">
              {editingProduct ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าใหม่ในระบบ"}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  รหัสบาร์โค้ด (Barcode)
                </label>
                <input
                  type="text"
                  required
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  รหัส SKU
                </label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่อสินค้า
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น น้ำดื่มสิงห์ 600 มล."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  หมวดหมู่
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">เลือกหมวดหมู่</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  แบรนด์ / ยี่ห้อ
                </label>
                <select
                  value={formData.brand_id}
                  onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">เลือกแบรนด์</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  หน่วยนับ
                </label>
                <input
                  type="text"
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="ชิ้น, ขวด, ซอง..."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ราคาทุน (Cost)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ราคาขายปลีก (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                  className="w-full text-xs font-bold text-blue-600 px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ราคาขายส่ง (บาท)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.wholesale_price}
                  onChange={(e) => setFormData({ ...formData, wholesale_price: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  เกณฑ์สต๊อกขั้นต่ำ (Min Stock)
                </label>
                <input
                  type="number"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!editingProduct && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    สต๊อกตั้งต้น (จัดเก็บหน้าร้าน)
                  </label>
                  <input
                    type="number"
                    value={formData.initial_stock}
                    onChange={(e) => setFormData({ ...formData, initial_stock: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3">
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
                บันทึกข้อมูลสินค้า
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
