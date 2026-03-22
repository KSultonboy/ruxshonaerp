"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import { ensureSeed } from "@/lib/seed";
import type { Category, ExpenseCategory } from "@/lib/types";

import { categoriesService, expenseCategoriesService } from "@/services/categories";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isAdminRole } from "@/lib/roles";

type CategoryKind = "product" | "expense";
type CategoryRow = (Category | ExpenseCategory) & { kind: CategoryKind };

export default function ProductCategoriesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [productName, setProductName] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [productCategories, setProductCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<{ id: string; kind: CategoryKind } | null>(null);
  const [editName, setEditName] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseCategory["type"]>("NORMAL");
  const [editExpenseType, setEditExpenseType] = useState<ExpenseCategory["type"]>("NORMAL");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      await Promise.resolve(ensureSeed());
      const [products, expenses] = await Promise.all([categoriesService.list(), expenseCategoriesService.list()]);
      setProductCategories(products);
      setExpenseCategories(expenses);
    } catch (e: any) {
      setErr(e?.message || t("Xatolik yuz berdi"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const combined = useMemo<CategoryRow[]>(
    () => [
      ...productCategories.map((c) => ({ ...c, kind: "product" as const })),
      ...expenseCategories.map((c) => ({ ...c, kind: "expense" as const })),
    ],
    [productCategories, expenseCategories]
  );

  const kindLabel = useCallback(
    (kind: CategoryKind) => (kind === "product" ? t("Mahsulotlar") : t("Xarajatlar")),
    [t]
  );

  if (!isAdminRole(user?.role)) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Kategoriyalar")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">
          {t("Mahsulot kategoriyalari")} / {t("Xarajatlar")}
        </p>
      </div>

      {err ? (
        <Card className="border-rose-200/70 bg-rose-50/70">
          <div className="text-sm font-semibold text-rose-700">{err}</div>
        </Card>
      ) : null}

      <Card className="motion-safe:animate-fade-up">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full md:w-72">
              <Input
                label={t("Yangi kategoriya")}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={t("Masalan: Pirojniy")}
                disabled={loading}
              />
            </div>
            <Button
              disabled={loading}
              onClick={async () => {
                if (!productName.trim()) return;

                setLoading(true);
                setErr("");
                try {
                  await categoriesService.create(productName.trim());
                  setProductName("");
                  await refresh();
                } catch (e: any) {
                  setErr(e?.message || t("Mahsulot kategoriyasini qo'shishda xatolik"));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {t("+ Qo'shish")}
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full md:w-72">
              <Input
                label={t("Yangi xarajat kategoriyasi")}
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                placeholder={t("Masalan: Reklama")}
                disabled={loading}
              />
            </div>
            <div className="w-full md:w-56">
              <Select
                label={t("Turi")}
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value as ExpenseCategory["type"])}
                options={[
                  { value: "NORMAL", label: t("Oddiy") },
                  { value: "SELLABLE", label: t("Sotiladigan") },
                ]}
              />
            </div>
            <Button
              disabled={loading}
              onClick={async () => {
                if (!expenseName.trim()) return;

                setLoading(true);
                setErr("");
                try {
                  await expenseCategoriesService.create({
                    name: expenseName.trim(),
                    type: expenseType,
                    productCategoryId: null,
                  });
                  setExpenseName("");
                  setExpenseType("NORMAL");
                  await refresh();
                } catch (e: any) {
                  setErr(e?.message || t("Xarajat kategoriyasini qo'shishda xatolik"));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {t("+ Qo'shish")}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Nomi")}</th>
                  <th>{t("Turi")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {combined.map((c) => (
                  <tr key={`${c.kind}-${c.id}`}>
                    <td className="font-semibold text-cocoa-900">
                      {editing?.id === c.id && editing.kind === c.kind ? (
                        <div className="flex flex-col gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="max-w-xs"
                          />
                          {c.kind === "expense" ? (
                            <>
                              <Select
                                value={editExpenseType}
                                onChange={(e) => setEditExpenseType(e.target.value as ExpenseCategory["type"])}
                                options={[
                                  { value: "NORMAL", label: t("Oddiy") },
                                  { value: "SELLABLE", label: t("Sotiladigan") },
                                ]}
                              />
                            </>
                          ) : null}
                        </div>
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="text-sm text-cocoa-600">
                      {c.kind === "expense" ? (
                        <>
                          {kindLabel(c.kind)} {" • "}
                          {(c as ExpenseCategory).type === "SELLABLE" ? t("Sotiladigan") : t("Oddiy")}
                        </>
                      ) : (
                        kindLabel(c.kind)
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        {editing?.id === c.id && editing.kind === c.kind ? (
                          <>
                            <Button
                              disabled={loading}
                              onClick={async () => {
                                if (!editName.trim()) return;
                                setLoading(true);
                                setErr("");
                                try {
                                  if (c.kind === "product") {
                                    await categoriesService.update(c.id, editName.trim());
                                  } else {
                                    await expenseCategoriesService.update(c.id, {
                                      name: editName.trim(),
                                      type: editExpenseType,
                                      productCategoryId: null,
                                    });
                                  }
                                  setEditing(null);
                                  await refresh();
                                } catch (e: any) {
                                  setErr(e?.message || t("Saqlab bo'lmadi"));
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {t("Saqlash")}
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={loading}
                              onClick={() => {
                                setEditing(null);
                                setEditName("");
                                setEditExpenseType("NORMAL");
                              }}
                            >
                              {t("Bekor")}
                            </Button>
                          </>
                        ) : (
                          <>
                          <Button
                              variant="ghost"
                              disabled={loading}
                              onClick={() => {
                                setEditing({ id: c.id, kind: c.kind });
                                setEditName(c.name);
                                if (c.kind === "expense") {
                                  setEditExpenseType((c as ExpenseCategory).type ?? "NORMAL");
                                }
                              }}
                            >
                              {t("Edit")}
                            </Button>
                            <Button
                              variant="danger"
                              disabled={loading}
                              onClick={async () => {
                                if (!confirm(t("O'chirish?"))) return;

                                setLoading(true);
                                setErr("");
                                try {
                                  if (c.kind === "product") {
                                    await categoriesService.remove(c.id);
                                  } else {
                                    await expenseCategoriesService.remove(c.id);
                                  }
                                  await refresh();
                                } catch (e: any) {
                                  setErr(e?.message || t("O'chirishda xatolik"));
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {t("Delete")}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {combined.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-sm text-cocoa-600">
                      {t("Hozircha yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        </div>
      </Card>
    </div>
  );
}



