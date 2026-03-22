import type { Alert, AlertRule, AlertRuleType, CashEntry, Product, Return, Transfer } from "@/lib/types";
import { getJSON, safeId, setJSON } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

const STORAGE_KEY = "rx_alert_rules";

function nowISO() {
  return new Date().toISOString();
}

function dateToTs(date: string) {
  const safe = date.length === 10 ? `${date}T00:00:00Z` : date;
  return new Date(safe).getTime();
}

function itemPrice(product?: { salePrice?: number; price?: number } | null) {
  return product?.salePrice ?? product?.price ?? 0;
}

function sumItems(items: { quantity: number; product?: { salePrice?: number; price?: number } | null }[]) {
  return items.reduce((sum, item) => sum + item.quantity * itemPrice(item.product), 0);
}

type AlertRuleInput = {
  type: AlertRuleType;
  threshold: number;
  branchId?: string | null;
  productId?: string | null;
  active?: boolean;
  note?: string;
};

const local = {
  async listRules() {
    const rules = getJSON<AlertRule[]>(STORAGE_KEY, []);
    const branches = getJSON<{ id: string; name: string }[]>(STORAGE_KEYS.branches, []);
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const productMap = new Map(products.map((p) => [p.id, p]));
    return rules.map((rule) => ({
      ...rule,
      branch: rule.branchId ? branchMap.get(rule.branchId) ?? null : null,
      product: rule.productId ? productMap.get(rule.productId) ?? null : null,
    }));
  },
  async createRule(dto: AlertRuleInput) {
    const now = nowISO();
    const rule: AlertRule = {
      id: safeId("alert"),
      type: dto.type,
      threshold: dto.threshold,
      active: dto.active ?? true,
      note: dto.note?.trim() || null,
      branchId: dto.branchId ?? null,
      productId: dto.productId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const rules = getJSON<AlertRule[]>(STORAGE_KEY, []);
    setJSON(STORAGE_KEY, [rule, ...rules]);
    return rule;
  },
  async updateRule(id: string, dto: Partial<AlertRuleInput>) {
    const rules = getJSON<AlertRule[]>(STORAGE_KEY, []);
    const updated = rules.map((rule) =>
      rule.id === id
        ? {
            ...rule,
            threshold: dto.threshold ?? rule.threshold,
            active: dto.active ?? rule.active,
            note: dto.note?.trim() || null,
            updatedAt: nowISO(),
          }
        : rule
    );
    setJSON(STORAGE_KEY, updated);
    return { ok: true };
  },
  async removeRule(id: string) {
    const rules = getJSON<AlertRule[]>(STORAGE_KEY, []);
    setJSON(
      STORAGE_KEY,
      rules.filter((rule) => rule.id !== id)
    );
    return { ok: true };
  },
  async listAlerts() {
    const rules = getJSON<AlertRule[]>(STORAGE_KEY, []).filter((rule) => rule.active);
    if (!rules.length) return [] as Alert[];

    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const branches = getJSON<{ id: string; name: string }[]>(STORAGE_KEYS.branches, []);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    const alerts: Alert[] = [];

    const branchStockRules = rules.filter((r) => r.type === "BRANCH_STOCK_MIN");
    if (branchStockRules.length) {
      const stocks = getJSON<any[]>(STORAGE_KEYS.branchStocks, []);
      branchStockRules.forEach((rule) => {
        stocks.forEach((stock) => {
          if (rule.branchId && stock.branchId !== rule.branchId) return;
          if (rule.productId && stock.productId !== rule.productId) return;
          if (stock.quantity <= rule.threshold) {
            alerts.push({
              type: rule.type,
              ruleId: rule.id,
              message: `Low stock`,
              branch: stock.branchId ? branchMap.get(stock.branchId) ?? null : null,
              product: stock.productId ? productMap.get(stock.productId) ?? null : null,
              value: stock.quantity,
              threshold: rule.threshold,
            });
          }
        });
      });
    }

    const debtRules = rules.filter((r) => r.type === "BRANCH_DEBT_LIMIT");
    const overdueRules = rules.filter((r) => r.type === "PAYMENT_OVERDUE_DAYS");
    if (debtRules.length || overdueRules.length) {
      const transfers = getJSON<Transfer[]>(STORAGE_KEYS.transfers, []).filter(
        (t) => t.status === "RECEIVED" && t.targetType === "BRANCH" && t.branchId
      );
      const returns = getJSON<Return[]>(STORAGE_KEYS.returns, []).filter(
        (r) => r.status === "APPROVED" && r.sourceType === "BRANCH" && r.branchId
      );
      const payments = getJSON<CashEntry[]>(STORAGE_KEYS.cashEntries, []).filter(
        (p) => p.sourceType === "BRANCH"
      );

      const transferSum = new Map<string, number>();
      transfers.forEach((t) => {
        const sum = sumItems(
          t.items.map((item) => ({
            quantity: item.quantity,
            product: item.product ?? productMap.get(item.productId),
          }))
        );
        transferSum.set(t.branchId as string, (transferSum.get(t.branchId as string) ?? 0) + sum);
      });

      const returnSum = new Map<string, number>();
      returns.forEach((r) => {
        const sum = sumItems(
          r.items.map((item) => ({
            quantity: item.quantity,
            product: item.product ?? productMap.get(item.productId),
          }))
        );
        returnSum.set(r.branchId as string, (returnSum.get(r.branchId as string) ?? 0) + sum);
      });

      const paymentSum = new Map<string, number>();
      const paymentLatest = new Map<string, string>();
      payments.forEach((p) => {
        paymentSum.set(p.sourceId, (paymentSum.get(p.sourceId) ?? 0) + p.amount);
        const prev = paymentLatest.get(p.sourceId);
        if (!prev || dateToTs(p.date) > dateToTs(prev)) {
          paymentLatest.set(p.sourceId, p.date);
        }
      });

      const branchIds = new Set<string>();
      [...transferSum.keys(), ...returnSum.keys(), ...paymentSum.keys()].forEach((id) => branchIds.add(id));

      const debtByBranch = new Map<string, number>();
      branchIds.forEach((id) => {
        const debt = (transferSum.get(id) ?? 0) - (returnSum.get(id) ?? 0) - (paymentSum.get(id) ?? 0);
        debtByBranch.set(id, debt);
      });

      debtRules.forEach((rule) => {
        const targets = rule.branchId ? [rule.branchId] : Array.from(branchIds);
        targets.forEach((branchId) => {
          const debt = debtByBranch.get(branchId) ?? 0;
          if (debt >= rule.threshold) {
            alerts.push({
              type: rule.type,
              ruleId: rule.id,
              message: `Debt limit exceeded`,
              branch: branchMap.get(branchId) ?? null,
              value: debt,
              threshold: rule.threshold,
            });
          }
        });
      });

      if (overdueRules.length) {
        const lastTransferDate = new Map<string, string>();
        transfers.forEach((t) => {
          const prev = lastTransferDate.get(t.branchId as string);
          if (!prev || dateToTs(t.date) > dateToTs(prev)) {
            lastTransferDate.set(t.branchId as string, t.date);
          }
        });

        overdueRules.forEach((rule) => {
          const targets = rule.branchId ? [rule.branchId] : Array.from(branchIds);
          targets.forEach((branchId) => {
            const debt = debtByBranch.get(branchId) ?? 0;
            if (debt <= 0) return;
            const lastPay = paymentLatest.get(branchId) ?? lastTransferDate.get(branchId);
            if (!lastPay) return;
            const daysSince = Math.floor((Date.now() - dateToTs(lastPay)) / (24 * 60 * 60 * 1000));
            if (daysSince >= rule.threshold) {
              alerts.push({
                type: rule.type,
                ruleId: rule.id,
                message: `Payment overdue`,
                branch: branchMap.get(branchId) ?? null,
                value: daysSince,
                threshold: rule.threshold,
              });
            }
          });
        });
      }
    }

    return alerts;
  },
};

const api = {
  async listRules() {
    return apiFetch<AlertRule[]>("/alerts/rules");
  },
  async createRule(dto: AlertRuleInput) {
    return apiFetch<AlertRule>("/alerts/rules", { method: "POST", body: JSON.stringify(dto) });
  },
  async updateRule(id: string, dto: Partial<AlertRuleInput>) {
    return apiFetch<void>(`/alerts/rules/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  },
  async removeRule(id: string) {
    return apiFetch<void>(`/alerts/rules/${id}`, { method: "DELETE" });
  },
  async listAlerts() {
    return apiFetch<Alert[]>("/alerts");
  },
};

export const alertsService = SERVICE_MODE === "api" ? api : local;
