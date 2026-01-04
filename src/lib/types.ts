export type ProductType = "PRODUCT" | "INGREDIENT" | "DECOR" | "UTILITY";

export type Category = {
    id: string;
    name: string;
};

export type Unit = {
    id: string;
    name: string;   // Kilogram, Dona...
    short: string;  // kg, dona...
};

export type Product = {
    id: string;
    name: string;
    type: ProductType;
    categoryId: string;
    unitId: string;
    price?: number;     // ixtiyoriy (hozircha)
    active: boolean;
    createdAt: string;  // ISO
    updatedAt: string;  // ISO
};

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

export type Expense = {
    id: string;
    date: string;       // YYYY-MM-DD
    categoryId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    note?: string;
    createdAt: string;
    updatedAt: string;
};
