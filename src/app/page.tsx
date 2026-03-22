"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import Select from "@/components/ui/Select";

import { ensureSeed } from "@/lib/seed";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import { buildCSV, downloadCSV, fileStamp } from "@/lib/csv";

import { productsService } from "@/services/products";
import { expensesService } from "@/services/expenses";
import { expenseCategoriesService } from "@/services/categories";
import { statsService } from "@/services/stats";
import { SERVICE_MODE } from "@/services/config";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import type { Product, Expense, Category, StatsOverview } from "@/lib/types";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

type ReportRange = "week" | "month" | "year";

function getWeekBounds(year: number, week: number) {
  const d = new Date(year, 0, 1);
  const dayOfWeek = d.getDay();
  const daysToAdd = (week - 1) * 7 - dayOfWeek + 1;
  d.setDate(d.getDate() + daysToAdd);
  const from = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

function getMonthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function getYearBounds(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function getWeeksInYear(year: number) {
  const d = new Date(year, 11, 31);
  const week = getWeekNumber(d);
  return week === 1 ? 52 : week;
}

function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function Page() {
  const { t } = useI18n();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reportRange, setReportRange] = useState<ReportRange>("month");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date()));
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expCats, setExpCats] = useState<Category[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  const today = isoToday();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === "SALES" || user?.role === "MANAGER") {
      router.replace("/sales/sell");
      return;
    }
    if (user?.role === "PRODUCTION") {
      router.replace("/production/entry");
    }
  }, [authLoading, router, user?.role]);
  
  const rangeOptions = useMemo(
    () => [
      { value: "week" as const, label: t("Hafta") },
      { value: "month" as const, label: t("Oylik") },
      { value: "year" as const, label: t("Yillik") },
    ],
    [t]
  );

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 1; y++) {
      years.push({ value: String(y), label: String(y) });
    }
    return years;
  }, [currentYear]);

  const monthOptions = useMemo(
    () => [
      { value: "1", label: t("Yanvar") },
      { value: "2", label: t("Fevral") },
      { value: "3", label: t("Mart") },
      { value: "4", label: t("Aprel") },
      { value: "5", label: t("May") },
      { value: "6", label: t("Iyun") },
      { value: "7", label: t("Iyul") },
      { value: "8", label: t("Avgust") },
      { value: "9", label: t("Sentabr") },
      { value: "10", label: t("Oktabr") },
      { value: "11", label: t("Noyabr") },
      { value: "12", label: t("Dekabr") },
    ],
    [t]
  );

  const weekOptions = useMemo(() => {
    const weeks = [];
    const totalWeeks = getWeeksInYear(selectedYear);
    for (let w = 1; w <= totalWeeks; w++) {
      const bounds = getWeekBounds(selectedYear, w);
      const label = `${t("Hafta")} ${w} (${safeDateLabel(bounds.from)} - ${safeDateLabel(bounds.to)})`;
      weeks.push({ value: String(w), label });
    }
    return weeks;
  }, [selectedYear, t]);

  const rangeBounds = useMemo(() => {
    if (reportRange === "week") {
      return getWeekBounds(selectedYear, selectedWeek);
    } else if (reportRange === "month") {
      return getMonthBounds(selectedYear, selectedMonth);
    } else {
      return getYearBounds(selectedYear);
    }
  }, [reportRange, selectedYear, selectedMonth, selectedWeek]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatsError(null);
    if (SERVICE_MODE === "local") ensureSeed();

    const [ps, exps, cats, statsOverview] = await Promise.allSettled([
      productsService.list(),
      expensesService.list(),
      expenseCategoriesService.list(),
      statsService.overview(rangeBounds),
    ]);

    if (ps.status === "fulfilled") setProducts(ps.value);
    if (exps.status === "fulfilled") setExpenses(exps.value);
    if (cats.status === "fulfilled") setExpCats(cats.value);

    if (statsOverview.status === "fulfilled") {
      setStats(statsOverview.value);
    } else {
      const message = statsOverview.reason instanceof Error ? statsOverview.reason.message : String(statsOverview.reason);
      setStats(null);
      setStatsError(message);
      toast.error(t("Xatolik"), `${t("Dashboard ma'lumotlarini olishda xatolik")}: ${message}`);
    }

    setLoading(false);
  }, [rangeBounds, t, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === "SALES" || user?.role === "MANAGER" || user?.role === "PRODUCTION") return;
    refresh();
  }, [authLoading, refresh, user?.role]);

const expCatMap = useMemo(() => new Map(expCats.map((c) => [c.id, c.name])), [expCats]);

  const upcomingFeatures = useMemo(
    () => [
      {
        title: "Buyurtmalar",
        description: "Buyurtmani qabul qilish va yetkazib berish bo'limlari uchun tayyorlash",
      },
      {
        title: "Platformalar",
        description: "Website, Telegram bot va mobilga yangi modullarini kengaytirish",
      },
      {
        title: "Kassa & Xarajatlar",
        description: "Filial va do'konlar uchun kassa, ingredient, dekor va kommunal to'lovlar paneli",
      },
      {
        title: "Transfer + Vazvrat",
        description: "Filiallarga transferlar, qabul qilish va vazvratlar avtomatik tarzda boshqariladi",
      },
    ],
    []
  );

  const statCards = useMemo(
    () => [
      {
        id: "revenue",
        title: "Umumiy daromad",
        value: (data: StatsOverview) => moneyUZS(data.revenue),
        variant: "info" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        id: "received",
        title: "Olingan pullar",
        value: (data: StatsOverview) => moneyUZS(data.received),
        variant: "success" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 7h18v10H3zM3 10h18" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="14" r="2" strokeWidth="1.5"/>
          </svg>
        ),
      },
      {
        id: "expenses-total",
        title: "Xarajatlar yig'indisi",
        value: (data: StatsOverview) => moneyUZS(data.expensesTotal),
        variant: "warning" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 7h14v12H5zM8 5h8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        id: "profit",
        title: "Sof foyda",
        value: (data: StatsOverview) => moneyUZS(data.netProfit),
        hint: t("Daromad - xarajat"),
        variant: "success" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="16 7 22 7 22 13" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        id: "returns",
        title: "Umumiy vazvrat",
        value: (data: StatsOverview) => moneyUZS(data.returns),
        variant: "danger" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 7H4v3m0-3 4 4m-4-4h9a6 6 0 1 1 0 12h-3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        id: "branch-value",
        title: "Filial omborlari narxi",
        value: (data: StatsOverview) => moneyUZS(data.branchValue),
        variant: "default" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 10 12 4l9 6v10H3z" strokeLinejoin="round"/>
            <path d="M9 21v-6h6v6" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        id: "products",
        title: "Mahsulotlar soni",
        value: (data: StatsOverview) => String(data.productsCount),
        variant: "default" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16v13H4zM7 4h10v3H7z" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        id: "workers",
        title: "Ishchilar soni",
        value: (data: StatsOverview) => String(data.workersCount),
        variant: "default" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" strokeLinejoin="round"/>
            <path d="M3.5 19a5 5 0 0 1 10 0m1.5 0a4 4 0 0 1 5.5-3.5" strokeLinecap="round"/>
          </svg>
        ),
      },
      {
        id: "branch-shop",
        title: "Filial va do'konlar soni",
        value: (data: StatsOverview) => String(data.branchShopCount),
        variant: "default" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 9h16l-1-4H5l-1 4Zm1 0v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        id: "expenses-count",
        title: "Xarajatlar soni",
        value: (data: StatsOverview) => String(data.expensesCount),
        variant: "default" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 7H6l-1 11h14L18 7h-3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 7a3 3 0 0 1 6 0" strokeLinecap="round"/>
          </svg>
        ),
      },
      {
        id: "categories",
        title: "Kategoriyalar soni",
        value: (data: StatsOverview) => String(data.categoriesCount),
        variant: "default" as const,
        icon: (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" strokeLinejoin="round"/>
          </svg>
        ),
      },
    ],
    [t]
  );

  function exportExpensesCSV() {
    const headers = ["Date", "Category", "Payment", "Amount_UZS", "Note"];
    const rows = expenses.map((e) => [
      e.date,
      expCatMap.get(e.categoryId) ?? "",
      e.paymentMethod,
      e.amount,
      e.note ?? "",
    ]);
    const csv = buildCSV(headers, rows);
    downloadCSV(`ruxshona-expenses-${fileStamp()}.csv`, csv);
  }

function exportProductsCSV() {
  const headers = ["Name", "Price_UZS", "SalePrice_UZS", "ShopPrice_UZS", "Active"];
  const rows = products.map((p) => [
    p.name,
    typeof p.price === "number" ? p.price : "",
    typeof p.salePrice === "number" ? p.salePrice : "",
    typeof p.shopPrice === "number" ? p.shopPrice : "",
    p.active ? "YES" : "NO",
  ]);
  const csv = buildCSV(headers, rows);
  downloadCSV(`ruxshona-products-${fileStamp()}.csv`, csv);
}

  if (authLoading || user?.role === "SALES" || user?.role === "MANAGER" || user?.role === "PRODUCTION") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cocoa-900">{t("Bosh panel")}</h1>
          <p className="mt-0.5 text-sm text-cocoa-500">
            {safeDateLabel(today)}
            <span className="mx-2 text-cocoa-300">·</span>
            <span className="font-medium text-berry-700">{SERVICE_MODE}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={exportProductsCSV} disabled={products.length === 0} className="text-xs px-3 py-1.5">
            {t("Mahsulotlar CSV")}
          </Button>
          <Button variant="ghost" onClick={exportExpensesCSV} disabled={expenses.length === 0} className="text-xs px-3 py-1.5">
            {t("Xarajatlar CSV")}
          </Button>
          <Button onClick={refresh} disabled={loading} className="text-xs px-3 py-1.5">
            {loading ? t("Yuklanmoqda...") : t("Yangilash")}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {statsError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {t("Dashboard ma'lumotlarini olishda xatolik")}: {statsError}
        </div>
      ) : null}

      {/* Period filter */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-cream-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-cocoa-500">{t("Davr")}:</span>
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                reportRange === option.value
                  ? "bg-berry-700 text-white shadow-glow-sm"
                  : "border border-cream-200 bg-cream-50 text-cocoa-600 hover:bg-cream-100"
              }`}
              onClick={() => setReportRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Select
          label={t("Yil")}
          value={String(selectedYear)}
          onChange={(e) => {
            const year = parseInt(e.target.value);
            setSelectedYear(year);
            if (reportRange === "week") {
              const maxWeek = getWeeksInYear(year);
              if (selectedWeek > maxWeek) setSelectedWeek(maxWeek);
            }
          }}
          options={yearOptions}
          className="min-w-[110px]"
        />
        {reportRange === "month" && (
          <Select
            label={t("Oy")}
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            options={monthOptions}
            className="min-w-[130px]"
          />
        )}
        {reportRange === "week" && (
          <Select
            label={t("Hafta")}
            value={String(selectedWeek)}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
            options={weekOptions}
            className="min-w-[130px]"
          />
        )}
        <Button onClick={refresh} disabled={loading} className="text-xs px-4 py-2">
          {loading ? t("Yuklanmoqda...") : t("Qo'llash")}
        </Button>
      </div>

      {/* Financial KPI row */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-cocoa-400">{t("Moliyaviy ko'rsatkichlar")}</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.slice(0, 4).map((card) => (
            <StatCard
              key={card.id}
              title={t(card.title)}
              value={stats ? card.value(stats) : loading ? "..." : "—"}
              hint={card.hint}
              variant={card.variant}
              icon={card.icon}
            />
          ))}
        </div>
      </div>

      {/* Returns + Stock row */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-cocoa-400">{t("Vazvrat va ombor")}</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {statCards.slice(4, 7).map((card) => (
            <StatCard
              key={card.id}
              title={t(card.title)}
              value={stats ? card.value(stats) : loading ? "..." : "—"}
              hint={card.hint}
              variant={card.variant}
              icon={card.icon}
            />
          ))}
        </div>
      </div>

      {/* Counts row */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-cocoa-400">{t("Umumiy ma'lumotlar")}</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {statCards.slice(7).map((card) => (
            <StatCard
              key={card.id}
              title={t(card.title)}
              value={stats ? card.value(stats) : loading ? "..." : "—"}
              hint={card.hint}
              variant={card.variant}
              icon={card.icon}
            />
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-cocoa-400">{t("Tezkor havolalar")}</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { href: "/reports",        label: t("Hisobotlar"),      color: "text-blue-600  bg-blue-50  border-blue-100"  },
            { href: "/cash/shops",     label: t("Do'kon kassa"),    color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { href: "/cash/branches",  label: t("Filial kassa"),    color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { href: "/expenses",       label: t("Xarajatlar"),      color: "text-amber-600  bg-amber-50  border-amber-100"  },
            { href: "/dashboard/shops",label: t("Do'konlar"),       color: "text-violet-600 bg-violet-50 border-violet-100" },
            { href: "/dashboard/branches", label: t("Filiallar"),   color: "text-violet-600 bg-violet-50 border-violet-100" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`flex items-center justify-center rounded-xl border px-3 py-3 text-center text-xs font-semibold transition hover:shadow-card-md ${link.color}`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
