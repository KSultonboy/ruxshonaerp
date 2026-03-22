import type {
  Branch,
  BranchStock,
  Category,
  Expense,
  MarketingStats,
  Product,
  Return,
  Sale,
  Shop,
  StatsOverview,
  User
} from "@/lib/types";
import { getJSON } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "@/services/http";

function priceForProduct(product?: { salePrice?: number; price?: number }) {
  return product?.salePrice ?? product?.price ?? 0;
}

function sumBranchValue(stocks: BranchStock[], productMap: Map<string, Product>) {
  return stocks.reduce((sum, stock) => {
    const prod = stock.product ?? productMap.get(stock.productId);
    return sum + priceForProduct(prod) * stock.quantity;
  }, 0);
}

function sumReturns(returns: Return[], products: Product[]) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  return returns
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, ret) => {
      return sum + ret.items.reduce((inner, item) => {
        const prod = productMap.get(item.productId);
        return inner + priceForProduct(prod) * item.quantity;
      }, 0);
    }, 0);
}

type DateRange = { from?: string; to?: string };

function inRange(date: string, range?: DateRange) {
  if (!range?.from && !range?.to) return true;
  if (range?.from && date < range.from) return false;
  if (range?.to && date > range.to) return false;
  return true;
}

function apiErrorCode(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/^API\s+(\d{3})/);
  return match ? Number(match[1]) : null;
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toIsoDate(value: unknown) {
  if (typeof value !== "string") return "";
  return value.slice(0, 10);
}

function unwrapArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const candidates = [record.items, record.data, record.results, record.rows];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as T[];
  }
  return [];
}

function filterByRange<T>(rows: T[], range: DateRange | undefined, pickDate: (row: T) => string) {
  return rows.filter((row) => {
    const date = pickDate(row);
    if (!date) return true;
    return inRange(date, range);
  });
}

async function fetchListWithFallback<T>(paths: string[]): Promise<T[]> {
  for (const path of paths) {
    try {
      const raw = await apiFetch<unknown>(path);
      return unwrapArray<T>(raw);
    } catch (error) {
      if (apiErrorCode(error) === 404) continue;
      throw error;
    }
  }
  return [];
}

function buildRangeQuery(range?: DateRange) {
  const search = new URLSearchParams();
  if (range?.from) search.set("from", range.from);
  if (range?.to) search.set("to", range.to);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function overviewFromLegacyEndpoints(range?: DateRange): Promise<StatsOverview> {
  const query = buildRangeQuery(range);

  const [products, categories, expenses, sales, returns, users, branches, shops, payments] = await Promise.all([
    fetchListWithFallback<Product>(["/products"]),
    fetchListWithFallback<Category>(["/product-categories", "/categories"]),
    fetchListWithFallback<Expense>(["/expenses"]),
    fetchListWithFallback<Sale>([query ? `/sales${query}` : "/sales"]),
    fetchListWithFallback<Return>([query ? `/returns${query}` : "/returns"]),
    fetchListWithFallback<User>(["/users"]),
    fetchListWithFallback<Branch>(["/branches"]),
    fetchListWithFallback<Shop>(["/shops"]),
    fetchListWithFallback<{ amount?: unknown }>(["/payments"]),
  ]);

  const productsCount = products.length;
  const categoriesCount =
    categories.length ||
    new Set(products.map((product) => String((product as unknown as Record<string, unknown>).categoryId ?? "")).filter(Boolean))
      .size;

  const expensesFiltered = filterByRange(expenses, range, (exp) => {
    const record = exp as unknown as Record<string, unknown>;
    return toIsoDate(record.date) || toIsoDate(record.createdAt);
  });
  const expensesCount = expensesFiltered.length;
  const expensesTotal = expensesFiltered.reduce((sum, exp) => {
    const record = exp as unknown as Record<string, unknown>;
    return sum + toNumber(record.amount);
  }, 0);

  const salesFiltered = filterByRange(sales, range, (sale) => {
    const record = sale as unknown as Record<string, unknown>;
    return toIsoDate(record.date) || toIsoDate(record.createdAt);
  });

  const revenue = salesFiltered.reduce((sum, sale) => {
    const record = sale as unknown as Record<string, unknown>;
    const total = toNumber(record.total, Number.NaN);
    if (Number.isFinite(total)) return sum + total;
    const amount = toNumber(record.amount, Number.NaN);
    if (Number.isFinite(amount)) return sum + amount;
    const price = toNumber(record.price, Number.NaN);
    const quantity = toNumber(record.quantity, 1);
    if (Number.isFinite(price)) return sum + price * quantity;
    return sum;
  }, 0);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const returnsFiltered = filterByRange(returns, range, (ret) => {
    const record = ret as unknown as Record<string, unknown>;
    return toIsoDate(record.date) || toIsoDate(record.createdAt);
  });

  const returnsTotal = returnsFiltered.reduce((sum, ret) => {
    const record = ret as unknown as Record<string, unknown>;
    const status = String(record.status ?? "");
    if (status && status !== "APPROVED") return sum;

    const direct = toNumber(record.total, Number.NaN);
    if (Number.isFinite(direct)) return sum + direct;

    const items = Array.isArray(record.items) ? (record.items as Array<Record<string, unknown>>) : [];
    const byItems = items.reduce((inner, item) => {
      const productId = String(item.productId ?? "");
      const product = productMap.get(productId);
      const qty = toNumber(item.quantity);
      return inner + priceForProduct(product) * qty;
    }, 0);
    return sum + byItems;
  }, 0);

  const branchValue = products.reduce((sum, product) => {
    const record = product as unknown as Record<string, unknown>;
    const stock = toNumber(record.stock);
    return sum + stock * priceForProduct(product);
  }, 0);

  const paymentsTotal = payments.reduce((sum, payment) => {
    const record = payment as unknown as Record<string, unknown>;
    return sum + toNumber(record.amount);
  }, 0);

  const workersCount = users.length;
  const branchShopCount = branches.length + shops.length;

  return {
    productsCount,
    categoriesCount,
    expensesCount,
    branchValue,
    workersCount,
    branchShopCount,
    revenue,
    returns: returnsTotal,
    received: payments.length ? paymentsTotal : revenue,
    expensesTotal,
    netProfit: revenue - expensesTotal
  };
}

/**
 * Normalizer:
 * - API yoki local eski format qaytarsa ham,
 * - MarketingStats type’ga mos "full shape" qaytaradi.
 */
function normalizeMarketingStats(raw: any): MarketingStats {
  // recentOrders ba’zi versiyalarda array bo‘lishi mumkin.
  // Agar type number bo‘lsa ham TS mos keladi (0), lekin ko‘pincha array bo‘ladi.
  // Shuning uchun: agar array bo‘lsa qoldiramiz, bo‘lmasa [].
  const recentOrders =
    Array.isArray(raw?.recentOrders) ? raw.recentOrders : raw?.recentOrders ?? [];

  return {
    totalOrders: Number(raw?.totalOrders ?? 0),
    totalSales: Number(raw?.totalSales ?? 0),
    newCustomers: Number(raw?.newCustomers ?? 0),

    newOrders: Number(raw?.newOrders ?? 0),
    inDeliveryOrders: Number(raw?.inDeliveryOrders ?? 0),
    deliveredOrders: Number(raw?.deliveredOrders ?? 0),
    canceledOrders: Number(raw?.canceledOrders ?? 0),

    // Agar sizning MarketingStats typingiz recentOrders: number bo‘lsa,
    // bu yerda recentOrders ni Number(...) qilib qo‘yish kerak.
    // Lekin ko‘p loyihalarda bu array bo‘ladi.
    // Shu sababli: raw’dan nima kelsa shuni "safe" ko‘rinishda qaytaryapmiz.
    recentOrders,

    topProducts: Array.isArray(raw?.topProducts) ? raw.topProducts : [],
    couponStats: Array.isArray(raw?.couponStats) ? raw.couponStats : []
  } as MarketingStats;
}

const local = {
  async overview(range?: DateRange): Promise<StatsOverview> {
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const categories = getJSON<Category[]>(STORAGE_KEYS.categories, []);
    const expenses = getJSON<Expense[]>(STORAGE_KEYS.expenses, []);
    const branches = getJSON<Branch[]>(STORAGE_KEYS.branches, []);
    const shops = getJSON<Shop[]>(STORAGE_KEYS.shops, []);
    const users = getJSON<User[]>(STORAGE_KEYS.users, []);
    const branchStocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
    const sales = getJSON<Sale[]>(STORAGE_KEYS.sales, []);
    const returns = getJSON<Return[]>(STORAGE_KEYS.returns, []);

    const productsCount = products.length;
    const categoriesCount = categories.length;
    const expensesFiltered = expenses.filter((exp) => inRange(exp.date, range));
    const expensesCount = expensesFiltered.length;

    const productMap = new Map(products.map((p) => [p.id, p]));
    const branchValue = sumBranchValue(branchStocks, productMap);

    const workersCount = users.length;
    const branchShopCount = branches.length + shops.length;

    const salesFiltered = sales.filter((sale) => inRange(sale.date, range));
    const revenue = salesFiltered.reduce((sum, sale) => sum + sale.price * sale.quantity, 0);

    const returnsFiltered = returns.filter((ret) => inRange(ret.date, range));
    const returnsTotal = sumReturns(returnsFiltered, products);

    const expensesTotal = expensesFiltered.reduce((sum, exp) => sum + exp.amount, 0);

    return {
      productsCount,
      categoriesCount,
      expensesCount,
      branchValue,
      workersCount,
      branchShopCount,
      revenue,
      returns: returnsTotal,
      received: revenue,
      expensesTotal,
      netProfit: revenue - expensesTotal
    };
  },

  async getMarketingStats(): Promise<MarketingStats> {
    // Local mode uchun “default” full-shape
    const raw = {
      totalOrders: 0,
      totalSales: 0,
      newCustomers: 0,
      newOrders: 0,
      inDeliveryOrders: 0,
      deliveredOrders: 0,
      canceledOrders: 0,
      recentOrders: [],
      topProducts: [],
      couponStats: []
    };

    return normalizeMarketingStats(raw);
  }
};

const api = {
  async overview(range?: DateRange): Promise<StatsOverview> {
    const qs = buildRangeQuery(range);
    try {
      return await apiFetch<StatsOverview>(qs ? `/stats/overview${qs}` : "/stats/overview");
    } catch (error) {
      if (apiErrorCode(error) !== 404) throw error;
      return overviewFromLegacyEndpoints(range);
    }
  },

  async getMarketingStats(): Promise<MarketingStats> {
    // API eski format qaytarsa ham normalize qilib yuboramiz
    try {
      const raw = await apiFetch<unknown>("/analytics/marketing");
      return normalizeMarketingStats(raw);
    } catch (error) {
      if (apiErrorCode(error) !== 404) throw error;
      return normalizeMarketingStats({
        totalOrders: 0,
        totalSales: 0,
        newCustomers: 0,
        newOrders: 0,
        inDeliveryOrders: 0,
        deliveredOrders: 0,
        canceledOrders: 0,
        recentOrders: [],
        topProducts: [],
        couponStats: []
      });
    }
  }
};

export const statsService = SERVICE_MODE === "api" ? api : local;
