import { apiFetch } from "./http";
import { SERVICE_MODE } from "./config";

export type InventoryCheckStatus = 'PENDING' | 'COMPLETED' | 'CANCELED';

export interface InventoryCheckItem {
    id: string;
    productId: string;
    systemQuantity: number;
    actualQuantity: number;
    product?: {
        name: string;
        barcode: string;
        unit?: { short: string };
    };
}

export interface InventoryCheck {
    id: string;
    date: string;
    status: InventoryCheckStatus;
    note?: string;
    branchId?: string;
    branch?: { name: string };
    createdBy?: { name: string };
    items?: InventoryCheckItem[];
    createdAt: string;
}

export interface CreateInventoryCheckDTO {
    date: string;
    note?: string;
    branchId?: string;
    items: { productId: string; actualQuantity: number }[];
}

const local = {
    async list(): Promise<InventoryCheck[]> {
        return []; // Local rejimda hozircha bo'sh
    },
    async get(id: string): Promise<InventoryCheck> {
        throw new Error("Not implemented in local mode");
    },
    async create(dto: CreateInventoryCheckDTO): Promise<InventoryCheck> {
        throw new Error("Not implemented in local mode");
    },
    async finalize(id: string): Promise<InventoryCheck> {
        throw new Error("Not implemented in local mode");
    }
};

const api = {
    async list(): Promise<InventoryCheck[]> {
        return apiFetch<InventoryCheck[]>("/inventory");
    },

    async get(id: string): Promise<InventoryCheck> {
        return apiFetch<InventoryCheck>(`/inventory/${id}`);
    },

    async create(dto: CreateInventoryCheckDTO): Promise<InventoryCheck> {
        return apiFetch<InventoryCheck>("/inventory", {
            method: "POST",
            body: JSON.stringify(dto),
        });
    },

    async finalize(id: string): Promise<InventoryCheck> {
        return apiFetch<InventoryCheck>(`/inventory/${id}/finalize`, {
            method: "POST",
        });
    },

    async remove(id: string): Promise<void> {
        return apiFetch<void>(`/inventory/${id}`, {
            method: "DELETE",
        });
    },
};

export const inventoryService = SERVICE_MODE === "api" ? api : local;
