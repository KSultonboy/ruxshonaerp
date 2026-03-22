"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import type { ExpenseCategory, ExpenseItem } from "@/lib/types";
import { expenseCategoriesService } from "@/services/categories";
import { expenseItemsService } from "@/services/expenseItems";

export default function ExpenseItemsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await expenseCategoriesService.list();
      setCategories(cats);
      setCategoryId((prev) => prev || cats[0]?.id || "");
    } catch (e: any) {
      toast.error(t("Xatolik"), t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const loadItems = useCallback(
    async (targetCategoryId: string) => {
      if (!targetCategoryId) {
        setItems([]);
        return;
      }
      try {
        const rows = await expenseItemsService.list(targetCategoryId);
        setItems(rows);
      } catch (e: any) {
        toast.error(t("Xatolik"), t("Ma'lumotlarni yuklab bo'lmadi"));
      }
    },
    [t, toast]
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!categoryId) return;
    loadItems(categoryId);
  }, [categoryId, loadItems]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const resetForm = () => {
    setName("");
    setSalePrice("");
    setCostPrice("");
    setEditingId(null);
  };

  const onSave = async () => {
    if (!categoryId) {
      toast.error(t("Xatolik"), t("Kategoriya tanlang"));
      return;
    }
    if (name.trim().length < 2) {
      toast.error(t("Xatolik"), t("Nom kamida 2 ta belgidan iborat bo'lsin"));
      return;
    }
    setLoading(true);
    try {
      const numericPrice = salePrice ? Number(salePrice) : undefined;
      const numericCost = costPrice ? Number(costPrice) : undefined;
      if (selectedCategory?.type === "SELLABLE") {
        if (!numericPrice || numericPrice <= 0) {
          toast.error(t("Xatolik"), t("Sotuv narxi 0 dan katta bo'lsin"));
          return;
        }
      } else {
        if (!numericCost || numericCost <= 0) {
          toast.error(t("Xatolik"), t("Tannarx 0 dan katta bo'lsin"));
          return;
        }
      }
      if (editingId) {
        await expenseItemsService.update(editingId, {
          name: name.trim(),
          categoryId,
          salePrice: selectedCategory?.type === "SELLABLE" ? numericPrice : undefined,
          costPrice: selectedCategory?.type === "SELLABLE" ? undefined : numericCost,
        });
      } else {
        await expenseItemsService.create({
          name: name.trim(),
          categoryId,
          salePrice: selectedCategory?.type === "SELLABLE" ? numericPrice : undefined,
          costPrice: selectedCategory?.type === "SELLABLE" ? undefined : numericCost,
        });
      }
      await loadItems(categoryId);
      resetForm();
      toast.success(t("Saqlandi"));
    } catch (e: any) {
      toast.error(t("Xatolik"), t("Saqlab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Xarajat nomlari")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Bu yerda xarajat kategoriyasiga xarajat nomlarini ulaysiz")}</p>
        </div>
        <Link href="/expenses">
          <Button variant="ghost">{t("Xarajatlarga qaytish")}</Button>
        </Link>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label={t("Kategoriya")}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              resetForm();
            }}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <div className="text-sm text-cocoa-600">
            {selectedCategory?.type === "SELLABLE" ? t("Sotiladigan xarajatlar omborga qo'shiladi.") : t("Oddiy xarajatlar omborga qo'shilmaydi.")}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="w-full md:w-72">
            <Input
              label={editingId ? t("Xarajat nomini tahrirlash") : t("Yangi xarajat nomi")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Masalan: masallik, un, shakar...")}
            />
          </div>
          {selectedCategory?.type === "SELLABLE" ? (
            <div className="w-full md:w-56">
              <Input
                label={t("Sotuv narxi (so'm)")}
                inputMode="numeric"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value.replace(/\D+/g, ""))}
                placeholder={t("Masalan: 250000")}
              />
            </div>
          ) : (
            <div className="w-full md:w-56">
              <Input
                label={t("Tannarx (so'm)")}
                inputMode="numeric"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value.replace(/\D+/g, ""))}
                placeholder={t("Masalan: 120000")}
              />
            </div>
          )}
          <div className="flex gap-2">
            {editingId ? (
              <Button variant="ghost" onClick={resetForm} disabled={loading}>
                {t("Bekor")}
              </Button>
            ) : null}
            <Button onClick={onSave} disabled={loading}>
              {loading ? t("Saqlanmoqda...") : editingId ? t("Saqlash") : t("+ Qo'shish")}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {items.length === 0 ? (
          <div className="py-4 text-cocoa-600">{t("Hozircha yo'q.")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Xarajat nomi")}</th>
                  <th>{selectedCategory?.type === "SELLABLE" ? t("Sotuv narxi") : t("Tannarx")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold text-cocoa-900">{item.name}</td>
                    <td className="text-cocoa-700">
                      {selectedCategory?.type === "SELLABLE"
                        ? item.product?.salePrice
                          ? `${item.product.salePrice.toLocaleString("ru-RU")} so'm`
                          : "-"
                        : item.costPrice
                          ? `${item.costPrice.toLocaleString("ru-RU")} so'm`
                          : "-"}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingId(item.id);
                            setName(item.name);
                            setSalePrice(item.product?.salePrice ? String(item.product.salePrice) : "");
                            setCostPrice(item.costPrice ? String(item.costPrice) : "");
                          }}
                        >
                          {t("Edit")}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={async () => {
                            if (!confirm(t("O'chirish?"))) return;
                            setLoading(true);
                            try {
                              await expenseItemsService.remove(item.id);
                              await loadItems(categoryId);
                            } catch (e: any) {
                              toast.error(t("Xatolik"), t("O'chirib bo'lmadi"));
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          {t("Delete")}
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
    </div>
  );
}
