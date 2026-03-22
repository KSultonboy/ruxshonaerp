"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Table, T } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/components/i18n/I18nProvider";
import { inventoryService, InventoryCheck } from "@/services/inventory";
import { useToast } from "@/components/ui/toast/ToastProvider";

export default function InventoryListPage() {
    const { t } = useI18n();
    const toast = useToast();
    const [checks, setChecks] = useState<InventoryCheck[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        try {
            const res = await inventoryService.list();
            setChecks(res);
        } catch (e: any) {
            toast.error(t("Xatolik"), t("Ma'lumotlarni yuklab bo'lmadi"));
        } finally {
            setLoading(false);
        }
    }

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

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-semibold text-cocoa-900">
                        {t("Inventarizatsiya")} (Reviziya)
                    </h1>
                    <p className="mt-1 text-sm text-cocoa-600">
                        {t("Omborxonadagi qoldiqlarni tekshirish va to'g'irlash")}
                    </p>
                </div>
                <Link href="/warehouse/inventory/new">
                    <Button>{t("+ Yangi reviziya")}</Button>
                </Link>
            </div>

            <Card>
                {loading ? (
                    <div className="py-4 text-cocoa-600">{t("Yuklanmoqda...")}</div>
                ) : checks.length === 0 ? (
                    <div className="py-4 text-cocoa-600">{t("Hozircha yo'q.")}</div>
                ) : (
                    <Table>
                        <T>
                            <thead>
                                <tr>
                                    <th>{t("Sana")}</th>
                                    <th>{t("Filial")}</th>
                                    <th>{t("Status")}</th>
                                    <th>{t("Xodim")}</th>
                                    <th>{t("Batafsil")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {checks.map((check) => (
                                    <tr key={check.id}>
                                        <td className="text-cocoa-900">{check.date}</td>
                                        <td className="text-cocoa-700">{check.branch?.name ?? t("Markaziy ombor")}</td>
                                        <td>{getStatusBadge(check.status)}</td>
                                        <td className="text-cocoa-600">{check.createdBy?.name}</td>
                                        <td>
                                            <Link href={`/warehouse/inventory/detail?id=${check.id}`}>
                                                <Button variant="ghost">
                                                    {t("Batafsil")}
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </T>
                    </Table>
                )}
            </Card>
        </div>
    );
}
