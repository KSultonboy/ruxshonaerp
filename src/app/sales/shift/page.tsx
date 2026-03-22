"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ShiftCloseModal from "@/components/sales/ShiftCloseModal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { salesService } from "@/services/sales";
import { moneyUZS } from "@/lib/format";
import type { Shift, Sale, PaymentMethod, ShiftWithMeta } from "@/lib/types";

type MethodStat = { method: PaymentMethod; count: number; total: number };

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Naqd", CARD: "Karta", TRANSFER: "O'tkazma",
};
const METHOD_COLOR: Record<PaymentMethod, string> = {
  CASH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CARD: "bg-blue-50 text-blue-700 border-blue-200",
  TRANSFER: "bg-amber-50 text-amber-700 border-amber-200",
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

  // Joriy smena statistikasi
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [byMethod, setByMethod] = useState<MethodStat[]>([]);

  // Kunlik umumiy statistika
  const [dayTotal, setDayTotal] = useState(0);
  const [dayGroups, setDayGroups] = useState(0);
  const [dayByMethod, setDayByMethod] = useState<MethodStat[]>([]);
  const [closeWarningShown, setCloseWarningShown] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const loadStats = useCallback(async (activeShift: Shift) => {
    try {
      const report = await salesService.getShiftReport(activeShift.id);
      setTotalAmount(report.totalAmount);
      setTotalGroups(report.totalGroups);
      setByMethod(report.byPaymentMethod);
    } catch { /* ignore */ }
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
      if (s?.status === "OPEN") await loadStats(s);
      await loadDayStats();
    } catch { setShift(null); }
    finally { setLoading(false); }
  }, [loadStats, loadDayStats, today]);

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

        {/* Kunlik umumiy — agar 2+ smena bo'lsa yoki yopilgan smenalar bo'lsa */}
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

        {/* Yopilgan smenalar ro'yxati (bugun) */}
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

        {/* Joriy ochiq smena statistikasi */}
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
          </>
        )}

        {/* Photo upload */}
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
                <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2">
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

        {/* Actions */}
        <Card>
          <div className="flex flex-wrap gap-3">
            {isOpen && (
              <Button variant="danger" onClick={() => setShowCloseModal(true)}>
                {t("Smena yopish")}
              </Button>
            )}
            <Button variant="secondary" onClick={refresh}>{t("Yangilash")}</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
