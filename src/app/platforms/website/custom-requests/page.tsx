"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/services/http";

type CustomRequest = {
    id: string;
    description: string;
    desiredDate: string;
    status: "PENDING" | "QUOTED" | "ACCEPTED" | "REJECTED" | "CANCELED";
    priceQuote?: number;
    adminNote?: string;
    customer: {
        name: string;
        phone: string;
    };
    createdAt: string;
};

export default function WebsiteCustomRequestsPage() {
    const { t } = useI18n();
    const { user } = useAuth();
    const [requests, setRequests] = useState<CustomRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [price, setPrice] = useState("");
    const [note, setNote] = useState("");

    async function fetchRequests() {
        setLoading(true);
        try {
            const data = await apiFetch<CustomRequest[]>("/custom-requests");
            setRequests(data);
        } catch (e) {
            console.error("Fetch requests error:", e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (user) void fetchRequests();
    }, [user?.id]);

    async function handleUpdate(id: string, status: CustomRequest["status"]) {
        try {
            await apiFetch(`/custom-requests/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                    status,
                    priceQuote: price ? parseInt(price, 10) : undefined,
                    adminNote: note
                }),
            });
            setEditingId(null);
            setPrice("");
            setNote("");
            await fetchRequests();
        } catch (e) {
            console.error("Update status error:", e);
        }
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{t("Maxsus buyurtma so'rovlari")}</h1>
                    <p className="text-cocoa-600">{t("Mijozlar tomonidan yuborilgan eksklyuziv so'rovlar")}</p>
                </div>
                <button onClick={fetchRequests} className="btn-secondary">{t("Yangilash")}</button>
            </div>

            {loading ? (
                <div className="py-20 text-center text-cocoa-400">{t("Yuklanmoqda...")}</div>
            ) : requests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-cocoa-400">
                    {t("Hozircha so'rovlar yo'q")}
                </div>
            ) : (
                <div className="grid gap-4">
                    {requests.map((req) => (
                        <div key={req.id} className="bg-white rounded-2xl border border-cream-200 p-6 shadow-sm hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-cocoa-800">{req.customer.name}</h3>
                                    <p className="text-sm text-cocoa-500">{req.customer.phone}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                        req.status === 'QUOTED' ? 'bg-blue-100 text-blue-700' :
                                            req.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-700'
                                    }`}>
                                    {req.status}
                                </div>
                            </div>

                            <div className="mb-4">
                                <p className="text-cocoa-700 whitespace-pre-wrap">{req.description}</p>
                            </div>

                            <div className="flex gap-6 text-sm text-cocoa-500 mb-6 border-t border-cream-100 pt-4">
                                <div><strong>{t("Sana")}:</strong> {req.desiredDate}</div>
                                <div><strong>{t("Yuborilgan")}:</strong> {new Date(req.createdAt).toLocaleDateString()}</div>
                                {req.priceQuote && <div className="text-berry-700 font-bold"><strong>{t("Taklif")}:</strong> {req.priceQuote.toLocaleString()} so'm</div>}
                            </div>

                            {editingId === req.id ? (
                                <div className="bg-cream-50 p-4 rounded-xl grid gap-4">
                                    <div className="flex gap-4">
                                        <input
                                            type="number"
                                            placeholder="Narx taklifi (so'm)"
                                            className="form-input flex-1"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Izoh (admin uchun)"
                                            className="form-input flex-2"
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setEditingId(null)} className="btn-ghost">{t("Bekor qilish")}</button>
                                        <button onClick={() => handleUpdate(req.id, 'QUOTED')} className="btn-primary">{t("Narxni yuborish")}</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => { setEditingId(req.id); setPrice(req.priceQuote?.toString() || ""); setNote(req.adminNote || ""); }} className="btn-secondary">
                                        {req.status === 'PENDING' ? t("Ko'rib chiqish") : t("Tahrirlash")}
                                    </button>
                                    {req.status === 'PENDING' && (
                                        <button onClick={() => handleUpdate(req.id, 'REJECTED')} className="btn-ghost text-red-600 border-red-100 hover:bg-red-50">
                                            {t("Rad etish")}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
