"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ShiftCloseModal from "@/components/sales/ShiftCloseModal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { salesService, type ShopOrder } from "@/services/sales";
import { printAllOrders } from "@/app/sales/orders/page";
import { moneyUZS } from "@/lib/format";
import { onlyDigits, formatDigitsWithSpaces } from "@/lib/mask";
import type {
  Shift,
  Sale,
  PaymentMethod,
  ShiftWithMeta,
  ShiftCashSummary,
  ShiftCashOutRecipient,
} from "@/lib/types";

type MethodStat = { method: PaymentMethod; count: number; total: number };

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Naqd", CARD: "Karta", TRANSFER: "O'tkazma",
};
const METHOD_COLOR: Record<PaymentMethod, string> = {
  CASH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CARD: "bg-blue-50 text-blue-700 border-blue-200",
  TRANSFER: "bg-amber-50 text-amber-700 border-amber-200",
};

const CASH_OUT_LABEL: Record<ShiftCashOutRecipient, string> = {
  OWNER: "Xo'jayin",
  SUPPLIER: "Ta'minotchi",
  OTHER: "Boshqa",
};

function computeStats(sales: Sale[]) {
  const groupMap = new Map<string, { method: PaymentMethod; total: number }>();
  for (const sale of sales) {
    const gId = String(sale.saleGroupId || sale.id);
    const line = Number(sale.price) * Number(sale.quantity);
    const ex = groupMap.get(gId);
    if (ex) { ex.total += line; } else { groupMap.set(gId, { method: sale.paymentMethod, total: line }); }
  }
  const methodMap = new Map<PaymentMethod, MethodStat>();
  let totalAmount = 0;
  for (const { method, total } of groupMap.values()) {
    totalAmount += total;
    const ex = methodMap.get(method) ?? { method, count: 0, total: 0 };
    ex.count += 1; ex.total += total;
    methodMap.set(method, ex);
  }
  return { totalAmount, totalGroups: groupMap.size, byMethod: Array.from(methodMap.values()) };
}

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function SalesShiftPage() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();

  const today = new Date().toISOString().slice(0, 10);

  const [shift, setShift] = useState<Shift | null>(null);
  const [todayShifts, setTodayShifts] = useState<ShiftWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingShift, setOpeningShift] = useState(false);
  const [cashSummary, setCashSummary] = useState<ShiftCashSummary | null>(null);
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashOutNote, setCashOutNote] = useState("");
  const [cashOutRecipient, setCashOutRecipient] = useState<ShiftCashOutRecipient>("OTHER");
  const [cashOutSaving, setCashOutSaving] = useState(false);

  const [totalAmount, setTotalAmount] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [byMethod, setByMethod] = useState<MethodStat[]>([]);

  const [dayTotal, setDayTotal] = useState(0);
  const [dayGroups, setDayGroups] = useState(0);
  const [dayByMethod, setDayByMethod] = useState<MethodStat[]>([]);
  const [closeWarningShown, setCloseWarningShown] = useState(false);
  const [openWarningShown, setOpenWarningShown] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<ShopOrder[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  const loadStats = useCallback(async (activeShift: Shift) => {
    try {
      const report = await salesService.getShiftReport(activeShift.id);
      setTotalAmount(report.totalAmount);
      setTotalGroups(report.totalGroups);
      setByMethod(report.byPaymentMethod);
    } catch { /* ignore */ }
  }, []);

  const loadCashSummary = useCallback(async () => {
    try {
      const summary = await salesService.getShiftCashSummary();
      setCashSummary(summary);
    } catch {
      setCashSummary(null);
    }
  }, []);

  const loadDayStats = useCallback(async () => {
    try {
      const sales = await salesService.list({ from: today, to: today });
      const stats = computeStats(sales);
      setDayTotal(stats.totalAmount);
      setDayGroups(stats.totalGroups);
      setDayByMethod(stats.byMethod);
    } catch { /* ignore */ }
  }, [today]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, shifts] = await Promise.all([
        salesService.getShift().catch(() => null),
        salesService.listShifts({ from: today, to: today }).catch(() => []),
      ]);
      setShift(s);
      setTodayShifts(Array.isArray(shifts) ? shifts : []);
      if (s?.status === "OPEN") {
        await Promise.all([loadStats(s), loadCashSummary()]);
      } else {
        setCashSummary(null);
      }
      await loadDayStats();
    } catch { setShift(null); }
    finally { setLoading(false); }
  }, [loadCashSummary, loadStats, loadDayStats, today]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (closeWarningShown) return;
    if (searchParams.get("needClose") !== "1") return;
    toast.error(
      t("Smenani yopmasdan chiqib bo'lmaydi"),
      t("Avval rasm yuklab, smenani yoping")
    );
    setCloseWarningShown(true);
  }, [closeWarningShown, searchParams, t, toast]);

  useEffect(() => {
    if (openWarningShown) return;
    if (searchParams.get("needOpen") !== "1") return;
    toast.error(t("Kassaga kirishdan oldin smena oching"));
    setOpenWarningShown(true);
  }, [openWarningShown, searchParams, t, toast]);

  const photoCount = shift?.photos?.length ?? 0;
  const isOpen = shift?.status === "OPEN";
  const closedShiftsToday = todayShifts.filter((s) => s.status === "CLOSED");
  const hasMultipleShiftsToday = todayShifts.length > 1;

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const photos = await salesService.uploadShiftPhotos(Array.from(files));
      setShift((prev) => (prev ? { ...prev, photos } : prev));
      toast.success(t("Rasm yuklandi"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleShiftClosed() {
    setShowCloseModal(false);
    toast.success(t("Smena yopildi"));
    await logout();
    router.replace("/login");
  }

  async function handleOpenShift() {
    setOpeningShift(true);
    try {
      await salesService.openShift();
      toast.success(t("Smena ochildi"));
      await refresh();
      // Faol buyurtmalarni yuklash va toast ko'rsatish
      try {
        const activeOrders = await salesService.listShopOrders("ACTIVE");
        setPendingOrders(activeOrders);
        if (activeOrders.length > 0) {
          toast.info(t("Buyurtmalar"), `${activeOrders.length} ta faol buyurtma bor`);
        }
      } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Smenani ochib bo'lmadi"));
    } finally {
      setOpeningShift(false);
    }
  }

  async function handleAddCashOut() {
    const amount = Number(onlyDigits(cashOutAmount));
    if (!amount || amount <= 0) {
      toast.error(t("Xatolik"), t("Summa 0 dan katta bo'lsin"));
      return;
    }
    setCashOutSaving(true);
    try {
      const result = await salesService.addShiftCashOut({
        amount,
        recipientType: cashOutRecipient,
        note: cashOutNote.trim() || undefined,
      });
      setCashSummary(result.summary);
      setCashOutAmount("");
      setCashOutNote("");
      toast.success(t("Saqlandi"), t("Kassadan chiqim yozildi"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    } finally {
      setCashOutSaving(false);
    }
  }

  async function handlePrint() {
    if (!shift) return;
    try {
      const report = await salesService.getShiftReport(shift.id);
      const { shift: s, totalAmount: total, byPaymentMethod, groups } = report;

      const methodRows = byPaymentMethod.map((m) =>
        `<tr><td>${METHOD_LABEL[m.method] ?? m.method}</td><td style="text-align:right;font-weight:700">${m.count} ta</td><td style="text-align:right;font-weight:700">${m.total.toLocaleString()} so'm</td></tr>`
      ).join("");

      const groupRows = groups.map((g) => {
        const itemLines = g.items.map((item) =>
          `<tr><td style="padding-left:20px;color:#666">${item.name}</td><td style="text-align:right;color:#666">${item.quantity} × ${item.price.toLocaleString()}</td><td></td></tr>`
        ).join("");
        return `<tr style="background:#f5f0ea"><td colspan="2"><b>${new Date(g.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })} · ${METHOD_LABEL[g.paymentMethod] ?? g.paymentMethod}</b></td><td style="text-align:right;font-weight:700">${g.total.toLocaleString()} so'm</td></tr>${itemLines}`;
      }).join("");

      const html = `<!doctype html><html><head><meta charset="utf-8"/>
        <title>Smena Hisoboti — ${s.date}</title>
        <style>
          body{font-family:Arial,sans-serif;font-size:12px;margin:16px;color:#1f1a17}
          h2{margin:0 0 4px}p{margin:2px 0;font-size:11px;color:#5c5048}
          table{width:100%;border-collapse:collapse;margin-top:10px}
          th,td{padding:5px 8px;border:1px solid #e5ded7;text-align:left}
          th{background:#f5f0ea;font-weight:700;font-size:11px}
          .total{margin-top:14px;padding:10px 14px;background:#1a1a2e;color:#fff;border-radius:8px;font-size:15px;font-weight:700;display:flex;justify-content:space-between}
          @media print{@page{margin:10mm}}
        </style></head><body>
        <h2>Smena Hisoboti</h2>
        <p>Sana: <b>${s.date}</b> | Filial: <b>${s.branch?.name ?? "—"}</b> | Kassir: <b>${s.openedBy?.username ?? "—"}</b></p>
        <p>Ochilish: <b>${new Date(s.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</b>
          ${s.closedAt ? ` | Yopilish: <b>${new Date(s.closedAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</b>` : " | Hali ochiq"}
        </p>
        <table><thead><tr><th>To'lov usuli</th><th style="text-align:right">Cheklar</th><th style="text-align:right">Summa</th></tr></thead>
        <tbody>${methodRows}</tbody></table>
        <table><thead><tr><th>Chek / Mahsulot</th><th style="text-align:right">Miqdor</th><th style="text-align:right">Summa</th></tr></thead>
        <tbody>${groupRows}</tbody></table>
        <div class="total"><span>Jami sotuv:</span><span>${total.toLocaleString()} so'm</span></div>
        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
        </body></html>`;

      const w = window.open("", "_blank", "width=750,height=950");
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-slate-400">{t("Yuklanmoqda...")}</div>;
  }

  return (
    <>
      {showCloseModal && shift && (
        <ShiftCloseModal
          shift={shift}
          onClose={() => setShowCloseModal(false)}
          onShiftClosed={handleShiftClosed}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("Smena")}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            {todayShifts.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {t("Bugun")} {todayShifts.length} {t("ta smena")}
              </span>
            )}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {isOpen ? t("Ochiq") : shift ? t("Yopilgan") : t("Smena yo'q")}
            </span>
          </div>
        </div>

        {/* Kunlik umumiy */}
        {(hasMultipleShiftsToday || (closedShiftsToday.length > 0 && dayTotal > 0)) && (
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-4">
            <div className="mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("Bugungi umumiy")}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Jami sotuv")}</div>
                <div className="mt-1 text-lg font-bold text-emerald-700">{moneyUZS(dayTotal)}</div>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Cheklar")}</div>
                <div className="mt-1 text-lg font-bold text-slate-800">{dayGroups}</div>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 shadow-sm col-span-2 sm:col-span-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Smenalar")}</div>
                <div className="mt-1 text-lg font-bold text-slate-800">
                  {closedShiftsToday.length} {t("yopildi")} {isOpen ? `/ 1 ${t("ochiq")}` : ""}
                </div>
              </div>
            </div>
            {dayByMethod.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {dayByMethod.map(({ method, total, count }) => (
                  <span key={method} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${METHOD_COLOR[method]}`}>
                    {t(METHOD_LABEL[method])}: {moneyUZS(total)} · {count} {t("ta")}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Yopilgan smenalar */}
        {closedShiftsToday.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{t("Bugungi yopilgan smenalar")}</h2>
            <div className="space-y-2">
              {closedShiftsToday.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {formatTime(s.createdAt)} → {formatTime(s.closedAt)}
                      </div>
                      {s.closingAmount != null && (
                        <div className="text-xs text-slate-500">
                          {t("Yopilish")} {moneyUZS(Number(s.closingAmount))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {t("Yopilgan")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Joriy smena statistikasi */}
        {isOpen && (
          <>
            {hasMultipleShiftsToday && (
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("Joriy smena")}</h2>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Jami sotuvlar")}</div>
                <div className="mt-1 text-xl font-bold text-emerald-700">{moneyUZS(totalAmount)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Cheklar")}</div>
                <div className="mt-1 text-xl font-bold text-slate-800">{totalGroups}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card col-span-2 sm:col-span-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Rasmlar")}</div>
                <div className="mt-1 text-xl font-bold text-slate-800">{photoCount} / 6</div>
              </div>
            </div>

            {byMethod.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {byMethod.map(({ method, count, total }) => (
                  <div key={method} className={`rounded-xl border p-4 ${METHOD_COLOR[method]}`}>
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{t(METHOD_LABEL[method])}</div>
                    <div className="mt-2 text-xl font-bold">{moneyUZS(total)}</div>
                    <div className="mt-1 text-xs font-medium opacity-60">{count} {t("ta chek")}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Kassa holati va chiqim */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("Joriy kassa nazorati")}</h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Boshlang'ich")}</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">{moneyUZS(cashSummary?.openingAmount ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">{t("Naqd sotuv")}</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">{moneyUZS(cashSummary?.cashSalesTotal ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">{t("Kassadan chiqim")}</div>
                  <div className="mt-1 text-lg font-bold text-rose-700">{moneyUZS(cashSummary?.cashOutTotal ?? 0)}</div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">{t("Joriy qoldiq")}</div>
                  <div className={`mt-1 text-lg font-bold ${(cashSummary?.currentCash ?? 0) < 0 ? "text-rose-700" : "text-blue-700"}`}>
                    {moneyUZS(cashSummary?.currentCash ?? 0)}
                  </div>
                </div>
              </div>

              {cashSummary?.warnings?.includes("NEGATIVE_CASH") && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {t("Diqqat: joriy kassa manfiy holatga tushgan. Chiqimlarni tekshiring.")}
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{t("Kimga berildi")}</label>
                  <select
                    value={cashOutRecipient}
                    onChange={(e) => setCashOutRecipient(e.target.value as ShiftCashOutRecipient)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="OWNER">{t("Xo'jayin")}</option>
                    <option value="SUPPLIER">{t("Ta'minotchi")}</option>
                    <option value="OTHER">{t("Boshqa")}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{t("Summa (so'm)")}</label>
                  <input
                    inputMode="numeric"
                    value={formatDigitsWithSpaces(cashOutAmount)}
                    onChange={(e) => setCashOutAmount(onlyDigits(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    placeholder={t("Masalan: 250 000")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{t("Izoh (ixtiyoriy)")}</label>
                  <input
                    value={cashOutNote}
                    onChange={(e) => setCashOutNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    placeholder={t("Nima uchun berildi?")}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end">
                <Button onClick={() => void handleAddCashOut()} disabled={cashOutSaving}>
                  {cashOutSaving ? t("Saqlanmoqda...") : t("Kassadan chiqim qo'shish")}
                </Button>
              </div>

              {cashSummary?.cashOuts?.length ? (
                <div className="mt-4 rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("So'nggi chiqimlar")}
                  </div>
                  <div className="max-h-52 overflow-auto divide-y divide-slate-100">
                    {cashSummary.cashOuts.slice(0, 20).map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-slate-800">
                            {t(CASH_OUT_LABEL[item.recipientType])}
                            {(item as any).status === "PENDING" && (
                              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                                {t("Kutmoqda")}
                              </span>
                            )}
                            {(item as any).status === "REJECTED" && (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                {t("Rad etildi")}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(item.createdAt).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            {item.note ? ` · ${item.note}` : ""}
                          </div>
                        </div>
                        <div className={`font-semibold ${(item as any).status === "PENDING" ? "text-orange-600" : (item as any).status === "REJECTED" ? "text-slate-400 line-through" : "text-rose-700"}`}>
                          {moneyUZS(item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          </>
        )}

        {/* Rasm yuklash */}
        {isOpen && (
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">{t("Kassa rasmlari")}</h3>
            {photoCount > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {shift!.photos.map((url, idx) => (
                  <div key={idx} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url.startsWith("data:") ? url : `${process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "")}${url}`}
                      alt={`photo-${idx}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            {photoCount < 6 && (
              <div>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadPhotos(e.target.files)} />
                <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {uploading ? t("Yuklanmoqda...") : t("Rasm yuklash")}
                </Button>
                <p className="mt-1.5 text-xs text-slate-400">{t("Maksimum 6 ta rasm")}</p>
              </div>
            )}
            {!photoCount && <p className="mt-2 text-xs font-medium text-rose-500">⚠ {t("Smena yopish uchun kamida 1 ta rasm yuklang")}</p>}
          </Card>
        )}

        {/* Amallar */}
        <Card>
          <div className="flex flex-wrap gap-3">
            {!isOpen && (
              <Button onClick={() => void handleOpenShift()} disabled={openingShift}>
                {openingShift ? t("Ochilmoqda...") : t("Smena ochish")}
              </Button>
            )}
            {isOpen && (
              <Button variant="danger" onClick={() => setShowCloseModal(true)}>
                {t("Smena yopish")}
              </Button>
            )}
            {isOpen && (
              <Button onClick={() => router.push("/sales/cashier")}>
                {t("Kassaga kirish")}
              </Button>
            )}
            {shift && (
              <Button variant="ghost" onClick={() => void handlePrint()}>
                🖨 {t("Hisobotni chop etish")}
              </Button>
            )}
            <Button variant="ghost" onClick={refresh}>{t("Yangilash")}</Button>
          </div>
        </Card>

        {/* Faol buyurtmalar bloki — smena ochilganda ko'rinadi */}
        {isOpen && pendingOrders.length > 0 && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  📦 {t("Faol buyurtmalar")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pendingOrders.length} {t("ta buyurtma bajarilishini kutmoqda")}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => printAllOrders(pendingOrders)}
                className="flex items-center gap-1.5 text-xs"
              >
                🖨 {t("Barchasini chop etish")}
              </Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {order.description}
                    </div>
                    {order.customerName && (
                      <div className="text-xs text-slate-500">{order.customerName}</div>
                    )}
                    {order.deliveryDate && (
                      <div className="text-xs font-medium text-amber-600">
                        🗓{" "}
                        {new Date(order.deliveryDate).toLocaleDateString("uz-UZ", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {order.preparedAt && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        ✅
                      </span>
                    )}
                    <button
                      onClick={() => printAllOrders([order])}
                      title={t("Chop etish")}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={() => router.push("/sales/orders")}
                className="text-xs font-medium text-cocoa-600 hover:underline"
              >
                {t("Buyurtmalar sahifasiga o'tish →")}
              </button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
