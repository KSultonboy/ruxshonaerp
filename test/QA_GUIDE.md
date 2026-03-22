# QA Test Qollanma (Web + Mobile)

Ushbu qollanma bosqichma-bosqich. Har bir test yonida belgi qoyish uchun [ ] Ishladi [ ] Ishlamadi joyi bor.
Bir xil test ma'lumotlaridan foydalaning, shunda modullar orasidagi raqamlar mos tushadi.

## 0) Pre-flight (bir marta)
1) DB migratsiyalar
   - `server` ichida: `npx prisma migrate deploy`
   - Kutilgan natija: migratsiya xatosiz tugaydi. [✅] Ishladi [ ] Ishlamadi
2) Server
   - `server` ichida: `npm start`
   - Kutilgan natija: API ishga tushadi, runtime xato yoq. [✅] Ishladi [ ] Ishlamadi
3) Web
   - root ichida: `npm run dev`
   - Kutilgan natija: web UI ochiladi. [✅] Ishladi [ ] Ishlamadi
4) Mobile
   - `mobile` ichida: `npm start` (Expo)
   - Kutilgan natija: ilova qurilmada/emulatorda ochiladi. [✅] Ishladi [] Ishlamadi

## 1) Test ma'lumotlari (shu qiymatlarni ishlating)
Bir marta yarating va hamma joyda ishlating.
- Filiallar:
  - "Central" (manzil: "Main 1", tel: "+998900000001")
  - "Chilonzor" (manzil: "Main 2", tel: "+998900000002")
- Dokonlar:
  - "Shop A" (manzil: "Shop 1", tel: "+998900000101")
- Birliklar:
  - nomi: "dona", qisqa: "pcs"
  - nomi: "kg", qisqa: "kg"
- Mahsulot kategoriyalari:
  - "Cakes"
  - "Ingredients"
  - "Decor"
- Xarajat kategoriyalari:
  - "Ingredients"
  - "Decor"
  - "Utilities"
- Mahsulotlar:
  - "Napoleon" (type: PRODUCT, category: Cakes, unit: dona, price: 100000, salePrice: 120000, barcode: 111111)
  - "Cream" (type: INGREDIENT, category: Ingredients, unit: kg, price: 20000, barcode: 222222)
  - "Box" (type: DECOR, category: Decor, unit: dona, price: 5000, barcode: 333333)
- Foydalanuvchilar:
  - admin: username "admin", role ADMIN
  - sales: username "sales1", role SALES, branch Central
  - production: username "prod1", role PRODUCTION
  - limited: username "auditor1", role SALES yoki PRODUCTION (ruxsat testi uchun)

## 2) Web QA (ketma-ket)

### 2.1 Login / logout
1) Admin bilan login qiling.
   - Kutilgan natija: Dashboard chiqadi, xato yoq. [ ] Ishladi [ ] Ishlamadi
2) Logout qilib sales1 bilan kiring.
   - Kutilgan natija: Sales sahifalari ochiladi, admin bolimlari blok. [ ] Ishladi [ ] Ishlamadi

### 2.2 Settings > Branches
1) "Central" va "Chilonzor" yarating.
   - Kutilgan natija: ro'yxatda chiqadi, boshqa selectlarda ko'rinadi. [ ] Ishladi [ ] Ishlamadi
2) Bir filialni tahrir qiling (tel/manzil).
   - Kutilgan natija: refreshdan keyin ham saqlanadi. [ ] Ishladi [ ] Ishlamadi

### 2.3 Settings > Shops
1) "Shop A" yarating.
   - Kutilgan natija: ro'yxatda va transfer/selectlarda chiqadi. [ ] Ishladi [ ] Ishlamadi

### 2.4 Settings > Units
1) "dona / pcs" va "kg / kg" yarating.
   - Kutilgan natija: mahsulot formida chiqadi. [ ] Ishladi [ ] Ishlamadi

### 2.5 Settings > Categories
1) Product kategoriyalar: "Cakes", "Ingredients", "Decor" yarating.
2) Expense kategoriyalar: "Ingredients", "Decor", "Utilities" yarating.
   - Kutilgan natija: mahsulot/xarajat formida chiqadi. [ ] Ishladi [ ] Ishlamadi

### 2.6 Settings > Users
1) sales1 (SALES, Central), prod1 (PRODUCTION), auditor1 yarating.
   - Kutilgan natija: ro'yxatda to'g'ri rol/filial bilan chiqadi. [ ] Ishladi [ ] Ishlamadi

### 2.7 Settings > Permissions (granular)
1) auditor1 ni tanlang.
2) Faqat REPORTS_READ va AUDIT_READ (global) bering.
3) Saqlang.
   - Kutilgan natija: auditor1 Reports/Audit ko'radi, Products/Sales/Transfers ocholmaydi. [ ] Ishladi [ ] Ishlamadi

### 2.8 Products
1) Napoleon, Cream, Box yarating (barcode bilan).
2) Napoleon uchun 1 ta rasm yuklang.
   - Kutilgan natija: listda rasm va barcode chiqadi. [ ] Ishladi [ ] Ishlamadi
3) Narxni tahrir qiling.
   - Kutilgan natija: listda yangi narx ko'rinadi. [ ] Ishladi [ ] Ishlamadi

### 2.9 IKPU (Barcode boshqaruvi)
1) IKPU sahifasini oching.
   - Kutilgan natija: barcha mahsulotlar barcode bilan chiqadi; soni products bilan mos. [ ] Ishladi [ ] Ishlamadi

### 2.10 Warehouse
1) Stock IN: Napoleon 50.
2) Stock IN: Cream 20.
3) Stock OUT: Cream 5.
   - Kutilgan natija: ombor summary va product stock yangilanadi. [ ] Ishladi [ ] Ishlamadi

### 2.11 Transfer > Branches (ADMIN/PRODUCTION)
1) Transfer yarating: Central ga Napoleon 10, Box 5.
   - Kutilgan natija: status PENDING, branch stock hali ozgarmaydi. [ ] Ishladi [ ] Ishlamadi
2) sales1 bilan login qiling, Transfer > Branches oching.
3) "Qabul qilish" ni bosing.
   - Kutilgan natija: status RECEIVED, Central stock +10/+5. [ ] Ishladi [ ] Ishlamadi

### 2.12 Transfer > Shops (ADMIN/PRODUCTION)
1) Shop A ga Napoleon 5 transfer qiling.
   - Kutilgan natija: status RECEIVED darhol, product stock -5. [ ] Ishladi [ ] Ishlamadi

### 2.13 Returns > Branches
1) sales1 bilan: Central dan Napoleon 2 return yarating.
   - Kutilgan natija: status PENDING. [ ] Ishladi [ ] Ishlamadi
2) admin bilan approve qiling.
   - Kutilgan natija: status APPROVED; Central stock -2, product stock +2. [ ] Ishladi [ ] Ishlamadi

### 2.14 Returns > Shops
1) Shop A dan Napoleon 1 return yarating (admin).
2) Approve qiling.
   - Kutilgan natija: status APPROVED; product stock +1. [ ] Ishladi [ ] Ishlamadi

### 2.15 Sales (Shift, Sell, Stock)
1) sales1 bilan login.
2) Sales > Shift: open shift.
   - Kutilgan natija: status OPEN. [ ] Ishladi [ ] Ishlamadi
3) Sales > Stock: Napoleon miqdori ko'rinadi.
   - Kutilgan natija: stock mavjud. [ ] Ishladi [ ] Ishlamadi
4) Sales > Sell: barcode 111111, qty 1, CASH.
   - Kutilgan natija: sotuv ok, branch stock -1. [ ] Ishladi [ ] Ishlamadi
5) Sales > Shift: close shift (rasm bilan).
   - Kutilgan natija: status CLOSED. [ ] Ishladi [ ] Ishlamadi

### 2.16 Sales > Receive (Transfer)
1) Pending transfer bo'lsin.
2) Sales > Receive ochib accept qiling.
   - Kutilgan natija: status RECEIVED. [ ] Ishladi [ ] Ishlamadi

### 2.17 Cash (Payments)
1) Cash > Branches: Central uchun 200000 CASH.
2) Cash > Shops: Shop A uchun 50000 CARD.
   - Kutilgan natija: listda chiqadi; debt kamayadi. [ ] Ishladi [ ] Ishlamadi

### 2.18 Expenses
1) Ingredients: 60000 CASH.
2) Decor: 20000 CARD.
3) Utilities: 10000 CASH.
   - Kutilgan natija: har biri listda chiqadi. [ ] Ishladi [ ] Ishlamadi

### 2.19 Orders (local storage)
1) Orders > Receive: order yarating.
   - Kutilgan natija: status NEW. [ ] Ishladi [ ] Ishlamadi
2) "Qabul qilish" bosing.
   - Kutilgan natija: order Deliveryga o'tadi. [ ] Ishladi [ ] Ishlamadi
3) Orders > Delivery: "Yetkazildi" bosing.
   - Kutilgan natija: status DELIVERED. [ ] Ishladi [ ] Ishlamadi

### 2.20 Platforms (local storage)
1) Website: URL va admin login saqlang.
2) Telegram: bot token va username saqlang.
3) Mobile: package id va store link saqlang.
   - Kutilgan natija: holat Ulangan. [ ] Ishladi [ ] Ishlamadi

### 2.21 Reports
1) Sana oraligini bugungi sanani qamrab oladigan qilib tanlang.
2) Overview raqamlari (revenue/expenses/payments/transfers/returns).
3) Trend chart chiqadi; Analitika chartlari (o'rtacha, jamlanma) chiqadi.
4) Segment by branch/product/payment method tekshiring.
5) CSV/Excel/PDF export tekshiring.
   - Kutilgan natija: chartlar va eksport fayllari to'g'ri. [ ] Ishladi [ ] Ishlamadi

### 2.22 Dashboards (Branches/Shops)
1) Dashboard > Branches: debt, transfer, return, paid raqamlari.
2) Dashboard > Shops: transfer/return/paid raqamlari.
   - Kutilgan natija: raqamlar yaratgan ma'lumotga mos. [ ] Ishladi [ ] Ishlamadi

### 2.23 Alerts (admin)
1) BRANCH_STOCK_MIN rule: Napoleon, threshold 5.
   - Kutilgan natija: stock <= 5 bo'lsa alert chiqadi. [ ] Ishladi [ ] Ishlamadi
2) BRANCH_DEBT_LIMIT rule: Central, threshold 100000.
   - Kutilgan natija: debt >= 100000 bo'lsa alert chiqadi. [ ] Ishladi [ ] Ishlamadi
3) PAYMENT_OVERDUE_DAYS rule: Central, 7 days.
   - Kutilgan natija: oxirgi to'lov 7 kundan eski bo'lsa alert chiqadi. [ ] Ishladi [ ] Ishlamadi

### 2.24 Audit log
1) Yuqoridagi create/update/delete amallarini bajaring.
2) Settings > Audit ni oching.
3) Action filter va CSV exportni tekshiring.
   - Kutilgan natija: loglar va export ishlaydi. [ ] Ishladi [ ] Ishlamadi

## 3) Mobile QA (ketma-ket)

### 3.1 Login va sync indikatori
1) Admin bilan login.
2) Topbar sync pill ni ko'ring.
   - Kutilgan natija: online/queued holat ko'rinadi, tap sync ishlaydi. [ ] Ishladi [ ] Ishlamadi

### 3.2 Dashboard
1) Dashboard tab.
   - Kutilgan natija: stats va summary to'g'ri chiqadi. [ ] Ishladi [ ] Ishlamadi

### 3.3 Settings (admin)
1) Branches: Central, Chilonzor yarating.
2) Shops: Shop A yarating.
3) Users: sales1 va prod1 yarating.
4) Categories va Units yarating.
   - Kutilgan natija: data boshqa tablarda ko'rinadi. [ ] Ishladi [ ] Ishlamadi

### 3.4 Products
1) Products list chiqadi.
2) Napoleon qo'shing (barcode + rasm).
   - Kutilgan natija: listda ko'rinadi. [ ] Ishladi [ ] Ishlamadi

### 3.5 Warehouse
1) Stock IN: Napoleon 50.
2) Stock OUT: Napoleon 5.
   - Kutilgan natija: stock qiymati yangilanadi. [ ] Ishladi [ ] Ishlamadi

### 3.6 Sales
1) Sales > Shift: open shift.
2) Sales > Sell: barcode 111111, qty 1, CASH, Save.
3) Sales > Stock: miqdor kamayganini ko'ring.
4) Sales > Photos: 1 rasm yuklang.
5) Sales > Shift: close shift.
   - Kutilgan natija: shift xatosiz yopiladi. [ ] Ishladi [ ] Ishlamadi

### 3.7 Transfers
1) Transfer > Branches: Central ga Napoleon 3.
   - Kutilgan natija: PENDING. [ ] Ishladi [ ] Ishlamadi
2) sales1 bilan login, Transfer > Branches: "Qabul qilish".
   - Kutilgan natija: RECEIVED, branch stock oshadi. [ ] Ishladi [ ] Ishlamadi
3) Transfer > Shops: Shop A ga Napoleon 2.
   - Kutilgan natija: RECEIVED. [ ] Ishladi [ ] Ishlamadi

### 3.8 Returns
1) Returns > Branches: Napoleon 1 return.
2) Admin bilan approve.
   - Kutilgan natija: APPROVED, branch stock kamayadi, product stock oshadi. [ ] Ishladi [ ] Ishlamadi
3) Returns > Shops: yaratish + approve.
   - Kutilgan natija: APPROVED. [ ] Ishladi [ ] Ishlamadi

### 3.9 Cash
1) Cash > Branches: Central 200000 CASH.
2) Cash > Shops: Shop A 50000 CARD.
   - Kutilgan natija: list va total to'g'ri. [ ] Ishladi [ ] Ishlamadi

### 3.10 Expenses
1) Ingredients: 60000.
2) Decor: 20000.
3) Utilities: 10000.
   - Kutilgan natija: listda ko'rinadi, totals yangilanadi. [ ] Ishladi [ ] Ishlamadi

### 3.11 Orders (local storage)
1) Orders > Receive: order yarating.
2) Accept qiling.
3) Orders > Delivery: delivered qiling.
   - Kutilgan natija: NEW -> IN_DELIVERY -> DELIVERED. [ ] Ishladi [ ] Ishlamadi

### 3.12 Platforms (local storage)
1) Website/Telegram/Mobile ma'lumotlarini saqlang.
   - Kutilgan natija: Ulangan holat. [ ] Ishladi [ ] Ishlamadi

### 3.13 Offline cache + sync
1) Internetni o'chiring.
2) 1 ta yangi expense yoki transfer yarating.
   - Kutilgan natija: local saqlanadi, queued ko'rinadi. [ ] Ishladi [ ] Ishlamadi
3) Internetni yoqing.
4) Sync pill ni bosing.
   - Kutilgan natija: queue 0 bo'ladi, webda ham ko'rinadi. [ ] Ishladi [ ] Ishlamadi

### 3.14 Push notifications
1) Notifikatsiyaga ruxsat bering.
2) Serverdan POST `/notifications/push-test` yuboring (shu user uchun).
   - Kutilgan natija: push keladi. [ ] Ishladi [ ] Ishlamadi

## 4) Pass kriteriy
Yuqoridagi barcha testlar xatosiz bajarilishi va data mos bo'lishi kerak:
- Web listlar va dashboardlar
- Mobile listlar
- Reports va eksport
- Audit log yozuvlari
