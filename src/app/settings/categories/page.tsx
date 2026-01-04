"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Table, T } from "@/components/ui/Table";
import { ensureSeed } from "@/lib/seed";
import type { Category } from "@/lib/types";

// ✅ Mahsulot kategoriyalari servisi (agar sizda nomi boshqacha bo‘lsa shu importni moslang)
import { categoriesService } from "@/services/categories";

// ✅ Xarajat kategoriyalari servisi
import { expenseCategoriesService } from "@/services/expenseCategories.service";

export default function CategoriesPage() {
    const [name1, setName1] = useState("");
    const [name2, setName2] = useState("");

    const [productCats, setProductCats] = useState<Category[]>([]);
    const [expenseCats, setExpenseCats] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string>("");

    async function refresh() {
        setLoading(true);
        setErr("");
        try {
            // agar ensureSeed async bo‘lsa — await; sync bo‘lsa ham zarar qilmaydi
            await Promise.resolve(ensureSeed());

            const [pc, ec] = await Promise.all([
                categoriesService.list(),
                expenseCategoriesService.list(),
            ]);

            setProductCats(pc);
            setExpenseCats(ec);
        } catch (e: any) {
            setErr(e?.message || "Xatolik yuz berdi");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <h1 className="h1">Kategoriyalar</h1>

            {err && (
                <div
                    style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "rgba(255,0,0,0.08)",
                        fontWeight: 700,
                    }}
                >
                    {err}
                </div>
            )}

            <Card>
                <div className="h2">Mahsulot kategoriyalari</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ flex: "1 1 260px" }}>
                        <Input
                            label="Yangi kategoriya"
                            value={name1}
                            onChange={(e) => setName1(e.target.value)}
                            placeholder="Masalan: Pirojniy"
                            disabled={loading}
                        />
                    </div>

                    <Button
                        disabled={loading}
                        onClick={async () => {
                            if (!name1.trim()) return;
                            setLoading(true);
                            setErr("");
                            try {
                                await categoriesService.create(name1.trim());
                                setName1("");
                                await refresh();
                            } catch (e: any) {
                                setErr(e?.message || "Kategoria qo‘shishda xatolik");
                            } finally {
                                setLoading(false);
                            }
                        }}
                    >
                        + Qo‘shish
                    </Button>
                </div>

                <div className="hr" />

                <Table>
                    <T>
                        <thead>
                            <tr>
                                <th>Nomi</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {productCats.map((c) => (
                                <tr key={c.id}>
                                    <td style={{ fontWeight: 800 }}>{c.name}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                        <Button
                                            variant="danger"
                                            disabled={loading}
                                            onClick={async () => {
                                                if (!confirm("O‘chirish?")) return;
                                                setLoading(true);
                                                setErr("");
                                                try {
                                                    await categoriesService.remove(c.id);
                                                    await refresh();
                                                } catch (e: any) {
                                                    setErr(e?.message || "O‘chirishda xatolik");
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}

                            {productCats.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="muted">
                                        Hozircha yo‘q.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </T>
                </Table>
            </Card>

            <Card>
                <div className="h2">Xarajat kategoriyalari</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ flex: "1 1 260px" }}>
                        <Input
                            label="Yangi xarajat kategoriyasi"
                            value={name2}
                            onChange={(e) => setName2(e.target.value)}
                            placeholder="Masalan: Reklama"
                            disabled={loading}
                        />
                    </div>

                    <Button
                        disabled={loading}
                        onClick={async () => {
                            if (!name2.trim()) return;
                            setLoading(true);
                            setErr("");
                            try {
                                await expenseCategoriesService.create(name2.trim());
                                setName2("");
                                await refresh();
                            } catch (e: any) {
                                setErr(e?.message || "Xarajat kategoriyasi qo‘shishda xatolik");
                            } finally {
                                setLoading(false);
                            }
                        }}
                    >
                        + Qo‘shish
                    </Button>
                </div>

                <div className="hr" />

                <Table>
                    <T>
                        <thead>
                            <tr>
                                <th>Nomi</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenseCats.map((c) => (
                                <tr key={c.id}>
                                    <td style={{ fontWeight: 800 }}>{c.name}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                        <Button
                                            variant="danger"
                                            disabled={loading}
                                            onClick={async () => {
                                                if (!confirm("O‘chirish?")) return;
                                                setLoading(true);
                                                setErr("");
                                                try {
                                                    await expenseCategoriesService.remove(c.id);
                                                    await refresh();
                                                } catch (e: any) {
                                                    setErr(e?.message || "O‘chirishda xatolik");
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}

                            {expenseCats.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="muted">
                                        Hozircha yo‘q.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </T>
                </Table>
            </Card>
        </div>
    );
}
