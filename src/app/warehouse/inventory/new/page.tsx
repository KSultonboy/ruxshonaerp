"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { productsService } from "@/services/products";
import { inventoryService } from "@/services/inventory";
import { branchesService } from "@/services/branches";
import type { Product, Branch } from "@/lib/types";
import { formatDigitsWithSpaces, onlyDigits } from "@/lib/mask";

interface ItemEntry {
    productId: string;
    name: string;
    systemQuantity: number;
    actualQuantity: string;
}

export default function NewInventoryPage() {
    const { t } = useI18n();
    const toast = useToast();
    const router = useRouter();

    const [products, setProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchId, setBranchId] = useState<string>("central");
    const [items, setItems] = useState<ItemEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        Promise.all([productsService.list(), branchesService.list()])
            .then(([p, b]) => {
                setProducts(p);
                setBranches(b);
                initItems(p, "central");
                setLoading(false);
            });
    }, []);

    function initItems(productList: Product[], bId: string) {
        const entries = productList.map(p => ({
            productId: p.id,
            name: p.name,
            systemQuantity: p.stock, // Central stock or branch stock needs logic here
            actualQuantity: String(p.stock)
        }));
        setItems(entries);
    }

    const handleApplyBranch = (val: string) => {
        setBranchId(val);
        // In a real app, we'd fetch current stock for this branch
        // For now, keep it simple
    };

    const handleQtyChange = (productId: string, val: string) => {
        setItems(prev => prev.map(item =>
            item.productId === productId ? { ...item, actualQuantity: onlyDigits(val) } : item
        ));
    };

    const onSubmit = async () => {
        setSubmitting(true);
        try {
            const dto = {
                date: new Date().toISOString().split('T')[0],
                branchId: branchId === "central" ? undefined : branchId,
                items: items.map(i => ({
                    productId: i.productId,
                    actualQuantity: Number(i.actualQuantity)
                }))
            };

            await inventoryService.create(dto);
            toast.success(t("Saqlandi"));
            router.push("/warehouse/inventory");
        } catch (e: any) {
            toast.error(t("Xatolik"), t("Saqlab bo'lmadi"));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-6">{t("Yuklanmoqda...")}</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-semibold text-cocoa-900">
                        {t("Yangi reviziya")}
                    </h1>
                    <p className="mt-1 text-sm text-cocoa-600">
                        {t("Haqiqiy qoldiqlarni kiriting")}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => router.back()}>{t("Bekor")}</Button>
                    <Button onClick={onSubmit} disabled={submitting}>
                        {submitting ? t("Saqlanmoqda...") : t("Saqlash")}
                    </Button>
                </div>
            </div>

            <Card>
                <div className="mb-6 w-full max-w-xs">
                    <Select
                        label={t("Filial")}
                        value={branchId}
                        onChange={(e) => handleApplyBranch(e.target.value)}
                        options={[
                            { value: "central", label: t("Markaziy ombor") },
                            ...branches.map(b => ({ value: b.id, label: b.name }))
                        ]}
                    />
                </div>

                <Table>
                    <T>
                        <thead>
                            <tr>
                                <th>{t("Mahsulot")}</th>
                                <th>{t("Tizimdagi qoldiq")}</th>
                                <th className="w-32">{t("Haqiqiy qoldiq")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.productId}>
                                    <td className="font-medium text-cocoa-900">{item.name}</td>
                                    <td className="text-cocoa-600">{formatDigitsWithSpaces(String(item.systemQuantity))}</td>
                                    <td>
                                        <Input
                                            value={formatDigitsWithSpaces(item.actualQuantity)}
                                            onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                                            className="text-right"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </T>
                </Table>
            </Card>
        </div>
    );
}
