import type { Expense } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";
import type { IExpensesService, ExpenseCreateDTO, ExpenseUpdateDTO } from "./contracts";

const local: IExpensesService = {
    async list() {
        return getJSON<Expense[]>(STORAGE_KEYS.expenses, []);
    },

    async create(input: ExpenseCreateDTO) {
        const items = getJSON<Expense[]>(STORAGE_KEYS.expenses, []);
        const now = new Date().toISOString();

        const e: Expense = {
            ...input,
            id: input.id ?? safeId("e"),
            createdAt: now,
            updatedAt: now,
        };

        // ✅ upsert (restore uchun)
        const next = [e, ...items.filter((x) => x.id !== e.id)];
        setJSON(STORAGE_KEYS.expenses, next);
        return e;
    },

    async update(id: string, patch: ExpenseUpdateDTO) {
        const items = getJSON<Expense[]>(STORAGE_KEYS.expenses, []).map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
        );
        setJSON(STORAGE_KEYS.expenses, items);
    },

    async remove(id: string) {
        const items = getJSON<Expense[]>(STORAGE_KEYS.expenses, []).filter((e) => e.id !== id);
        setJSON(STORAGE_KEYS.expenses, items);
    },
};

const api: IExpensesService = {
    async list() {
        return apiFetch<Expense[]>("/expenses");
    },

    async create(dto) {
        const { id, ...safe } = dto as any; // ✅ id backendga yuborilmasin
        return apiFetch<Expense>("/expenses", { method: "POST", body: JSON.stringify(safe) });
    },

    async update(id, dto) {
        await apiFetch<void>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
    },

    async remove(id) {
        await apiFetch<void>(`/expenses/${id}`, { method: "DELETE" });
    },
};

export const expensesService: IExpensesService = SERVICE_MODE === "api" ? api : local;
