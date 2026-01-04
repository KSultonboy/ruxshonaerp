import type { Product } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";
import type { IProductsService, ProductCreateDTO, ProductUpdateDTO } from "./contracts";

const local: IProductsService = {
    async list() {
        return getJSON<Product[]>(STORAGE_KEYS.products, []);
    },

    async create(input: ProductCreateDTO) {
        const items = getJSON<Product[]>(STORAGE_KEYS.products, []);
        const now = new Date().toISOString();

        const p: Product = {
            ...input,
            id: input.id ?? safeId("p"),
            createdAt: now,
            updatedAt: now,
        };

        // ✅ upsert (restore uchun): shu id bo‘lsa oldingisini olib tashlaymiz
        const next = [p, ...items.filter((x) => x.id !== p.id)];
        setJSON(STORAGE_KEYS.products, next);
        return p;
    },

    async update(id: string, patch: ProductUpdateDTO) {
        const items = getJSON<Product[]>(STORAGE_KEYS.products, []).map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
        );
        setJSON(STORAGE_KEYS.products, items);
    },

    async remove(id: string) {
        const items = getJSON<Product[]>(STORAGE_KEYS.products, []).filter((p) => p.id !== id);
        setJSON(STORAGE_KEYS.products, items);
    },
};

// API skeleton
const api: IProductsService = {
    async list() {
        return apiFetch<Product[]>("/products");
    },

    async create(dto) {
        // ✅ id backendga yuborilmasin
        const { id, ...safe } = dto as any;
        return apiFetch<Product>("/products", { method: "POST", body: JSON.stringify(safe) });
    },

    async update(id, dto) {
        await apiFetch<void>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
    },

    async remove(id) {
        await apiFetch<void>(`/products/${id}`, { method: "DELETE" });
    },
};

export const productsService: IProductsService = SERVICE_MODE === "api" ? api : local;
