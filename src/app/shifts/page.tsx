"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { salesService, type UploadedShiftPhoto } from "@/services/sales";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import type { ShiftWithMeta, ShiftReport, PaymentMethod } from "@/lib/types";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") ?? "";

function photoSrc(url: string) {
  return url.startsWith("data:") || url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

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

type DayGroup = { date: string; shifts: ShiftWithMeta[] };
type DayDetail = {
  loading: boolean;
  reports: Map<string, ShiftReport>;
  dayTotal: number;
  dayGroups: number;
  byMethod: { method: PaymentMethod; count: number; total: number }[];
};

// ─── Photo lightbox ───────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="fullscreen"
        className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Photos tab ───────────────────────────────────────────────────────────────

function PhotosTab() {
  const { t } = useI18n();
  const toast = useToast();
  const [photoShifts, setPhotoShifts] = useState<UploadedShiftPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesService.listUploadedShiftPhotos();
      setPhotoShifts(data);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteAll() {
    setDeletingAll(true);
    setConfirmAll(false);
    let failed = 0;
    for (const s of photoShifts) {
      for (const photo of s.photos) {
        try {
          await salesService.deleteShiftPhoto(s.id, photo);
        } catch {
          failed++;
        }
      }
    }
    if (failed > 0) toast.error(t("Xatolik"), `${failed} ta rasm o'chirilmadi`);
    await load();
    setDeletingAll(false);
  }

  async function handleDelete(shiftId: string, photo: string) {
    const key = `${shiftId}:${photo}`;
    setDeletingKey(key);
    try {
      await salesService.deleteShiftPhoto(shiftId, photo);
      setPhotoShifts((prev) =>
        prev
          .map((s) => ({ ...s, photos: s.photos.filter((p) => p !== photo) }))
          .filter((s) => s.photos.length > 0)
      );
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setDeletingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">{t("Yuklanmoqda...")}</div>
    );
  }

  if (photoShifts.length === 0) {
    return (
      <Card>
        <div className="py-16 text-center text-sm text-slate-400">{t("Rasmlar yo'q")}</div>
      </Card>
    );
  }

  // Kunlarga guruhlash
  const byDate = new Map<string, UploadedShiftPhoto[]>();
  for (const s of photoShifts) {
    const arr = byDate.get(s.date) ?? [];
    arr.push(s);
    byDate.set(s.date, arr);
  }
  const dateGroups = Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const totalPhotos = photoShifts.reduce((n, s) => n + s.photos.length, 0);

  return (
    <>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* Summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">
          {photoShifts.length} {t("ta smena")} · {totalPhotos} {t("ta rasm")}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={load} disabled={deletingAll}>{t("Yangilash")}</Button>
          {confirmAll ? (
            <>
              <span className="text-sm text-slate-500">{t("Ishonchingiz komilmi?")}</span>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {deletingAll ? t("O'chirilmoqda...") : t("Ha, hammasini o'chir")}
              </button>
              <button
                onClick={() => setConfirmAll(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                {t("Bekor")}
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmAll(true)}
              disabled={deletingAll}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition"
            >
              🗑 {t("Hammasini o'chir")}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {dateGroups.map(([date, shifts]) => (
          <div key={date}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              {safeDateLabel(date)}
            </h3>
            <div className="space-y-4">
              {shifts.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  {/* Smena sarlavhasi */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${s.status === "OPEN" ? "bg-emerald-500" : "bg-slate-400"}`} />
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {s.openedBy?.username ?? "—"}
                      </span>
                      {s.branch?.name && (
                        <span className="text-xs text-slate-400">· {s.branch.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">
                        {fmtTime(s.createdAt)} → {fmtTime(s.closedAt)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        s.status === "OPEN" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {s.status === "OPEN" ? t("Ochiq") : t("Yopilgan")}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {s.photos.length} {t("ta rasm")}
                      </span>
                    </div>
                  </div>

                  {/* Rasmlar */}
                  <div className="flex flex-wrap gap-3 p-4">
                    {s.photos.map((url) => {
                      const src = photoSrc(url);
                      const delKey = `${s.id}:${url}`;
                      return (
                        <div key={url} className="relative group">
                          <div
                            className="h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 cursor-pointer hover:opacity-90 transition"
                            onClick={() => setLightbox(src)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt="shift-photo"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          {/* Delete overlay */}
                          <button
                            onClick={() => handleDelete(s.id, url)}
                            disabled={deletingKey === delKey}
                            className="absolute top-1.5 right-1.5 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white text-xs shadow-md hover:bg-rose-700 transition disabled:opacity-50"
                            title={t("O'chirish")}
                          >
                            {deletingKey === delKey ? "…" : "✕"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();

  const [tab, setTab] = useState<"shifts" | "photos">("shifts");

  const [shifts, setShifts] = useState<ShiftWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayISO());

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
        } catch { /* ignore */ }
      })
    );

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
    if (expandedDate === date) { setExpandedDate(null); return; }
    setExpandedDate(date);
    if (!dayDetails.has(date)) loadDayDetail(date, dayShifts);
  }

  if (user?.role !== "ADMIN") {
    return (
      <Card>
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

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
          <h1 className="text-2xl font-bold text-slate-900">{t("Smenalar va rasmlar")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{t("Smena hisobotlari va filial rasmlari")}</p>
        </div>
        {tab === "shifts" && (
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
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
        {([
          { key: "shifts", label: "📋 Smenalar" },
          { key: "photos", label: "🖼 Rasmlar" },
        ] as const).map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
              tab === tb.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t(tb.label)}
          </button>
        ))}
      </div>

      {/* ── Shifts tab ── */}
      {tab === "shifts" && (
        <>
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
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                            {dayShifts.length} {t("ta smena")}
                          </span>
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

                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4">
                          {detail?.loading ? (
                            <div className="py-4 text-center text-sm text-slate-400">{t("Yuklanmoqda...")}</div>
                          ) : (
                            <>
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
        </>
      )}

      {/* ── Photos tab ── */}
      {tab === "photos" && <PhotosTab />}
    </div>
  );
}
