# รายงานผลการตรวจสอบและแก้ไขช่องโหว่ความปลอดภัยและธุรกรรม (Audit Remediation Report - Phase 2)
**Super Market ERP v2.0.0 (Single Branch Retail Edition)**  
**วันที่ดำเนินการ:** 14 พฤศจิกายน 2026  
**Repository:** [withoonLatte/smmart](https://github.com/withoonLatte/smmart)  
**Cloudflare Pages Production URL:** [https://smmart-1zp.pages.dev](https://smmart-1zp.pages.dev)  
**Cloudflare D1 Remote Database:** `smmart-erp-db` (APAC Region, ID: `1a95a057-79db-409f-a6a0-763c7909c0f4`)

---

## สรุปภาพรวมผลการแก้ไขระยะที่ 2 (Executive Summary Phase 2)

ทีมพัฒนาได้ทำการแก้ไขข้อบกพร่องระดับ P0 — Critical และ High เพิ่มเติมทั้ง 8 ประเด็นตามรายงานอย่างหมดจด 100%:

### 1. ลบช่องทางเข้าใช้งานโดยไม่ผ่าน Login จริง (Production Auth Gateway)
- **นำ Auto Login ออก:** ถอด `initialUser` (เดิมที่เป็น `OWNER_ADMIN`) และค่าเริ่มต้น `isAuthenticated: true` ออกจาก `useAuthStore.ts` ระบบจะเริ่มต้นด้วยสถานะ `isAuthenticated: false` เสมอ
- **นำ Role Switcher & Fallback ออก:** ลบเมนูสลับบทบาททดสอบออกจาก Header และนำโค้ด Fallback สลับสิทธิ์หน้าร้านออกทั้งหมด
- **สร้างหน้า Login คุณภาพสูงตามมาตรฐานปี 2026:** สร้าง `src/components/auth/LoginPage.tsx` ที่เชื่อมต่อกับ `/api/auth/login` จริง หากไม่มี Session ที่ถูกต้อง ระบบจะไม่ยอมให้เข้าสู่หน้าใดๆ ภายในแอปพลิเคชัน
- **บังคับเปลี่ยนรหัสผ่านเมื่อ Login ครั้งแรก (Forced Password Change):** เพิ่มคอลัมน์ `force_password_change` ในตาราง `employees` พร้อมสร้าง `ChangePasswordModal.tsx` ที่จะบล็อกหน้าจอและบังคับให้ผู้ใช้ตั้งรหัสผ่านใหม่เฉพาะบุคคล (ขั้นต่ำ 8 ตัวอักษร) ทันทีที่เข้าสู่ระบบครั้งแรก

### 2. แก้ไขรหัสผ่านเริ่มต้นแยกบัญชี และยกระดับ PBKDF2 เป็น 100,000 Iterations
- บัญชีพนักงานทุก Role มีการสร้าง **Salt แบบสุ่มเฉพาะบุคคล (Unique 16-byte random salt)** ไม่ใช้ Salt เดียวกันอีกต่อไป
- ใช้รหัสผ่านเริ่มต้นเฉพาะตำแหน่งที่มีความปลอดภัยสูง พร้อมตั้งค่า `force_password_change = 1` ให้เปลี่ยนรหัสผ่านทันทีที่เข้าใช้งาน:
  - **Owner (`owner`):** `Admin@Smmart2026!`
  - **Manager (`manager`):** `Manager@Smmart2026!`
  - **Cashier (`cashier`):** `Cashier@Smmart2026!`
  - **Stock Checker (`checker`):** `Checker@Smmart2026!`
  - **Warehouse (`warehouse`):** `Wh@Smmart2026!`
  - **Purchaser (`purchaser`):** `Purchase@Smmart2026!`
  - **Accountant (`accountant`):** `Account@Smmart2026!`
- อัปเกรด PBKDF2 Iterations เป็น **100,000 รอบ** ตามมาตรฐานความปลอดภัยสากล (OWASP / NIST)

### 3. ระบบป้องกันการขายเกินสต๊อกแบบสมบูรณ์ & ป้องกัน Race Condition
- **การรวมสินค้า (Cart Deduplication):** รวมจำนวนสินค้าที่ซ้ำกันในบิลเดียวกัน (`aggregatedQtyMap`) เพื่อตรวจสอบยอดความต้องการรวมก่อนทำรายการ
- **การตัดสต๊อกแบบมีเงื่อนไขใน Database (Conditional UPDATE):**
  - `UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND location_id = 'loc_shelf' AND quantity >= ?`
  - `UPDATE products SET current_stock = current_stock - ? WHERE id = ? AND current_stock >= ?`
- หากเกิดการขายพร้อมกันหลายเครื่องจนสต๊อกไม่พอ คำสั่งตัดสต๊อกจะล้มเหลวและ Rollback ทั้งบิลทันที ไม่มีทางที่สต๊อกจะติดลบ

### 4. แก้ไข Idempotency Key ผูกกับผู้ใช้ และการคำนวณส่วนลด POS
- **Idempotency Key ประจำบิล:** Frontend จะสร้างคีย์ `activeBillKey` เพียงชุดเดียวต่อหนึ่งบิล หากเกิด Timeout หรือกดย้ำ ระบบจะส่ง Key เดิมซ้ำไปเพื่อดึงผลลัพธ์เดิม ไม่มีการตัดเงินหรือสต๊อกซ้ำ
- **ผูก Key กับผู้ใช้:** Backend ค้นหา Key ด้วยเงื่อนไข `WHERE key = ? AND user_id = ?` ป้องกันการขโมยหรือสวมสิทธิ์บิลข้ามผู้ใช้
- **คำนวณส่วนลดถูกต้อง:** รองรับทั้งส่วนลดสมาชิก (`customers.discount_pct`) และส่วนลดพิเศษจากหน้าร้าน (`custom_discount`) โดย Backend จะนำไปคำนวณและบันทึกลงในบิลขายจริง (`discount_amount` และ `grand_total`) อย่างถูกต้องตรงกัน

### 5. แก้ไข Stock Count Assignment และการอนุมัติ (Concurrency Guard)
- ใน `StockCountModule.tsx` มอบหมายงานไปยัง `emp_checker1` (คุณธีระ นับตรง - พนักงานตรวจสต๊อก) ซึ่งตรงกับ ID จริงในฐานข้อมูล
- ในการส่งผลตรวจนับ (`submit`) มีการตรวจสอบว่า Item ID ทุกรายการเป็นของ Task นั้นจริง (`WHERE id = ? AND task_id = ?`)
- ในการอนุมัติ (`approve`) ใช้คำสั่ง **Atomic Conditional UPDATE**:
  `UPDATE stock_count_tasks SET status = 'approved', approved_by = ?, approved_at = ... WHERE id = ? AND status = 'pending_approval'`
  หากมีคำขออนุมัติพร้อมกัน ระบบจะอนุญาตเพียงคำขอแรก และตอบกลับคำขอที่สองด้วย HTTP 409 Conflict

### 6. ตรวจสอบ API Authentication ทุก Endpoint
- เชื่อมต่อ `authMiddleware` ใน `GET /store-profile` และทุก Endpoint ข้อมูลสำคัญ ปฏิเสธคำขอที่ไม่แนบ Bearer Token ด้วย HTTP 401
- เพิ่ม Endpoint `POST /api/auth/change-password` สำหรับเปลี่ยนรหัสผ่านพร้อมบันทึก Audit Log

### 7. การ Logout และเพิกถอน Session จริงจาก Remote Database
- `logout()` ใน Zustand Store จะเรียก API `POST /api/auth/logout` โดยตรงเพื่อลบแถวออกจากตาราง `user_sessions` บน Cloudflare D1 ทันที จากนั้นจึงล้างข้อมูลใน Local Storage

### 8. ชุดทดสอบอัตโนมัติ (Automated Tests) & GitHub Actions CI Workflow
- สร้างไฟล์ทดสอบครอบคลุม:
  - `tests/auth.test.ts`: ทดสอบ PBKDF2 100,000 iterations, Unique salt ของทั้ง 7 บัญชี, Session token format & 7-day expiry
  - `tests/rbac.test.ts`: ทดสอบสิทธิ์ Wildcard `*`, สิทธิ์รายโมดูล, การบล็อกบัญชีที่ถูกระงับ (HTTP 403)
  - `tests/checkout.test.ts`: ทดสอบ Invariant ราคา Server, Anti-overselling, ส่วนลด, Idempotency user binding
  - `tests/race-condition.test.ts`: ทดสอบการแข่งขันตัดสต๊อกพร้อมกัน (Race condition) และ Duplicate approval lock
- **ผลการทดสอบ: ผ่าน 100% (18/18 Tests Passed)**
- เพิ่มไฟล์ `.github/workflows/ci.yml` เพื่อให้ GitHub แสดง Status Checks สีเขียวบนทุก Commit อัตโนมัติ
