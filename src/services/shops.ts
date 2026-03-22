// src/services/shops.ts
import type { Shop } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

export type ShopCreateDTO = {
  name: string;
  address?: string;
  phone?: string;
};

type ShopUpdateDTO = Partial<ShopCreateDTO>;

const local = {
  async list(): Promise<Shop[]> {
    return getJSON<Shop[]>(STORAGE_KEYS.shops, []);
  },

  async create(dto: ShopCreateDTO): Promise<Shop> {
    if (!dto.name?.trim()) throw new Error("Do'kon nomi kerak");
    const items = getJSON<Shop[]>(STORAGE_KEYS.shops, []);
    const now = new Date().toISOString();

    const shop: Shop = {
      id: safeId("shop"),
      name: dto.name.trim(),
      address: dto.address?.trim() || undefined,
      phone: dto.phone?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    setJSON(STORAGE_KEYS.shops, [shop, ...items]);
    return shop;
  },

  async update(id: string, dto: ShopUpdateDTO): Promise<void> {
    const items = getJSON<Shop[]>(STORAGE_KEYS.shops, []).map((s) =>
      s.id === id
        ? {
          ...s,
          ...dto,
          name: dto.name?.trim() ?? s.name,
          address: dto.address === undefined ? s.address : dto.address.trim() || undefined,
          phone: dto.phone === undefined ? s.phone : dto.phone.trim() || undefined,
          updatedAt: new Date().toISOString(),
        }
        : s
    );
    setJSON(STORAGE_KEYS.shops, items);
  },

  async remove(id: string): Promise<void> {
    const items = getJSON<Shop[]>(STORAGE_KEYS.shops, []).filter((s) => s.id !== id);
    setJSON(STORAGE_KEYS.shops, items);
  },
};

const api = {
  async list(): Promise<Shop[]> {
    return apiFetch<Shop[]>("/shops");
  },
  async create(dto: ShopCreateDTO): Promise<Shop> {
    return apiFetch<Shop>("/shops", { method: "POST", body: JSON.stringify(dto) });
  },
  async update(id: string, dto: ShopUpdateDTO): Promise<void> {
    await apiFetch<void>(`/shops/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  },
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/shops/${id}`, { method: "DELETE" });
  },
};

export const shopsService = SERVICE_MODE === "api" ? api : local;