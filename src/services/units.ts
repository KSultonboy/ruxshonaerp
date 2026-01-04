import type { Unit } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";
import type { IUnitsService } from "./contracts";

const local: IUnitsService = {
    async list() {
        return getJSON<Unit[]>(STORAGE_KEYS.units, []);
    },
    async create(name: string, short: string) {
        const items = getJSON<Unit[]>(STORAGE_KEYS.units, []);
        const unit: Unit = { id: safeId("u"), name: name.trim(), short: short.trim() };
        setJSON(STORAGE_KEYS.units, [unit, ...items]);
        return unit;
    },
    async update(id: string, patch: { name: string; short: string }) {
        const items = getJSON<Unit[]>(STORAGE_KEYS.units, []).map((u) =>
            u.id === id ? { ...u, ...patch } : u
        );
        setJSON(STORAGE_KEYS.units, items);
    },
    async remove(id: string) {
        const items = getJSON<Unit[]>(STORAGE_KEYS.units, []).filter((u) => u.id !== id);
        setJSON(STORAGE_KEYS.units, items);
    },
};

const api: IUnitsService = {
    async list() {
        return apiFetch<Unit[]>("/units");
    },
    async create(name: string, short: string) {
        return apiFetch<Unit>("/units", { method: "POST", body: JSON.stringify({ name, short }) });
    },
    async update(id: string, patch) {
        await apiFetch<void>(`/units/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    },
    async remove(id: string) {
        await apiFetch<void>(`/units/${id}`, { method: "DELETE" });
    },
};

export const unitsService: IUnitsService = SERVICE_MODE === "api" ? api : local;
