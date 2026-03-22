import type {
  Branch,
  CashEntry,
  Category,
  Expense,
  Product,
  ReportExportData,
  ReportFilters,
  ReportGranularity,
  ReportMetric,
  ReportOverview,
  ReportSegmentBy,
  ReportSegmentRow,
  ReportSeries,
  Return,
  Sale,
  Shop,
  Transfer,
} from "@/lib/types";
import { getJSON } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { getStoredAuth, setStoredAuth } from "@/lib/auth-store";
import { API_BASE_URL, SERVICE_MODE } from "./config";
import { apiFetch } from "./http";
import { refresh as refreshRequest } from "./auth";

type ReportType = "sales" | "expenses" | "payments" | "transfers" | "returns";

function buildDateFilter<T extends { date: string }>(items: T[], range: ReportFilters) {
  if (!range.from && !range.to) return items;
  return items.filter((item) => {
    if (range.from && item.date < range.from) return false;
    if (range.to && item.date > range.to) return false;
    return true;
  });
}

function itemPrice(product?: { salePrice?: number; price?: number } | null) {
  return product?.salePrice ?? product?.price ?? 0;
}

function sumItems(items: { quantity: number; product?: { salePrice?: number; price?: number } | null }[]) {
  return items.reduce((sum, item) => sum + item.quantity * itemPrice(item.product), 0);
}

function csvEscape(value: any) {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes("\"") || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: any[][]) {
  const lines = [headers.map(csvEscape).join(",")];
  rows.forEach((row) => lines.push(row.map(csvEscape).join(",")));
  return lines.join("\n");
}

function parseDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  return addDays(date, -diff);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function resolveRange(items: { date: string }[], range: ReportFilters) {
  let from = range.from;
  let to = range.to;
  if (!from || !to) {
    let min = "";
    let max = "";
    for (const item of items) {
      if (!min || item.date < min) min = item.date;
      if (!max || item.date > max) max = item.date;
    }
    if (!from) from = min;
    if (!to) to = max;
  }
  if (!from && to) from = to;
  if (!to && from) to = from;
  if (!from || !to) {
    const today = formatDate(new Date());
    return { from: today, to: today };
  }
  if (from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

function buildBuckets(range: { from: string; to: string }, granularity: ReportGranularity) {
  const buckets: { start: string; end: string }[] = [];
  const rangeStart = parseDate(range.from);
  const rangeEnd = parseDate(range.to);
  let cursor = rangeStart;
  if (granularity === "week") {
    cursor = startOfWeek(cursor);
  } else if (granularity === "month") {
    cursor = startOfMonth(cursor);
  }

  while (cursor <= rangeEnd) {
    const bucketStart = cursor;
    let bucketEnd = cursor;
    if (granularity === "week") bucketEnd = addDays(bucketStart, 6);
    if (granularity === "month") bucketEnd = endOfMonth(bucketStart);
    if (bucketEnd > rangeEnd) bucketEnd = rangeEnd;
    buckets.push({ start: formatDate(bucketStart), end: formatDate(bucketEnd) });

    if (granularity === "month") {
      cursor = new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 1);
    } else {
      cursor = addDays(bucketEnd, 1);
    }
  }
  return buckets;
}

function sumByKey<T>(
  items: T[],
  getKey: (item: T) => string | null | undefined,
  getLabel: (item: T) => string,
  getValue: (item: T) => number
) {
  const map = new Map<string, ReportSegmentRow>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const entry = map.get(key) ?? { key, label: getLabel(item), value: 0 };
    entry.value += getValue(item);
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

type MetricItem = { date: string; value: number };

function aggregateByDate(items: MetricItem[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.date, (map.get(item.date) ?? 0) + item.value);
  }
  return Array.from(map, ([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

function buildSeries(items: MetricItem[], range: ReportFilters, granularity: ReportGranularity) {
  const daily = aggregateByDate(items);
  const resolved = resolveRange(daily, range);
  const buckets = buildBuckets(resolved, granularity);
  let idx = 0;
  const points = buckets.map((bucket) => {
    let value = 0;
    while (idx < daily.length && daily[idx].date < bucket.start) idx += 1;
    while (idx < daily.length && daily[idx].date <= bucket.end) {
      value += daily[idx].value;
      idx += 1;
    }
    return { start: bucket.start, end: bucket.end, value };
  });
  return { points, range: resolved };
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

const local = {
  async overview(range: ReportFilters): Promise<ReportOverview> {
    const sales = buildDateFilter(getJSON<Sale[]>(STORAGE_KEYS.sales, []), range);
    const expenses = buildDateFilter(getJSON<Expense[]>(STORAGE_KEYS.expenses, []), range);
    const payments = buildDateFilter(getJSON<CashEntry[]>(STORAGE_KEYS.cashEntries, []), range);
    const transfers = buildDateFilter(getJSON<Transfer[]>(STORAGE_KEYS.transfers, []), range).filter(
      (t) => t.status === "RECEIVED" && t.targetType === "BRANCH"
    );
    const returns = buildDateFilter(getJSON<Return[]>(STORAGE_KEYS.returns, []), range).filter(
      (r) => r.status === "APPROVED" && r.sourceType === "BRANCH"
    );
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const revenue = sales.reduce((sum, s) => sum + s.price * s.quantity, 0);
    const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    const transfersTotal = transfers.reduce(
      (sum, t) =>
        sum +
        sumItems(
          t.items.map((i) => ({
            quantity: i.quantity,
            product: i.product ?? productMap.get(i.productId),
          }))
        ),
      0
    );
    const returnsTotal = returns.reduce(
      (sum, r) =>
        sum +
        sumItems(
          r.items.map((i) => ({
            quantity: i.quantity,
            product: i.product ?? productMap.get(i.productId),
          }))
        ),
      0
    );
    const netProfit = revenue - expensesTotal;
    const debtTotal = transfersTotal - returnsTotal - paymentsTotal;

    return { revenue, expensesTotal, paymentsTotal, transfersTotal, returnsTotal, netProfit, debtTotal };
  },

  async timeseries(params: { metric: ReportMetric; granularity: ReportGranularity } & ReportFilters): Promise<ReportSeries> {
    const { metric, granularity, ...filters } = params;
    if (!["day", "week", "month"].includes(granularity)) {
      throw new Error("Unknown granularity");
    }
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const items = (() => {
      switch (metric) {
        case "revenue": {
          const sales = buildDateFilter(getJSON<Sale[]>(STORAGE_KEYS.sales, []), filters)
            .filter((s) => (!filters.branchId ? true : s.branchId === filters.branchId))
            .filter((s) => (!filters.productId ? true : s.productId === filters.productId))
            .filter((s) => (!filters.paymentMethod ? true : s.paymentMethod === filters.paymentMethod))
            .filter((s) => {
              if (!filters.categoryId) return true;
              return productMap.get(s.productId)?.categoryId === filters.categoryId;
            });
          return sales.map((s) => ({ date: s.date, value: s.price * s.quantity }));
        }
        case "expenses": {
          const expenses = buildDateFilter(getJSON<Expense[]>(STORAGE_KEYS.expenses, []), filters)
            .filter((e) => (!filters.categoryId ? true : e.categoryId === filters.categoryId))
            .filter((e) => (!filters.paymentMethod ? true : e.paymentMethod === filters.paymentMethod));
          return expenses.map((e) => ({ date: e.date, value: e.amount }));
        }
        case "payments": {
          const payments = buildDateFilter(getJSON<CashEntry[]>(STORAGE_KEYS.cashEntries, []), filters)
            .filter((p) => (!filters.sourceType ? true : p.sourceType === filters.sourceType))
            .filter((p) => (!filters.branchId ? true : p.branchId === filters.branchId))
            .filter((p) => (!filters.shopId ? true : p.shopId === filters.shopId))
            .filter((p) => (!filters.paymentMethod ? true : p.paymentMethod === filters.paymentMethod));
          return payments.map((p) => ({ date: p.date, value: p.amount }));
        }
        case "transfers": {
          const transfers = buildDateFilter(getJSON<Transfer[]>(STORAGE_KEYS.transfers, []), filters).filter((t) => {
            if (filters.branchId) return t.branchId === filters.branchId;
            if (filters.shopId) return t.shopId === filters.shopId;
            return true;
          });
          return transfers.map((t) => ({
            date: t.date,
            value: sumItems(
              t.items.map((i) => ({
                quantity: i.quantity,
                product: i.product ?? productMap.get(i.productId),
              }))
            ),
          }));
        }
        case "returns": {
          const returns = buildDateFilter(getJSON<Return[]>(STORAGE_KEYS.returns, []), filters).filter((r) => {
            if (filters.branchId) return r.branchId === filters.branchId;
            if (filters.shopId) return r.shopId === filters.shopId;
            return true;
          });
          return returns.map((r) => ({
            date: r.date,
            value: sumItems(
              r.items.map((i) => ({
                quantity: i.quantity,
                product: i.product ?? productMap.get(i.productId),
              }))
            ),
          }));
        }
        case "netProfit": {
          const rangeOnly = { from: filters.from, to: filters.to };
          const sales = buildDateFilter(getJSON<Sale[]>(STORAGE_KEYS.sales, []), rangeOnly);
          const expenses = buildDateFilter(getJSON<Expense[]>(STORAGE_KEYS.expenses, []), rangeOnly);
          return [
            ...sales.map((s) => ({ date: s.date, value: s.price * s.quantity })),
            ...expenses.map((e) => ({ date: e.date, value: -e.amount })),
          ];
        }
        case "debt": {
          const rangeOnly = { from: filters.from, to: filters.to };
          const payments = buildDateFilter(getJSON<CashEntry[]>(STORAGE_KEYS.cashEntries, []), rangeOnly);
          const transfers = buildDateFilter(getJSON<Transfer[]>(STORAGE_KEYS.transfers, []), rangeOnly);
          const returns = buildDateFilter(getJSON<Return[]>(STORAGE_KEYS.returns, []), rangeOnly);
          return [
            ...transfers.map((t) => ({
              date: t.date,
              value: sumItems(
                t.items.map((i) => ({
                  quantity: i.quantity,
                  product: i.product ?? productMap.get(i.productId),
                }))
              ),
            })),
            ...returns.map((r) => ({
              date: r.date,
              value: -sumItems(
                r.items.map((i) => ({
                  quantity: i.quantity,
                  product: i.product ?? productMap.get(i.productId),
                }))
              ),
            })),
            ...payments.map((p) => ({ date: p.date, value: -p.amount })),
          ];
        }
        default:
          throw new Error("Unknown metric");
      }
    })();

    const { points } = buildSeries(items, filters, granularity);
    return { metric, granularity, points };
  },

  async segments(params: { metric: ReportMetric; segmentBy: ReportSegmentBy } & ReportFilters): Promise<ReportSegmentRow[]> {
    const { metric, segmentBy, ...filters } = params;
    if (segmentBy === "none") return [];
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const categories = getJSON<Category[]>(STORAGE_KEYS.categories, []);
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const expenseCategories = getJSON<Category[]>(STORAGE_KEYS.expenseCategories, []);
    const expenseCategoryMap = new Map(expenseCategories.map((c) => [c.id, c]));
    const branches = getJSON<Branch[]>(STORAGE_KEYS.branches, []);
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const shops = getJSON<Shop[]>(STORAGE_KEYS.shops, []);
    const shopMap = new Map(shops.map((s) => [s.id, s]));

    switch (metric) {
      case "revenue": {
        const sales = buildDateFilter(getJSON<Sale[]>(STORAGE_KEYS.sales, []), filters)
          .filter((s) => (!filters.branchId ? true : s.branchId === filters.branchId))
          .filter((s) => (!filters.productId ? true : s.productId === filters.productId))
          .filter((s) => (!filters.paymentMethod ? true : s.paymentMethod === filters.paymentMethod))
          .filter((s) => {
            if (!filters.categoryId) return true;
            return productMap.get(s.productId)?.categoryId === filters.categoryId;
          });
        if (segmentBy === "branch") {
          return sumByKey(
            sales,
            (s) => s.branchId,
            (s) => branchMap.get(s.branchId)?.name ?? "Unknown",
            (s) => s.price * s.quantity
          );
        }
        if (segmentBy === "product") {
          return sumByKey(
            sales,
            (s) => s.productId,
            (s) => productMap.get(s.productId)?.name ?? "Unknown",
            (s) => s.price * s.quantity
          );
        }
        if (segmentBy === "category") {
          return sumByKey(
            sales,
            (s) => productMap.get(s.productId)?.categoryId,
            (s) => categoryMap.get(productMap.get(s.productId)?.categoryId ?? "")?.name ?? "Unknown",
            (s) => s.price * s.quantity
          );
        }
        if (segmentBy === "paymentMethod") {
          return sumByKey(sales, (s) => s.paymentMethod, (s) => s.paymentMethod, (s) => s.price * s.quantity);
        }
        return [];
      }
      case "expenses": {
        const expenses = buildDateFilter(getJSON<Expense[]>(STORAGE_KEYS.expenses, []), filters)
          .filter((e) => (!filters.categoryId ? true : e.categoryId === filters.categoryId))
          .filter((e) => (!filters.paymentMethod ? true : e.paymentMethod === filters.paymentMethod));
        if (segmentBy === "category") {
          return sumByKey(
            expenses,
            (e) => e.categoryId,
            (e) => expenseCategoryMap.get(e.categoryId)?.name ?? "Unknown",
            (e) => e.amount
          );
        }
        if (segmentBy === "paymentMethod") {
          return sumByKey(expenses, (e) => e.paymentMethod, (e) => e.paymentMethod, (e) => e.amount);
        }
        return [];
      }
      case "payments": {
        const payments = buildDateFilter(getJSON<CashEntry[]>(STORAGE_KEYS.cashEntries, []), filters)
          .filter((p) => (!filters.sourceType ? true : p.sourceType === filters.sourceType))
          .filter((p) => (!filters.branchId ? true : p.branchId === filters.branchId))
          .filter((p) => (!filters.shopId ? true : p.shopId === filters.shopId))
          .filter((p) => (!filters.paymentMethod ? true : p.paymentMethod === filters.paymentMethod));
        if (segmentBy === "sourceType") {
          return sumByKey(payments, (p) => p.sourceType, (p) => p.sourceType, (p) => p.amount);
        }
        if (segmentBy === "branch") {
          return sumByKey(
            payments,
            (p) => p.branchId,
            (p) => branchMap.get(p.branchId ?? "")?.name ?? "Unknown",
            (p) => p.amount
          );
        }
        if (segmentBy === "shop") {
          return sumByKey(payments, (p) => p.shopId, (p) => shopMap.get(p.shopId ?? "")?.name ?? "Unknown", (p) => p.amount);
        }
        if (segmentBy === "paymentMethod") {
          return sumByKey(payments, (p) => p.paymentMethod, (p) => p.paymentMethod, (p) => p.amount);
        }
        return [];
      }
      case "transfers": {
        const transfers = buildDateFilter(getJSON<Transfer[]>(STORAGE_KEYS.transfers, []), filters).filter((t) => {
          if (filters.branchId) return t.branchId === filters.branchId;
          if (filters.shopId) return t.shopId === filters.shopId;
          return true;
        });
        if (segmentBy === "branch") {
          return sumByKey(
            transfers,
            (t) => t.branchId,
            (t) => branchMap.get(t.branchId ?? "")?.name ?? "Unknown",
            (t) =>
              sumItems(
                t.items.map((i) => ({
                  quantity: i.quantity,
                  product: i.product ?? productMap.get(i.productId),
                }))
              )
          );
        }
        if (segmentBy === "shop") {
          return sumByKey(
            transfers,
            (t) => t.shopId,
            (t) => shopMap.get(t.shopId ?? "")?.name ?? "Unknown",
            (t) =>
              sumItems(
                t.items.map((i) => ({
                  quantity: i.quantity,
                  product: i.product ?? productMap.get(i.productId),
                }))
              )
          );
        }
        return [];
      }
      case "returns": {
        const returns = buildDateFilter(getJSON<Return[]>(STORAGE_KEYS.returns, []), filters).filter((r) => {
          if (filters.branchId) return r.branchId === filters.branchId;
          if (filters.shopId) return r.shopId === filters.shopId;
          return true;
        });
        if (segmentBy === "branch") {
          return sumByKey(
            returns,
            (r) => r.branchId,
            (r) => branchMap.get(r.branchId ?? "")?.name ?? "Unknown",
            (r) =>
              sumItems(
                r.items.map((i) => ({
                  quantity: i.quantity,
                  product: i.product ?? productMap.get(i.productId),
                }))
              )
          );
        }
        if (segmentBy === "shop") {
          return sumByKey(
            returns,
            (r) => r.shopId,
            (r) => shopMap.get(r.shopId ?? "")?.name ?? "Unknown",
            (r) =>
              sumItems(
                r.items.map((i) => ({
                  quantity: i.quantity,
                  product: i.product ?? productMap.get(i.productId),
                }))
              )
          );
        }
        return [];
      }
      default:
        return [];
    }
  },

  async exportData(type: ReportType, range: ReportFilters): Promise<ReportExportData> {
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const branches = getJSON<Branch[]>(STORAGE_KEYS.branches, []);
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const shops = getJSON<Shop[]>(STORAGE_KEYS.shops, []);
    const shopMap = new Map(shops.map((s) => [s.id, s]));
    const expenseCategories = getJSON<Category[]>(STORAGE_KEYS.expenseCategories, []);
    const expenseCategoryMap = new Map(expenseCategories.map((c) => [c.id, c]));

    switch (type) {
      case "sales": {
        const sales = buildDateFilter(getJSON<Sale[]>(STORAGE_KEYS.sales, []), range)
          .filter((s) => (!range.branchId ? true : s.branchId === range.branchId))
          .filter((s) => (!range.productId ? true : s.productId === range.productId))
          .filter((s) => (!range.paymentMethod ? true : s.paymentMethod === range.paymentMethod))
          .filter((s) => {
            if (!range.categoryId) return true;
            return productMap.get(s.productId)?.categoryId === range.categoryId;
          });
        const rows = sales.map((s) => [
          s.date,
          branchMap.get(s.branchId)?.name ?? s.branchId,
          productMap.get(s.productId)?.name ?? s.productId,
          s.quantity,
          s.price,
          s.price * s.quantity,
          s.paymentMethod,
        ]);
        return { headers: ["date", "branch", "product", "qty", "price", "total", "paymentMethod"], rows };
      }
      case "expenses": {
        const expenses = buildDateFilter(getJSON<Expense[]>(STORAGE_KEYS.expenses, []), range)
          .filter((e) => (!range.categoryId ? true : e.categoryId === range.categoryId))
          .filter((e) => (!range.paymentMethod ? true : e.paymentMethod === range.paymentMethod));
        const rows = expenses.map((e) => [
          e.date,
          expenseCategoryMap.get(e.categoryId)?.name ?? e.categoryId,
          e.amount,
          e.paymentMethod,
          e.note ?? "",
        ]);
        return { headers: ["date", "category", "amount", "paymentMethod", "note"], rows };
      }
      case "payments": {
        const payments = buildDateFilter(getJSON<CashEntry[]>(STORAGE_KEYS.cashEntries, []), range)
          .filter((p) => (!range.sourceType ? true : p.sourceType === range.sourceType))
          .filter((p) => (!range.branchId ? true : p.branchId === range.branchId))
          .filter((p) => (!range.shopId ? true : p.shopId === range.shopId))
          .filter((p) => (!range.paymentMethod ? true : p.paymentMethod === range.paymentMethod));
        const rows = payments.map((p) => [
          p.date,
          p.sourceType,
          branchMap.get(p.branchId ?? "")?.name ?? shopMap.get(p.shopId ?? "")?.name ?? p.sourceId,
          p.amount,
          p.paymentMethod,
          p.note ?? "",
        ]);
        return { headers: ["date", "sourceType", "sourceName", "amount", "paymentMethod", "note"], rows };
      }
      case "transfers": {
        const transfers = buildDateFilter(getJSON<Transfer[]>(STORAGE_KEYS.transfers, []), range).filter((t) => {
          if (range.branchId) return t.branchId === range.branchId;
          if (range.shopId) return t.shopId === range.shopId;
          return true;
        });
        const rows = transfers.map((t) => [
          t.date,
          t.targetType,
          branchMap.get(t.branchId ?? "")?.name ?? shopMap.get(t.shopId ?? "")?.name ?? "",
          t.status,
          sumItems(
            t.items.map((i) => ({
              quantity: i.quantity,
              product: i.product ?? productMap.get(i.productId),
            }))
          ),
        ]);
        return { headers: ["date", "targetType", "targetName", "status", "total"], rows };
      }
      case "returns": {
        const returns = buildDateFilter(getJSON<Return[]>(STORAGE_KEYS.returns, []), range).filter((r) => {
          if (range.branchId) return r.branchId === range.branchId;
          if (range.shopId) return r.shopId === range.shopId;
          return true;
        });
        const rows = returns.map((r) => [
          r.date,
          r.sourceType,
          branchMap.get(r.branchId ?? "")?.name ?? shopMap.get(r.shopId ?? "")?.name ?? "",
          r.status,
          sumItems(
            r.items.map((i) => ({
              quantity: i.quantity,
              product: i.product ?? productMap.get(i.productId),
            }))
          ),
        ]);
        return { headers: ["date", "sourceType", "sourceName", "status", "total"], rows };
      }
      default:
        return { headers: [], rows: [] };
    }
  },

  async exportCsv(type: ReportType, range: ReportFilters) {
    const data = await this.exportData(type, range);
    return toCsv(data.headers, data.rows);
  },
};

const api = {
  async overview(range: ReportFilters) {
    const query = buildQuery({ from: range.from, to: range.to });
    return apiFetch<ReportOverview>(`/reports/overview${query}`);
  },
  async timeseries(params: { metric: ReportMetric; granularity: ReportGranularity } & ReportFilters) {
    const query = buildQuery({
      metric: params.metric,
      granularity: params.granularity,
      from: params.from,
      to: params.to,
      branchId: params.branchId,
      shopId: params.shopId,
      productId: params.productId,
      categoryId: params.categoryId,
      paymentMethod: params.paymentMethod,
      sourceType: params.sourceType,
    });
    return apiFetch<ReportSeries>(`/reports/timeseries${query}`);
  },
  async segments(params: { metric: ReportMetric; segmentBy: ReportSegmentBy } & ReportFilters) {
    const query = buildQuery({
      metric: params.metric,
      segmentBy: params.segmentBy,
      from: params.from,
      to: params.to,
      branchId: params.branchId,
      shopId: params.shopId,
      productId: params.productId,
      categoryId: params.categoryId,
      paymentMethod: params.paymentMethod,
      sourceType: params.sourceType,
    });
    return apiFetch<ReportSegmentRow[]>(`/reports/segments${query}`);
  },
  async exportData(type: ReportType, range: ReportFilters) {
    const query = buildQuery({
      from: range.from,
      to: range.to,
      branchId: range.branchId,
      shopId: range.shopId,
      productId: range.productId,
      categoryId: range.categoryId,
      paymentMethod: range.paymentMethod,
      sourceType: range.sourceType,
    });
    return apiFetch<ReportExportData>(`/reports/data/${type}${query}`);
  },
  async exportCsv(type: ReportType, range: ReportFilters) {
    const query = buildQuery({
      from: range.from,
      to: range.to,
      branchId: range.branchId,
      shopId: range.shopId,
      productId: range.productId,
      categoryId: range.categoryId,
      paymentMethod: range.paymentMethod,
      sourceType: range.sourceType,
    });
    const auth = getStoredAuth();
    const makeRequest = (token?: string) =>
      fetch(`${API_BASE_URL}/reports/csv/${type}${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    let res = await makeRequest(auth?.accessToken);
    if (res.status === 401 && auth?.refreshToken) {
      const refreshed = await refreshRequest(auth.refreshToken);
      const next = { ...auth, ...refreshed };
      setStoredAuth(next);
      res = await makeRequest(next.accessToken);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || res.statusText);
    }
    return res.text();
  },
};

export const reportsService = SERVICE_MODE === "api" ? api : local;
export type { ReportType };
