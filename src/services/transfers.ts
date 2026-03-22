// src/services/transfers.ts
import type { BranchStock, Product, Sale, Transfer, TransferTargetType } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

export type TransferCreateDTO = {
  targetType: TransferTargetType;
  branchId?: string;
  shopId?: string;
  date?: string;
  note?: string;
  items: { productId: string; quantity: number }[];
};

export type TransferUpdateDTO = Partial<TransferCreateDTO> & { specialCode?: string };

const RECEIVED_TRANSFER_SPECIAL_CODE = "2112";

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
  async list(): Promise<Transfer[]> {
    const transfers = getJSON<Transfer[]>(STORAGE_KEYS.transfers, []);
    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const branches = getJSON<{ id: string; name: string }[]>(STORAGE_KEYS.branches, []);
    const shops = getJSON<{ id: string; name: string }[]>(STORAGE_KEYS.shops, []);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const shopMap = new Map(shops.map((s) => [s.id, s]));

    return transfers.map((t) => ({
      ...t,
      items: t.items.map((i) => ({ ...i, product: productMap.get(i.productId) })),
      branch: t.branchId ? branchMap.get(t.branchId) ?? null : null,
      shop: t.shopId ? shopMap.get(t.shopId) ?? null : null,
    }));
  },

  async create(dto: TransferCreateDTO): Promise<Transfer> {
    if (!dto.items?.length) throw new Error("Items required");
    if (dto.targetType === "BRANCH" && !dto.branchId) throw new Error("Branch required");
    if (dto.targetType === "SHOP" && !dto.shopId) throw new Error("Shop required");

    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const productMap = new Map(products.map((p) => [p.id, p]));

    dto.items.forEach((item) => {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error("Invalid quantity");
      const p = productMap.get(item.productId);
      if (!p) throw new Error("Product not found");
      if (Number(p.stock ?? 0) < item.quantity) throw new Error("Insufficient stock");
    });

    const now = new Date().toISOString();
    const transfer: Transfer = {
      id: safeId("tr"),
      date: dto.date ?? todayISO(),
      status: dto.targetType === "SHOP" ? "RECEIVED" : "PENDING",
      targetType: dto.targetType,
      note: dto.note?.trim() || null,
      branchId: dto.branchId ?? null,
      shopId: dto.shopId ?? null,
      createdById: "local",
      receivedById: dto.targetType === "SHOP" ? "local" : null,
      items: dto.items.map((i) => ({ id: safeId("tri"), productId: i.productId, quantity: i.quantity })),
      createdAt: now,
      updatedAt: now,
    };

    // deduct stock
    const nextProducts = products.map((p) => {
      const found = dto.items.find((i) => i.productId === p.id);
      if (!found) return p;
      return { ...p, stock: Number(p.stock ?? 0) - found.quantity, updatedAt: now };
    });
    setJSON(STORAGE_KEYS.products, nextProducts);

    const transfers = getJSON<Transfer[]>(STORAGE_KEYS.transfers, []);
    setJSON(STORAGE_KEYS.transfers, [transfer, ...transfers]);

    return transfer;
  },

  async receive(id: string): Promise<void> {
    const transfers = getJSON<Transfer[]>(STORAGE_KEYS.transfers, []);
    const transfer = transfers.find((t) => t.id === id);
    if (!transfer) throw new Error("Transfer not found");
    if (transfer.targetType !== "BRANCH") throw new Error("Transfer is not for branch");
    if (transfer.status !== "PENDING") throw new Error("Transfer already processed");
    if (!transfer.branchId) throw new Error("Branch not set");

    const now = new Date().toISOString();
    const stocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
    const nextStocks = [...stocks];

    transfer.items.forEach((item) => {
      const existing = nextStocks.find((s) => s.branchId === transfer.branchId && s.productId === item.productId);
      if (existing) {
        existing.quantity = Number(existing.quantity ?? 0) + item.quantity;
        existing.updatedAt = now;
      } else {
        nextStocks.push({
          id: safeId("bst"),
          branchId: transfer.branchId as string,
          productId: item.productId,
          quantity: item.quantity,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    setJSON(STORAGE_KEYS.branchStocks, nextStocks);

    const updated = transfers.map((t) =>
      t.id === transfer.id ? { ...t, status: "RECEIVED", receivedById: "local", updatedAt: now } : t
    );
    setJSON(STORAGE_KEYS.transfers, updated);
  },

  async update(id: string, dto: TransferUpdateDTO): Promise<Transfer> {
    const transfers = getJSON<Transfer[]>(STORAGE_KEYS.transfers, []);
    const exists = transfers.find((t) => t.id === id);
    if (!exists) throw new Error("Transfer not found");
    const canEditBranchPending = exists.targetType === "BRANCH" && exists.status === "PENDING";
    const canEditBranchReceived = exists.targetType === "BRANCH" && exists.status === "RECEIVED";
    const canEditShopReceived = exists.targetType === "SHOP" && exists.status === "RECEIVED";
    if (!canEditBranchPending && !canEditBranchReceived && !canEditShopReceived) {
      throw new Error("Only pending/received branch or received shop transfers can be edited");
    }

    if (canEditBranchReceived) {
      if ((dto.specialCode ?? "").trim() !== RECEIVED_TRANSFER_SPECIAL_CODE) {
        throw new Error("Special code required for received transfer changes");
      }
      if (dto.branchId && dto.branchId !== exists.branchId) {
        throw new Error("Branch cannot be changed after transfer is received");
      }

      const transferProductIds = Array.from(new Set(exists.items.map((item) => item.productId)));
      const sales = getJSON<Sale[]>(STORAGE_KEYS.sales, []);
      const sold = sales.some(
        (sale) =>
          sale.branchId === exists.branchId &&
          transferProductIds.includes(sale.productId) &&
          String(sale.date || "") >= String(exists.date || "")
      );
      if (sold) {
        throw new Error("Cannot edit or delete: transfer products already sold in branch");
      }
    }

    if (dto.targetType && dto.targetType !== exists.targetType) {
      throw new Error("Changing transfer type is not allowed");
    }

    const nextTargetType = exists.targetType;
    const nextBranchId = nextTargetType === "BRANCH" ? dto.branchId ?? exists.branchId : null;
    const nextShopId = nextTargetType === "SHOP" ? dto.shopId ?? exists.shopId : null;
    if (nextTargetType === "BRANCH" && !nextBranchId) throw new Error("Branch required");
    if (nextTargetType === "SHOP" && !nextShopId) throw new Error("Shop required");

    const nextItems = dto.items ?? exists.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
    if (!nextItems.length) throw new Error("Items required");

    nextItems.forEach((i) => {
      if (!Number.isFinite(i.quantity) || i.quantity <= 0) throw new Error("Invalid quantity");
    });

    const now = new Date().toISOString();
    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));

    const rollbackProducts = products.map((p) => ({ ...p }));

    const productMap = new Map(rollbackProducts.map((p) => [p.id, p]));
    const branchStocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
    const nextBranchStocks = [...branchStocks];

    if (canEditBranchReceived) {
      const branchId = exists.branchId ?? "";
      exists.items.forEach((item) => {
        const stockIndex = nextBranchStocks.findIndex((stock) => stock.branchId === branchId && stock.productId === item.productId);
        const currentQty = stockIndex >= 0 ? Number(nextBranchStocks[stockIndex].quantity ?? 0) : 0;
        if (currentQty < item.quantity) {
          throw new Error("Cannot edit: transfer stock already used");
        }
        if (stockIndex >= 0) {
          nextBranchStocks[stockIndex] = {
            ...nextBranchStocks[stockIndex],
            quantity: currentQty - item.quantity,
            updatedAt: now,
          };
        }

        const product = productMap.get(item.productId);
        if (!product) throw new Error("Product not found");
        productMap.set(item.productId, { ...product, stock: Number(product.stock ?? 0) + item.quantity, updatedAt: now });
      });
    } else {
      exists.items.forEach((item) => {
        const product = productMap.get(item.productId);
        if (!product) return;
        productMap.set(item.productId, { ...product, stock: Number(product.stock ?? 0) + item.quantity, updatedAt: now });
      });
    }

    // apply new items
    nextItems.forEach((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error("Product not found");
      if (Number(product.stock ?? 0) < item.quantity) throw new Error("Insufficient stock");
      productMap.set(item.productId, { ...product, stock: Number(product.stock ?? 0) - item.quantity, updatedAt: now });

      if (canEditBranchReceived) {
        const branchId = exists.branchId ?? "";
        const stockIndex = nextBranchStocks.findIndex((stock) => stock.branchId === branchId && stock.productId === item.productId);
        if (stockIndex >= 0) {
          nextBranchStocks[stockIndex] = {
            ...nextBranchStocks[stockIndex],
            quantity: Number(nextBranchStocks[stockIndex].quantity ?? 0) + item.quantity,
            updatedAt: now,
          };
        } else {
          nextBranchStocks.push({
            id: safeId("bst"),
            branchId,
            productId: item.productId,
            quantity: item.quantity,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    });

    setJSON(STORAGE_KEYS.products, Array.from(productMap.values()));
    if (canEditBranchReceived) {
      setJSON(STORAGE_KEYS.branchStocks, nextBranchStocks);
    }

    const nextTransfer: Transfer = {
      ...exists,
      date: dto.date ?? exists.date,
      note: dto.note !== undefined ? dto.note?.trim() || null : exists.note,
      branchId: nextBranchId,
      shopId: nextShopId,
      targetType: nextTargetType,
      updatedAt: now,
      items: nextItems.map((item) => ({ id: safeId("tri"), productId: item.productId, quantity: item.quantity })),
    };

    setJSON(STORAGE_KEYS.transfers, transfers.map((t) => (t.id === exists.id ? nextTransfer : t)));
    return nextTransfer;
  },

  async remove(id: string, specialCode?: string): Promise<void> {
    const transfers = getJSON<Transfer[]>(STORAGE_KEYS.transfers, []);
    const exists = transfers.find((t) => t.id === id);
    if (!exists) throw new Error("Transfer not found");
    const canDeleteBranchPending = exists.targetType === "BRANCH" && exists.status === "PENDING";
    const canDeleteBranchReceived = exists.targetType === "BRANCH" && exists.status === "RECEIVED";
    const canDeleteShopReceived = exists.targetType === "SHOP" && exists.status === "RECEIVED";
    if (!canDeleteBranchPending && !canDeleteBranchReceived && !canDeleteShopReceived) {
      throw new Error("Only pending/received branch or received shop transfers can be deleted");
    }

    if (canDeleteBranchReceived) {
      if ((specialCode ?? "").trim() !== RECEIVED_TRANSFER_SPECIAL_CODE) {
        throw new Error("Special code required for received transfer changes");
      }
      const transferProductIds = Array.from(new Set(exists.items.map((item) => item.productId)));
      const sales = getJSON<Sale[]>(STORAGE_KEYS.sales, []);
      const sold = sales.some(
        (sale) =>
          sale.branchId === exists.branchId &&
          transferProductIds.includes(sale.productId) &&
          String(sale.date || "") >= String(exists.date || "")
      );
      if (sold) {
        throw new Error("Cannot edit or delete: transfer products already sold in branch");
      }
    }

    const now = new Date().toISOString();
    const products = normalizeProducts(getJSON<Product[]>(STORAGE_KEYS.products, []));
    const branchStocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
    const nextBranchStocks = [...branchStocks];

    const nextProducts = products.map((p) => {
      const oldItem = exists.items.find((item) => item.productId === p.id);
      if (!oldItem) return p;
      return { ...p, stock: Number(p.stock ?? 0) + oldItem.quantity, updatedAt: now };
    });

    if (canDeleteBranchReceived) {
      const branchId = exists.branchId ?? "";
      exists.items.forEach((item) => {
        const stockIndex = nextBranchStocks.findIndex((stock) => stock.branchId === branchId && stock.productId === item.productId);
        const currentQty = stockIndex >= 0 ? Number(nextBranchStocks[stockIndex].quantity ?? 0) : 0;
        if (currentQty < item.quantity) {
          throw new Error("Cannot delete: transfer stock already used");
        }
        if (stockIndex >= 0) {
          nextBranchStocks[stockIndex] = {
            ...nextBranchStocks[stockIndex],
            quantity: currentQty - item.quantity,
            updatedAt: now,
          };
        }
      });
      setJSON(STORAGE_KEYS.branchStocks, nextBranchStocks);
    }

    setJSON(STORAGE_KEYS.products, nextProducts);
    setJSON(STORAGE_KEYS.transfers, transfers.filter((t) => t.id !== exists.id));
  },
};

const api = {
  async list(): Promise<Transfer[]> {
    return apiFetch<Transfer[]>("/transfers");
  },
  async create(dto: TransferCreateDTO): Promise<Transfer> {
    return apiFetch<Transfer>("/transfers", { method: "POST", body: JSON.stringify(dto) });
  },
  async receive(id: string): Promise<void> {
    await apiFetch<void>(`/transfers/${id}/receive`, { method: "POST" });
  },
  async update(id: string, dto: TransferUpdateDTO): Promise<Transfer> {
    return apiFetch<Transfer>(`/transfers/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  },
  async remove(id: string, specialCode?: string): Promise<void> {
    const query = specialCode ? `?specialCode=${encodeURIComponent(specialCode)}` : "";
    await apiFetch<void>(`/transfers/${id}${query}`, { method: "DELETE" });
  },
};

export const transfersService = SERVICE_MODE === "api" ? api : local;
