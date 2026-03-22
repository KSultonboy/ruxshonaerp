"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import Textarea from "@/components/ui/Textarea";

import { ensureSeed } from "@/lib/seed";
import type { Expense, PaymentMethod, ExpenseCategory, ExpenseItem } from "@/lib/types";
import { expenseCategoriesService } from "@/services/categories";
import { expensesService } from "@/services/expenses";
import { expenseItemsService } from "@/services/expenseItems";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import { buildCSV, downloadCSV, fileStamp } from "@/lib/csv";

import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { onlyDigits, formatDigitsWithSpaces } from "@/lib/mask";

type ExpenseForm = {
  date: string;
  categoryId: string;
  amount?: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
  note?: string;
  expenseItemId?: string;
  quantity?: string;
};

type ExpenseRow = {
  key: string;
  batchId?: string | null;
  date: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note?: string;
  amount: number;
  items: Expense[];
  itemLabel: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function createExpenseBatchId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `expense-batch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortExpenseItems(items: Expense[]) {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default function ExpensesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ExpenseRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCostPrice, setEditingCostPrice] = useState(false);
  const [customCostPrice, setCustomCostPrice] = useState("");
  const [sellableItems, setSellableItems] = useState<Array<{ expenseItemId: string; quantity: string }>>([
    { expenseItemId: "", quantity: "" },
  ]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const payOptions = useMemo(
    () => [
      { value: "CASH", label: t("Naqd") },
      { value: "CARD", label: t("Karta") },
      { value: "TRANSFER", label: t("O'tkazma") },
    ],
    [t]
  );

  const expenseSchema = useMemo(
    () =>
      z.object({
        date: z.string().min(10, t("Sana noto'g'ri")),
        categoryId: z.string().min(1, t("Kategoriya tanlang")),
        amount: z.string().optional(),
        paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]),
        note: z.string().trim().max(200, t("Izoh 200 belgidan oshmasin")).optional(),
        expenseItemId: z.string().optional(),
        quantity: z.string().optional(),
      }),
    [t]
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: todayISO(),
      categoryId: "",
      amount: "",
      paymentMethod: "CASH",
      note: "",
      expenseItemId: "",
      quantity: "",
    },
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    ensureSeed();
    try {
      const [cats, exps] = await Promise.all([expenseCategoriesService.list(), expensesService.list()]);
      setCategories(cats);
      setExpenses(exps);

      if (cats[0]) {
        reset((prev) => ({
          ...prev,
          categoryId: prev.categoryId || cats[0].id,
        }));
      }
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [reset, toast, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => setFocus("amount"), 0);
  }, [open, setFocus]);

  const watchedCategoryId = watch("categoryId");
  const watchedExpenseItemId = watch("expenseItemId");
  const watchedQuantity = watch("quantity");
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === watchedCategoryId),
    [categories, watchedCategoryId]
  );
  const selectedExpenseItem = useMemo(
    () => expenseItems.find((item) => item.id === watchedExpenseItemId),
    [expenseItems, watchedExpenseItemId]
  );
  const normalizedNormalQuantity = useMemo(() => {
    const qty = Number(onlyDigits(watchedQuantity || ""));
    return qty > 0 ? qty : 1;
  }, [watchedQuantity]);
  const effectiveCostPrice = useMemo(() => {
    if (customCostPrice) {
      return Number(onlyDigits(customCostPrice)) || 0;
    }
    return selectedExpenseItem?.costPrice ?? 0;
  }, [customCostPrice, selectedExpenseItem?.costPrice]);
  const normalAutoAmount = useMemo(() => {
    if (selectedCategory?.type !== "NORMAL") return 0;
    if (!effectiveCostPrice || effectiveCostPrice <= 0) return 0;
    return effectiveCostPrice * normalizedNormalQuantity;
  }, [normalizedNormalQuantity, selectedCategory?.type, effectiveCostPrice]);
  const editingExpenses = editingRow?.items ?? [];
  const isGroupedEditing = editingExpenses.length > 1;
  const editingExpense = editingExpenses[0] ?? null;

  useEffect(() => {
    if (!open) return;
    if (editingRow) return;
    if (selectedCategory?.type === "SELLABLE") {
      setValue("amount", "");
      setValue("expenseItemId", "");
      setValue("quantity", "");
      setSellableItems([{ expenseItemId: "", quantity: "" }]);
    } else {
      setValue("expenseItemId", "");
      setValue("quantity", "1");
      setValue("amount", "");
    }
  }, [editingRow, open, selectedCategory?.type, setValue]);

  useEffect(() => {
    if (!open) return;
    if (selectedCategory?.type !== "NORMAL") return;
    setValue("amount", normalAutoAmount > 0 ? String(normalAutoAmount) : "");
  }, [normalAutoAmount, open, selectedCategory?.type, setValue]);

  useEffect(() => {
    setEditingCostPrice(false);
    setCustomCostPrice("");
  }, [watchedExpenseItemId, open]);

  useEffect(() => {
    if (!open) return;
    if (!watchedCategoryId) {
      setExpenseItems([]);
      return;
    }
    expenseItemsService
      .list(watchedCategoryId)
      .then((rows) => setExpenseItems(rows))
      .catch(() => setExpenseItems([]));
  }, [open, watchedCategoryId]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryTypeMap = useMemo(() => new Map(categories.map((c) => [c.id, c.type])), [categories]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const okFrom = from ? e.date >= from : true;
      const okTo = to ? e.date <= to : true;
      return okFrom && okTo;
    });
  }, [expenses, from, to]);

  const rows = useMemo<ExpenseRow[]>(() => {
    const grouped = new Map<string, ExpenseRow>();
    for (const expense of filtered) {
      let key = expense.batchId ?? expense.id;
      const isSellable = categoryTypeMap.get(expense.categoryId) === "SELLABLE";
      const expenseNote = expense.note ?? "";
      const expenseTime = new Date(expense.createdAt).getTime();

      if (!expense.batchId && isSellable) {
        const existingLegacyRow = Array.from(grouped.values()).find((row) => {
          if (row.batchId) return false;
          if (row.date !== expense.date || row.categoryId !== expense.categoryId) return false;
          if (row.paymentMethod !== expense.paymentMethod) return false;
          if ((row.note ?? "") !== expenseNote) return false;
          if (!(expense.amount === 0 || row.items.some((item) => item.amount === 0))) return false;
          return row.items.some((item) => Math.abs(new Date(item.createdAt).getTime() - expenseTime) <= 10_000);
        });

        if (existingLegacyRow) {
          key = existingLegacyRow.key;
        } else if (expense.amount === 0) {
          key = `legacy:${expense.date}:${expense.categoryId}:${expense.paymentMethod}:${expenseNote}:${Math.floor(
            expenseTime / 10_000
          )}`;
        }
      }

      const existing = grouped.get(key);
      if (existing) {
        existing.items.push(expense);
        existing.amount += expense.amount;
        continue;
      }

      grouped.set(key, {
        key,
        batchId: expense.batchId ?? null,
        date: expense.date,
        categoryId: expense.categoryId,
        paymentMethod: expense.paymentMethod,
        note: expense.note,
        amount: expense.amount,
        items: [expense],
        itemLabel: "",
      });
    }

    return Array.from(grouped.values()).map((row) => {
      const orderedItems = sortExpenseItems(row.items);
      const note = orderedItems.find((item) => item.note?.trim())?.note ?? row.note;
      return {
        ...row,
        items: orderedItems,
        note,
        itemLabel: orderedItems.map((item) => item.expenseItem?.name ?? "-").join(", "),
      };
    });
  }, [categoryTypeMap, filtered]);

  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered]);

  const openCreate = useCallback(() => {
    setEditingRow(null);
    reset({
      date: todayISO(),
      categoryId: categories[0]?.id ?? "",
      amount: "",
      paymentMethod: "CASH",
      note: "",
      expenseItemId: "",
      quantity: "1",
    });
    setSellableItems([{ expenseItemId: "", quantity: "" }]);
    setOpen(true);
  }, [categories, reset]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    if (open) return;
    if (categories.length === 0) return;
    openCreate();
    router.replace(pathname);
  }, [categories.length, open, openCreate, pathname, router, searchParams]);

  function openEdit(row: ExpenseRow) {
    setEditingRow(row);
    const primaryExpense = row.items[0];
    reset({
      date: row.date,
      categoryId: row.categoryId,
      amount: String(row.amount),
      paymentMethod: row.paymentMethod,
      note: row.note ?? "",
      expenseItemId: primaryExpense?.expenseItemId ?? "",
      quantity: primaryExpense?.quantity ? String(primaryExpense.quantity) : "1",
    });
    setSellableItems(
      row.items.length > 1
        ? row.items.map((item) => ({
            expenseItemId: item.expenseItemId ?? "",
            quantity: item.quantity ? String(item.quantity) : "",
          }))
        : primaryExpense?.expenseItemId && primaryExpense.quantity
          ? [{ expenseItemId: primaryExpense.expenseItemId, quantity: String(primaryExpense.quantity) }]
          : [{ expenseItemId: "", quantity: "" }]
    );
    setOpen(true);
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      const category = categories.find((c) => c.id === data.categoryId);
      if (!category) {
        toast.error(t("Xatolik"), t("Kategoriya tanlang"));
        return;
      }

      if (category.type === "SELLABLE") {
        const amountNum = Number(data.amount || 0);
        if (!amountNum || amountNum <= 0) {
          toast.error(t("Xatolik"), t("Summa 0 dan katta bo'lsin"));
          return;
        }
        const items =
          editingExpense && !isGroupedEditing && data.expenseItemId
            ? [{ expenseItemId: data.expenseItemId, quantity: Number(data.quantity || 0) }]
            : sellableItems.map((i) => ({ expenseItemId: i.expenseItemId, quantity: Number(i.quantity || 0) }));

        const payloadItems = items.filter((i) => i.expenseItemId && i.quantity > 0);
        if (payloadItems.length === 0) {
          toast.error(t("Xatolik"), t("Xarajat nomi va miqdor kiriting"));
          return;
        }

        if (isGroupedEditing) {
          for (const expense of editingExpenses) {
            await expensesService.remove(expense.id);
          }

          const batchId = payloadItems.length > 1 ? editingRow?.batchId ?? createExpenseBatchId() : undefined;
          for (let i = 0; i < payloadItems.length; i += 1) {
            const item = payloadItems[i];
            await expensesService.create({
              date: data.date,
              categoryId: data.categoryId,
              expenseItemId: item.expenseItemId,
              quantity: item.quantity,
              amount: i === 0 ? amountNum : 0,
              paymentMethod: data.paymentMethod,
              note: data.note?.trim(),
              batchId,
            });
          }
        } else if (editingExpense) {
          const item = payloadItems[0];
          await expensesService.update(editingExpense.id, {
            date: data.date,
            categoryId: data.categoryId,
            expenseItemId: item.expenseItemId,
            quantity: item.quantity,
            paymentMethod: data.paymentMethod,
            note: data.note?.trim(),
            amount: amountNum,
          });
        } else {
          const batchId = payloadItems.length > 1 ? createExpenseBatchId() : undefined;
          for (let i = 0; i < payloadItems.length; i += 1) {
            const item = payloadItems[i];
            await expensesService.create({
              date: data.date,
              categoryId: data.categoryId,
              amount: i === 0 ? amountNum : 0,
              paymentMethod: data.paymentMethod,
              note: data.note?.trim(),
              expenseItemId: item.expenseItemId,
              quantity: item.quantity,
              batchId,
            });
          }
        }
      } else {
        if (!data.expenseItemId) {
          toast.error(t("Xatolik"), t("Xarajat nomini tanlang"));
          return;
        }

        const quantityNum = Number(data.quantity || 1);
        if (!quantityNum || quantityNum <= 0) {
          toast.error(t("Xatolik"), t("Miqdor 0 dan katta bo'lsin"));
          return;
        }

        if (!effectiveCostPrice || effectiveCostPrice <= 0) {
          toast.error(t("Xatolik"), t("Tannarx topilmadi"));
          return;
        }

        const amountNum = effectiveCostPrice * quantityNum;

        if (isGroupedEditing) {
          for (const expense of editingExpenses) {
            await expensesService.remove(expense.id);
          }

          await expensesService.create({
            date: data.date,
            categoryId: data.categoryId,
            amount: amountNum,
            paymentMethod: data.paymentMethod,
            note: data.note?.trim(),
            expenseItemId: data.expenseItemId,
            quantity: quantityNum,
          });
        } else if (editingExpense) {
          await expensesService.update(editingExpense.id, {
            date: data.date,
            categoryId: data.categoryId,
            amount: amountNum,
            paymentMethod: data.paymentMethod,
            note: data.note?.trim(),
            expenseItemId: data.expenseItemId,
            quantity: quantityNum,
          });
        } else {
          await expensesService.create({
            date: data.date,
            categoryId: data.categoryId,
            amount: amountNum,
            paymentMethod: data.paymentMethod,
            note: data.note?.trim(),
            expenseItemId: data.expenseItemId,
            quantity: quantityNum,
          });
        }
      }

      toast.success(t("Saqlandi"));
      setEditingRow(null);
      setOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    }
  });

  async function remove(row: ExpenseRow) {
    setDeletingId(row.key);
    try {
      for (const item of row.items) {
        await expensesService.remove(item.id);
      }

      toast.info(t("O'chirildi"), undefined, {
        label: t("Undo"),
        onClick: async () => {
          for (const item of row.items) {
            await expensesService.create({
              date: item.date,
              categoryId: item.categoryId,
              amount: item.amount,
              paymentMethod: item.paymentMethod,
              note: item.note,
              batchId: item.batchId ?? undefined,
              expenseItemId: item.expenseItemId ?? undefined,
              productId: item.productId ?? undefined,
              quantity: item.quantity ?? undefined,
            });
          }
          toast.success(t("Qaytarildi"));
          await refresh();
        },
      });

      await refresh();
    } catch (err: any) {
      toast.error(t("Xatolik"), err?.message || t("O'chirib bo'lmadi"));
    } finally {
      setDeletingId(null);
    }
  }

  function exportCSV() {
    const headers = ["Date", "Category", "Item", "Payment", "Amount_UZS", "Note"];
    const exportRows = rows.map((row) => [
      row.date,
      catMap.get(row.categoryId) ?? "",
      row.itemLabel,
      row.paymentMethod,
      row.amount,
      row.note ?? "",
    ]);
    const csv = buildCSV(headers, exportRows);
    downloadCSV(`ruxshona-expenses-${fileStamp()}.csv`, csv);
  }

  if (user?.role === "PRODUCTION") {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim sotuv va admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Xarajat kiritish")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Kunlik xarajatlar va to'lovlar nazorati")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={exportCSV} disabled={filtered.length === 0}>
            {t("Export CSV")}
          </Button>
          <Link href="/expenses/items">
            <Button variant="ghost">{t("Xarajat nomlari")}</Button>
          </Link>
          <Button onClick={openCreate}>{t("+ Xarajat qo'shish")}</Button>
        </div>
      </div>

      <Card className="motion-safe:animate-fade-up">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-52">
            <Input label={t("From")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-full sm:w-52">
            <Input label={t("To")} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="ml-auto flex flex-col items-end">
            <div className="text-xs font-semibold uppercase tracking-wide text-cocoa-500">{t("Jami")}</div>
            <div className="text-lg font-semibold text-berry-700">{moneyUZS(total)}</div>
          </div>
        </div>
      </Card>

      <Card className="motion-safe:animate-fade-up anim-delay-150">
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Sana")}</th>
                  <th>{t("Kategoriya")}</th>
                    <th>{t("Xarajat nomi")}</th>
                  <th>{t("To'lov")}</th>
                  <th>{t("Summa")}</th>
                  <th>{t("Izoh")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="font-semibold">{safeDateLabel(row.date)}</td>
                    <td>{catMap.get(row.categoryId) ?? "-"}</td>
                    <td>{row.itemLabel}</td>
                    <td>{payOptions.find((p) => p.value === row.paymentMethod)?.label ?? row.paymentMethod}</td>
                    <td>{moneyUZS(row.amount)}</td>
                    <td className="text-cocoa-600">{row.note ?? "-"}</td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={() => openEdit(row)}>
                          {t("Edit")}
                        </Button>
                        <Button variant="danger" disabled={deletingId === row.key} onClick={() => remove(row)}>
                          {deletingId === row.key ? t("Deleting...") : t("Delete")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-sm text-cocoa-600">
                      {t("Hozircha xarajat yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        )}
      </Card>

      <Modal title={editingRow ? t("Xarajatni tahrirlash") : t("Yangi xarajat")} open={open} onClose={() => setOpen(false)}>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Input
            label={t("Sana")}
            type="date"
            {...register("date")}
            error={errors.date?.message}
            disabled={!editingRow}
          />

          <Select
            label={t("Kategoriya")}
            {...register("categoryId")}
            error={errors.categoryId?.message}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />

          {selectedCategory?.type === "SELLABLE" ? (
            editingRow && !isGroupedEditing ? (
              <>
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label={t("Umumiy summa (so'm) *")}
                      inputMode="numeric"
                      value={formatDigitsWithSpaces(field.value || "")}
                      onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                      placeholder={t("Masalan: 250000")}
                    />
                  )}
                />
                <Select
                  label={t("Xarajat nomi")}
                  {...register("expenseItemId")}
                  options={[
                    { value: "", label: t("Tanlang") },
                    ...expenseItems.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label={t("Miqdor")}
                      inputMode="numeric"
                      value={formatDigitsWithSpaces(field.value || "")}
                      onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                      placeholder={t("Masalan: 5")}
                    />
                  )}
                />
              </>
            ) : (
              <div className="space-y-3">
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label={t("Umumiy summa (so'm) *")}
                      inputMode="numeric"
                      value={formatDigitsWithSpaces(field.value || "")}
                      onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                      placeholder={t("Masalan: 250000")}
                    />
                  )}
                />
                {sellableItems.map((item, index) => (
                  <div key={`${item.expenseItemId}-${index}`} className="grid gap-3 md:grid-cols-3">
                    <Select
                      label={t("Xarajat nomi")}
                      value={item.expenseItemId}
                      onChange={(e) => {
                        const next = [...sellableItems];
                        next[index] = { ...item, expenseItemId: e.target.value };
                        setSellableItems(next);
                      }}
                      options={[
                        { value: "", label: t("Tanlang") },
                        ...expenseItems.map((row) => ({ value: row.id, label: row.name })),
                      ]}
                    />
                    <Input
                      label={t("Miqdor")}
                      inputMode="numeric"
                      value={formatDigitsWithSpaces(item.quantity || "")}
                      onChange={(e) => {
                        const next = [...sellableItems];
                        next[index] = { ...item, quantity: onlyDigits(e.target.value) };
                        setSellableItems(next);
                      }}
                      placeholder={t("Masalan: 5")}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          const next = sellableItems.filter((_, i) => i !== index);
                          setSellableItems(next.length ? next : [{ expenseItemId: "", quantity: "" }]);
                        }}
                      >
                        {t("Delete")}
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSellableItems((prev) => [...prev, { expenseItemId: "", quantity: "" }])}
                >
                  {t("+ Qo'shish")}
                </Button>
              </div>
            )
          ) : (
            <>
              <Select
                label={t("Xarajat nomi")}
                {...register("expenseItemId")}
                options={[
                  { value: "", label: t("Tanlang") },
                  ...expenseItems.map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
              <Controller
                name="quantity"
                control={control}
                render={({ field }) => (
                  <Input
                    label={t("Miqdor")}
                    inputMode="numeric"
                    value={formatDigitsWithSpaces(field.value || "")}
                    onFocus={() => { if (field.value === "1") field.onChange(""); }}
                    onBlur={() => { if (!field.value || field.value === "0") field.onChange("1"); }}
                    onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                    placeholder="1"
                  />
                )}
              />
              {selectedExpenseItem && (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      label={t("Tannarx (1 dona)")}
                      inputMode="numeric"
                      value={editingCostPrice ? formatDigitsWithSpaces(customCostPrice) : formatDigitsWithSpaces(String(effectiveCostPrice))}
                      readOnly={!editingCostPrice}
                      onChange={(e) => setCustomCostPrice(onlyDigits(e.target.value))}
                    />
                  </div>
                  <div className="pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (!editingCostPrice) {
                          setCustomCostPrice(String(selectedExpenseItem.costPrice ?? 0));
                        }
                        setEditingCostPrice((prev) => !prev);
                      }}
                    >
                      {editingCostPrice ? t("✓ Tayyor") : t("Edit")}
                    </Button>
                  </div>
                </div>
              )}
              <Input
                label={t("Summa (so'm, auto)")}
                inputMode="numeric"
                value={formatDigitsWithSpaces(String(normalAutoAmount || 0))}
                readOnly
              />
            </>
          )}

          <Select
            label={t("To'lov turi")}
            {...register("paymentMethod")}
            error={errors.paymentMethod?.message}
            options={payOptions.map((p) => ({ value: p.value, label: p.label }))}
          />

          <Textarea
            label={t("Izoh")}
            {...register("note")}
            error={errors.note?.message}
            placeholder={t("Masalan: un, shakar...")}
          />

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              {t("Bekor")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("Saqlanmoqda...") : t("Saqlash")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
