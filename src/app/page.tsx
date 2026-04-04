"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { apiFetch } from "@/services/http";
import { moneyUZS } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsOverview {
  revenue: number;
  expensesTotal: number;
  netProfit: number;
  branchValue: number;
  productsCount: number;
  workersCount: number;
  branchShopCount: number;
  returns: number;
}

interface TimeseriesPoint { start: string; end: string; value: number }
interface SegmentRow { key: string; label: string; value: number }

interface ShopBranchRow {
  key: string;
  label: string;
  transfers: number;
  returns: number;
  payments: number;
  debt: number;
}

interface BranchCash {
  branchId: string;
  branchName: string;
  currentCash: number;
  shiftStatus: "OPEN" | "CLOSED" | null;
  shiftDate: string | null;
  hasData: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}
function weekStart() { return daysAgo(6); }

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}-${d.toLocaleString("uz-UZ",{month:"short"})}`;
}

// ─── Mini bar chart (pure CSS) ────────────────────────────────────────────────

function BarChart({ points, color = "#8F1D1D" }: { points: TimeseriesPoint[]; color?: string }) {
  const max = Math.max(...points.map(p => p.value), 1);
  return (
    <div className="flex-1 flex flex-col min-h-0 gap-1">
      {/* Bar area — fills all available height */}
      <div className="flex-1 flex items-end gap-[3px] min-h-0">
        {points.map((p, i) => {
          const pct = Math.max((p.value / max) * 100, 1.5);
          return (
            <div key={i} className="flex-1 min-w-0 h-full flex flex-col justify-end group relative">
              <div
                className="absolute z-10 hidden group-hover:flex flex-col items-center
                            bg-slate-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg pointer-events-none"
                style={{ bottom: `calc(${pct}% + 6px)`, left: "50%", transform: "translateX(-50%)" }}
              >
                <span>{fmtDate(p.start)}</span>
                <span className="font-bold">{moneyUZS(p.value)}</span>
              </div>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: `${pct}%`, background: color, opacity: p.value > 0 ? 0.85 : 0.2 }}
              />
            </div>
          );
        })}
      </div>
      {/* Label row — fixed below bars */}
      <div className="flex gap-[3px] shrink-0">
        {points.map((p, i) => (
          <span key={i} className="flex-1 min-w-0 text-[8px] text-slate-400 truncate text-center leading-tight">
            {fmtDate(p.start)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = "bg-white", textColor = "text-slate-800", icon
}: {
  label: string; value: string; sub?: string;
  color?: string; textColor?: string; icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${color} px-5 py-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <div className={`text-2xl font-black tabular-nums ${textColor}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HBar({ label, value, max, color = "#8F1D1D", rank }: {
  label: string; value: number; max: number; color?: string; rank?: number;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, 1) : 1;
  return (
    <div className="flex items-center gap-3">
      {rank != null && (
        <span className="w-5 text-center text-xs font-bold text-slate-400 shrink-0">{rank}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-0.5">
          <span className="text-sm font-medium text-slate-700 truncate max-w-[60%]">{label}</span>
          <span className="text-sm font-bold text-slate-800 tabular-nums ml-2 shrink-0">{moneyUZS(value)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

// ─── Period selector ─────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "custom";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "week",  label: "7 kun" },
  { key: "month", label: "Oy" },
  { key: "custom", label: "Belgilash" },
];

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function Page() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState(daysAgo(30));
  const [customTo, setCustomTo] = useState(today());
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [chartPoints, setChartPoints] = useState<TimeseriesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<SegmentRow[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<SegmentRow[]>([]);
  const [branches, setBranches] = useState<BranchCash[]>([]);
  const [totalBranchCash, setTotalBranchCash] = useState(0);
  const [shopBranchTable, setShopBranchTable] = useState<ShopBranchRow[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === "SALES" || user?.role === "MANAGER") { router.replace("/sales/sell"); return; }
    if (user?.role === "PRODUCTION") { router.replace("/production/entry"); return; }
  }, [authLoading, router, user?.role]);

  const range = useCallback((): { from: string; to: string } => {
    switch (period) {
      case "today":  return { from: today(), to: today() };
      case "week":   return { from: weekStart(), to: today() };
      case "month":  return { from: monthStart(), to: today() };
      case "custom": return { from: customFrom, to: customTo };
    }
  }, [period, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = range();
    const qs = `from=${from}&to=${to}`;
    // 7-day chart always shows last 30 days daily
    const chartFrom = daysAgo(29);
    const chartQs = `metric=revenue&granularity=day&from=${chartFrom}&to=${today()}`;

    try {
      const [
        statsRes, chartRes, topProductsRes, expCatRes, branchCashRes,
        tBranchRes, tShopRes, rBranchRes, rShopRes, pBranchRes, pShopRes, dBranchRes, dShopRes,
      ] = await Promise.allSettled([
        apiFetch<StatsOverview>(`/stats/overview?${qs}`),
        apiFetch<{ points: TimeseriesPoint[] }>(`/reports/timeseries?${chartQs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=revenue&segmentBy=product&${qs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=expenses&segmentBy=category&${qs}`),
        apiFetch<BranchCash[]>(`/sales/all-branches-cash`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=transfers&segmentBy=branch&${qs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=transfers&segmentBy=shop&${qs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=returns&segmentBy=branch&${qs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=returns&segmentBy=shop&${qs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=payments&segmentBy=branch&${qs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=payments&segmentBy=shop&${qs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=debt&segmentBy=branch&${qs}`),
        apiFetch<SegmentRow[]>(`/reports/segments?metric=debt&segmentBy=shop&${qs}`),
      ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (chartRes.status === "fulfilled") setChartPoints(chartRes.value.points ?? []);
      if (topProductsRes.status === "fulfilled") setTopProducts(topProductsRes.value.slice(0, 10));
      if (expCatRes.status === "fulfilled") setExpensesByCategory(expCatRes.value.slice(0, 8));
      if (branchCashRes.status === "fulfilled") {
        setBranches(branchCashRes.value);
        setTotalBranchCash(branchCashRes.value.reduce((s, b) => s + b.currentCash, 0));
      }

      // Do'konlar/filiallar jadvali: branch + shop birlashtirish
      {
        function rows(res: PromiseSettledResult<unknown>): SegmentRow[] {
          return res.status === "fulfilled" ? (res.value as SegmentRow[]) : [];
        }
        function toMap(list: SegmentRow[]): Map<string, SegmentRow> {
          const m = new Map<string, SegmentRow>();
          for (const r of list) {
            const ex = m.get(r.key);
            m.set(r.key, { key: r.key, label: r.label, value: (ex?.value ?? 0) + r.value });
          }
          return m;
        }
        function merge(a: Map<string, SegmentRow>, b: Map<string, SegmentRow>) {
          const out = new Map(a);
          b.forEach((v, k) => {
            const ex = out.get(k);
            out.set(k, { key: k, label: v.label, value: (ex?.value ?? 0) + v.value });
          });
          return out;
        }

        const tMap = merge(toMap(rows(tBranchRes)), toMap(rows(tShopRes)));
        const rMap = merge(toMap(rows(rBranchRes)), toMap(rows(rShopRes)));
        const pMap = merge(toMap(rows(pBranchRes)), toMap(rows(pShopRes)));
        const dMap = merge(toMap(rows(dBranchRes)), toMap(rows(dShopRes)));

        const allKeys = new Set([
          ...tMap.keys(),
          ...rMap.keys(),
          ...pMap.keys(),
          ...dMap.keys(),
        ]);
        const tableRows: ShopBranchRow[] = Array.from(allKeys).map(key => {
          const label =
            dMap.get(key)?.label ??
            tMap.get(key)?.label ??
            rMap.get(key)?.label ??
            pMap.get(key)?.label ??
            key;
          const transfers = tMap.get(key)?.value ?? 0;
          const returns   = rMap.get(key)?.value ?? 0;
          const payments  = pMap.get(key)?.value ?? 0;
          const debt = dMap.get(key)?.value ?? (transfers - returns - payments);
          return { key, label, transfers, returns, payments, debt };
        }).sort((a, b) => b.transfers - a.transfers);
        setShopBranchTable(tableRows);
      }
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setLoading(false);
    }
  }, [range, t, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === "SALES" || user?.role === "MANAGER" || user?.role === "PRODUCTION") return;
    load();
  }, [authLoading, load, user?.role]);

  if (authLoading || user?.role === "SALES" || user?.role === "MANAGER" || user?.role === "PRODUCTION") return null;

  const topProductMax = topProducts[0]?.value ?? 1;
  const expCatMax = expensesByCategory[0]?.value ?? 1;
  const openBranches = branches.filter(b => b.shiftStatus === "OPEN").length;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("Bosh panel")}</h1>
          <p className="mt-0.5 text-sm text-slate-400">{new Date().toLocaleDateString("uz-UZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
        >
          <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? t("Yuklanmoqda...") : t("Yangilash")}
        </button>
      </div>

      {/* ── Period filter ── */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              period === p.key
                ? "bg-[#8F1D1D] text-white shadow"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t(p.label)}
          </button>
        ))}
        {period === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-[#8F1D1D]" />
            <span className="text-slate-400 text-sm">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-[#8F1D1D]" />
            <button onClick={() => void load()}
              className="rounded-xl bg-[#8F1D1D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7a1818]">
              {t("Qo'llash")}
            </button>
          </>
        )}
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={t("Umumiy daromad")}
          value={stats ? moneyUZS(stats.revenue) : "..."}
          sub={t("Tanlangan davr")}
          color="bg-emerald-50"
          textColor="text-emerald-700"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        />
        <KpiCard
          label={t("Xarajatlar")}
          value={stats ? moneyUZS(stats.expensesTotal) : "..."}
          sub={t("Tanlangan davr")}
          color="bg-rose-50"
          textColor="text-rose-700"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" d="M5 7h14v12H5zM8 5h8"/></svg>}
        />
        <KpiCard
          label={t("Sof foyda")}
          value={stats ? moneyUZS(stats.netProfit) : "..."}
          sub={t("Daromad − xarajat")}
          color={stats && stats.netProfit < 0 ? "bg-rose-50" : "bg-blue-50"}
          textColor={stats && stats.netProfit < 0 ? "text-rose-700" : "text-blue-700"}
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><polyline strokeLinecap="round" points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline strokeLinecap="round" points="16 7 22 7 22 13"/></svg>}
        />
        <KpiCard
          label={t("Kassalar qoldig'i")}
          value={moneyUZS(totalBranchCash)}
          sub={`${openBranches} ${t("ta smena ochiq")} · ${branches.length} ${t("ta filial")}`}
          color="bg-amber-50"
          textColor="text-amber-700"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.5"/></svg>}
        />
      </div>

      {/* ── 30-day chart + mini stats ── */}
      <div className="grid gap-4 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="mb-3 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-bold text-slate-700">{t("30 kunlik sotuv dinamikasi")}</h2>
            <span className="text-xs text-slate-400">{t("Kunlik daromad")}</span>
          </div>
          {chartPoints.length > 0
            ? <BarChart points={chartPoints} color="#8F1D1D" />
            : <div className="flex-1 flex items-center justify-center text-sm text-slate-400">{loading ? t("Yuklanmoqda...") : t("Ma'lumot yo'q")}</div>
          }
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-700">{t("Umumiy ko'rsatkichlar")}</h2>
          <div className="space-y-3">
            {[
              { label: t("Mahsulotlar soni"), value: String(stats?.productsCount ?? "—"), icon: "📦" },
              { label: t("Ishchilar soni"), value: String(stats?.workersCount ?? "—"), icon: "👥" },
              { label: t("Filial + Do'konlar"), value: String(stats?.branchShopCount ?? "—"), icon: "🏪" },
              { label: t("Ombor qiymati"), value: stats ? moneyUZS(stats.branchValue) : "—", icon: "🏭" },
              { label: t("Vazvrat"), value: stats ? moneyUZS(stats.returns) : "—", icon: "↩️" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>{row.icon}</span>
                  <span>{row.label}</span>
                </div>
                <span className="text-sm font-bold text-slate-800 tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Branches + Top products ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Filiallar holati */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">{t("Filiallar — joriy kassa")}</h2>
            <span className="text-xs font-semibold text-slate-400">{t("Jami")}: {moneyUZS(totalBranchCash)}</span>
          </div>
          {branches.length === 0
            ? <div className="py-8 text-center text-sm text-slate-400">{loading ? t("Yuklanmoqda...") : t("Filiallar yo'q")}</div>
            : (
              <div className="space-y-2">
                {branches.map((b) => (
                  <div key={b.branchId} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                    b.shiftStatus === "OPEN"
                      ? "border-emerald-200 bg-emerald-50"
                      : b.hasData
                      ? "border-slate-200 bg-slate-50"
                      : "border-amber-200 bg-amber-50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        b.shiftStatus === "OPEN" ? "bg-emerald-500" : b.hasData ? "bg-slate-400" : "bg-amber-400"
                      }`}/>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{b.branchName}</div>
                        <div className="text-xs text-slate-500">
                          {b.shiftStatus === "OPEN"
                            ? `🟢 ${t("Smena ochiq")}${b.shiftDate ? ` · ${b.shiftDate}` : ""}`
                            : b.hasData
                            ? `⚫ ${t("Yopilgan")}${b.shiftDate ? ` · ${b.shiftDate}` : ""}`
                            : `⚠️ ${t("Ma'lumot yo'q")}`}
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-black tabular-nums ${
                      b.shiftStatus === "OPEN" ? "text-emerald-700" : "text-slate-700"
                    }`}>
                      {b.currentCash.toLocaleString()}
                      <span className="text-xs font-normal ml-1 text-slate-400">{t("so'm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Top mahsulotlar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">{t("Ko'p sotiladigan mahsulotlar")}</h2>
            <span className="text-xs text-slate-400">{t("Daromad bo'yicha")}</span>
          </div>
          {topProducts.length === 0
            ? <div className="py-8 text-center text-sm text-slate-400">{loading ? t("Yuklanmoqda...") : t("Sotuv ma'lumoti yo'q")}</div>
            : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <HBar
                    key={p.key}
                    rank={i + 1}
                    label={p.label}
                    value={p.value}
                    max={topProductMax}
                    color={i === 0 ? "#8F1D1D" : i === 1 ? "#B64242" : i === 2 ? "#E07A5F" : "#94a3b8"}
                  />
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* ── Expenses by category + Profit by product ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Xarajatlar kategoriya bo'yicha */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">{t("Xarajatlar kategoriya bo'yicha")}</h2>
            <span className="text-xs font-semibold text-rose-600">{stats ? moneyUZS(stats.expensesTotal) : "..."}</span>
          </div>
          {expensesByCategory.length === 0
            ? <div className="py-8 text-center text-sm text-slate-400">{loading ? t("Yuklanmoqda...") : t("Xarajat yo'q")}</div>
            : (
              <div className="space-y-3">
                {expensesByCategory.map((e, i) => {
                  const pct = stats?.expensesTotal ? Math.round((e.value / stats.expensesTotal) * 100) : 0;
                  return (
                    <HBar
                      key={e.key}
                      rank={i + 1}
                      label={`${e.label} (${pct}%)`}
                      value={e.value}
                      max={expCatMax}
                      color={["#be123c","#dc2626","#ef4444","#f87171","#fca5a5","#fecaca","#fee2e2","#fff1f2"][i] ?? "#e2e8f0"}
                    />
                  );
                })}
              </div>
            )
          }
        </div>

        {/* Foyda/zarar xulosasi */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-700">{t("Moliyaviy xulosa")}</h2>
          {stats ? (
            <div className="space-y-4">
              {/* Visual profit breakdown */}
              {[
                { label: t("Daromad"), value: stats.revenue, color: "bg-emerald-500" },
                { label: t("Xarajatlar"), value: stats.expensesTotal, color: "bg-rose-500" },
                { label: t("Vazvrat"), value: stats.returns, color: "bg-amber-400" },
              ].map(row => {
                const max = Math.max(stats.revenue, stats.expensesTotal, stats.returns, 1);
                const pct = Math.min(Math.round((row.value / max) * 100), 100);
                return (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-600">{row.label}</span>
                      <span className="font-bold text-slate-800 tabular-nums">{moneyUZS(row.value)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(pct,1)}%` }} />
                    </div>
                  </div>
                );
              })}

              {/* Profit result */}
              <div className={`mt-2 rounded-xl px-4 py-4 text-center ${
                stats.netProfit >= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"
              }`}>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{t("Sof foyda")}</div>
                <div className={`text-3xl font-black tabular-nums ${stats.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {stats.netProfit >= 0 ? "+" : ""}{moneyUZS(stats.netProfit)}
                </div>
                {stats.revenue > 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    {t("Margin")}: {Math.round((stats.netProfit / stats.revenue) * 100)}%
                  </div>
                )}
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { href: "/reports", label: t("Batafsil hisobot") },
                  { href: "/sales/journal", label: t("Kassa jurnali") },
                  { href: "/expenses", label: t("Xarajatlar") },
                  { href: "/reports/profit", label: t("Foyda hisoboti") },
                ].map(link => (
                  <a key={link.href} href={link.href}
                    className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition text-center">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">{loading ? t("Yuklanmoqda...") : t("Ma'lumot yo'q")}</div>
          )}
        </div>
      </div>

      {/* ── Do'konlar / Filiallar jadvali ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-700">{t("Do'konlar va filiallar hisoboti")}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{t("Mahsulot, vazvrat, to'lov va qarz")}</p>
          </div>
          <span className="text-xs text-slate-400">{t("Tanlangan davr")}</span>
        </div>

        {shopBranchTable.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {loading ? t("Yuklanmoqda...") : t("Ma'lumot yo'q")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("Filial / Do'kon")}</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">{t("Olib ketilgan")}</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-emerald-600 text-right">{t("Qaytarilgan")}</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-blue-600 text-right">{t("To'langan")}</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-rose-600 text-right">{t("Qarz")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shopBranchTable.map((row, i) => (
                  <tr key={row.key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{row.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800 tabular-nums">
                      {moneyUZS(row.transfers)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-700 tabular-nums">
                      {row.returns > 0 ? moneyUZS(row.returns) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-blue-700 tabular-nums">
                      {row.payments > 0 ? moneyUZS(row.payments) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                        row.debt > 0
                          ? "bg-rose-50 text-rose-700"
                          : row.debt < 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {row.debt > 0 ? "+" : ""}{moneyUZS(row.debt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {shopBranchTable.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("Jami")}</td>
                    <td className="px-5 py-3 text-right text-sm font-black text-slate-800 tabular-nums">
                      {moneyUZS(shopBranchTable.reduce((s, r) => s + r.transfers, 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-black text-emerald-700 tabular-nums">
                      {moneyUZS(shopBranchTable.reduce((s, r) => s + r.returns, 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-black text-blue-700 tabular-nums">
                      {moneyUZS(shopBranchTable.reduce((s, r) => s + r.payments, 0))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(() => {
                        const totalDebt = shopBranchTable.reduce((s, r) => s + r.debt, 0);
                        return (
                          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-black ${
                            totalDebt > 0 ? "bg-rose-50 text-rose-700" : totalDebt < 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {totalDebt > 0 ? "+" : ""}{moneyUZS(totalDebt)}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
