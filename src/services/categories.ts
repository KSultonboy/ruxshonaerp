import type { Category, ExpenseCategory } from "@/lib/types";
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
        return apiFetch<Category[]>("/product-categories");
    },
    async create(name: string) {
        return apiFetch<Category>("/product-categories", { method: "POST", body: JSON.stringify({ name }) });
    },
    async update(id: string, name: string) {
        await apiFetch<void>(`/product-categories/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    },
    async remove(id: string) {
        await apiFetch<void>(`/product-categories/${id}`, { method: "DELETE" });
    },
};

export const categoriesService: ICategoriesService =
    SERVICE_MODE === "api" ? apiCategories : localCategories;

export type ExpenseCategoryCreateDTO = {
    name: string;
    type?: ExpenseCategory["type"];
    productCategoryId?: string | null;
};

export type ExpenseCategoryUpdateDTO = Partial<ExpenseCategoryCreateDTO>;

// Expense categories (alohida)
const localExpenseCategories = {
    async list() {
        return getJSON<ExpenseCategory[]>(STORAGE_KEYS.expenseCategories, []);
    },
    async create(dto: ExpenseCategoryCreateDTO) {
        const items = getJSON<ExpenseCategory[]>(STORAGE_KEYS.expenseCategories, []);
        const cat: ExpenseCategory = {
            id: safeId("expcat"),
            name: dto.name.trim(),
            type: dto.type ?? "NORMAL",
            productCategoryId: dto.productCategoryId ?? null,
        };
        setJSON(STORAGE_KEYS.expenseCategories, [cat, ...items]);
        return cat;
    },
    async update(id: string, dto: ExpenseCategoryUpdateDTO) {
        const items = getJSON<ExpenseCategory[]>(STORAGE_KEYS.expenseCategories, []).map((c) =>
            c.id === id
                ? {
                      ...c,
                      name: dto.name ? dto.name.trim() : c.name,
                      type: dto.type ?? c.type,
                      productCategoryId:
                          dto.productCategoryId === undefined ? c.productCategoryId : dto.productCategoryId,
                  }
                : c
        );
        setJSON(STORAGE_KEYS.expenseCategories, items);
    },
    async remove(id: string) {
        const items = getJSON<ExpenseCategory[]>(STORAGE_KEYS.expenseCategories, []).filter((c) => c.id !== id);
        setJSON(STORAGE_KEYS.expenseCategories, items);
    },
};

const apiExpenseCategories = {
    async list() {
        return apiFetch<ExpenseCategory[]>("/expense-categories");
    },
    async create(dto: ExpenseCategoryCreateDTO) {
        return apiFetch<ExpenseCategory>("/expense-categories", { method: "POST", body: JSON.stringify(dto) });
    },
    async update(id: string, dto: ExpenseCategoryUpdateDTO) {
        await apiFetch<void>(`/expense-categories/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
    },
    async remove(id: string) {
        await apiFetch<void>(`/expense-categories/${id}`, { method: "DELETE" });
    },
};

export const expenseCategoriesService = SERVICE_MODE === "api" ? apiExpenseCategories : localExpenseCategories;
