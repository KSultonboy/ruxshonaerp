"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Table, T } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { inventoryService, InventoryCheck } from "@/services/inventory";
import { formatDigitsWithSpaces } from "@/lib/mask";

function InventoryDetailContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");
    const { t } = useI18n();
    const toast = useToast();
    const router = useRouter();
    const [check, setCheck] = useState<InventoryCheck | null>(null);
    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);

    useEffect(() => {
        if (id) load();
    }, [id]);

    async function load() {
        if (!id) return;
        try {
            const res = await inventoryService.get(id);
            setCheck(res);
        } catch (e) {
            toast.error(t("Xatolik"), t("Ma'lumotlarni yuklab bo'lmadi"));
        } finally {
            setLoading(false);
        }
    }

    const onFinalize = async () => {
        if (!id) return;
        if (!confirm(t("Tasdiqlash? Ombor qoldiqlari o'zgaradi."))) return;
        setFinalizing(true);
        try {
            await inventoryService.finalize(id);
            toast.success(t("Saqlandi"));
            load();
        } catch (e) {
            toast.error(t("Xatolik"), t("Saqlab bo'lmadi"));
        } finally {
            setFinalizing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return <Badge tone="primary">{t("Saqlandi")}</Badge>;
            case "PENDING":
                return <Badge tone="neutral">{t("Ochiq")}</Badge>;
            default:
                return <Badge tone="neutral">{status}</Badge>;
        }
    };

    if (loading) return <div className="p-6">{t("Yuklanmoqda...")}</div>;
    if (!check) return <div className="p-6">{t("Topilmadi")}</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-semibold text-cocoa-900">
                        {t("Reviziya")} #{check.id.slice(-6)}
                    </h1>
                    <p className="mt-1 text-sm text-cocoa-600">
                        {check.date} | {check.branch?.name ?? t("Markaziy ombor")}
                    </p>
                </div>
                <div className="flex gap-2">
                    {check.status === 'PENDING' && (
                        <Button onClick={onFinalize} disabled={finalizing}>
                            {finalizing ? t("Saqlanmoqda...") : t("Tasdiqlash")}
                        </Button>
                    )}
                    <Button variant="ghost" onClick={() => router.back()}>{t("Orqaga")}</Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <div className="text-xs text-cocoa-500 mb-1">{t("Status")}</div>
                    {getStatusBadge(check.status)}
                </Card>
                <Card>
                    <div className="text-xs text-cocoa-500 mb-1">{t("Xodim")}</div>
                    <div className="font-semibold text-cocoa-900">{check.createdBy?.name}</div>
                </Card>
                <Card>
                    <div className="text-xs text-cocoa-500 mb-1">{t("Sana")}</div>
                    <div className="font-semibold text-cocoa-900">{check.date}</div>
                </Card>
            </div>

            <Card>
                <Table>
                    <T>
                        <thead>
                            <tr>
                                <th>{t("Mahsulot")}</th>
                                <th>{t("Tizimdagi qoldiq")}</th>
                                <th>{t("Haqiqiy qoldiq")}</th>
                                <th>{t("Farq")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {check.items?.map((item) => {
                                const diff = item.actualQuantity - item.systemQuantity;
                                return (
                                    <tr key={item.id}>
                                        <td className="font-medium text-cocoa-900">{item.product?.name}</td>
                                        <td className="text-cocoa-600">{formatDigitsWithSpaces(String(item.systemQuantity))}</td>
                                        <td className="text-cocoa-900 font-semibold">{formatDigitsWithSpaces(String(item.actualQuantity))}</td>
                                        <td>
                                            {diff === 0 ? (
                                                <span className="text-cocoa-400">0</span>
                                            ) : (
                                                <span className={diff > 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                                    {diff > 0 ? `+${diff}` : diff}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </T>
                </Table>
            </Card>
        </div>
    );
}

export default function InventoryDetailPage() {
    return (
        <Suspense fallback={<div className="p-6">Yuklanmoqda...</div>}>
            <InventoryDetailContent />
        </Suspense>
    );
}
