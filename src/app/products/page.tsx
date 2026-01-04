"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { Table, T } from "@/components/ui/Table";
import Textarea from "@/components/ui/Textarea";

import { ensureSeed } from "@/lib/seed";
import type { ProductType, Product, Category, Unit } from "@/lib/types";
import { categoriesService } from "@/services/categories";
import { unitsService } from "@/services/units";
import { productsService } from "@/services/products";
import { moneyUZS } from "@/lib/format";
import { buildCSV, downloadCSV, fileStamp } from "@/lib/csv";

import { useToast } from "@/components/ui/toast/ToastProvider";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { onlyDigits, formatDigitsWithSpaces } from "@/lib/mask";

const typeOptions: { value: ProductType; label: string }[] = [
    { value: "PRODUCT", label: "Tayyor mahsulot" },
    { value: "INGREDIENT", label: "Ingredient" },
    { value: "DECOR", label: "Dekor" },
    { value: "UTILITY", label: "Xo‘jalik" },
];

function typeLabel(t: ProductType) {
    return typeOptions.find((x) => x.value === t)?.label ?? t;
}

const ProductSchema = z.object({
    name: z.string().trim().min(2, "Nom kamida 2 ta belgidan iborat bo‘lsin"),
    type: z.enum(["PRODUCT", "INGREDIENT", "DECOR", "UTILITY"]),
    categoryId: z.string().min(1, "Kategoriya tanlang"),
    unitId: z.string().min(1, "Birlik tanlang"),
    // ✅ endi faqat digits yoki bo‘sh
    price: z
        .string()
        .trim()
        .refine((v) => v === "" || /^\d+$/.test(v), "Narx faqat raqam bo‘lsin (masalan: 180000)"),
    active: z.enum(["true", "false"]),
    note: z.string().trim().max(200, "Izoh 200 belgidan oshmasin").optional(),
});

type ProductForm = z.infer<typeof ProductSchema>;

export default function ProductsPage() {
    const toast = useToast();

    const [categories, setCategories] = useState<Category[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const [q, setQ] = useState("");
    const [type, setType] = useState<ProductType | "ALL">("ALL");

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const {
        control,
        register,
        handleSubmit,
        reset,
        setFocus,
        formState: { errors, isSubmitting },
    } = useForm<ProductForm>({
        resolver: zodResolver(ProductSchema),
        defaultValues: {
            name: "",
            type: "PRODUCT",
            categoryId: "",
            unitId: "",
            price: "",
            active: "true",
            note: "",
        },
    });

    async function refresh() {
        setLoading(true);
        ensureSeed();
        try {
            const [cats, us, ps] = await Promise.all([
                categoriesService.list(),
                unitsService.list(),
                productsService.list(),
            ]);
            setCategories(cats);
            setUnits(us);
            setProducts(ps);

            if (cats[0] && us[0]) {
                reset((prev) => ({
                    ...prev,
                    categoryId: prev.categoryId || cats[0].id,
                    unitId: prev.unitId || us[0].id,
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
        setTimeout(() => setFocus("name"), 0);
    }, [open, setFocus]);

    const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
    const unitMap = useMemo(
        () => new Map(units.map((u) => [u.id, `${u.name} (${u.short})`])),
        [units]
    );

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return products.filter((p) => {
            const okQ = qq ? p.name.toLowerCase().includes(qq) : true;
            const okT = type === "ALL" ? true : p.type === type;
            return okQ && okT;
        });
    }, [products, q, type]);

    function openCreate() {
        setEditing(null);
        reset({
            name: "",
            type: "PRODUCT",
            categoryId: categories[0]?.id ?? "",
            unitId: units[0]?.id ?? "",
            price: "",
            active: "true",
            note: "",
        });
        setOpen(true);
    }

    function openEdit(p: Product) {
        setEditing(p);
        reset({
            name: p.name,
            type: p.type,
            categoryId: p.categoryId,
            unitId: p.unitId,
            price: typeof p.price === "number" ? String(p.price) : "",
            active: p.active ? "true" : "false",
            note: "",
        });
        setOpen(true);
    }

    const onSubmit = handleSubmit(async (data) => {
        try {
            const priceNum = data.price?.trim() ? Number(data.price) : undefined;
            const activeBool = data.active === "true";

            if (editing) {
                await productsService.update(editing.id, {
                    name: data.name.trim(),
                    type: data.type,
                    categoryId: data.categoryId,
                    unitId: data.unitId,
                    price: priceNum,
                    active: activeBool,
                });
            } else {
                await productsService.create({
                    name: data.name.trim(),
                    type: data.type,
                    categoryId: data.categoryId,
                    unitId: data.unitId,
                    price: priceNum,
                    active: activeBool,
                });
            }

            toast.success("✅ Saqlandi");
            setOpen(false);
            await refresh();
        } catch (e: any) {
            toast.error("❌ Xatolik", e?.message || "Saqlab bo‘lmadi");
        }
    });

    async function remove(p: Product) {
        setDeletingId(p.id);
        try {
            await productsService.remove(p.id);

            toast.info("🗑️ O‘chirildi", undefined, {
                label: "Undo",
                onClick: async () => {
                    // ✅ restore: id saqlanadi
                    await productsService.create({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        categoryId: p.categoryId,
                        unitId: p.unitId,
                        price: p.price,
                        active: p.active,
                    });
                    toast.success("✅ Qaytarildi");
                    await refresh();
                },
            });

            await refresh();
        } catch (e: any) {
            toast.error("❌ Xatolik", e?.message || "O‘chirib bo‘lmadi");
        } finally {
            setDeletingId(null);
        }
    }

    function exportCSV() {
        const headers = ["Name", "Type", "Category", "Unit", "Price_UZS", "Active"];
        const rows = filtered.map((p) => [
            p.name,
            typeLabel(p.type),
            catMap.get(p.categoryId) ?? "",
            unitMap.get(p.unitId) ?? "",
            typeof p.price === "number" ? p.price : "",
            p.active ? "YES" : "NO",
        ]);
        const csv = buildCSV(headers, rows);
        downloadCSV(`ruxshona-products-${fileStamp()}.csv`, csv);
    }

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <h1 className="h1">Katalog (Mahsulotlar)</h1>

            <Card>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ flex: "1 1 260px" }}>
                        <Input label="Qidirish" placeholder="Masalan: Napoleon" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>

                    <div style={{ width: 260 }}>
                        <Select
                            label="Turi"
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            options={[
                                { value: "ALL", label: "Barchasi" },
                                ...typeOptions.map((o) => ({ value: o.value, label: o.label })),
                            ]}
                        />
                    </div>

                    <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                        <Button variant="ghost" onClick={exportCSV} disabled={filtered.length === 0}>
                            Export CSV
                        </Button>
                        <Button onClick={openCreate}>+ Mahsulot qo‘shish</Button>
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
                                    <th>Nomi</th>
                                    <th>Turi</th>
                                    <th>Kategoriya</th>
                                    <th>Birlik</th>
                                    <th>Narx</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p) => (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 800 }}>{p.name}</td>
                                        <td>
                                            <Badge tone="primary">{typeLabel(p.type)}</Badge>
                                        </td>
                                        <td>{catMap.get(p.categoryId) ?? "—"}</td>
                                        <td>{unitMap.get(p.unitId) ?? "—"}</td>
                                        <td>{typeof p.price === "number" ? moneyUZS(p.price) : "—"}</td>
                                        <td>{p.active ? "Active" : "Archived"}</td>
                                        <td style={{ whiteSpace: "nowrap" }}>
                                            <Button variant="ghost" onClick={() => openEdit(p)}>
                                                Edit
                                            </Button>{" "}
                                            <Button variant="danger" disabled={deletingId === p.id} onClick={() => remove(p)}>
                                                {deletingId === p.id ? "Deleting..." : "Delete"}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="muted">
                                            Hech narsa topilmadi.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </T>
                    </Table>
                )}
            </Card>

            <Modal title={editing ? "Mahsulotni tahrirlash" : "Yangi mahsulot"} open={open} onClose={() => setOpen(false)}>
                <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
                    <Input label="Nomi *" {...register("name")} error={errors.name?.message} placeholder="Masalan: Medovik tort" />

                    <Select
                        label="Turi"
                        {...register("type")}
                        error={errors.type?.message}
                        options={typeOptions.map((o) => ({ value: o.value, label: o.label }))}
                    />

                    <Select
                        label="Kategoriya"
                        {...register("categoryId")}
                        error={errors.categoryId?.message}
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    />

                    <Select
                        label="O‘lchov birligi"
                        {...register("unitId")}
                        error={errors.unitId?.message}
                        options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.short})` }))}
                    />

                    {/* ✅ price mask */}
                    <Controller
                        name="price"
                        control={control}
                        render={({ field }) => (
                            <Input
                                label="Narx (so‘m)"
                                inputMode="numeric"
                                value={formatDigitsWithSpaces(field.value || "")}
                                onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                                error={errors.price?.message}
                                placeholder="Masalan: 180000"
                            />
                        )}
                    />

                    <Select
                        label="Status"
                        {...register("active")}
                        error={errors.active?.message}
                        options={[
                            { value: "true", label: "Active" },
                            { value: "false", label: "Archived" },
                        ]}
                    />

                    <Textarea label="Izoh (demo)" {...register("note")} error={errors.note?.message} placeholder="Ixtiyoriy..." />

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
