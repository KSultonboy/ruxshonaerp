// src/services/warehouse.ts
import type { StockMovement, WarehouseSummary, Product } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";
import type { IWarehouseService, StockMovementCreateDTO, StockMovementUpdateDTO } from "./contracts";

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

function movementEffect(type: StockMovement["type"], quantity: number) {
  return type === "IN" ? quantity : -quantity;
}

function applyStockDeltas(products: Product[], deltas: Map<string, number>) {
  const nextProducts = products.map((product) => ({ ...product }));

  for (const [productId, delta] of deltas.entries()) {
    if (!delta) continue;

    const productIndex = nextProducts.findIndex((product) => product.id === productId);
    if (productIndex === -1) throw new Error("Product not found");

    const nextStock = Number(nextProducts[productIndex].stock ?? 0) + delta;
    if (nextStock < 0) throw new Error("Insufficient stock");

    nextProducts[productIndex] = {
      ...nextProducts[productIndex],
      stock: nextStock,
      updatedAt: new Date().toISOString(),
    };
  }

  return nextProducts;
}

const local: IWarehouseService = {
  async summary() {
    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const movements = getJSON<StockMovement[]>(STORAGE_KEYS.stockMovements, []);
    const today = todayISO();

    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + Number(p.stock ?? 0), 0);
    const lowStockCount = products.filter((p) => Number(p.stock ?? 0) <= Number(p.minStock ?? 0)).length;
    const todayIn = movements.filter((m) => m.date === today && m.type === "IN").reduce((sum, m) => sum + m.quantity, 0);
    const todayOut = movements.filter((m) => m.date === today && m.type === "OUT").reduce((sum, m) => sum + m.quantity, 0);

    return { totalProducts, totalStock, lowStockCount, todayIn, todayOut };
  },

  async movements(limit = 20) {
    const movements = getJSON<StockMovement[]>(STORAGE_KEYS.stockMovements, []);
    return movements
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  },

  async createMovement(dto) {
    if (!Number.isFinite(dto.quantity) || dto.quantity <= 0) throw new Error("Invalid quantity");

    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const index = products.findIndex((p) => p.id === dto.productId);
    if (index === -1) throw new Error("Product not found");

    const delta = dto.type === "IN" ? dto.quantity : -dto.quantity;
    const nextStock = Number(products[index].stock ?? 0) + delta;
    if (nextStock < 0) throw new Error("Insufficient stock");

    const now = new Date().toISOString();
    const movement: StockMovement = {
      id: safeId("wm"),
      date: dto.date ?? todayISO(),
      type: dto.type,
      quantity: dto.quantity,
      note: dto.note?.trim() || undefined,
      productId: dto.productId,
      product: { id: products[index].id, name: products[index].name, type: products[index].type },
      createdById: dto.createdById,
      createdAt: now,
      updatedAt: now,
    };

    products[index] = { ...products[index], stock: nextStock, updatedAt: now };
    setJSON(STORAGE_KEYS.products, products);

    const movements = getJSON<StockMovement[]>(STORAGE_KEYS.stockMovements, []);
    setJSON(STORAGE_KEYS.stockMovements, [movement, ...movements]);

    return movement;
  },

  async updateMovement(id, dto) {
    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const movements = getJSON<StockMovement[]>(STORAGE_KEYS.stockMovements, []);
    const existing = movements.find((movement) => movement.id === id);
    if (!existing) throw new Error("Stock movement not found");

    const nextProductId = dto.productId ?? existing.productId;
    const nextType = dto.type ?? existing.type;
    const nextQuantity = dto.quantity ?? existing.quantity;
    const nextDate = dto.date ?? existing.date;
    const nextNote = dto.note !== undefined ? dto.note?.trim() || undefined : existing.note;

    const deltas = new Map<string, number>();
    deltas.set(
      existing.productId,
      (deltas.get(existing.productId) ?? 0) - movementEffect(existing.type, existing.quantity)
    );
    deltas.set(
      nextProductId,
      (deltas.get(nextProductId) ?? 0) + movementEffect(nextType, nextQuantity)
    );

    const nextProducts = applyStockDeltas(products, deltas);
    const linkedProduct = nextProducts.find((product) => product.id === nextProductId);
    if (!linkedProduct) throw new Error("Product not found");

    const updatedMovement: StockMovement = {
      ...existing,
      productId: nextProductId,
      type: nextType,
      quantity: nextQuantity,
      date: nextDate,
      note: nextNote,
      updatedAt: new Date().toISOString(),
      product: {
        id: linkedProduct.id,
        name: linkedProduct.name,
        type: linkedProduct.type,
      },
    };

    setJSON(STORAGE_KEYS.products, nextProducts);
    setJSON(
      STORAGE_KEYS.stockMovements,
      movements.map((movement) => (movement.id === id ? updatedMovement : movement))
    );

    return updatedMovement;
  },

  async removeMovement(id) {
    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const movements = getJSON<StockMovement[]>(STORAGE_KEYS.stockMovements, []);
    const existing = movements.find((movement) => movement.id === id);
    if (!existing) throw new Error("Stock movement not found");

    const deltas = new Map<string, number>();
    deltas.set(
      existing.productId,
      -movementEffect(existing.type, existing.quantity)
    );

    const nextProducts = applyStockDeltas(products, deltas);
    setJSON(STORAGE_KEYS.products, nextProducts);
    setJSON(
      STORAGE_KEYS.stockMovements,
      movements.filter((movement) => movement.id !== id)
    );
  },

  async adjustStock(productId, newQuantity) {
    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const idx = products.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error("Product not found");
    const previousStock = products[idx].stock;
    products[idx] = { ...products[idx], stock: newQuantity };
    setJSON(STORAGE_KEYS.products, products);
    return { ok: true, previousStock, newStock: newQuantity };
  },
};

const api: IWarehouseService = {
  async summary() {
    return apiFetch<WarehouseSummary>("/warehouse/summary");
  },

  async movements(limit = 20) {
    return apiFetch<StockMovement[]>(`/warehouse/movements?limit=${limit}`);
  },

  async createMovement(dto: StockMovementCreateDTO) {
    return apiFetch<StockMovement>("/warehouse/movements", { method: "POST", body: JSON.stringify(dto) });
  },

  async updateMovement(id: string, dto: StockMovementUpdateDTO) {
    return apiFetch<StockMovement>(`/warehouse/movements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  },

  async removeMovement(id: string) {
    await apiFetch<void>(`/warehouse/movements/${id}`, { method: "DELETE" });
  },

  async adjustStock(productId: string, newQuantity: number, note?: string) {
    return apiFetch<{ ok: boolean; previousStock: number; newStock: number }>(
      "/warehouse/adjust-stock",
      {
        method: "PATCH",
        body: JSON.stringify({ productId, newQuantity, note }),
      }
    );
  },
};

export const warehouseService: IWarehouseService = SERVICE_MODE === "api" ? api : local;
