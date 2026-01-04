import type { Category, Unit, Product, Expense } from "@/lib/types";
import type { ProductType, PaymentMethod } from "@/lib/types";

// --- DTOs ---
export type ProductCreateDTO = {
    id?: string; // ✅ restore uchun
    name: string;
    type: ProductType;
    categoryId: string;
    unitId: string;
    price?: number;
    active: boolean;
};

export type ProductUpdateDTO = Partial<ProductCreateDTO>;

export type ExpenseCreateDTO = {
    id?: string; // ✅ restore uchun
    date: string; // YYYY-MM-DD
    categoryId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    note?: string;
};

export type ExpenseUpdateDTO = Partial<ExpenseCreateDTO>;

export type CategoryCreateDTO = { name: string };
export type UnitCreateDTO = { name: string; short: string };

// --- Service interfaces (UI shular bilan ishlaydi) ---
export interface IProductsService {
    list(): Promise<Product[]>;
    create(dto: ProductCreateDTO): Promise<Product>;
    update(id: string, dto: ProductUpdateDTO): Promise<void>;
    remove(id: string): Promise<void>;
}

export interface IExpensesService {
    list(): Promise<Expense[]>;
    create(dto: ExpenseCreateDTO): Promise<Expense>;
    update(id: string, dto: ExpenseUpdateDTO): Promise<void>;
    remove(id: string): Promise<void>;
}

export interface ICategoriesService {
    list(): Promise<Category[]>;
    create(name: string): Promise<Category>;
    update(id: string, name: string): Promise<void>;
    remove(id: string): Promise<void>;
}

export interface IUnitsService {
    list(): Promise<Unit[]>;
    create(name: string, short: string): Promise<Unit>;
    update(id: string, patch: { name: string; short: string }): Promise<void>;
    remove(id: string): Promise<void>;
}
