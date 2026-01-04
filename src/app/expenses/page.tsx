"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import Textarea from "@/components/ui/Textarea";

import { ensureSeed } from "@/lib/seed";
import type { Expense, PaymentMethod, Category } from "@/lib/types";
import { expenseCategoriesService } from "@/services/categories";
import { expensesService } from "@/services/expenses";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import { buildCSV, downloadCSV, fileStamp } from "@/lib/csv";

import { useToast } from "@/components/ui/toast/ToastProvider";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { onlyDigits, formatDigitsWithSpaces } from "@/lib/mask";

const payOptions: { value: PaymentMethod; label: string }[] = [
    { value: "CASH", label: "Naqd" },
    { value: "CARD", label: "Karta" },
    { value: "TRANSFER", label: "O‘tkazma" },
];

const ExpenseSchema = z.object({
    date: z.string().min(10, "Sana noto‘g‘ri"),
    categoryId: z.string().min(1, "Kategoriya tanlang"),
    // ✅ endi faqat digits va >0
    amount: z
        .string()
        .trim()
        .refine((v) => /^\d+$/.test(v) && Number(v) > 0, "Summa 0 dan katta raqam bo‘lsin"),
    paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]),
    note: z.string().trim().max(200, "Izoh 200 belgidan oshmasin").optional(),
});

type ExpenseForm = z.infer<typeof ExpenseSchema>;

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

export default function ExpensesPage() {
    const toast = useToast();

    const [categories, setCategories] = useState<Category[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Expense | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const {
        control,
        register,
        handleSubmit,
        reset,
        setFocus,
        formState: { errors, isSubmitting },
    } = useForm<ExpenseForm>({
        resolver: zodResolver(ExpenseSchema),
        defaultValues: {
            date: todayISO(),
            categoryId: "",
            amount: "",
            paymentMethod: "CASH",
            note: "",
        },
    });

    async function refresh() {
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
            toast.error("❌ Xatolik", e?.message || "Ma’lumotlarni yuklab bo‘lmadi");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!open) return;
        setTimeout(() => setFocus("amount"), 0);
    }, [open, setFocus]);

    const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

    const filtered = useMemo(() => {
        return expenses.filter((e) => {
            const okFrom = from ? e.date >= from : true;
            const okTo = to ? e.date <= to : true;
            return okFrom && okTo;
        });
    }, [expenses, from, to]);

    const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered]);

    function openCreate() {
        setEditing(null);
        reset({
            date: todayISO(),
            categoryId: categories[0]?.id ?? "",
            amount: "",
            paymentMethod: "CASH",
            note: "",
        });
        setOpen(true);
    }

    function openEdit(e: Expense) {
        setEditing(e);
        reset({
            date: e.date,
            categoryId: e.categoryId,
            amount: String(e.amount), // digits
            paymentMethod: e.paymentMethod,
            note: e.note ?? "",
        });
        setOpen(true);
    }

    const onSubmit = handleSubmit(async (data) => {
        try {
            const amountNum = Number(data.amount);

            if (editing) {
                await expensesService.update(editing.id, {
                    date: data.date,
                    categoryId: data.categoryId,
                    amount: amountNum,
                    paymentMethod: data.paymentMethod,
                    note: data.note?.trim(),
                });
            } else {
                await expensesService.create({
                    date: data.date,
                    categoryId: data.categoryId,
                    amount: amountNum,
                    paymentMethod: data.paymentMethod,
                    note: data.note?.trim(),
                });
            }

            toast.success("✅ Saqlandi");
            setOpen(false);
            await refresh();
        } catch (e: any) {
            toast.error("❌ Xatolik", e?.message || "Saqlab bo‘lmadi");
        }
    });

    async function remove(e: Expense) {
        setDeletingId(e.id);
        try {
            await expensesService.remove(e.id);

            toast.info("🗑️ O‘chirildi", undefined, {
                label: "Undo",
                onClick: async () => {
                    // ✅ restore: id saqlanadi
                    await expensesService.create({
                        id: e.id,
                        date: e.date,
                        categoryId: e.categoryId,
                        amount: e.amount,
                        paymentMethod: e.paymentMethod,
                        note: e.note,
                    });
                    toast.success("✅ Qaytarildi");
                    await refresh();
                },
            });

            await refresh();
        } catch (err: any) {
            toast.error("❌ Xatolik", err?.message || "O‘chirib bo‘lmadi");
        } finally {
            setDeletingId(null);
        }
    }

    function exportCSV() {
        const headers = ["Date", "Category", "Payment", "Amount_UZS", "Note"];
        const rows = filtered.map((e) => [e.date, catMap.get(e.categoryId) ?? "", e.paymentMethod, e.amount, e.note ?? ""]);
        const csv = buildCSV(headers, rows);
        downloadCSV(`ruxshona-expenses-${fileStamp()}.csv`, csv);
    }

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <h1 className="h1">Xarajatlar</h1>

            <Card>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ width: 220 }}>
                        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div style={{ width: 220 }}>
                        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>

                    <div style={{ marginLeft: "auto", display: "grid", gap: 6, justifyItems: "end" }}>
                        <div className="muted">Jami:</div>
                        <div style={{ fontWeight: 900, color: "var(--primary)" }}>{moneyUZS(total)}</div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <Button variant="ghost" onClick={exportCSV} disabled={filtered.length === 0}>
                            Export CSV
                        </Button>
                        <Button onClick={openCreate}>+ Xarajat qo‘shish</Button>
                    </div>
                </div>
            </Card>

            <Card>
                {loading ? (
                    <div className="muted">Yuklanmoqda...</div>
                ) : (
                    <Table>
                        <T>
                            <thead>
                                <tr>
                                    <th>Sana</th>
                                    <th>Kategoriya</th>
                                    <th>To‘lov</th>
                                    <th>Summa</th>
                                    <th>Izoh</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((e) => (
                                    <tr key={e.id}>
                                        <td style={{ fontWeight: 800 }}>{safeDateLabel(e.date)}</td>
                                        <td>{catMap.get(e.categoryId) ?? "—"}</td>
                                        <td>{payOptions.find((p) => p.value === e.paymentMethod)?.label ?? e.paymentMethod}</td>
                                        <td>{moneyUZS(e.amount)}</td>
                                        <td className="muted">{e.note ?? "—"}</td>
                                        <td style={{ whiteSpace: "nowrap" }}>
                                            <Button variant="ghost" onClick={() => openEdit(e)}>
                                                Edit
                                            </Button>{" "}
                                            <Button variant="danger" disabled={deletingId === e.id} onClick={() => remove(e)}>
                                                {deletingId === e.id ? "Deleting..." : "Delete"}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="muted">
                                            Hozircha xarajat yo‘q.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </T>
                    </Table>
                )}
            </Card>

            <Modal title={editing ? "Xarajatni tahrirlash" : "Yangi xarajat"} open={open} onClose={() => setOpen(false)}>
                <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
                    <Input label="Sana" type="date" {...register("date")} error={errors.date?.message} />

                    <Select
                        label="Kategoriya"
                        {...register("categoryId")}
                        error={errors.categoryId?.message}
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    />

                    {/* ✅ amount mask */}
                    <Controller
                        name="amount"
                        control={control}
                        render={({ field }) => (
                            <Input
                                label="Summa (so‘m) *"
                                inputMode="numeric"
                                value={formatDigitsWithSpaces(field.value || "")}
                                onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                                error={errors.amount?.message}
                                placeholder="Masalan: 250000"
                            />
                        )}
                    />

                    <Select
                        label="To‘lov turi"
                        {...register("paymentMethod")}
                        error={errors.paymentMethod?.message}
                        options={payOptions.map((p) => ({ value: p.value, label: p.label }))}
                    />

                    <Textarea label="Izoh" {...register("note")} error={errors.note?.message} placeholder="Masalan: Un, shakar..." />

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
                            Bekor
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saqlanmoqda..." : "Saqlash"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
