"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import LineChart from "@/components/ui/LineChart";
import { Table, T } from "@/components/ui/Table";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { reportsService, type ReportType } from "@/services/reports";
import { branchesService } from "@/services/branches";
import { shopsService } from "@/services/shops";
import { categoriesService, expenseCategoriesService } from "@/services/categories";
import { productsService } from "@/services/products";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import { downloadCSV, fileStamp } from "@/lib/csv";
import type {
  Branch,
  Category,
  PaymentMethod,
  PaymentSourceType,
  Product,
  ReportFilters,
  ReportGranularity,
  ReportMetric,
  ReportOverview,
  ReportSegmentBy,
  ReportSegmentRow,
  ReportSeries,
  Shop,
} from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function movingAverage(values: number[], windowSize: number) {
  if (!values.length) return [];
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= windowSize) sum -= values[i - windowSize];
    const denom = i < windowSize ? i + 1 : windowSize;
    result.push(sum / denom);
  }
  return result;
}

function cumulative(values: number[]) {
  const result: number[] = [];
  let total = 0;
  for (const value of values) {
    total += value;
    result.push(total);
  }
  return result;
}

const METRIC_COLORS: Record<ReportMetric, string> = {
  revenue: "#b45309",
  expenses: "#be123c",
  payments: "#0f766e",
  transfers: "#1d4ed8",
  returns: "#0f766e",
  netProfit: "#16a34a",
  debt: "#b91c1c",
};

const SEGMENT_COLORS = ["#8F1D1D", "#B64242", "#E07A5F", "#7F5539", "#52796F", "#2A9D8F", "#1D4ED8", "#0F766E"];

const EXPORT_FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
  { value: "pdf", label: "PDF" },
] as const;

type ExportFormat = (typeof EXPORT_FORMATS)[number]["value"];

type DrillState = {
  from: string;
  to: string;
  granularity: ReportGranularity;
};

export default function ReportsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const [metric, setMetric] = useState<ReportMetric>("revenue");
  const [granularity, setGranularity] = useState<ReportGranularity>("week");
  const [segmentBy, setSegmentBy] = useState<ReportSegmentBy>("none");
  const [branchId, setBranchId] = useState("");
  const [shopId, setShopId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [series, setSeries] = useState<ReportSeries | null>(null);
  const [segments, setSegments] = useState<ReportSegmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportType, setExportType] = useState<ReportType>("sales");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exporting, setExporting] = useState(false);
  const [monthlyExporting, setMonthlyExporting] = useState(false);
  const [drillStack, setDrillStack] = useState<DrillState[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [branchData, shopData, categoryData, expenseCategoryData, productData] = await Promise.all([
          branchesService.list(),
          shopsService.list(),
          categoriesService.list(),
          expenseCategoriesService.list(),
          productsService.list(),
        ]);
        if (!active) return;
        setBranches(branchData);
        setShops(shopData);
        setCategories(categoryData);
        setExpenseCategories(expenseCategoryData);
        setProducts(productData);
      } catch (e: any) {
        if (!active) return;
        toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t, toast]);

  const filters = useMemo<ReportFilters>(
    () => ({
      from: from || undefined,
      to: to || undefined,
      branchId: branchId || undefined,
      shopId: shopId || undefined,
      productId: productId || undefined,
      categoryId: categoryId || undefined,
      paymentMethod: (paymentMethod || undefined) as PaymentMethod | undefined,
      sourceType: (sourceType || undefined) as PaymentSourceType | undefined,
    }),
    [branchId, categoryId, from, paymentMethod, productId, shopId, sourceType, to]
  );

  const filterSupport = useMemo(() => {
    const base = {
      branch: false,
      shop: false,
      product: false,
      category: false,
      paymentMethod: false,
      sourceType: false,
    };
    switch (metric) {
      case "revenue":
        return { ...base, branch: true, product: true, category: true, paymentMethod: true };
      case "expenses":
        return { ...base, category: true, paymentMethod: true };
      case "payments":
        return { ...base, branch: true, shop: true, paymentMethod: true, sourceType: true };
      case "transfers":
      case "returns":
        return { ...base, branch: true, shop: true };
      default:
        return base;
    }
  }, [metric]);

  useEffect(() => {
    if (!filterSupport.branch) setBranchId("");
    if (!filterSupport.shop) setShopId("");
    if (!filterSupport.product) setProductId("");
    if (!filterSupport.category) setCategoryId("");
    if (!filterSupport.paymentMethod) setPaymentMethod("");
    if (!filterSupport.sourceType) setSourceType("");
  }, [filterSupport]);

  useEffect(() => {
    if (metric !== "payments") return;
    if (sourceType === "BRANCH") setShopId("");
    if (sourceType === "SHOP") setBranchId("");
  }, [metric, sourceType]);

  useEffect(() => {
    if (!categoryId) return;
    const activeCategories = metric === "expenses" ? expenseCategories : categories;
    if (!activeCategories.some((item) => item.id === categoryId)) {
      setCategoryId("");
    }
  }, [categories, categoryId, expenseCategories, metric]);

  useEffect(() => {
    if (productId && !products.some((item) => item.id === productId)) {
      setProductId("");
    }
  }, [productId, products]);

  useEffect(() => {
    if (branchId && !branches.some((item) => item.id === branchId)) {
      setBranchId("");
    }
  }, [branchId, branches]);

  useEffect(() => {
    if (shopId && !shops.some((item) => item.id === shopId)) {
      setShopId("");
    }
  }, [shopId, shops]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, seriesData, segmentData] = await Promise.all([
        reportsService.overview({ from: filters.from, to: filters.to }),
        reportsService.timeseries({ metric, granularity, ...filters }),
        segmentBy === "none"
          ? Promise.resolve([] as ReportSegmentRow[])
          : reportsService.segments({ metric, segmentBy, ...filters }),
      ]);
      setOverview(overviewData);
      setSeries(seriesData);
      setSegments(segmentData);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [filters, granularity, metric, segmentBy, t, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const metricOptions = useMemo(
    () =>
      [
        { value: "revenue", label: t("Daromad") },
        { value: "expenses", label: t("Xarajatlar") },
        { value: "payments", label: t("Olingan pullar") },
        { value: "transfers", label: t("Transfer xizmati") },
        { value: "returns", label: t("Vazvrat") },
        { value: "netProfit", label: t("Sof foyda") },
        { value: "debt", label: t("Qarz") },
      ] as { value: ReportMetric; label: string }[],
    [t]
  );

  const granularityOptions = useMemo(
    () =>
      [
        { value: "day", label: t("Kun") },
        { value: "week", label: t("Hafta") },
        { value: "month", label: t("Oy") },
      ] as { value: ReportGranularity; label: string }[],
    [t]
  );

  const segmentOptions = useMemo(() => {
    if (metric === "revenue") {
      return [
        { value: "none", label: t("Segment tanlanmagan") },
        { value: "branch", label: t("Filiallar") },
        { value: "product", label: t("Mahsulot") },
        { value: "category", label: t("Kategoriya") },
        { value: "paymentMethod", label: t("To'lov turi") },
      ];
    }
    if (metric === "expenses") {
      return [
        { value: "none", label: t("Segment tanlanmagan") },
        { value: "category", label: t("Kategoriya") },
        { value: "paymentMethod", label: t("To'lov turi") },
      ];
    }
    if (metric === "payments") {
      return [
        { value: "none", label: t("Segment tanlanmagan") },
        { value: "sourceType", label: t("Manba turi") },
        { value: "branch", label: t("Filiallar") },
        { value: "shop", label: t("Do'konlar") },
        { value: "paymentMethod", label: t("To'lov turi") },
      ];
    }
    if (metric === "transfers" || metric === "returns") {
      return [
        { value: "none", label: t("Segment tanlanmagan") },
        { value: "branch", label: t("Filiallar") },
        { value: "shop", label: t("Do'konlar") },
      ];
    }
    return [{ value: "none", label: t("Segment tanlanmagan") }];
  }, [metric, t]);

  useEffect(() => {
    if (!segmentOptions.some((option) => option.value === segmentBy)) {
      setSegmentBy("none");
    }
  }, [segmentBy, segmentOptions]);

  const branchOptions = useMemo(
    () => [{ value: "", label: t("Barchasi") }, ...branches.map((b) => ({ value: b.id, label: b.name }))],
    [branches, t]
  );

  const shopOptions = useMemo(
    () => [{ value: "", label: t("Barchasi") }, ...shops.map((s) => ({ value: s.id, label: s.name }))],
    [shops, t]
  );

  const productOptions = useMemo(
    () => [{ value: "", label: t("Barchasi") }, ...products.map((p) => ({ value: p.id, label: p.name }))],
    [products, t]
  );

  const activeCategories = metric === "expenses" ? expenseCategories : categories;
  const categoryOptions = useMemo(
    () => [{ value: "", label: t("Barchasi") }, ...activeCategories.map((c) => ({ value: c.id, label: c.name }))],
    [activeCategories, t]
  );

  const paymentMethodOptions = useMemo(
    () => [
      { value: "", label: t("Barchasi") },
      { value: "CASH", label: t("Naqd") },
      { value: "CARD", label: t("Karta") },
      { value: "TRANSFER", label: t("O'tkazma") },
    ],
    [t]
  );

  const sourceTypeOptions = useMemo(
    () => [
      { value: "", label: t("Barchasi") },
      { value: "BRANCH", label: t("Filiallar") },
      { value: "SHOP", label: t("Do'konlar") },
    ],
    [t]
  );

  const exportOptions = useMemo(
    () =>
      [
        { type: "sales", label: t("Sotuv") },
        { type: "expenses", label: t("Xarajatlar") },
        { type: "payments", label: t("Kassa") },
        { type: "transfers", label: t("Transfer xizmati") },
        { type: "returns", label: t("Vazvrat") },
      ] as { type: ReportType; label: string }[],
    [t]
  );

  const metricLabel = metricOptions.find((option) => option.value === metric)?.label ?? metric;
  const granularityLabel = granularityOptions.find((option) => option.value === granularity)?.label ?? granularity;
  const activeGranularity = series?.granularity ?? granularity;

  const seriesValues = useMemo(() => (series ? series.points.map((point) => point.value) : []), [series]);
  const movingWindow = useMemo(() => {
    if (activeGranularity === "day") return 7;
    if (activeGranularity === "week") return 4;
    return 3;
  }, [activeGranularity]);
  const movingAverageValues = useMemo(
    () => movingAverage(seriesValues, movingWindow),
    [movingWindow, seriesValues]
  );
  const cumulativeValues = useMemo(() => cumulative(seriesValues), [seriesValues]);

  const chartLabels = useMemo(() => {
    if (!series) return [];
    if (activeGranularity === "month") {
      return series.points.map((point) => point.start.slice(0, 7));
    }
    return series.points.map((point) => point.start);
  }, [activeGranularity, series]);

  const chartSeries = useMemo(() => {
    if (!series) return [];
    return [
      {
        id: metric,
        label: metricLabel,
        color: METRIC_COLORS[metric],
        values: series.points.map((point) => point.value),
      },
    ];
  }, [metric, metricLabel, series]);

  const movingAvgSeries = useMemo(() => {
    if (!series) return [];
    return [
      {
        id: `${metric}-avg`,
        label: t("O'rtacha trend"),
        color: "#64748b",
        values: movingAverageValues,
      },
    ];
  }, [metric, movingAverageValues, series, t]);

  const cumulativeSeries = useMemo(() => {
    if (!series) return [];
    return [
      {
        id: `${metric}-cum`,
        label: t("Jamlanma"),
        color: METRIC_COLORS[metric],
        values: cumulativeValues,
      },
    ];
  }, [cumulativeValues, metric, series, t]);

  const monthNames = useMemo(
    () => [
      t("Yanvar"),
      t("Fevral"),
      t("Mart"),
      t("Aprel"),
      t("May"),
      t("Iyun"),
      t("Iyul"),
      t("Avgust"),
      t("Sentabr"),
      t("Oktabr"),
      t("Noyabr"),
      t("Dekabr"),
    ],
    [t]
  );

  const paymentLabels = useMemo(
    () => ({
      CASH: t("Naqd"),
      CARD: t("Karta"),
      TRANSFER: t("O'tkazma"),
    }),
    [t]
  );

  const sourceLabels = useMemo(
    () => ({
      BRANCH: t("Filiallar"),
      SHOP: t("Do'konlar"),
    }),
    [t]
  );

  const formatBucketLabel = useCallback(
    (point: ReportSeries["points"][number]) => {
      if (activeGranularity === "month") {
        const [year, month] = point.start.split("-");
        const idx = Number(month) - 1;
        const name = monthNames[idx] ?? point.start.slice(0, 7);
        return `${name} ${year}`;
      }
      if (activeGranularity === "week") {
        return `${safeDateLabel(point.start)} - ${safeDateLabel(point.end)}`;
      }
      return safeDateLabel(point.start);
    },
    [activeGranularity, monthNames]
  );

  const formatSegmentLabel = useCallback(
    (item: ReportSegmentRow) => {
      if (item.key === "other") return item.label;
      if (segmentBy === "paymentMethod") return paymentLabels[item.key as keyof typeof paymentLabels] ?? item.label;
      if (segmentBy === "sourceType") return sourceLabels[item.key as keyof typeof sourceLabels] ?? item.label;
      return item.label;
    },
    [paymentLabels, segmentBy, sourceLabels]
  );

  const segmentRows = useMemo(() => {
    if (!segments.length) return [];
    const sorted = [...segments].sort((a, b) => b.value - a.value);
    const maxRows = 8;
    if (sorted.length <= maxRows) return sorted;
    const top = sorted.slice(0, maxRows);
    const restValue = sorted.slice(maxRows).reduce((sum, item) => sum + item.value, 0);
    return [...top, { key: "other", label: t("Boshqa"), value: restValue }];
  }, [segments, t]);

  const segmentsTotal = useMemo(() => segments.reduce((sum, item) => sum + item.value, 0), [segments]);
  const segmentChartRows = useMemo(() => {
    if (!segmentRows.length) return [];
    return segmentRows.map((item, idx) => {
      const share = segmentsTotal ? item.value / segmentsTotal : 0;
      const width = share > 0 ? Math.max(3, share * 100) : 0;
      return {
        ...item,
        share,
        width,
        color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
      };
    });
  }, [segmentRows, segmentsTotal]);

  const handleDrill = (point: ReportSeries["points"][number]) => {
    const next = activeGranularity === "month" ? "week" : activeGranularity === "week" ? "day" : null;
    if (!next) return;
    setDrillStack((prev) => [...prev, { from, to, granularity: activeGranularity }]);
    setGranularity(next);
    setFrom(point.start);
    setTo(point.end);
  };

  const handleDrillBack = () => {
    setDrillStack((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      setFrom(last.from);
      setTo(last.to);
      setGranularity(last.granularity);
      return prev.slice(0, -1);
    });
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const stamp = fileStamp();
      const selectedLabel = exportOptions.find((option) => option.type === exportType)?.label ?? exportType;
      const baseName = `${exportType}-report-${stamp}`;

      if (exportFormat === "csv") {
        const csv = await reportsService.exportCsv(exportType, filters);
        downloadCSV(`${baseName}.csv`, csv);
      } else if (exportFormat === "excel") {
        const data = await reportsService.exportData(exportType, filters);
        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        XLSX.writeFile(workbook, `${baseName}.xlsx`);
      } else {
        const data = await reportsService.exportData(exportType, filters);
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

        const margin = 40;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let y = margin;

        // Header
        doc.setFillColor(143, 29, 29); // Berry color
        doc.rect(0, 0, pageWidth, 60, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("RUXSHONA TORT ERP", margin, 35);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`${selectedLabel.toUpperCase()} ${t("HISOBOTI")}`, margin, 50);
        doc.text(`${t("Sana")}: ${new Date().toLocaleDateString()}`, pageWidth - margin, 35, { align: "right" });
        y = 90;

        // Date Range
        doc.setTextColor(60, 40, 30);
        doc.setFont("helvetica", "bold");
        doc.text(`${t("Davr")}: ${from || "..."} - ${to || "..."}`, margin, y);
        y += 30;

        const colWidth = (pageWidth - margin * 2) / data.headers.length;

        const drawRow = (row: (string | number)[], isHeader = false) => {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }

          if (isHeader) {
            doc.setFillColor(245, 240, 235);
            doc.rect(margin, y - 12, pageWidth - margin * 2, 20, "F");
            doc.setTextColor(143, 29, 29);
            doc.setFont("helvetica", "bold");
          } else {
            doc.setTextColor(60, 40, 30);
            doc.setFont("helvetica", "normal");
            doc.setDrawColor(230, 220, 210);
            doc.line(margin, y + 5, pageWidth - margin, y + 5);
          }

          row.forEach((cell, idx) => {
            const val = String(cell ?? "");
            doc.text(val, margin + idx * colWidth + 5, y, { maxWidth: colWidth - 10 });
          });
          y += 20;
        };

        drawRow(data.headers, true);
        data.rows.forEach((row) => drawRow(row));

        doc.save(`${baseName}.pdf`);
      }
      toast.success(t("Tayyor"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    } finally {
      setExporting(false);
    }
  }, [exportFormat, exportOptions, exportType, filters, from, t, toast, to]);

  const handleMonthlyReport = useCallback(async () => {
    setMonthlyExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;

      // Aggregated data for monthly report
      const stats = [
        { label: t("Umumiy daromad"), value: moneyUZS(overview?.revenue ?? 0) },
        { label: t("Xarajatlar"), value: moneyUZS(overview?.expensesTotal ?? 0) },
        { label: t("Sof foyda"), value: moneyUZS(overview?.netProfit ?? 0) },
        { label: t("Vazvrat"), value: moneyUZS(overview?.returnsTotal ?? 0) },
        { label: t("Qarz"), value: moneyUZS(overview?.debtTotal ?? 0) },
      ];

      // Header
      doc.setFillColor(143, 29, 29);
      doc.rect(0, 0, pageWidth, 80, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("RUXSHONA TORT", pageWidth / 2, 45, { align: "center" });
      doc.setFontSize(12);
      doc.text(t("OYLIK BIZNES HISOBOTI").toUpperCase(), pageWidth / 2, 65, { align: "center" });

      let y = 120;
      doc.setTextColor(60, 40, 30);
      doc.setFontSize(14);
      doc.text(t("Asosiy ko'rsatkichlar"), margin, y);
      y += 10;
      doc.setDrawColor(143, 29, 29);
      doc.setLineWidth(2);
      doc.line(margin, y, margin + 50, y);
      y += 30;

      // Stats Grid
      doc.setFontSize(10);
      stats.forEach((stat) => {
        doc.setFillColor(252, 250, 248);
        doc.rect(margin, y - 15, pageWidth - margin * 2, 25, "F");
        doc.setFont("helvetica", "bold");
        doc.text(stat.label, margin + 10, y);
        doc.setFont("helvetica", "normal");
        doc.text(stat.value, pageWidth - margin - 10, y, { align: "right" });
        y += 35;
      });

      y += 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(t("Sotuv dinamikasi"), margin, y);
      y += 40;

      if (series?.points.length) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(t("Sana"), margin + 10, y);
        doc.text(t("Summa"), pageWidth - margin - 10, y, { align: "right" });
        y += 15;
        doc.line(margin, y, pageWidth - margin, y);
        y += 20;

        series.points.slice(-10).forEach(point => {
          doc.setFont("helvetica", "normal");
          doc.text(formatBucketLabel(point), margin + 10, y);
          doc.text(moneyUZS(point.value), pageWidth - margin - 10, y, { align: "right" });
          y += 20;
        });
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`${t("Hisobot generatsiya qilindi")}: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 30, { align: "center" });

      doc.save(`monthly-business-report-${fileStamp()}.pdf`);
      toast.success(t("Tayyor"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setMonthlyExporting(false);
    }
  }, [formatBucketLabel, moneyUZS, overview, series, t, toast]);

  if (user?.role !== "ADMIN" && user?.role !== "PRODUCTION") {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  const canDrill = activeGranularity !== "day";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cocoa-900">{t("Hisobotlar")}</h1>
          <p className="mt-0.5 text-sm text-cocoa-500">{t("Moliyaviy tahlil va ko'rsatkichlar")}</p>
        </div>
        <Button
          variant="primary"
          onClick={handleMonthlyReport}
          disabled={monthlyExporting || !overview}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          {monthlyExporting ? t("Tayyorlanmoqda...") : t("PDF hisobot")}
        </Button>
      </div>

      {/* Overview KPI cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: t("Daromad"),       value: moneyUZS(overview?.revenue ?? 0),       color: "bg-blue-50  border-blue-100  text-blue-700"   },
          { label: t("Olingan pullar"),value: moneyUZS(overview?.paymentsTotal ?? 0),  color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
          { label: t("Sof foyda"),     value: moneyUZS(overview?.netProfit ?? 0),      color: "bg-green-50 border-green-100 text-green-800"  },
          { label: t("Xarajatlar"),    value: moneyUZS(overview?.expensesTotal ?? 0),  color: "bg-amber-50 border-amber-100 text-amber-700"  },
          { label: t("Transfer"),      value: moneyUZS(overview?.transfersTotal ?? 0), color: "bg-violet-50 border-violet-100 text-violet-700"},
          { label: t("Vazvrat"),       value: moneyUZS(overview?.returnsTotal ?? 0),   color: "bg-red-50   border-red-100   text-red-700"    },
          { label: t("Qarz"),          value: moneyUZS(overview?.debtTotal ?? 0),      color: "bg-rose-50  border-rose-100  text-rose-800"   },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border px-3 py-3 ${kpi.color}`}>
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{kpi.label}</div>
            <div className="mt-1 text-base font-bold">{loading ? "..." : kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filters card */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-cocoa-500" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span className="text-sm font-semibold text-cocoa-700">{t("Filtrlar va sozlamalar")}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Input label={t("From")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label={t("To")} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select
            label={t("Metrika")}
            options={metricOptions.map((option) => ({ value: option.value, label: option.label }))}
            value={metric}
            onChange={(e) => setMetric(e.target.value as ReportMetric)}
          />
          <Select
            label={t("Kesim")}
            options={granularityOptions.map((option) => ({ value: option.value, label: option.label }))}
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as ReportGranularity)}
          />
          <Select
            label={t("Segmentlar")}
            options={segmentOptions.map((option) => ({ value: option.value, label: option.label }))}
            value={segmentBy}
            onChange={(e) => setSegmentBy(e.target.value as ReportSegmentBy)}
          />
          {filterSupport.branch ? (
            <Select
              label={t("Filial")}
              options={branchOptions}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            />
          ) : null}
          {filterSupport.shop ? (
            <Select
              label={t("Do'kon")}
              options={shopOptions}
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
            />
          ) : null}
          {filterSupport.category ? (
            <Select
              label={t("Kategoriya")}
              options={categoryOptions}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            />
          ) : null}
          {filterSupport.product ? (
            <Select
              label={t("Mahsulot")}
              options={productOptions}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
          ) : null}
          {filterSupport.paymentMethod ? (
            <Select
              label={t("To'lov turi")}
              options={paymentMethodOptions}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          ) : null}
          {filterSupport.sourceType ? (
            <Select
              label={t("Manba turi")}
              options={sourceTypeOptions}
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            />
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {drillStack.length > 0 ? (
            <Button variant="ghost" onClick={handleDrillBack}>
              {t("Orqaga")}
            </Button>
          ) : null}
          <Button onClick={loadReports}>{t("Qo'llash")}</Button>
        </div>
      </Card>


      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-cocoa-900">{t("Dinamika")}: <span className="text-berry-700">{metricLabel}</span></div>
            <div className="text-xs text-cocoa-500">{granularityLabel} {t("kesimida")}</div>
          </div>
          {loading ? <div className="rounded-lg bg-cream-100 px-3 py-1 text-xs font-medium text-cocoa-400">{t("Yuklanmoqda...")}</div> : null}
        </div>
        <div className="mt-4">
          <LineChart labels={chartLabels} series={chartSeries} emptyLabel={t("Hozircha yo'q.")} />
        </div>
        <div className="mt-4">
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Interval")}</th>
                  <th>{t("Summa")}</th>
                  {canDrill ? <th>{t("Batafsil")}</th> : null}
                </tr>
              </thead>
              <tbody>
                {series?.points.length ? (
                  series.points.map((point) => (
                    <tr key={`${point.start}-${point.end}`}>
                      <td className="text-sm font-semibold text-cocoa-800">{formatBucketLabel(point)}</td>
                      <td className="text-sm font-semibold text-cocoa-900">{moneyUZS(point.value)}</td>
                      {canDrill ? (
                        <td>
                          <Button variant="ghost" onClick={() => handleDrill(point)}>
                            {t("Batafsil")}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canDrill ? 3 : 2} className="text-sm text-cocoa-500">
                      {t("Hozircha yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cocoa-900">{t("Analitika")}</div>
            <div className="text-xs text-cocoa-600">{metricLabel}</div>
          </div>
          {loading ? <div className="text-xs text-cocoa-500">{t("Yuklanmoqda...")}</div> : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cocoa-400">{t("O'rtacha trend")}</div>
            <div className="mt-2">
              <LineChart labels={chartLabels} series={movingAvgSeries} height={140} emptyLabel={t("Hozircha yo'q.")} />
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cocoa-400">{t("Jamlanma")}</div>
            <div className="mt-2">
              <LineChart labels={chartLabels} series={cumulativeSeries} height={140} emptyLabel={t("Hozircha yo'q.")} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cocoa-900">{t("Segmentlar")}</div>
            <div className="text-xs text-cocoa-600">{segmentBy === "none" ? t("Segment tanlanmagan") : metricLabel}</div>
          </div>
          {loading ? <div className="text-xs text-cocoa-500">{t("Yuklanmoqda...")}</div> : null}
        </div>
        <div className="mt-4">
          {segmentBy === "none" ? (
            <div className="rounded-2xl border border-cream-200/70 bg-cream-50/70 p-4 text-sm text-cocoa-600">
              {t("Segment tanlanmagan")}
            </div>
          ) : (
            <>
              {segmentChartRows.length ? (
                <div className="mb-4 space-y-3">
                  {segmentChartRows.map((item) => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between text-xs text-cocoa-600">
                        <span className="font-semibold text-cocoa-800">{formatSegmentLabel(item)}</span>
                        <span>
                          {moneyUZS(item.value)} / {item.share ? `${(item.share * 100).toFixed(1)}%` : "0%"}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-cream-100/80">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${item.width}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <Table>
                <T>
                  <thead>
                    <tr>
                      <th>{t("Segmentlar")}</th>
                      <th>{t("Summa")}</th>
                      <th>{t("Ulush")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segmentRows.length ? (
                      segmentRows.map((item) => (
                        <tr key={item.key}>
                          <td className="text-sm font-semibold text-cocoa-800">{formatSegmentLabel(item)}</td>
                          <td className="text-sm font-semibold text-cocoa-900">{moneyUZS(item.value)}</td>
                          <td className="text-sm text-cocoa-600">
                            {segmentsTotal ? `${((item.value / segmentsTotal) * 100).toFixed(1)}%` : "0%"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-sm text-cocoa-500">
                          {t("Hozircha yo'q.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </T>
              </Table>
            </>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cocoa-900">{t("Eksport")}</div>
            <div className="text-xs text-cocoa-600">{t("Hisobotlar")}</div>
          </div>
          {exporting ? <div className="text-xs text-cocoa-500">{t("Yuklanmoqda...")}</div> : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Select
            label={t("Hisobot turi")}
            options={exportOptions.map((option) => ({ value: option.type, label: option.label }))}
            value={exportType}
            onChange={(e) => setExportType(e.target.value as ReportType)}
          />
          <Select
            label={t("Format")}
            options={EXPORT_FORMATS.map((option) => ({ value: option.value, label: option.label }))}
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
          />
          <div className="flex items-end">
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? t("Yuklanmoqda...") : t("Eksport")}
            </Button>
          </div>
        </div>
      </Card>
    </div >
  );
}
