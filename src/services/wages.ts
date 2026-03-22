import { apiFetch } from "./http";

export type WageReportItem = {
    id: string;
    date: string;
    productName: string;
    quantity: number;
    unit: string;
    rate: number;
    total: number;
};

export type WageReportUser = {
    user: { id: string; name: string };
    earned: number;
    paid: number;
    balance: number;
    items: WageReportItem[];
};

export const wagesService = {
    async getReport(from?: string, to?: string) {
        let qs = "";
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (params.size > 0) qs = `?${params.toString()}`;

        return apiFetch<WageReportUser[]>(`/wages/report${qs}`);
    },

    async createPayment(data: { userId: string; amount: number; paymentMethod: string; note?: string }) {
        return apiFetch("/wages/payments", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },
};
