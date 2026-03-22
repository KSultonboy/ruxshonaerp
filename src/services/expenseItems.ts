import type { ExpenseItem } from "@/lib/types";
import { apiFetch } from "./http";

export type ExpenseItemCreateDTO = {
  name: string;
  categoryId: string;
  productId?: string;
  salePrice?: number;
  costPrice?: number;
};

export type ExpenseItemUpdateDTO = Partial<ExpenseItemCreateDTO>;

export const expenseItemsService = {
  async list(categoryId?: string) {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    return apiFetch<ExpenseItem[]>(`/expense-items${query}`);
  },
  async create(dto: ExpenseItemCreateDTO) {
    return apiFetch<ExpenseItem>("/expense-items", { method: "POST", body: JSON.stringify(dto) });
  },
  async update(id: string, dto: ExpenseItemUpdateDTO) {
    await apiFetch<void>(`/expense-items/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  },
  async remove(id: string) {
    await apiFetch<void>(`/expense-items/${id}`, { method: "DELETE" });
  },
};
