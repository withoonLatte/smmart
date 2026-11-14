import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Save,
  Send,
  Eye,
  Lock,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { WarehouseLocation, Category, StockCountTask } from "@/types";

export const StockCountModule: React.FC = () => {
  const { currentUser, activeRole } = useAuthStore();
  const isChecker = activeRole === "STOCK_CHECKER";

  const [tasks, setTasks] = useState<StockCountTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskItems, setTaskItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New task form state (Manager/Owner only)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLocationId, setNewLocationId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  // Counts entered in UI: map of sci_id -> quantity
  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const [tRes, locRes, catRes] = await Promise.all([
        api.getStockCountTasks(),
        api.getLocations(),
        api.getCategories(),
      ]);
      setTasks(tRes.data || []);
      setLocations(locRes.data || []);
      setCategories(catRes.data || []);
      if (locRes.data?.length > 0) setNewLocationId(locRes.data[0].id);
    } catch (err) {
      console.error("Error loading stock count tasks", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [currentUser]);

  // View Task detail
  const handleSelectTask = async (taskId: string) => {
    try {
      const res = await api.getStockCountTask(taskId);
      setSelectedTask(res.task);
      setTaskItems(res.items || []);

      // Pre-fill existing counted quantities
      const initial: Record<string, number> = {};
      (res.items || []).forEach((item: any) => {
        if (item.counted_quantity !== null && item.counted_quantity !== undefined) {
          initial[item.id] = item.counted_quantity;
        }
      });
      setCounts(initial);
    } catch (err: any) {
      alert(err.message || "ไม่สามารถเปิดใบงานได้");
    }
  };

  // Create Task (Manager)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocationId) {
      alert("กรุณากรอกชื่องานและเลือกจุดจัดเก็บที่ต้องการนับ");
      return;
    }

    try {
      await api.createStockCountTask({
        title: newTitle,
        location_id: newLocationId,
        category_id: newCategoryId || null,
        assigned_to: "emp_stock_checker",
        user_id: currentUser?.id,
      });

      setIsCreateOpen(false);
      setNewTitle("");
      loadTasks();
    } catch (err: any) {
      alert(err.message || "สร้างงานนับไม่สำเร็จ");
    }
  };

  // Checker Submits count results
  const handleSubmitCounts = async () => {
    if (!selectedTask) return;
    const payload = Object.entries(counts).map(([id, qty]) => ({
      id,
      counted_quantity: Number(qty) || 0,
    }));

    try {
      await api.submitStockCount(selectedTask.id, payload);
      alert("บันทึกและส่งผลการนับสต๊อกให้ผู้จัดการเรียบร้อยแล้ว");
      handleSelectTask(selectedTask.id);
      loadTasks();
    } catch (err: any) {
      alert(err.message || "ส่งผลการตรวจนับไม่สำเร็จ");
    }
  };

  // Manager Approves count discrepancies
  const handleApprove = async () => {
    if (!selectedTask) return;
    if (!confirm("ยืนยันการอนุมัติและปรับปรุงยอดสต๊อกในระบบจริงตามผลต่างที่ตรวจนับได้?")) return;

    try {
      const res = await api.approveStockCount(selectedTask.id, currentUser?.full_name || "Manager");
      alert(res.message);
      handleSelectTask(selectedTask.id);
      loadTasks();
    } catch (err: any) {
      alert(err.message || "อนุมัติไม่สำเร็จ");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              ระบบตรวจนับสต๊อกสินค้า (Stock Counting App)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isChecker
              ? "โหมดพนักงานตรวจนับ (Blind Count): ป้อนยอดจริงที่นับได้จากชั้นวางโดยตรง"
              : "โหมดผู้จัดการ: มอบหมายงาน ตรวจสอบผลต่าง (Discrepancy) และอนุมัติปรับสต๊อก"}
          </p>
        </div>

        {!isChecker && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างใบงานนับสต๊อกใหม่</span>
          </button>
        )}
      </div>

      {/* Task List or Active Task View */}
      {!selectedTask ? (
        /* Task Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleSelectTask(task.id)}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-modern hover:border-blue-400 hover:shadow-float cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    {task.task_code}
                  </span>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                      task.status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : task.status === "pending_approval"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {task.status === "approved"
                      ? "อนุมัติแล้ว"
                      : task.status === "pending_approval"
                      ? "รออนุมัติผลต่าง"
                      : "กำลังดำเนินการ"}
                  </span>
                </div>

                <h3 className="font-bold text-slate-800 text-sm mb-1">{task.title}</h3>
                <p className="text-xs text-slate-500 mb-3">
                  จุดจัดเก็บ: <span className="font-semibold text-slate-700">{task.location_name || "ทุกจุด"}</span>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  ตรวจแล้ว {task.counted_items || 0} / {task.total_items || 0} รายการ
                </span>
                <span className="font-bold text-blue-600 flex items-center gap-1">
                  เปิดงาน <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200">
              ไม่มีใบงานตรวจนับสต๊อกในขณะนี้
            </div>
          )}
        </div>
      ) : (
        /* Selected Task Detail / Counting Sheet */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-modern overflow-hidden">
          {/* Sheet Header */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  ← กลับไปรายการ
                </button>
                <span className="font-mono font-bold text-blue-600 text-xs bg-blue-50 px-2 py-0.5 rounded-lg">
                  {selectedTask.task_code}
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedTask.title}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                จุดนับ: {selectedTask.location_name} • สถานะ: {selectedTask.status}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Checker Action */}
              {selectedTask.status !== "approved" && (
                <button
                  onClick={handleSubmitCounts}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>บันทึกและส่งผลการตรวจนับ</span>
                </button>
              )}

              {/* Manager Approval Action */}
              {!isChecker && selectedTask.status === "pending_approval" && (
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>อนุมัติผลต่างและปรับปรุงสต๊อก</span>
                </button>
              )}
            </div>
          </div>

          {/* Strict Blind Count Note for Checkers */}
          {isChecker && (
            <div className="p-3 bg-amber-50 border-b border-amber-200/60 flex items-center gap-2 text-xs text-amber-800">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Blind Count Security:</strong> ระบบซ่อนจำนวนสต๊อกในระบบและราคาต้นทุนเพื่อความโปร่งใส 100%
                กรุณานับจำนวนจริงที่พบบนชั้นวางแล้วป้อนลงในช่องด้านล่าง
              </span>
            </div>
          )}

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">บาร์โค้ด</th>
                  <th className="py-3 px-4 font-semibold">ชื่อสินค้า</th>
                  <th className="py-3 px-4 font-semibold">หน่วย</th>
                  {/* ONLY managers see system quantity and difference! */}
                  {!isChecker && (
                    <>
                      <th className="py-3 px-4 font-semibold text-right">ยอดในระบบ</th>
                      <th className="py-3 px-4 font-semibold text-right">ยอดนับได้</th>
                      <th className="py-3 px-4 font-semibold text-right">ผลต่าง</th>
                    </>
                  )}
                  <th className="py-3 px-4 font-semibold text-center w-40">
                    {isChecker ? "ยอดที่นับได้จริง (ป้อนที่นี่)" : "แก้ไขยอดนับ"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taskItems.map((item) => {
                  const counted = counts[item.id] ?? item.counted_quantity ?? "";
                  const diff = item.difference;
                  const isDiff = diff !== null && diff !== undefined && diff !== 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-500">
                        {item.barcode}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {item.product_name}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{item.unit}</td>

                      {/* Manager-only Columns */}
                      {!isChecker && (
                        <>
                          <td className="py-3 px-4 text-right font-semibold text-slate-600">
                            {item.system_quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {item.counted_quantity ?? "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-black">
                            {diff !== null && diff !== undefined ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] ${
                                  diff === 0
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </>
                      )}

                      {/* Actual Count Input */}
                      <td className="py-2 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          disabled={selectedTask.status === "approved"}
                          value={counted}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Number(e.target.value);
                            setCounts((prev) => ({ ...prev, [item.id]: val }));
                          }}
                          className="w-24 text-center font-bold text-sm px-2 py-1.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Create Count Task */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateTask}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-modal border border-slate-200 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">
              สร้างใบงานตรวจนับสต๊อกใหม่
            </h2>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่องานตรวจนับ
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="เช่น ตรวจนับสินค้าหมวดเครื่องดื่มประจำสัปดาห์"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                จุดจัดเก็บสินค้าที่ต้องนับ
              </label>
              <select
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เฉพาะหมวดหมู่ (เว้นว่างเพื่อนับทั้งหมด)
              </label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">ทุกหมวดหมู่</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
              >
                สร้างใบงาน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
