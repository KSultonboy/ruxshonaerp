import type { AuditLog } from "@/lib/types";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

const local = {
  async list(_filters?: any) {
    return { items: [] as AuditLog[], total: 0 };
  },
  async remove(_id: string) {
    return {};
  },
  async update(_id: string, _data: any) {
    return {};
  },
};

const api = {
  async list(filters?: { from?: string; to?: string; entity?: string; userId?: string; action?: string; skip?: number; take?: number }) {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.entity) params.set("entity", filters.entity);
    if (filters?.userId) params.set("userId", filters.userId);
    if (filters?.action) params.set("action", filters.action);
    if (filters?.skip !== undefined) params.set("skip", String(filters.skip));
    if (filters?.take !== undefined) params.set("take", String(filters.take));

    const query = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<{ items: AuditLog[]; total: number }>(`/audit${query}`);
  },

  async remove(id: string) {
    return apiFetch(`/audit/${id}`, { method: "DELETE" });
  },

  async update(id: string, data: any) {
    return apiFetch(`/audit/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};

export const auditService = SERVICE_MODE === "api" ? api : local;
