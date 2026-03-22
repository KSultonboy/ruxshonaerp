import { setJSON, getJSON, safeId } from "./storage";
import type { Branch, Category, Unit, Product, Expense, User, Shop } from "./types";

const KEYS = {
    seeded: "rx_seeded",
    categories: "rx_categories",
    units: "rx_units",
    products: "rx_products",
    expenseCategories: "rx_expense_categories",
    expenses: "rx_expenses",
    users: "rx_users",
    stockMovements: "rx_stock_movements",
    branches: "rx_branches",
    shops: "rx_shops",
    transfers: "rx_transfers",
    returns: "rx_returns",
    branchStocks: "rx_branch_stocks",
    sales: "rx_sales",
    shift: "rx_shift",
    orders: "rx_orders",
    cashEntries: "rx_cash_entries",
    platforms: "rx_platforms",
    receiptTemplate: "rx_receipt_template",
};

export function ensureSeed() {
    const seeded = getJSON<boolean>(KEYS.seeded, false);
    if (seeded) return;

    // Categories
    const categories = getJSON<Category[]>(KEYS.categories, []);
    if (categories.length === 0) {
        setJSON(KEYS.categories, [
            { id: safeId("cat"), name: "Tortlar" },
            { id: safeId("cat"), name: "Ingredientlar" },
            { id: safeId("cat"), name: "Dekor" },
            { id: safeId("cat"), name: "Xo'jalik" },
        ]);
    }

    // Units
    const units = getJSON<Unit[]>(KEYS.units, []);
    if (units.length === 0) {
        setJSON(KEYS.units, [
            { id: safeId("u"), name: "Kilogram", short: "kg" },
            { id: safeId("u"), name: "Dona", short: "dona" },
            { id: safeId("u"), name: "Litr", short: "l" },
        ]);
    }

    // Expense categories
    const expCats = getJSON<Category[]>(KEYS.expenseCategories, []);
    if (expCats.length === 0) {
        setJSON(KEYS.expenseCategories, [
            { id: safeId("expcat"), name: "Xomashyo" },
            { id: safeId("expcat"), name: "Ish haqi" },
            { id: safeId("expcat"), name: "Transport" },
            { id: safeId("expcat"), name: "Kommunal" },
            { id: safeId("expcat"), name: "Boshqa" },
        ]);
    }

    // Products (demo)
    const products = getJSON<Product[]>(KEYS.products, []);
    if (products.length === 0) {
        const cats = getJSON<Category[]>(KEYS.categories, []);
        const us = getJSON<Unit[]>(KEYS.units, []);
        const now = new Date().toISOString();

        const tortCat = cats.find((c) => c.name === "Tortlar")?.id ?? cats[0]?.id ?? safeId("cat");
        const kg = us.find((u) => u.short === "kg")?.id ?? us[0]?.id ?? safeId("u");
        const dona = us.find((u) => u.short === "dona")?.id ?? us[0]?.id ?? safeId("u");

        setJSON(KEYS.products, [
            {
                id: safeId("p"),
                name: "Napoleon tort",
                type: "PRODUCT",
                categoryId: tortCat,
                unitId: dona,
                salePrice: 180000,
                shopPrice: 160000,
                active: true,
                images: [],
                stock: 12,
                minStock: 2,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: safeId("p"),
                name: "Smetana (kg)",
                type: "INGREDIENT",
                categoryId: tortCat,
                unitId: kg,
                price: 68000,
                active: true,
                images: [],
                stock: 6,
                minStock: 3,
                createdAt: now,
                updatedAt: now,
            },
        ]);
    }

    // Expenses (demo)
    const expenses = getJSON<Expense[]>(KEYS.expenses, []);
    if (expenses.length === 0) {
        const expCats2 = getJSON<Category[]>(KEYS.expenseCategories, []);
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const nowIso = now.toISOString();
        setJSON(KEYS.expenses, [
            {
                id: safeId("e"),
                date: today,
                categoryId: expCats2[0]?.id ?? safeId("expcat"),
                amount: 250000,
                paymentMethod: "CASH",
                note: "Xomashyo xaridi (demo)",
                createdAt: nowIso,
                updatedAt: nowIso,
            },
        ]);
    }

    // Users (demo)
    const users = getJSON<User[]>(KEYS.users, []);
    if (users.length === 0) {
        const nowIso = new Date().toISOString();
        setJSON(KEYS.users, [
            {
                id: safeId("u"),
                name: "Admin",
                username: "admin",
                role: "ADMIN",
                active: true,
                createdAt: nowIso,
                updatedAt: nowIso,
            },
        ]);
    }

    // Branches (demo)
    const branches = getJSON<Branch[]>(KEYS.branches, []);
    if (branches.length === 0) {
        const nowIso = new Date().toISOString();
        setJSON(KEYS.branches, [
            {
                id: safeId("branch"),
                name: "Markaziy filial",
                address: "Chilonzor",
                phone: "+998 90 123 45 67",
                warehouseMode: "CENTRAL",
                createdAt: nowIso,
                updatedAt: nowIso,
            },
        ]);
    }

    // Shops (demo)
    const shops = getJSON<Shop[]>(KEYS.shops, []);
    if (shops.length === 0) {
        const nowIso = new Date().toISOString();
        setJSON(KEYS.shops, [
            {
                id: safeId("shop"),
                name: "Markaziy do'kon",
                address: "Chilonzor",
                phone: "+998 90 555 11 22",
                createdAt: nowIso,
                updatedAt: nowIso,
            },
        ]);
    }

    setJSON(KEYS.seeded, true);
}

export const STORAGE_KEYS = KEYS;
