// src/services/branches.ts
import type { Branch, BranchWarehouseMode } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

export type BranchCreateDTO = {
  name: string;
  address?: string;
  phone?: string;
  warehouseMode?: BranchWarehouseMode;
};

type BranchUpdateDTO = Partial<BranchCreateDTO>;

const local = {
  async list(): Promise<Branch[]> {
    const branches = getJSON<Branch[]>(STORAGE_KEYS.branches, []);
    return branches.map((b) => ({ ...b, warehouseMode: b.warehouseMode ?? "SEPARATE" }));
  },

  async create(dto: BranchCreateDTO): Promise<Branch> {
    if (!dto.name?.trim()) throw new Error("Filial nomi kerak");
    const items = getJSON<Branch[]>(STORAGE_KEYS.branches, []);
    const now = new Date().toISOString();

    const branch: Branch = {
      id: safeId("branch"),
      name: dto.name.trim(),
      address: dto.address?.trim() || undefined,
      phone: dto.phone?.trim() || undefined,
      warehouseMode: dto.warehouseMode ?? "SEPARATE",
      createdAt: now,
      updatedAt: now,
    };

    setJSON(STORAGE_KEYS.branches, [branch, ...items]);
    return branch;
  },

  async update(id: string, dto: BranchUpdateDTO): Promise<void> {
    const items = getJSON<Branch[]>(STORAGE_KEYS.branches, []).map((b) =>
      b.id === id
        ? {
          ...b,
          ...dto,
          name: dto.name?.trim() ?? b.name,
          address: dto.address === undefined ? b.address : dto.address.trim() || undefined,
          phone: dto.phone === undefined ? b.phone : dto.phone.trim() || undefined,
          warehouseMode: dto.warehouseMode ?? b.warehouseMode ?? "SEPARATE",
          updatedAt: new Date().toISOString(),
        }
        : b
    );
    setJSON(STORAGE_KEYS.branches, items);
  },

  async remove(id: string): Promise<void> {
    const items = getJSON<Branch[]>(STORAGE_KEYS.branches, []).filter((b) => b.id !== id);
    setJSON(STORAGE_KEYS.branches, items);
  },
};

const api = {
  async list(): Promise<Branch[]> {
    return apiFetch<Branch[]>("/branches");
  },
  async create(dto: BranchCreateDTO): Promise<Branch> {
    return apiFetch<Branch>("/branches", { method: "POST", body: JSON.stringify(dto) });
  },
  async update(id: string, dto: BranchUpdateDTO): Promise<void> {
    await apiFetch<void>(`/branches/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  },
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/branches/${id}`, { method: "DELETE" });
  },
};

export const branchesService = SERVICE_MODE === "api" ? api : local;