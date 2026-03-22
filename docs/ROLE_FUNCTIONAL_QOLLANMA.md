# RuxshonaERP: Admin / Sotuv / Ishlab chiqarish bo'limlari tekshiruv va to'liq qo'llanma

Yangilangan sana: 2026-02-15
Audit turi: Web + Mobile + Backend (API)

## 1. Tekshiruv qamrovi

Ushbu auditda quyidagilar tekshirildi:
- Admin, SALES va PRODUCTION rollari uchun route va role-access logikasi
- Web build/lint holati
- Mobile lint/type holati
- Server build/test holati
- Asosiy API endpointlar role bo'yicha amaliy "smoke" tekshiruv
- Menyular (web sidebar va mobile drawer) bo'limlarining mosligi

## 2. Avtomatik tekshiruv natijalari

| Qism | Buyruq | Natija |
|---|---|---|
| Web (root) | `npm run lint` | PASS |
| Web (root) | `npm run build` | PASS |
| Server | `npm run build` | PASS |
| Server | `npm test -- --runInBand` | PASS (1/1) |
| Mobile | `npm run lint` | PASS |
| Mobile | `npx tsc --noEmit` | PASS |

Qo'shimcha runtime tekshiruv:
- `GET /api/health` => `200` (server ishlayapti)
- `GET /api/sales/shift/photos` authsiz => `401` (route mavjud, auth talab qiladi)

## 3. Role bo'yicha API smoke tekshiruv (amaliy)

Admin token orqali vaqtinchalik test userlar yaratilib, tekshiruvdan keyin o'chirildi.

Tekshiruv natijasi: **12/12 PASS**

| Role | Endpoint | Kutilgan | Amaldagi |
|---|---|---|---|
| ADMIN | `GET /api/users` | 200 | 200 |
| ADMIN | `GET /api/payments` | 200 | 200 |
| SALES | `GET /api/sales/shift` | 200 | 200 |
| SALES | `GET /api/transfers` | 200 | 200 |
| SALES | `GET /api/returns` | 200 | 200 |
| SALES | `GET /api/sales/shift/photos` | 403 | 403 |
| SALES | `GET /api/users` | 403 | 403 |
| PRODUCTION | `GET /api/warehouse/summary` | 200 | 200 |
| PRODUCTION | `GET /api/products` | 200 | 200 |
| PRODUCTION | `GET /api/transfers` | 200 | 200 |
| PRODUCTION | `POST /api/sales/shift/open` | 403 | 403 |
| PRODUCTION | `GET /api/users` | 403 | 403 |

Muhim izoh:
- SALES user uchun `transfers/returns` list ishlashi uchun smena `OPEN` bo'lishi kerak.

## 4. Login va default yo'naltirishlar

### Web
- ADMIN login -> `/` (Dashboard)
- SALES login -> `/sales/sell`
- PRODUCTION login -> `/production/entry`

### Mobile
- ADMIN login -> `/(tabs)` (Dashboard)
- SALES login -> `/(tabs)/sales/sell`
- PRODUCTION login -> `/(tabs)/production/entry`
- Token tekshiruvi AuthGate ichida bajariladi, loading paytida ekran bloklanadi.

## 5. Admin bo'limi: to'liq qo'llanma

### 5.1 Dashboard
Bo'limlar:
- Filiallar
- Do'konlar
- Asosiy panel
- Hisobotlar (PDF)
- Ish haqi
- Filial rasmlari

Asosiy vazifalar:
- Umumiy metrikalarni ko'rish
- CSV eksport (mahsulot/xarajat)
- Period filtrlash (hafta/oy/yil)

### 5.2 Baza
Bo'limlar:
- Mahsulotlar
- Mahsulot qo'shish
- Kategoriyalar
- Birliklar
- Xarajat nomlari
- IKPU
- Inventarizatsiya (Reviziya)
- Omborxona

Muhim funksiyalar:
- Mahsulot yaratish/tahrirlash (barcode, narxlar, birlik)
- Kategoriya va birlik boshqaruvi
- Xarajat nomlarini kategoriyaga bog'lash
- IKPU ichida barcode print:
  - Tanlangan mahsulotlar
  - Barchasini chiqarish (A4)
  - Mahsulot nomi + barcode bilan print layout

### 5.3 Kassa
Bo'limlar:
- Filiallardan olish
- Do'konlardan olish

Amaliy flow:
1. Sana, filial/do'kon, to'lov turi va summa kiriting.
2. Saqlang.
3. Jadvalda tarix va umumiy qiymatlarni tekshiring.

### 5.4 Xarajat kiritish
Asosiy qoida:
- Oddiy xarajat: umumiy summa kiritiladi.
- Sotiladigan xarajat (SELLABLE): umumiy summa + item miqdori kiritiladi; itemlar bo'yicha kirim logikasi ishlaydi.

Amaliy flow:
1. Sana (default bugungi sana)
2. Kategoriya
3. Xarajat nomi (item)
4. To'lov turi
5. Summa va kerak bo'lsa miqdor
6. Saqlash

### 5.5 Transfer
Bo'limlar:
- Filiallarga
- Do'konlarga

Amaliy flow:
1. Target (filial/do'kon) tanlang.
2. Barcode orqali mahsulot qo'shing.
3. Miqdor kiriting.
4. Saqlang.
5. `PENDING` holatda edit/delete mumkin.
6. Qabul qilingach `RECEIVED` bo'ladi.

Qoida:
- Qoldiq yetarli bo'lmasa saqlamaydi.
- Xatolikda mahsulot nomi/qoldiq/so'ralgan miqdor bilan xabar chiqadi.

### 5.6 Vazvrat
Bo'limlar:
- Filiallarga
- Do'konlarga

Amaliy flow:
1. Source ni tanlang.
2. Mahsulot + miqdor kiriting.
3. Saqlang (`PENDING`).
4. `PENDING` holatda edit/delete mumkin.
5. Admin approve/reject qiladi.

### 5.7 Boshqaruv va Sozlamalar
Boshqaruv:
- Filiallar
- Do'konlar
- Ishchilar

Sozlamalar:
- Kategoriyalar
- Birliklar
- Audit log

Qo'shimcha admin modullar:
- Buyurtmalar (qabul qilish / yetkazib berish)
- Platformalar (website / telegram / mobile)

### 5.8 Filial rasmlari arxivi
- Route: `/dashboard/branches/photos`
- Backend route: `GET /api/sales/shift/photos`
- Faqat ADMIN ko'radi
- Filial, user, sana bo'yicha filtr mavjud

## 6. SALES bo'limi: to'liq qo'llanma

Bo'limlar:
- Omborxona
- Sotuv
- Qabul qilish
- Vazvrat
- Do'kon rasmlari
- Smena

### 6.1 Smena (majburiy qoidalar)
- Transfer qabul qilish va vazvrat funksiyalari uchun smena `OPEN` bo'lishi kerak.
- Smena yopiq bo'lsa backend `Forbidden/Shift is closed` qaytaradi.

### 6.2 Sotuv
Asosiy imkoniyatlar:
- Barcode skan orqali mahsulot topish
- Bir nechta mahsulotni bitta chekda kiritish
- Miqdor decimal (`1.2`, `1.6`) qo'llab-quvvatlanadi
- Dublikat barcode qo'shishga yo'l qo'ymaydi
- Omborda yo'q bo'lsa to'g'ridan-to'g'ri xatolik

Amaliy flow:
1. Barcode scan/qo'lda kiriting
2. Miqdorni kiriting
3. `Qo'shish`
4. Ro'yxatni tekshiring
5. `Barchasini saqlash`

### 6.3 Qabul qilish (transfer receive)
- Filialga yuborilgan transferlarni qabul qiladi
- Barcode satr bo'yicha qo'shish oqimi bor
- Yangi satr avtomatik qo'shiladi

### 6.4 Vazvrat (sales)
- Barcode orqali mahsulotni topadi
- Qoldiq ko'rinadi
- Miqdor bilan yuboradi
- Pending qaydlar tahrir/o'chirish mumkin

### 6.5 Do'kon rasmlari
- Smena foto yuklash
- Serverga multipart upload qiladi

## 7. PRODUCTION bo'limi: to'liq qo'llanma

Bo'limlar:
- Markaziy ombor
- Ishlab chiqarilgan mahsulot kiritish
- Tarix

### 7.1 Ishlab chiqarilgan mahsulot kiritish
Web:
- Mahsulot tanlash (search + modal)
- Miqdor kiritish
- Izoh
- Saqlashdan keyin kichik barcode label print (yopishtirish uchun)

Mobile:
- Mahsulot tanlash (modal + qidiruv)
- Miqdor/izoh
- Omborga `IN` movement sifatida saqlash

### 7.2 Markaziy ombor
- Qoldiq monitoring
- Mahsulotlar va zaxira ko'rsatkichlari

### 7.3 Tarix
- Ishlab chiqarish kirimlar tarixi

## 8. Web va Mobile menyu mosligi (asosiy)

- ADMIN: Dashboard / Baza / Kassa / Xarajat / Transfer / Vazvrat / Buyurtmalar / Platformalar / Boshqaruv / Sozlamalar
- SALES: Sotuv guruhi (ombor, sotuv, qabul qilish, vazvrat, rasmlar, smena)
- PRODUCTION: Markaziy ombor / Ishlab chiqarilgan mahsulot kiritish / Tarix

## 9. Muhim biznes qoidalari (tekshirildi)

- SALES va PRODUCTION user loginida default route to'g'ri yo'naladi.
- SALES transfer/returns oqimi uchun open shift talab qilinadi.
- Transferda qoldiq yetarli bo'lmasa backend rad etadi.
- SALES user admin endpointlariga kira olmaydi (`403`).
- PRODUCTION user sales-only endpointlariga kira olmaydi (`403`).
- Admin branch shift photos arxivini ko'ra oladi.

## 10. Cheklovlar va tavsiya etilgan yakuniy qo'lda test (UAT)

Cheklov:
- Avtomatik tekshiruvlar logika va accessni tasdiqlaydi, lekin real kamera skaneri/telefon qurilma darajasidagi UX ni 100% almashtirmaydi.

Tavsiya etilgan UAT (qisqa):
1. Har bir role bilan web login qiling va default route-ni tekshiring.
2. Har bir role bilan mobile login qiling va default route-ni tekshiring.
3. SALES: shift open -> transfer list -> receive -> return create.
4. SALES: sotuvda decimal miqdor (`1.25`) bilan saqlab, ombor qoldig'ini tekshiring.
5. ADMIN: transfer/return pending yozuvni edit/delete qilib ko'ring.
6. ADMIN: IKPU dan "Barchasini chiqarish (A4)" print sinovi.
7. PRODUCTION: entry dan mahsulot kiriting, history/warehouse da aks etishini tekshiring.

## 11. Audit artefaktlari

Ushbu qo'llanma fayli:
- `docs/ROLE_FUNCTIONAL_QOLLANMA.md`

Tekshiruvda asosiy ko'rib chiqilgan fayllar:
- `src/components/layout/Sidebar.tsx`
- `src/app/page.tsx`
- `src/app/sales/sell/page.tsx`
- `src/app/sales/returns/page.tsx`
- `src/app/transfer/branches/page.tsx`
- `src/app/transfer/shops/page.tsx`
- `src/app/production/entry/page.tsx`
- `src/app/dashboard/branches/photos/page.tsx`
- `mobile/app/_layout.tsx`
- `mobile/components/layout/DrawerMenu.tsx`
- `mobile/app/(tabs)/production/entry.tsx`
- `server/src/auth/guards/access.guard.ts`
- `server/src/sales/sales.controller.ts`
- `server/src/transfers/transfers.controller.ts`
- `server/src/returns/returns.controller.ts`

## 12. Responsive va EXE build holati

Responsive (web) bo'yicha amaliy yaxshilashlar:
- Topbar kichik ekranlarda o'qilishi va joylashuvi optimallashtirildi
- Sidebar mobile o'lchami va paddings responsive qilindi
- AppShell kontent paddingsi ekranlarga moslandi
- Card komponentida mobile paddings yaxshilandi

Asosiy o'zgargan fayllar:
- `src/components/layout/Topbar.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/ui/Card.tsx`

Desktop EXE build:
- Buyruq: `npm run dist`
- Natija: PASS
- Tayyor fayl: `dist-electron/Ruxshona ERP 0.1.0.exe`

