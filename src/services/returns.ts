// src/services/returns.ts
import type { BranchStock, Product, Return, ReturnSourceType } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

export type ReturnCreateDTO = {
  sourceType: ReturnSourceType;
  branchId?: string;
  shopId?: string;
  date?: string;
  note?: string;
  items: { productId: string; quantity: number }[];
};

export type ReturnUpdateDTO = Partial<ReturnCreateDTO>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeProducts(items: Product[]) {
  return items.map((p) => ({
    ...p,
    stock: Number(p.stock ?? 0),
    minStock: Number(p.minStock ?? 0),
  }));
}

const local = {
  async list(): Promise<Return[]> {
    const returns = getJSON<Return[]>(STORAGE_KEYS.returns, []);
    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const branches = getJSON<{ id: string; name: string }[]>(STORAGE_KEYS.branches, []);
    const shops = getJSON<{ id: string; name: string }[]>(STORAGE_KEYS.shops, []);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const shopMap = new Map(shops.map((s) => [s.id, s]));

    return returns.map((r) => ({
      ...r,
      items: r.items.map((i) => ({ ...i, product: productMap.get(i.productId) })),
      branch: r.branchId ? branchMap.get(r.branchId) ?? null : null,
      shop: r.shopId ? shopMap.get(r.shopId) ?? null : null,
    }));
  },

  async create(dto: ReturnCreateDTO): Promise<Return> {
    if (!dto.items?.length) throw new Error("Items required");
    if (dto.sourceType === "BRANCH" && !dto.branchId) throw new Error("Branch required");
    if (dto.sourceType === "SHOP" && !dto.shopId) throw new Error("Shop required");

    dto.items.forEach((i) => {
      if (!Number.isFinite(i.quantity) || i.quantity <= 0) throw new Error("Invalid quantity");
    });

    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const productMap = new Map(products.map((p) => [p.id, p]));
    dto.items.forEach((item) => {
      if (!productMap.get(item.productId)) throw new Error("Product not found");
    });

    // validate branch stock only if BRANCH return
    if (dto.sourceType === "BRANCH" && dto.branchId) {
      const stocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
      const stockMap = new Map(stocks.filter((s) => s.branchId === dto.branchId).map((s) => [s.productId, s.quantity]));
      dto.items.forEach((item) => {
        const qty = Number(stockMap.get(item.productId) ?? 0);
        if (qty < item.quantity) throw new Error("Insufficient branch stock");
      });
    }

    const now = new Date().toISOString();
    const ret: Return = {
      id: safeId("ret"),
      date: dto.date ?? todayISO(),
      status: "PENDING",
      sourceType: dto.sourceType,
      note: dto.note?.trim() || null,
      branchId: dto.branchId ?? null,
      shopId: dto.shopId ?? null,
      createdById: "local",
      approvedById: null,
      items: dto.items.map((i) => ({ id: safeId("reti"), productId: i.productId, quantity: i.quantity })),
      createdAt: now,
      updatedAt: now,
    };

    const returns = getJSON<Return[]>(STORAGE_KEYS.returns, []);
    setJSON(STORAGE_KEYS.returns, [ret, ...returns]);
    return ret;
  },

  async approve(id: string): Promise<void> {
    const returns = getJSON<Return[]>(STORAGE_KEYS.returns, []);
    const ret = returns.find((r) => r.id === id);
    if (!ret) throw new Error("Return not found");
    if (ret.status !== "PENDING") throw new Error("Return already processed");

    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const now = new Date().toISOString();

    // add to central stock
    const nextProducts = products.map((p) => {
      const item = ret.items.find((i) => i.productId === p.id);
      if (!item) return p;
      return { ...p, stock: Number(p.stock ?? 0) + item.quantity, updatedAt: now };
    });
    setJSON(STORAGE_KEYS.products, nextProducts);

    // subtract from branch stock if applicable
    if (ret.sourceType === "BRANCH" && ret.branchId) {
      const stocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
      const nextStocks = stocks.map((s) => {
        if (s.branchId !== ret.branchId) return s;
        const item = ret.items.find((i) => i.productId === s.productId);
        if (!item) return s;
        return { ...s, quantity: Math.max(0, Number(s.quantity ?? 0) - item.quantity), updatedAt: now };
      });
      setJSON(STORAGE_KEYS.branchStocks, nextStocks);
    }

    const updated = returns.map((r) =>
      r.id === ret.id ? { ...r, status: "APPROVED", approvedById: "local", updatedAt: now } : r
    );
    setJSON(STORAGE_KEYS.returns, updated);
  },

  async reject(id: string): Promise<void> {
    const returns = getJSON<Return[]>(STORAGE_KEYS.returns, []);
    const ret = returns.find((r) => r.id === id);
    if (!ret) throw new Error("Return not found");
    if (ret.status !== "PENDING") throw new Error("Return already processed");

    const now = new Date().toISOString();
    const updated = returns.map((r) =>
      r.id === ret.id ? { ...r, status: "REJECTED", approvedById: "local", updatedAt: now } : r
    );
    setJSON(STORAGE_KEYS.returns, updated);
  },

  async update(id: string, dto: ReturnUpdateDTO): Promise<Return> {
    const returns = getJSON<Return[]>(STORAGE_KEYS.returns, []);
    const exists = returns.find((ret) => ret.id === id);
    if (!exists) throw new Error("Return not found");
    if (exists.status !== "PENDING") throw new Error("Only pending returns can be edited");

    const nextSourceType = dto.sourceType ?? exists.sourceType;

    const nextBranchId = nextSourceType === "BRANCH" ? dto.branchId ?? exists.branchId : null;
    const nextShopId = nextSourceType === "SHOP" ? dto.shopId ?? exists.shopId : null;

    const nextItems =
      dto.items ?? exists.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));

    if (!nextItems.length) throw new Error("Items required");
    nextItems.forEach((i) => {
      if (!Number.isFinite(i.quantity) || i.quantity <= 0) throw new Error("Invalid quantity");
    });

    if (nextSourceType === "BRANCH" && !nextBranchId) throw new Error("Branch required");
    if (nextSourceType === "SHOP" && !nextShopId) throw new Error("Shop required");

    const now = new Date().toISOString();
    const nextReturn: Return = {
      ...exists,
      date: dto.date ?? exists.date,
      sourceType: nextSourceType,
      branchId: nextBranchId,
      shopId: nextShopId,
      note: dto.note !== undefined ? dto.note?.trim() || null : exists.note,
      updatedAt: now,
      items: nextItems.map((item) => ({ id: safeId("reti"), productId: item.productId, quantity: item.quantity })),
    };

    setJSON(STORAGE_KEYS.returns, returns.map((ret) => (ret.id === exists.id ? nextReturn : ret)));
    return nextReturn;
  },

  async remove(id: string): Promise<void> {
    const returns = getJSON<Return[]>(STORAGE_KEYS.returns, []);
    const exists = returns.find((ret) => ret.id === id);
    if (!exists) throw new Error("Return not found");
    if (exists.status !== "PENDING") throw new Error("Only pending returns can be deleted");

    setJSON(STORAGE_KEYS.returns, returns.filter((ret) => ret.id !== exists.id));
  },
};

const api = {
  async list(): Promise<Return[]> {
    return apiFetch<Return[]>("/returns");
  },
  async create(dto: ReturnCreateDTO): Promise<Return> {
    return apiFetch<Return>("/returns", { method: "POST", body: JSON.stringify(dto) });
  },
  async approve(id: string): Promise<void> {
    await apiFetch<void>(`/returns/${id}/approve`, { method: "POST" });
  },
  async reject(id: string): Promise<void> {
    await apiFetch<void>(`/returns/${id}/reject`, { method: "POST" });
  },
  async update(id: string, dto: ReturnUpdateDTO): Promise<Return> {
    return apiFetch<Return>(`/returns/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  },
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/returns/${id}`, { method: "DELETE" });
  },
};

export const returnsService = SERVICE_MODE === "api" ? api : local;