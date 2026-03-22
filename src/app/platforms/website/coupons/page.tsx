"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { couponsService } from "@/services/coupons";
import { Coupon } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export default function CouponsPage() {
    const { t } = useI18n();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
        code: "",
        discount: 10000,
        minOrder: 50000,
        maxUses: 100
    });

    const load = () => {
        setLoading(true);
        couponsService.findAll()
            .then(setCoupons)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await couponsService.create(newCoupon);
        setShowNew(false);
        load();
    };

    const handleDelete = async (id: string) => {
        if (confirm(t("Haqiqatan ham bu kuponni o'chirmoqchimisiz?"))) {
            await couponsService.remove(id);
            load();
        }
    };

    return (
        <div className="p-6 max-w-6xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold">{t("Kuponlar boshqaruvi")}</h1>
                    <p className="text-cocoa-600">{t("Promokodlar va chegirmalar tizimi")}</p>
                </div>
                <button
                    onClick={() => setShowNew(true)}
                    className="bg-berry-600 text-white px-6 py-2 rounded-2xl font-bold hover:bg-berry-700 transition shadow-glow"
                >
                    + {t("Yangi kupon")}
                </button>
            </div>

            {showNew && (
                <div className="fixed inset-0 bg-cocoa-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreate} className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">{t("Yangi kupon kiritish")}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">{t("Kod")}</label>
                                <input
                                    className="w-full p-3 bg-cream-50 border border-cream-200 rounded-xl uppercase"
                                    value={newCoupon.code}
                                    onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })}
                                    placeholder="MASALAN: SPRING2024"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">{t("Chegirma summasi")}</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 bg-cream-50 border border-cream-200 rounded-xl"
                                        value={newCoupon.discount}
                                        onChange={e => setNewCoupon({ ...newCoupon, discount: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">{t("Min. buyurtma")}</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 bg-cream-50 border border-cream-200 rounded-xl"
                                        value={newCoupon.minOrder}
                                        onChange={e => setNewCoupon({ ...newCoupon, minOrder: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">{t("Foydalanish limiti")}</label>
                                <input
                                    type="number"
                                    className="w-full p-3 bg-cream-50 border border-cream-200 rounded-xl"
                                    value={newCoupon.maxUses}
                                    onChange={e => setNewCoupon({ ...newCoupon, maxUses: Number(e.target.value) })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex gap-4 mt-8">
                            <button
                                type="button"
                                onClick={() => setShowNew(false)}
                                className="flex-1 py-3 border border-cream-300 rounded-xl font-bold"
                            >
                                {t("Bekor qilish")}
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-3 bg-berry-600 text-white rounded-xl font-bold"
                            >
                                {t("Saqlash")}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-cocoa-400">{t("Yuklanmoqda...")}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {coupons.map(coupon => (
                        <div key={coupon.id} className="bg-white p-6 rounded-3xl border border-cream-200 shadow-sm relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-black font-mono text-berry-700">{coupon.code}</h3>
                                    <p className="text-2xl font-bold text-cocoa-800">
                                        -{formatCurrency(coupon.discount)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDelete(coupon.id)}
                                    className="text-berry-200 hover:text-berry-600 transition"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                            </div>

                            <div className="space-y-2 mb-6 text-sm text-cocoa-600">
                                <div className="flex justify-between border-b border-cream-100 pb-1">
                                    <span>{t("Minimal buyurtma:")}</span>
                                    <span className="font-bold">{formatCurrency(coupon.minOrder)}</span>
                                </div>
                                <div className="flex justify-between border-b border-cream-100 pb-1">
                                    <span>{t("Limit:")}</span>
                                    <span className="font-bold">{coupon.usedCount} / {coupon.maxUses}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{t("Status:")}</span>
                                    <span className={coupon.active ? "text-green-600 font-bold" : "text-berry-400"}>
                                        {coupon.active ? t("Faol") : t("Nofaol")}
                                    </span>
                                </div>
                            </div>

                            <div className="absolute top-0 right-0 w-24 h-24 bg-berry-50 rounded-bl-full -mr-12 -mt-12 group-hover:bg-berry-100 transition-colors -z-10" />
                        </div>
                    ))}
                    {coupons.length === 0 && (
                        <div className="col-span-full py-24 text-center bg-cream-50 rounded-3xl border border-dashed border-cream-300">
                            <p className="text-cocoa-400">{t("Hali kuponlar yaratilmagan.")}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
