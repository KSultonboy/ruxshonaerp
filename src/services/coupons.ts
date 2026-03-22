import { Coupon } from "@/lib/types";
import { apiFetch } from "./http";

export const couponsService = {
    async findAll() {
        return apiFetch<Coupon[]>("/coupons");
    },
    async create(data: Partial<Coupon>) {
        return apiFetch<Coupon>("/coupons", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },
    async remove(id: string) {
        return apiFetch<{ ok: boolean }>(`/coupons/${id}`, {
            method: "DELETE",
        });
    }
};
