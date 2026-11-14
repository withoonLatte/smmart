# 🛒 SUPER MARKET ERP v2.0.0 (Single Branch Retail Edition)

ระบบบริหารจัดการซุปเปอร์มาร์เก็ตและร้านค้าปลีกแบบครบวงจร (Production-ready Retail Management System) พัฒนาบนสถาปัตยกรรม **Single Branch Central DB** เชื่อมต่อฐานข้อมูล **Cloudflare D1 (Remote Database)** โดยตรง และโฮสต์บน **Cloudflare Pages + Cloudflare Edge Workers**

🌐 **Live URL บน Cloudflare Pages:** [https://smmart-1zp.pages.dev](https://smmart-1zp.pages.dev)  
📦 **Cloudflare D1 Remote Database:** `smmart-erp-db` (APAC Region)  
🐙 **GitHub Repository:** [https://github.com/withoonLatte/smmart](https://github.com/withoonLatte/smmart)

---

## 🌟 จุดเด่นและสถาปัตยกรรมระบบ (Core Architecture)

1. **สถาปัตยกรรมสาขาเดี่ยว 100% (Single Branch Only):**
   - 1 กิจการ, 1 สาขาหลัก (00000), 1 ฐานข้อมูลกลางส่วนกลาง ไม่มีความซับซ้อนของการสลับสาขา
   - รองรับหลายจุดจัดเก็บภายในร้านเดียวกัน (Internal Locations):
     - **Retail Shelves:** ชั้นวางสินค้าหน้าร้าน (จุดขาย POS ตัดสต๊อก)
     - **Back Store:** สต๊อกสินค้าหลังร้าน
     - **Main Warehouse:** คลังสินค้าหลักยกลัง
     - **Chiller Storage (0-4°C):** ตู้แช่เย็นควบคุมอุณหภูมิสำหรับเครื่องดื่ม ผัก ผลไม้ นมสด
     - **Freezer (-18°C):** ตู้แช่เยือกแข็งสำหรับไอศกรีมและอาหารแช่แข็ง
2. **ระบบสิทธิ์ Least Privilege RBAC & Granular Permission Builder:**
   - บทบาทเฉพาะทาง 7 ตำแหน่งหลัก:
     - **OWNER_ADMIN:** เจ้าของร้านและผู้ดูแลระบบสูงสุด เข้าถึงได้ทุกฟังก์ชันและปรับแต่งสิทธิ์
     - **MANAGER:** ผู้จัดการร้าน ดูภาพรวมยอดขาย สต๊อก อนุมัติการปรับยอดและใบสั่งซื้อ
     - **CASHIER:** พนักงานแคชเชียร์หน้าร้าน ขายสินค้า เปิด-ปิดกะ ดูเฉพาะบิลตนเอง (ถูกปฏิเสธการดูยอดรวมร้าน ต้นทุน กำไร หรือสต๊อก)
     - **STOCK_CHECKER:** พนักงานตรวจนับสต๊อกแบบ Blind Count (ซ่อนสต๊อกในระบบ ต้นทุน และกำไร เพื่อความโปร่งใส 100%)
     - **WAREHOUSE:** พนักงานคลังสินค้า รับสินค้าเข้า เบิกจ่าย และย้ายสินค้าระหว่างจุดเก็บภายใน
     - **PURCHASING:** พนักงานจัดซื้อ จัดการคู่ค้า ทำใบสั่งซื้อ (PO)
     - **ACCOUNTING:** พนักงานบัญชี บันทึกค่าใช้จ่าย ภาษีซื้อ-ขาย ภาษีมูลค่าเพิ่ม (VAT 7%) และงบกำไรขาดทุน
   - **สลับบทบาททดสอบได้ทันที (Instant Role Switcher):** บนแถบ Header เพื่อทดสอบและสาธิตการบังคับใช้สิทธิ์แบบ Real-time
3. **Isolated Print Engine (กฎการพิมพ์ใบเสร็จ):**
   - พิมพ์ใบเสร็จความร้อนขนาด 80mm ผ่าน Hidden Iframe ตัดปัญหาหน้าพรีวิวขาวว่างเปล่าจาก CSS Modal 100%
4. **Instant PromptPay QR (กฎการสร้าง QR Code):**
   - สร้างคิวอาร์โค้ดพร้อมเพย์ฝั่ง Client-side ในเสี้ยววินาที (0.01 วินาที) พร้อมมี Image Fallback URL

---

## 🗂️ 14 โมดูลหลักที่ครอบคลุมการทำงาน

1. **01_OWNER_DASHBOARD:** ยอดขายวันนี้, รายเดือน, กำไรขั้นต้น, มูลค่าสต๊อกสินค้า, แจ้งเตือนสินค้าใกล้หมด (Low Stock)
2. **02_POS (Point of Sale):** สแกนบาร์โค้ด, ตะกร้าสินค้า, ระบบสมาชิกรับส่วนลด, คิดเงินสด, พร้อมเพย์ QR, บัตรเครดิต, เปิด-ปิดกะแคชเชียร์, พิมพ์สลิปใบเสร็จ, ยกเลิกบิล
3. **03_PRODUCT:** แคตตาล็อกสินค้า, บาร์โค้ด, SKU, ราคาทุน, ราคาขายปลีก, ราคาขายส่ง, พิมพ์ป้ายราคาบาร์โค้ด
4. **04_INVENTORY:** ยอดคงเหลือรายจุดจัดเก็บ, ย้ายสินค้าระหว่างจุดเก็บภายใน (Internal Transfer), บันทึกประวัติการเคลื่อนไหว
5. **05_STOCK_COUNT:** แอพตรวจนับสต๊อกเฉพาะทางแบบ Blind Count สำหรับพนักงานตรวจนับ, ระบบตรวจสอบผลต่าง (Discrepancy) และอนุมัติปรับปรุงสต๊อกอัตโนมัติ
6. **06_WAREHOUSE:** บริหารจัดการคลังสินค้าและจุดจัดเก็บ
7. **07_PURCHASING:** จัดทำใบสั่งซื้อ (PO), อนุมัติ PO, รับสินค้าเข้าคลังส่วนกลาง (Goods Receipt)
8. **08_SUPPLIER:** ทะเบียนคู่ค้า ซัพพลายเออร์ เครดิตเทอม และยอดค้างชำระ
9. **09_CUSTOMER:** ทะเบียนสมาชิกลูกค้า ระดับบัตร (Silver, Gold, Platinum) และแต้มสะสม
10. **10_ACCOUNTING:** บันทึกค่าใช้จ่าย, ภาษีซื้อ-ขาย, สรุปภาษีมูลค่าเพิ่มสุทธิ (VAT 7%), งบกำไรขาดทุน
11. **11_EMPLOYEES:** ทะเบียนพนักงาน, บัญชีผู้ใช้, กำหนดบทบาท RBAC, ระงับบัญชี
12. **12_REPORTS:** ประวัติรายการขาย, ส่งออกข้อมูลยอดขายเป็น CSV
13. **13_NOTIFICATIONS:** แจ้งเตือนสินค้าใกล้หมด, สต๊อกขาด, รออนุมัติ
14. **14_SYSTEM_SETTINGS:** ข้อมูลร้านค้า, ข้อความหัว-ท้ายใบเสร็จ, เลขประจำตัวผู้เสียภาษี, Permission Builder

---

## 🛠️ Stack ทางเทคนิค

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + TanStack Query + Zustand
- **Backend:** Hono Framework on Cloudflare Pages Functions (`functions/api/[[route]].ts`)
- **Database:** Cloudflare D1 Remote Database (`smmart-erp-db`)
- **Hosting:** Cloudflare Pages (Deploy output: `dist/`)

---

## 🚀 คำสั่งสำหรับการพัฒนาและ Deploy

```bash
# ติดตั้ง dependencies
npm install

# รันโหมด Development (Vite)
npm run dev

# บิลด์แอพพลิเคชัน
npm run build

# Deploy ไปยัง Cloudflare Pages
npx wrangler pages deploy dist --project-name=smmart

# รันคำสั่งหรือ Schema กับ Cloudflare D1 Remote
npx wrangler d1 execute smmart-erp-db --remote --file=./d1/schema.sql
```
