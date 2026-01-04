import type { Category } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";
import type { ICategoriesService } from "./contracts";

// Product categories
const localCategories: ICategoriesService = {
    async list() {
        return getJSON<Category[]>(STORAGE_KEYS.categories, []);
    },
    async create(name: string) {
        const items = getJSON<Category[]>(STORAGE_KEYS.categories, []);
        const cat: Category = { id: safeId("cat"), name: name.trim() };
        setJSON(STORAGE_KEYS.categories, [cat, ...items]);
        return cat;
    },
    async update(id: string, name: string) {
        const items = getJSON<Category[]>(STORAGE_KEYS.categories, []).map((c) =>
            c.id === id ? { ...c, name: name.trim() } : c
        );
        setJSON(STORAGE_KEYS.categories, items);
    },
    async remove(id: string) {
        const items = getJSON<Category[]>(STORAGE_KEYS.categories, []).filter((c) => c.id !== id);
        setJSON(STORAGE_KEYS.categories, items);
    },
};

const apiCategories: ICategoriesService = {
    async list() {
        return apiFetch<Category[]>("/categories");
    },
    async create(name: string) {
        return apiFetch<Category>("/categories", { method: "POST", body: JSON.stringify({ name }) });
    },
    async update(id: string, name: string) {
        await apiFetch<void>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    },
    async remove(id: string) {
        await apiFetch<void>(`/categories/${id}`, { method: "DELETE" });
    },
};

export const categoriesService: ICategoriesService =
    SERVICE_MODE === "api" ? apiCategories : localCategories;

// Expense categories (alohida)
const localExpenseCategories: ICategoriesService = {
    async list() {
        return getJSON<Category[]>(STORAGE_KEYS.expenseCategories, []);
    },
    async create(name: string) {
        const items = getJSON<Category[]>(STORAGE_KEYS.expenseCategories, []);
        const cat: Category = { id: safeId("expcat"), name: name.trim() };
        setJSON(STORAGE_KEYS.expenseCategories, [cat, ...items]);
        return cat;
    },
    async update(id: string, name: string) {
        const items = getJSON<Category[]>(STORAGE_KEYS.expenseCategories, []).map((c) =>
            c.id === id ? { ...c, name: name.trim() } : c
        );
        setJSON(STORAGE_KEYS.expenseCategories, items);
    },
    async remove(id: string) {
        const items = getJSON<Category[]>(STORAGE_KEYS.expenseCategories, []).filter((c) => c.id !== id);
        setJSON(STORAGE_KEYS.expenseCategories, items);
    },
};

const apiExpenseCategories: ICategoriesService = {
    async list() {
        return apiFetch<Category[]>("/expense-categories");
    },
    async create(name: string) {
        return apiFetch<Category>("/expense-categories", { method: "POST", body: JSON.stringify({ name }) });
    },
    async update(id: string, name: string) {
        await apiFetch<void>(`/expense-categories/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    },
    async remove(id: string) {
        await apiFetch<void>(`/expense-categories/${id}`, { method: "DELETE" });
    },
};

export const expenseCategoriesService: ICategoriesService =
    SERVICE_MODE === "api" ? apiExpenseCategories : localExpenseCategories;
