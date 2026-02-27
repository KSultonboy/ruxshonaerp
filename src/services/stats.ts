import type { Branch, BranchStock, Category, Expense, MarketingStats, Product, Return, Sale, Shop, StatsOverview, User } from "@/lib/types";
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
      netProfit: revenue - expensesTotal,
    };
  },
  async getMarketingStats(): Promise<MarketingStats> {
    return {
      totalOrders: 0,
      totalSales: 0,
      newCustomers: 0,
      newOrders: 0,
      inDeliveryOrders: 0,
      deliveredOrders: 0,
      canceledOrders: 0,
      recentOrders: 0,
      topProducts: [],
      couponStats: []
    };
  }
};

const api = {
  async overview(range?: DateRange): Promise<StatsOverview> {
    const search = new URLSearchParams();
    if (range?.from) search.set("from", range.from);
    if (range?.to) search.set("to", range.to);
    const qs = search.toString();
    return apiFetch<StatsOverview>(qs ? `/stats/overview?${qs}` : "/stats/overview");
  },
  async getMarketingStats(): Promise<MarketingStats> {
    return apiFetch<MarketingStats>("/analytics/marketing");
  }
};

export const statsService = SERVICE_MODE === "api" ? api : local;
