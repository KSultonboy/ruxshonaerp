// src/services/sales.ts
import type {
  Branch,
  BranchStock,
  ShiftCashOutItem,
  ShiftCashOutRecipient,
  ShiftCashSummary,
  Product,
  Sale,
  SaleHistoryGroup,
  Shift,
  ShiftWithMeta,
  ShiftReport,
  PaymentMethod,
} from "@/lib/types";
import { apiFetch } from "./http";
import { SERVICE_MODE } from "./config";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";

type SellDTO = {
  barcode: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  branchId?: string;
  date?: string;
  saleGroupId?: string;
  cashAmount?: number;
};

type UploadResult = { ok: true; photos: string[] };
type DateRange = { from?: string; to?: string; branchId?: string };
type SaleGroupUpdateDTO = {
  items: Array<{ barcode: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  date: string;
};

type ShiftCashOutCreateDTO = {
  amount: number;
  recipientType?: ShiftCashOutRecipient;
  note?: string;
};

const SHIFT_FETCH_TIMEOUT_MS = 4500;
const SHIFT_OPEN_TIMEOUT_MS = 6000;
const SHIFT_RETRY_DELAYS_MS = [0, 500] as const;

export type UploadedShiftPhoto = Shift & {
  branch?: { id: string; name: string } | null;
  openedBy?: { id: string; username: string } | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

function resolveLocalBranch(branchId?: string): Branch {
  const branches = getJSON<Branch[]>(STORAGE_KEYS.branches, []);
  if (branches.length === 0) throw new Error("Filial topilmadi");

  if (!branchId) return branches[0];

  const branch = branches.find((item) => item.id === branchId);
  if (!branch) throw new Error("Filial topilmadi");
  return branch;
}

function normalizeBarcode(barcode: string) {
  return String(barcode || "").trim();
}

function normalizeSaleGroupId(sale: Sale) {
  return String(sale.saleGroupId || sale.id);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown) {
  const message = String((error as any)?.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("api timeout") ||
    message.startsWith("api 502") ||
    message.startsWith("api 503") ||
    message.startsWith("api 504")
  );
}

async function runWithRetry<T>(task: () => Promise<T>, delays = SHIFT_RETRY_DELAYS_MS): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < delays.length; i += 1) {
    if (i > 0 && delays[i] > 0) {
      await wait(delays[i]);
    }
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || i === delays.length - 1) {
        throw error;
      }
    }
  }
  throw lastError ?? new Error("Unknown network error");
}

function groupSalesForHistory(sales: Sale[], limit = 5): SaleHistoryGroup[] {
  const grouped = new Map<string, SaleHistoryGroup>();

  const sorted = [...sales].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const sale of sorted) {
    const key = normalizeSaleGroupId(sale);
    const item = {
      saleId: sale.id,
      barcode: String(sale.product?.barcode ?? ""),
      productId: sale.productId,
      name: String(sale.product?.name ?? "Mahsulot"),
      price: Number(sale.price ?? 0),
      quantity: Number(sale.quantity ?? 0),
      editableStock: Number(sale.quantity ?? 0),
    };
    const existing = grouped.get(key);
    if (existing) {
      existing.total += item.price * item.quantity;
      existing.totalQuantity += item.quantity;
      existing.cashbackLocked =
        existing.cashbackLocked ||
        Boolean(sale.cashbackTransactionId || sale.cashbackRedeemTransactionId);
      existing.items.push(item);
      if (new Date(sale.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        existing.updatedAt = sale.updatedAt;
      }
      continue;
    }

    grouped.set(key, {
      id: key,
      saleGroupId: sale.saleGroupId ?? null,
      branchId: sale.branchId,
      date: sale.date,
      paymentMethod: sale.paymentMethod,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      createdById: sale.createdById,
      total: item.price * item.quantity,
      totalQuantity: item.quantity,
      cashbackLocked: Boolean(sale.cashbackTransactionId || sale.cashbackRedeemTransactionId),
      items: [item],
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

function centralProductAsStock(product: Product, branchId: string): BranchStock {
  const stockQty = Number(product.stock ?? 0);
  return {
    id: `local-central-${branchId}-${product.id}`,
    branchId,
    productId: product.id,
    quantity: stockQty,
    product: {
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      type: product.type,
      salePrice: product.salePrice,
      price: product.price,
      images: product.images,
    },
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

const SHIFT_KEY = STORAGE_KEYS.shift ?? "shift";
const SALES_KEY = STORAGE_KEYS.sales ?? "sales";
const SHIFT_CASH_OUT_KEY = "shift_cash_out_items";

const local = {
  async getShift(): Promise<Shift | null> {
    return getJSON<Shift | null>(SHIFT_KEY, null);
  },

  async openShift(openingAmount?: number): Promise<Shift> {
    const existing = getJSON<Shift | null>(SHIFT_KEY, null);
    if (existing?.status === "OPEN") {
      if (openingAmount !== undefined && Number(existing.openingAmount ?? 0) === 0) {
        const updated: Shift = {
          ...existing,
          openingAmount,
          updatedAt: new Date().toISOString(),
        };
        setJSON(SHIFT_KEY, updated);
        return updated;
      }
      return existing;
    }

    const now = new Date().toISOString();
    const shift: Shift = {
      id: safeId("shift"),
      date: now.slice(0, 10),
      status: "OPEN",
      photos: [],
      branchId: "local",
      openedById: "local",
      openingAmount: openingAmount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    setJSON(SHIFT_KEY, shift);
    return shift;
  },

  async closeShift(closingAmount?: number): Promise<Shift> {
    const existing = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!existing) throw new Error("Smena topilmadi");
    if (!existing.photos?.length) throw new Error("Rasm yuklang");

    const now = new Date().toISOString();
    const closed: Shift = { ...existing, status: "CLOSED", closedAt: now, updatedAt: now, ...(closingAmount !== undefined ? { closingAmount } : {}) };
    setJSON(SHIFT_KEY, closed);
    return closed;
  },

  async forceCloseShift(closingAmount?: number): Promise<{ ok: boolean }> {
    const existing = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!existing || existing.status !== "OPEN") return { ok: true };
    const now = new Date().toISOString();
    setJSON(SHIFT_KEY, { ...existing, status: "CLOSED", closedAt: now, updatedAt: now, ...(closingAmount !== undefined ? { closingAmount } : {}) });
    return { ok: true };
  },

  async uploadShiftPhotos(files: File[]): Promise<string[]> {
    const existing = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!existing) throw new Error("Smena topilmadi");

    const urls = await Promise.all(files.map((f) => fileToDataUrl(f)));
    const combined = [...(existing.photos ?? []), ...urls].slice(0, 6);
    const next: Shift = { ...existing, photos: combined, updatedAt: new Date().toISOString() };
    setJSON(SHIFT_KEY, next);
    return combined;
  },

  async listUploadedShiftPhotos(): Promise<UploadedShiftPhoto[]> {
    const shift = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!shift || !shift.photos?.length) return [];
    return [
      {
        ...shift,
        branch: { id: shift.branchId, name: "Local Branch" },
        openedBy: { id: shift.openedById, username: "local" },
      },
    ];
  },

  async deleteShiftPhoto(shiftId: string, photo: string): Promise<string[]> {
    const shift = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!shift || shift.id !== shiftId) throw new Error("Smena topilmadi");
    const nextPhotos = (shift.photos ?? []).filter((item) => item !== photo);
    const next: Shift = { ...shift, photos: nextPhotos, updatedAt: new Date().toISOString() };
    setJSON(SHIFT_KEY, next);
    return nextPhotos;
  },

  async listShifts(_query?: { from?: string; to?: string; branchId?: string }): Promise<ShiftWithMeta[]> {
    const shift = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!shift) return [];
    return [
      {
        ...shift,
        branch: { id: shift.branchId, name: "Local Branch" },
        openedBy: { id: shift.openedById, username: "local" },
      },
    ];
  },

  async getShiftReport(shiftId: string): Promise<ShiftReport> {
    const shift = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!shift || shift.id !== shiftId) throw new Error("Smena topilmadi");
    const sales = getJSON<Sale[]>(SALES_KEY, []).filter(
      (sale) => sale.branchId === shift.branchId && sale.createdById === shift.openedById && sale.date === shift.date
    );
    const groupMap = new Map<string, ShiftReport["groups"][number]>();
    for (const sale of sales) {
      const gId = String(sale.saleGroupId || sale.id);
      const item = {
        saleId: sale.id,
        productId: sale.productId,
        name: String(sale.product?.name ?? ""),
        barcode: String(sale.product?.barcode ?? ""),
        quantity: Number(sale.quantity),
        price: Number(sale.price),
      };
      const existing = groupMap.get(gId);
      if (existing) {
        existing.total += item.price * item.quantity;
        existing.items.push(item);
      } else {
        groupMap.set(gId, { id: gId, paymentMethod: sale.paymentMethod, createdAt: sale.createdAt, total: item.price * item.quantity, items: [item] });
      }
    }
    const groups = Array.from(groupMap.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const methodMap = new Map<PaymentMethod, { count: number; total: number }>();
    for (const g of groups) {
      const existing = methodMap.get(g.paymentMethod) ?? { count: 0, total: 0 };
      existing.count += 1; existing.total += g.total;
      methodMap.set(g.paymentMethod, existing);
    }
    const byPaymentMethod = Array.from(methodMap.entries()).map(([method, stats]) => ({ method, ...stats }));
    const shiftWithMeta: ShiftWithMeta = { ...shift, branch: { id: shift.branchId, name: "Local Branch" }, openedBy: { id: shift.openedById, username: "local" } };
    return { shift: shiftWithMeta, totalAmount: groups.reduce((s, g) => s + g.total, 0), totalGroups: groups.length, byPaymentMethod, groups };
  },

  async getShiftCashSummary(): Promise<ShiftCashSummary> {
    const shift = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!shift || shift.status !== "OPEN") throw new Error("Smena topilmadi");

    const sales = getJSON<Sale[]>(SALES_KEY, []).filter(
      (sale) =>
        sale.branchId === shift.branchId &&
        sale.createdById === shift.openedById &&
        sale.date === shift.date &&
        sale.paymentMethod === "CASH"
    );
    const cashSalesTotal = sales.reduce(
      (sum, sale) => sum + Number(sale.price || 0) * Number(sale.quantity || 0),
      0
    );

    const allCashOuts = getJSON<Array<ShiftCashOutItem & { shiftId: string }>>(SHIFT_CASH_OUT_KEY, []);
    const cashOuts = allCashOuts.filter((item) => item.shiftId === shift.id);
    const cashOutTotal = cashOuts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const openingAmount = Number(shift.openingAmount ?? 0);

    return {
      shiftId: shift.id,
      shiftDate: shift.date,
      openingAmount,
      cashSalesTotal,
      cashOutTotal,
      currentCash: openingAmount + cashSalesTotal - cashOutTotal,
      warnings: openingAmount + cashSalesTotal - cashOutTotal < 0 ? ["NEGATIVE_CASH"] : [],
      cashOuts: cashOuts
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(({ shiftId: _ignored, ...rest }) => rest),
    };
  },

  async addShiftCashOut(dto: ShiftCashOutCreateDTO) {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new Error("Summa noto'g'ri");
    const shift = getJSON<Shift | null>(SHIFT_KEY, null);
    if (!shift || shift.status !== "OPEN") throw new Error("Smena topilmadi");

    const allCashOuts = getJSON<Array<ShiftCashOutItem & { shiftId: string }>>(SHIFT_CASH_OUT_KEY, []);
    const entry: ShiftCashOutItem & { shiftId: string } = {
      id: safeId("shift_cash_out"),
      shiftId: shift.id,
      amount: Math.round(dto.amount),
      recipientType: dto.recipientType ?? "OTHER",
      note: dto.note?.trim() || null,
      createdAt: new Date().toISOString(),
      createdBy: { id: shift.openedById, username: "local" },
    };

    setJSON(SHIFT_CASH_OUT_KEY, [entry, ...allCashOuts]);
    const summary = await local.getShiftCashSummary();
    return { ok: true, item: entry, summary };
  },

  async branchStock(branchId?: string): Promise<BranchStock[]> {
    const branch = resolveLocalBranch(branchId);

    if ((branch.warehouseMode ?? "SEPARATE") === "CENTRAL") {
      const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
      return products
        .filter((product) => product.active !== false && Number(product.stock ?? 0) > 0)
        .map((product) => centralProductAsStock(product, branch.id));
    }

    const stocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
    return stocks.filter((stock) => stock.branchId === branch.id);
  },

  async productByBarcode(barcode: string, branchId?: string) {
    const branch = resolveLocalBranch(branchId);
    const code = normalizeBarcode(barcode);
    if (!code) throw new Error("Mahsulot topilmadi");

    if ((branch.warehouseMode ?? "SEPARATE") === "CENTRAL") {
      const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
      const product = products.find((item) => normalizeBarcode(item.barcode || "") === code);
      if (!product) throw new Error("Mahsulot topilmadi");
      const stock = centralProductAsStock(product, branch.id);
      return { product: stock.product, stock };
    }

    const stocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
    const found = stocks.find(
      (s) => s.branchId === branch.id && normalizeBarcode(String(s.product?.barcode ?? "")) === code
    );
    if (!found) throw new Error("Mahsulot topilmadi");
    return { product: found.product, stock: found };
  },

  async sell(dto: SellDTO): Promise<Sale> {
    const branch = resolveLocalBranch(dto.branchId);
    const code = normalizeBarcode(dto.barcode);
    if (!code) throw new Error("Mahsulot topilmadi");
    if (!Number.isFinite(dto.quantity) || dto.quantity <= 0) throw new Error("Miqdor noto'g'ri");

    let branchId = branch.id;
    let productId = "";
    let price = 0;
    let saleProduct: Sale["product"] | undefined;

    if ((branch.warehouseMode ?? "SEPARATE") === "CENTRAL") {
      const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
      const productIdx = products.findIndex((item) => normalizeBarcode(item.barcode || "") === code);
      if (productIdx === -1) throw new Error("Mahsulot topilmadi");

      const currentStock = Number(products[productIdx].stock ?? 0);
      if (currentStock < dto.quantity) throw new Error("Qoldiq yetarli emas");

      const now = new Date().toISOString();
      products[productIdx] = {
        ...products[productIdx],
        stock: currentStock - dto.quantity,
        updatedAt: now,
      };
      setJSON(STORAGE_KEYS.products, products);

      productId = products[productIdx].id;
      price = products[productIdx].salePrice ?? products[productIdx].price ?? 0;
      saleProduct = products[productIdx] as any;
    } else {
      const stocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
      const stockIdx = stocks.findIndex(
        (s) => s.branchId === branch.id && normalizeBarcode(String(s.product?.barcode ?? "")) === code
      );
      if (stockIdx === -1) throw new Error("Mahsulot topilmadi");

      if (Number(stocks[stockIdx].quantity ?? 0) < dto.quantity) throw new Error("Qoldiq yetarli emas");

      stocks[stockIdx] = { ...stocks[stockIdx], quantity: Number(stocks[stockIdx].quantity) - dto.quantity };
      setJSON(STORAGE_KEYS.branchStocks, stocks);

      branchId = stocks[stockIdx].branchId;
      productId = stocks[stockIdx].productId;
      price = stocks[stockIdx].product?.salePrice ?? stocks[stockIdx].product?.price ?? 0;
      saleProduct = stocks[stockIdx].product as Sale["product"];
    }

    const now = new Date().toISOString();
    const sale: Sale = {
      id: safeId("sale"),
      date: dto.date ?? now.slice(0, 10),
      quantity: dto.quantity,
      paymentMethod: dto.paymentMethod,
      price,
      saleGroupId: dto.saleGroupId ?? null,
      branchId,
      productId,
      product: saleProduct,
      createdById: "local",
      createdAt: now,
      updatedAt: now,
    };

    const existing = getJSON<Sale[]>(SALES_KEY, []);
    setJSON(SALES_KEY, [sale, ...existing]);
    return sale;
  },

  async list(range?: DateRange): Promise<Sale[]> {
    const sales = getJSON<Sale[]>(SALES_KEY, []);
    return sales.filter((sale) => {
      if (range?.branchId && sale.branchId !== range.branchId) return false;
      if (range?.from && sale.date < range.from) return false;
      if (range?.to && sale.date > range.to) return false;
      return true;
    });
  },

  async recentGroups(branchId?: string, limit = 5): Promise<SaleHistoryGroup[]> {
    const branch = branchId ? resolveLocalBranch(branchId) : null;
    const branchStocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const sales = getJSON<Sale[]>(SALES_KEY, []).filter((sale) => {
      if (!branch) return true;
      return sale.branchId === branch.id;
    });
    const groups = groupSalesForHistory(sales, limit);

    return groups.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const extraStock =
          branch && (branch.warehouseMode ?? "SEPARATE") === "CENTRAL"
            ? Number(products.find((product) => product.id === item.productId)?.stock ?? 0)
            : Number(
                branchStocks.find(
                  (stock) => stock.branchId === group.branchId && stock.productId === item.productId
                )?.quantity ?? 0
              );
        return {
          ...item,
          editableStock: extraStock + item.quantity,
        };
      }),
    }));
  },

  async updateGroup(groupId: string, dto: SaleGroupUpdateDTO): Promise<Sale[]> {
    const sales = getJSON<Sale[]>(SALES_KEY, []);
    const target = sales.filter((sale) => normalizeSaleGroupId(sale) === groupId);
    if (target.length === 0) throw new Error("Sotuv topilmadi");
    if (target.some((sale) => sale.cashbackTransactionId || sale.cashbackRedeemTransactionId)) {
      throw new Error("Cashback bilan bog'langan sotuvni tahrirlab bo'lmaydi");
    }

    const branch = resolveLocalBranch(target[0].branchId);
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const branchStocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);

    const restoreStock = (sale: Sale) => {
      if ((branch.warehouseMode ?? "SEPARATE") === "CENTRAL") {
        const productIdx = products.findIndex((product) => product.id === sale.productId);
        if (productIdx >= 0) {
          products[productIdx] = {
            ...products[productIdx],
            stock: Number(products[productIdx].stock ?? 0) + Number(sale.quantity ?? 0),
            updatedAt: new Date().toISOString(),
          };
        }
        return;
      }

      const stockIdx = branchStocks.findIndex(
        (stock) => stock.branchId === sale.branchId && stock.productId === sale.productId
      );
      if (stockIdx >= 0) {
        branchStocks[stockIdx] = {
          ...branchStocks[stockIdx],
          quantity: Number(branchStocks[stockIdx].quantity ?? 0) + Number(sale.quantity ?? 0),
        };
      }
    };

    for (const sale of target) restoreStock(sale);

    const remainingSales = sales.filter((sale) => normalizeSaleGroupId(sale) !== groupId);
    const now = new Date().toISOString();
    const nextGroupId = target[0].saleGroupId ?? groupId;
    const created: Sale[] = [];

    for (const item of dto.items) {
      const code = normalizeBarcode(item.barcode);
      const quantity = Number(item.quantity);
      if (!code || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Miqdor yoki barcode noto'g'ri");
      }

      if ((branch.warehouseMode ?? "SEPARATE") === "CENTRAL") {
        const productIdx = products.findIndex((product) => normalizeBarcode(product.barcode ?? "") === code);
        if (productIdx === -1) throw new Error("Mahsulot topilmadi");
        if (Number(products[productIdx].stock ?? 0) < quantity) {
          throw new Error(`Qoldiq yetarli emas: ${code}`);
        }
        products[productIdx] = {
          ...products[productIdx],
          stock: Number(products[productIdx].stock ?? 0) - quantity,
          updatedAt: now,
        };
        created.push({
          id: safeId("sale"),
          date: dto.date,
          quantity,
          paymentMethod: dto.paymentMethod,
          price: products[productIdx].salePrice ?? products[productIdx].price ?? 0,
          saleGroupId: nextGroupId,
          branchId: branch.id,
          productId: products[productIdx].id,
          product: products[productIdx] as any,
          createdById: target[0].createdById,
          createdAt: now,
          updatedAt: now,
        });
        continue;
      }

      const stockIdx = branchStocks.findIndex(
        (stock) => stock.branchId === branch.id && normalizeBarcode(stock.product?.barcode ?? "") === code
      );
      if (stockIdx === -1) throw new Error("Mahsulot topilmadi");
      if (Number(branchStocks[stockIdx].quantity ?? 0) < quantity) {
        throw new Error(`Qoldiq yetarli emas: ${code}`);
      }
      branchStocks[stockIdx] = {
        ...branchStocks[stockIdx],
        quantity: Number(branchStocks[stockIdx].quantity ?? 0) - quantity,
      };
      created.push({
        id: safeId("sale"),
        date: dto.date,
        quantity,
        paymentMethod: dto.paymentMethod,
        price: branchStocks[stockIdx].product?.salePrice ?? branchStocks[stockIdx].product?.price ?? 0,
        saleGroupId: nextGroupId,
        branchId: branch.id,
        productId: branchStocks[stockIdx].productId,
        product: branchStocks[stockIdx].product as Sale["product"],
        createdById: target[0].createdById,
        createdAt: now,
        updatedAt: now,
      });
    }

    setJSON(STORAGE_KEYS.products, products);
    setJSON(STORAGE_KEYS.branchStocks, branchStocks);
    setJSON(SALES_KEY, [...created, ...remainingSales]);
    return created;
  },

  async deleteGroup(groupId: string): Promise<{ ok: true; deletedCount: number; groupId: string }> {
    const sales = getJSON<Sale[]>(SALES_KEY, []);
    const target = sales.filter((sale) => normalizeSaleGroupId(sale) === groupId);
    if (target.length === 0) throw new Error("Sotuv topilmadi");
    if (target.some((sale) => sale.cashbackTransactionId || sale.cashbackRedeemTransactionId)) {
      throw new Error("Cashback bilan bog'langan sotuvni o'chirib bo'lmaydi");
    }

    const branch = resolveLocalBranch(target[0].branchId);
    const products = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const branchStocks = getJSON<BranchStock[]>(STORAGE_KEYS.branchStocks, []);

    for (const sale of target) {
      if ((branch.warehouseMode ?? "SEPARATE") === "CENTRAL") {
        const productIdx = products.findIndex((product) => product.id === sale.productId);
        if (productIdx >= 0) {
          products[productIdx] = {
            ...products[productIdx],
            stock: Number(products[productIdx].stock ?? 0) + Number(sale.quantity ?? 0),
            updatedAt: new Date().toISOString(),
          };
        }
        continue;
      }

      const stockIdx = branchStocks.findIndex(
        (stock) => stock.branchId === sale.branchId && stock.productId === sale.productId
      );
      if (stockIdx >= 0) {
        branchStocks[stockIdx] = {
          ...branchStocks[stockIdx],
          quantity: Number(branchStocks[stockIdx].quantity ?? 0) + Number(sale.quantity ?? 0),
        };
      }
    }

    setJSON(STORAGE_KEYS.products, products);
    setJSON(STORAGE_KEYS.branchStocks, branchStocks);
    setJSON(
      SALES_KEY,
      sales.filter((sale) => normalizeSaleGroupId(sale) !== groupId)
    );

    return { ok: true, deletedCount: target.length, groupId };
  },
};

const api = {
  async getShift(): Promise<Shift | null> {
    return runWithRetry(() =>
      apiFetch<Shift | null>("/sales/shift", { timeoutMs: SHIFT_FETCH_TIMEOUT_MS })
    );
  },
  async openShift(): Promise<Shift> {
    return runWithRetry(() =>
      apiFetch<Shift>("/sales/shift/open", {
        method: "POST",
        timeoutMs: SHIFT_OPEN_TIMEOUT_MS,
      })
    );
  },
  async closeShift(closingAmount?: number): Promise<Shift> {
    return apiFetch<Shift>("/sales/shift/close", { method: "POST", body: JSON.stringify({ closingAmount }) });
  },
  async forceCloseShift(closingAmount?: number): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/sales/shift/force-close", { method: "POST", body: JSON.stringify({ closingAmount }) });
  },
  async uploadShiftPhotos(files: File[]): Promise<string[]> {
    const form = new FormData();
    files.forEach((f) => form.append("images", f));
    const res = await apiFetch<UploadResult>("/sales/shift/photos", { method: "POST", body: form });
    return res.photos ?? [];
  },
  async listUploadedShiftPhotos(): Promise<UploadedShiftPhoto[]> {
    try {
      return await apiFetch<UploadedShiftPhoto[]>("/sales/shift/photos");
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("API 404")) return [];
      throw e;
    }
  },
  async deleteShiftPhoto(shiftId: string, photo: string): Promise<string[]> {
    const res = await apiFetch<UploadResult>(`/sales/shift/photos/${encodeURIComponent(shiftId)}`, {
      method: "DELETE",
      body: JSON.stringify({ photo }),
    });
    return res.photos ?? [];
  },
  async branchStock(branchId?: string): Promise<BranchStock[]> {
    const search = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    return apiFetch<BranchStock[]>(`/sales/branch-stock${search}`);
  },
  async productByBarcode(barcode: string, branchId?: string) {
    const search = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    return apiFetch(`/sales/barcode/${encodeURIComponent(barcode)}${search}`);
  },
  async sell(dto: SellDTO): Promise<Sale> {
    return apiFetch<Sale>("/sales/sell", { method: "POST", body: JSON.stringify(dto) });
  },
  async list(range?: DateRange): Promise<Sale[]> {
    const search = new URLSearchParams();
    if (range?.branchId) search.set("branchId", range.branchId);
    if (range?.from) search.set("from", range.from);
    if (range?.to) search.set("to", range.to);
    const qs = search.toString();

    try {
      return await apiFetch<Sale[]>(qs ? `/sales?${qs}` : "/sales");
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("API 404")) return [];
      throw e;
    }
  },
  async recentGroups(branchId?: string, limit = 5): Promise<SaleHistoryGroup[]> {
    const search = new URLSearchParams();
    if (branchId) search.set("branchId", branchId);
    search.set("limit", String(limit));
    const qs = search.toString();
    return apiFetch<SaleHistoryGroup[]>(`/sales/recent-groups?${qs}`);
  },
  async updateGroup(groupId: string, dto: SaleGroupUpdateDTO): Promise<Sale[]> {
    return apiFetch<Sale[]>(`/sales/groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  },
  async deleteGroup(groupId: string): Promise<{ ok: true; deletedCount: number; groupId: string }> {
    return apiFetch<{ ok: true; deletedCount: number; groupId: string }>(
      `/sales/groups/${encodeURIComponent(groupId)}`,
      { method: "DELETE" }
    );
  },
  async listShifts(query?: { from?: string; to?: string; branchId?: string }): Promise<ShiftWithMeta[]> {
    const search = new URLSearchParams();
    if (query?.branchId) search.set("branchId", query.branchId);
    if (query?.from) search.set("from", query.from);
    if (query?.to) search.set("to", query.to);
    const qs = search.toString();
    try {
      return await apiFetch<ShiftWithMeta[]>(qs ? `/sales/shifts?${qs}` : "/sales/shifts");
    } catch (e: any) {
      if (String(e?.message || "").startsWith("API 404")) return [];
      throw e;
    }
  },
  async getShiftReport(shiftId: string): Promise<ShiftReport> {
    return apiFetch<ShiftReport>(`/sales/shifts/${encodeURIComponent(shiftId)}/report`);
  },
  async getShiftCashSummary(): Promise<ShiftCashSummary> {
    return apiFetch<ShiftCashSummary>("/sales/shift/cash", {
      timeoutMs: SHIFT_FETCH_TIMEOUT_MS,
    });
  },
  async addShiftCashOut(dto: ShiftCashOutCreateDTO) {
    return apiFetch<{ ok: true; item: ShiftCashOutItem; summary: ShiftCashSummary }>(
      "/sales/shift/cash/out",
      { method: "POST", body: JSON.stringify(dto) }
    );
  },
};

export const salesService = SERVICE_MODE === "api" ? api : local;
