"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { salesService } from "@/services/sales";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import type { ShiftWithMeta, ShiftReport, PaymentMethod } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const METHOD_LABEL: Record<PaymentMethod, string> = { CASH: "Naqd", CARD: "Karta", TRANSFER: "O'tkazma" };
const METHOD_COLOR: Record<PaymentMethod, string> = {
  CASH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CARD: "bg-blue-50 text-blue-700 border-blue-200",
  TRANSFER: "bg-amber-50 text-amber-700 border-amber-200",
};

type DayGroup = {
  date: string;
  shifts: ShiftWithMeta[];
};

type DayDetail = {
  loading: boolean;
  reports: Map<string, ShiftReport>; // shiftId → report
  dayTotal: number;
  dayGroups: number;
  byMethod: { method: PaymentMethod; count: number; total: number }[];
};

export default function ShiftsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();

  const [shifts, setShifts] = useState<ShiftWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayISO());

  // expandedDate → DayDetail
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<Map<string, DayDetail>>(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    setExpandedDate(null);
    setDayDetails(new Map());
    try {
      const data = await salesService.listShifts({ from, to });
      setShifts(data);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [from, to, toast, t]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    refresh();
  }, [refresh, user?.role]);

  // Smena reportlarini yuklash va kunlik jami hisoblash
  async function loadDayDetail(date: string, dayShifts: ShiftWithMeta[]) {
    setDayDetails((prev) => {
      const next = new Map(prev);
      next.set(date, { loading: true, reports: new Map(), dayTotal: 0, dayGroups: 0, byMethod: [] });
      return next;
    });

    const reports = new Map<string, ShiftReport>();
    await Promise.all(
      dayShifts.map(async (s) => {
        try {
          const rep = await salesService.getShiftReport(s.id);
          reports.set(s.id, rep);
        } catch { /* smena reporti yo'q bo'lishi mumkin */ }
      })
    );

    // Kunlik jami hisoblash
    let dayTotal = 0;
    let dayGroups = 0;
    const methodMap = new Map<PaymentMethod, { method: PaymentMethod; count: number; total: number }>();
    for (const rep of reports.values()) {
      dayTotal += rep.totalAmount;
      dayGroups += rep.totalGroups;
      for (const m of rep.byPaymentMethod) {
        const ex = methodMap.get(m.method) ?? { method: m.method, count: 0, total: 0 };
        ex.count += m.count;
        ex.total += m.total;
        methodMap.set(m.method, ex);
      }
    }

    setDayDetails((prev) => {
      const next = new Map(prev);
      next.set(date, { loading: false, reports, dayTotal, dayGroups, byMethod: Array.from(methodMap.values()) });
      return next;
    });
  }

  function toggleDate(date: string, dayShifts: ShiftWithMeta[]) {
    if (expandedDate === date) {
      setExpandedDate(null);
      return;
    }
    setExpandedDate(date);
    if (!dayDetails.has(date)) {
      loadDayDetail(date, dayShifts);
    }
  }

  if (user?.role !== "ADMIN") {
    return (
      <Card>
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  // Smenalarni kunlarga guruhlash
  const dayMap = new Map<string, ShiftWithMeta[]>();
  for (const s of shifts) {
    const arr = dayMap.get(s.date) ?? [];
    arr.push(s);
    dayMap.set(s.date, arr);
  }
  const days: DayGroup[] = Array.from(dayMap.entries())
    .map(([date, dayShifts]) => ({ date, shifts: dayShifts }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalDays = days.length;
  const openCount = shifts.filter((s) => s.status === "OPEN").length;
  const closedCount = shifts.filter((s) => s.status === "CLOSED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("Smenalar")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{t("Barcha smena hisobotlari")}</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Kunlar")}</div>
            <div className="mt-0.5 text-lg font-bold text-slate-800">{totalDays}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Jami smena")}</div>
            <div className="mt-0.5 text-lg font-bold text-slate-800">{shifts.length}</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-center shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">{t("Ochiq")}</div>
            <div className="mt-0.5 text-lg font-bold text-emerald-700">{openCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Yopilgan")}</div>
            <div className="mt-0.5 text-lg font-bold text-slate-700">{closedCount}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input label={t("Dan")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-40">
            <Input label={t("Gacha")} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={refresh} disabled={loading}>
            {loading ? t("Yuklanmoqda...") : t("Izlash")}
          </Button>
        </div>
      </Card>

      {/* Days list */}
      <Card>
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">{t("Yuklanmoqda...")}</div>
        ) : days.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">{t("Smenalar topilmadi.")}</div>
        ) : (
          <div className="space-y-2">
            {days.map(({ date, shifts: dayShifts }) => {
              const isExpanded = expandedDate === date;
              const detail = dayDetails.get(date);
              const hasOpen = dayShifts.some((s) => s.status === "OPEN");
              const branchNames = [...new Set(dayShifts.map((s) => s.branch?.name).filter(Boolean))].join(", ");

              return (
                <div key={date} className="overflow-hidden rounded-xl border border-slate-200">
                  {/* Day row — header */}
                  <button
                    type="button"
                    onClick={() => toggleDate(date, dayShifts)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-white hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${hasOpen ? "bg-emerald-500" : "bg-slate-400"}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800">{safeDateLabel(date)}</div>
                        {branchNames && (
                          <div className="mt-0.5 text-xs text-slate-500 truncate">{branchNames}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Smena soni */}
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {dayShifts.length} {t("ta smena")}
                      </span>
                      {/* Kunlik jami (agar yuklangan bo'lsa) */}
                      {detail && !detail.loading && detail.dayTotal > 0 && (
                        <span className="text-sm font-bold text-emerald-700">{moneyUZS(detail.dayTotal)}</span>
                      )}
                      {detail?.loading && (
                        <span className="text-xs text-slate-400">{t("Yuklanmoqda...")}</span>
                      )}
                      {hasOpen && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {t("Ochiq")}
                        </span>
                      )}
                      <svg
                        className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded day detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4">
                      {detail?.loading ? (
                        <div className="py-4 text-center text-sm text-slate-400">{t("Yuklanmoqda...")}</div>
                      ) : (
                        <>
                          {/* Kunlik umumiy */}
                          {detail && (detail.dayTotal > 0 || detail.dayGroups > 0) && (
                            <div className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Kunlik umumiy")}</div>
                              <div className="flex flex-wrap items-center gap-4">
                                <div>
                                  <div className="text-[10px] text-slate-400">{t("Jami sotuv")}</div>
                                  <div className="text-xl font-bold text-emerald-700">{moneyUZS(detail.dayTotal)}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400">{t("Cheklar")}</div>
                                  <div className="text-xl font-bold text-slate-800">{detail.dayGroups}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400">{t("Smenalar")}</div>
                                  <div className="text-xl font-bold text-slate-800">{dayShifts.length}</div>
                                </div>
                              </div>
                              {detail.byMethod.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {detail.byMethod.map(({ method, total, count }) => (
                                    <span key={method} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${METHOD_COLOR[method]}`}>
                                      {t(METHOD_LABEL[method])}: {moneyUZS(total)} · {count} {t("ta")}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Har bir smena */}
                          <div className="space-y-2">
                            {dayShifts.map((s, idx) => {
                              const rep = detail?.reports.get(s.id);
                              const isOpen = s.status === "OPEN";
                              return (
                                <div key={s.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                        {idx + 1}
                                      </span>
                                      <div>
                                        <div className="text-sm font-semibold text-slate-800">
                                          {s.openedBy?.username ?? "—"}
                                          {s.branch?.name ? ` · ${s.branch.name}` : ""}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {fmtTime(s.createdAt)} → {fmtTime(s.closedAt)}
                                          {s.closingAmount != null
                                            ? ` · ${t("Yopilish")}: ${moneyUZS(Number(s.closingAmount))}`
                                            : ""}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      {rep && (
                                        <div className="text-right">
                                          <div className="text-sm font-bold text-emerald-700">{moneyUZS(rep.totalAmount)}</div>
                                          <div className="text-[11px] text-slate-500">{rep.totalGroups} {t("ta chek")}</div>
                                        </div>
                                      )}
                                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                        {isOpen ? t("Ochiq") : t("Yopilgan")}
                                      </span>
                                      <Link
                                        href={`/shifts/detail?id=${s.id}`}
                                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                                      >
                                        {t("Batafsil")}
                                      </Link>
                                    </div>
                                  </div>

                                  {/* To'lov usullari mini breakdown */}
                                  {rep && rep.byPaymentMethod.length > 0 && (
                                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 flex flex-wrap gap-2">
                                      {rep.byPaymentMethod.map(({ method, total, count }) => (
                                        <span key={method} className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${METHOD_COLOR[method]}`}>
                                          {t(METHOD_LABEL[method])}: {moneyUZS(total)} · {count} {t("ta")}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
