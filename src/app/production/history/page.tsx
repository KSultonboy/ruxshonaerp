"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { expenseItemsService } from "@/services/expenseItems";
import { productsService } from "@/services/products";
import { warehouseService } from "@/services/warehouse";
import type { Product, StockMovement } from "@/lib/types";
import { formatDigitsWithSpaces } from "@/lib/mask";

type EditFormState = {
    date: string;
    productId: string;
    quantity: string;
    note: string;
};

function sanitizeDecimalInput(value: string) {
    let normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const dotIndex = normalized.indexOf(".");
    if (dotIndex >= 0) {
        normalized = normalized.slice(0, dotIndex + 1) + normalized.slice(dotIndex + 1).replace(/\./g, "");
        const [intPart, decimalPart = ""] = normalized.split(".");
        normalized = `${intPart}.${decimalPart.slice(0, 3)}`;
    }
    return normalized;
}

function parseDecimalQuantity(value: string) {
    return Number.parseFloat(String(value || "").replace(",", "."));
}

function excludeExpenseLinkedProducts(products: Product[], expenseItems: { productId?: string | null }[]) {
    const blockedProductIds = new Set(
        expenseItems.map((item) => item.productId).filter((productId): productId is string => Boolean(productId))
    );
    return products.filter((product) => !blockedProductIds.has(product.id));
}

export default function ProductionHistoryPage() {
    const { t } = useI18n();
    const { user } = useAuth();
    const toast = useToast();
    const userId = user?.id;
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingMovement, setEditingMovement] = useState<StockMovement | null>(null);
    const [editForm, setEditForm] = useState<EditFormState>({
        date: "",
        productId: "",
        quantity: "",
        note: "",
    });
    const [saveBusy, setSaveBusy] = useState(false);
    const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

    const loadHistory = useCallback(async (keepVisible = false) => {
        if (keepVisible) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setLoadError(null);

        try {
            const response = await warehouseService.movements(100);
            const hasCreatorInfo = response.some((item) => typeof item.createdById === "string");
            const nextMovements =
                hasCreatorInfo && userId
                    ? response.filter((item) => item.createdById === userId)
                    : response;

            setMovements(nextMovements);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t("Tarixni yuklab bo'lmadi");
            setLoadError(message);
            toast.error(t("Xatolik"), message);
        } finally {
            if (keepVisible) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, [t, toast, userId]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        let cancelled = false;

        const loadProducts = async () => {
            try {
                const [nextProducts, expenseItems] = await Promise.all([
                    productsService.list(),
                    expenseItemsService.list(),
                ]);

                if (!cancelled) {
                    setProducts(excludeExpenseLinkedProducts(nextProducts, expenseItems));
                }
            } catch {
                if (!cancelled) {
                    setProducts([]);
                }
            }
        };

        void loadProducts();
        return () => {
            cancelled = true;
        };
    }, []);

    const productOptions = useMemo(() => {
        const options = products.map((product) => ({
            value: product.id,
            label: product.name,
        }));

        if (
            editingMovement &&
            !options.some((option) => option.value === editingMovement.productId)
        ) {
            options.unshift({
                value: editingMovement.productId,
                label: editingMovement.product?.name ?? t("Mahsulot"),
            });
        }

        return options;
    }, [editingMovement, products, t]);

    function openEditor(movement: StockMovement) {
        setEditingMovement(movement);
        setEditForm({
            date: movement.date,
            productId: movement.productId,
            quantity: String(movement.quantity),
            note: movement.note ?? "",
        });
        setEditorOpen(true);
    }

    function closeEditor() {
        setEditorOpen(false);
        setEditingMovement(null);
        setEditForm({
            date: "",
            productId: "",
            quantity: "",
            note: "",
        });
    }

    async function handleSaveEdit() {
        if (!editingMovement) return;

        const nextQuantity = parseDecimalQuantity(editForm.quantity);
        if (!editForm.productId) {
            toast.error(t("Xatolik"), t("Mahsulot tanlang"));
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(editForm.date)) {
            toast.error(t("Xatolik"), t("Sanani to'g'ri kiriting"));
            return;
        }
        if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
            toast.error(t("Xatolik"), t("Miqdor 0 dan katta bo'lsin"));
            return;
        }

        setSaveBusy(true);
        try {
            await warehouseService.updateMovement(editingMovement.id, {
                date: editForm.date,
                productId: editForm.productId,
                quantity: nextQuantity,
                note: editForm.note.trim() || undefined,
            });
            toast.success(t("Saqlandi"));
            closeEditor();
            await loadHistory(true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t("Saqlab bo'lmadi");
            toast.error(t("Xatolik"), message);
        } finally {
            setSaveBusy(false);
        }
    }

    async function handleDelete(movement: StockMovement) {
        const confirmed = window.confirm(t("Bu yozuvni o'chirmoqchimisiz?"));
        if (!confirmed) return;

        setDeleteBusyId(movement.id);
        try {
            await warehouseService.removeMovement(movement.id);
            toast.success(t("O'chirildi"));
            await loadHistory(true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t("O'chirib bo'lmadi");
            toast.error(t("Xatolik"), message);
        } finally {
            setDeleteBusyId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-3xl font-semibold text-cocoa-900">
                        {t("Ishlab chiqarish tarixi")}
                    </h1>
                    <p className="text-sm text-cocoa-600">
                        {t("Siz kiritgan mahsulotlar tarixi")}
                    </p>
                </div>
                <Button variant="ghost" onClick={() => void loadHistory(true)} disabled={loading || refreshing}>
                    {loading || refreshing ? t("Yangilanmoqda...") : t("Yangilash")}
                </Button>
            </div>

            <Card>
                {loading ? (
                    <div className="text-cocoa-600">{t("Yuklanmoqda...")}</div>
                ) : loadError ? (
                    <div className="space-y-3">
                        <div className="text-cocoa-700">{loadError}</div>
                        <Button onClick={() => void loadHistory()}>{t("Qayta urinish")}</Button>
                    </div>
                ) : movements.length === 0 ? (
                    <div className="text-cocoa-600">{t("Hozircha yo'q.")}</div>
                ) : (
                    <Table>
                        <T>
                            <thead>
                                <tr>
                                    <th>{t("Sana")}</th>
                                    <th>{t("Mahsulot")}</th>
                                    <th>{t("Miqdor")}</th>
                                    <th>{t("Izoh")}</th>
                                    <th>{t("Amallar")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map((m) => (
                                    <tr key={m.id}>
                                        <td className="text-sm text-cocoa-700">{m.date}</td>
                                        <td className="font-semibold text-cocoa-900">
                                            {m.product?.name}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Badge tone="primary">
                                                    {formatDigitsWithSpaces(String(m.quantity))}
                                                </Badge>
                                                <span className="text-xs text-cocoa-500">
                                                    {m.product?.unit?.short}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-sm text-cocoa-600 italic">
                                            {m.note || "-"}
                                        </td>
                                        <td>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="ghost"
                                                    className="px-3 py-1.5 text-xs"
                                                    onClick={() => openEditor(m)}
                                                >
                                                    {t("Edit")}
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    className="px-3 py-1.5 text-xs"
                                                    disabled={deleteBusyId === m.id}
                                                    onClick={() => void handleDelete(m)}
                                                >
                                                    {deleteBusyId === m.id ? t("O'chirilmoqda...") : t("Delete")}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </T>
                    </Table>
                )}
            </Card>

            <Modal title={t("Tarix yozuvini tahrirlash")} open={editorOpen} onClose={closeEditor}>
                <div className="grid gap-4">
                    <Input
                        label={t("Sana")}
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                    />

                    <Select
                        label={t("Mahsulot")}
                        value={editForm.productId}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, productId: e.target.value }))}
                        options={productOptions}
                    />

                    <Input
                        label={t("Miqdor")}
                        inputMode="decimal"
                        value={editForm.quantity}
                        onChange={(e) =>
                            setEditForm((prev) => ({
                                ...prev,
                                quantity: sanitizeDecimalInput(e.target.value),
                            }))
                        }
                        placeholder={t("Masalan: 5")}
                    />

                    <Textarea
                        label={t("Izoh")}
                        value={editForm.note}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder={t("Ixtiyoriy...")}
                    />

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="ghost" onClick={closeEditor} disabled={saveBusy}>
                            {t("Bekor")}
                        </Button>
                        <Button onClick={() => void handleSaveEdit()} disabled={saveBusy}>
                            {saveBusy ? t("Saqlanmoqda...") : t("Saqlash")}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
