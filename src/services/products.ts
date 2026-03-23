// src/services/products.ts
import type { Product } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";
import type {
  IProductsService,
  ProductCreateDTO,
  ProductFormalUpdateDTO,
  ProductUpdateDTO,
} from "./contracts";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

function generateBase12(prefix = "20") {
  let out = prefix;
  while (out.length < 12) out += String(Math.floor(Math.random() * 10));
  return out.slice(0, 12);
}

function computeEan13(base12: string) {
  let odd = 0;
  let even = 0;
  for (let i = 0; i < base12.length; i += 1) {
    const digit = Number(base12[i]);
    if (i % 2 === 0) odd += digit;
    else even += digit;
  }
  const sum = odd + even * 3;
  const check = (10 - (sum % 10)) % 10;
  return `${base12}${check}`;
}

function generateUniqueBarcode(used: Set<string>) {
  for (let i = 0; i < 8; i += 1) {
    const barcode = computeEan13(generateBase12());
    if (!used.has(barcode)) {
      used.add(barcode);
      return barcode;
    }
  }
  const fallback = computeEan13(generateBase12());
  used.add(fallback);
  return fallback;
}

function resolveBarcode(input: string | undefined, used: Set<string>) {
  const trimmed = input?.trim();
  if (trimmed && /^\d{13}$/.test(trimmed) && !used.has(trimmed)) {
    used.add(trimmed);
    return trimmed;
  }
  return generateUniqueBarcode(used);
}

const local: IProductsService = {
  async list() {
    const items = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const used = new Set(items.map((p) => p.barcode).filter(Boolean) as string[]);

    let changed = false;
    const next = items.map((p) => {
      let nextItem: Product = {
        ...p,
        stock: Number(p.stock ?? 0),
        minStock: Number(p.minStock ?? 0),
      };

      if (!p.barcode) {
        changed = true;
        nextItem = { ...nextItem, barcode: generateUniqueBarcode(used), updatedAt: new Date().toISOString() };
      }

      // Legacy: if price was used as salePrice, normalize
      if (p.type === "PRODUCT" && nextItem.salePrice === undefined && typeof p.price === "number") {
        changed = true;
        nextItem = { ...nextItem, salePrice: p.price, price: undefined, updatedAt: new Date().toISOString() };
      }

      return nextItem;
    });

    if (changed) setJSON(STORAGE_KEYS.products, next);
    return next;
  },

  async listFormal() {
    return this.list();
  },

  async create(input: ProductCreateDTO) {
    const items = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const now = new Date().toISOString();
    const used = new Set(items.map((p) => p.barcode).filter(Boolean) as string[]);

    const p: Product = {
      ...input,
      id: input.id ?? safeId("p"),
      barcode: resolveBarcode(input.barcode, used),
      type: "PRODUCT",
      price: input.price,
      salePrice: input.salePrice,
      shopPrice: input.shopPrice,
      labourPrice: input.labourPrice ?? 0,
      images: input.images ?? [],
      stock: 0,
      minStock: 0,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const next = [p, ...items.filter((x) => x.id !== p.id)];
    setJSON(STORAGE_KEYS.products, next);
    return p;
  },

  async update(id: string, patch: ProductUpdateDTO) {
    const items = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const used = new Set(items.filter((p) => p.id !== id).map((p) => p.barcode).filter(Boolean) as string[]);

    const next = items.map((p) => {
      if (p.id !== id) return p;

      const updated: Product = { ...p, updatedAt: new Date().toISOString() };

      if (patch.name !== undefined) updated.name = patch.name;
      if (patch.categoryId !== undefined) updated.categoryId = patch.categoryId;
      if (patch.unitId !== undefined) updated.unitId = patch.unitId;
      if (patch.price !== undefined) updated.price = patch.price;
      if (patch.salePrice !== undefined) updated.salePrice = patch.salePrice;
      if (patch.shopPrice !== undefined) updated.shopPrice = patch.shopPrice;
      if (patch.labourPrice !== undefined) updated.labourPrice = patch.labourPrice;
      if (patch.active !== undefined) updated.active = patch.active;
      if (patch.images !== undefined) updated.images = patch.images;

      if (patch.barcode !== undefined) {
        const b = patch.barcode?.trim() || "";
        if (b && /^\d{13}$/.test(b) && !used.has(b)) {
          updated.barcode = b;
          used.add(b);
        } else if (b) {
          // if user tries a duplicate barcode, keep old to avoid collisions
          // (alternatively you can throw error, but this is safer for local mode)
        }
      }

      return updated;
    });

    setJSON(STORAGE_KEYS.products, next);
  },

  async updateFormal(id: string, patch: ProductFormalUpdateDTO) {
    const items = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const next = items.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        formalName: patch.formalName !== undefined ? (patch.formalName?.trim() || null) : p.formalName ?? null,
        formalDescription:
          patch.formalDescription !== undefined
            ? patch.formalDescription?.trim() || null
            : p.formalDescription ?? null,
        formalImage: patch.formalImage !== undefined ? patch.formalImage?.trim() || null : p.formalImage ?? null,
        publishToWebsite:
          patch.publishToWebsite !== undefined ? patch.publishToWebsite : (p.publishToWebsite ?? false),
        publishToMobile:
          patch.publishToMobile !== undefined ? patch.publishToMobile : (p.publishToMobile ?? false),
        updatedAt: new Date().toISOString(),
      };
    });
    setJSON(STORAGE_KEYS.products, next);
  },

  async remove(id: string) {
    const items = getJSON<Product[]>(STORAGE_KEYS.products, []).filter((p) => p.id !== id);
    setJSON(STORAGE_KEYS.products, items);
  },

  async uploadImages(id: string, files: File[]) {
    const items = getJSON<Product[]>(STORAGE_KEYS.products, []);
    const existing = items.find((p) => p.id === id);
    if (!existing) return [];

    const urls = await Promise.all(files.map((f) => fileToDataUrl(f)));
    const combined = [...(existing.images ?? []), ...urls].slice(0, 3);
    const next = items.map((p) => (p.id === id ? { ...p, images: combined, updatedAt: new Date().toISOString() } : p));
    setJSON(STORAGE_KEYS.products, next);
    return combined;
  },
};

const api: IProductsService = {
  async list() {
    return apiFetch<Product[]>("/products");
  },

  async listFormal() {
    return apiFetch<Product[]>("/products/formal");
  },

  async create(dto) {
    const { id, images, ...safe } = dto as any;
    return apiFetch<Product>("/products", { method: "POST", body: JSON.stringify(safe) });
  },

  async update(id, dto) {
    await apiFetch<void>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  },

  async updateFormal(id, dto) {
    await apiFetch<void>(`/products/${id}/formal`, { method: "PATCH", body: JSON.stringify(dto) });
  },

  async remove(id) {
    await apiFetch<void>(`/products/${id}`, { method: "DELETE" });
  },

  async uploadImages(id, files) {
    const form = new FormData();
    files.forEach((f) => form.append("images", f));
    const res = await apiFetch<{ ok: true; images: string[] }>(`/products/${id}/images`, {
      method: "POST",
      body: form,
    });
    return res.images ?? [];
  },
};

export const productsService: IProductsService = SERVICE_MODE === "api" ? api : local;
