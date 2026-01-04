import { apiFetch } from "./http";

export type ExpenseCategory = {
    id: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
};

export const expenseCategoriesService = {
    list: () => apiFetch<ExpenseCategory[]>("/expense-categories"),

    create: (data: { id?: string; name: string }) =>
        apiFetch<ExpenseCategory>("/expense-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }),

    update: (id: string, data: { name?: string }) =>
        apiFetch<{ ok: true }>(`/expense-categories/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        apiFetch<{ ok: true }>(`/expense-categories/${id}`, {
            method: "DELETE",
        }),
};
