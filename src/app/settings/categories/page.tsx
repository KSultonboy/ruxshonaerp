"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Table, T } from "@/components/ui/Table";
import { ensureSeed } from "@/lib/seed";
import { expenseCategoriesService as categoriesService } from "@/services/expenseCategories.service";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
    const [name1, setName1] = useState("");
    const [name2, setName2] = useState("");

    const [productCats, setProductCats] = useState<Category[]>([]);
    const [expenseCats, setExpenseCats] = useState<Category[]>([]);

    async function refresh() {
        ensureSeed();
        const [pc, ec] = await Promise.all([
            categoriesService.list(),
            expenseCategoriesService.list(),
        ]);
        setProductCats(pc);
        setExpenseCats(ec);
    }

    useEffect(() => {
        refresh();
    }, []);

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <h1 className="h1">Kategoriyalar</h1>

            <Card>
                <div className="h2">Mahsulot kategoriyalari</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ flex: "1 1 260px" }}>
                        <Input
                            label="Yangi kategoriya"
                            value={name1}
                            onChange={(e) => setName1(e.target.value)}
                            placeholder="Masalan: Pirojniy"
                        />
                    </div>
                    <Button
                        onClick={async () => {
                            if (!name1.trim()) return;
                            await categoriesService.create(name1);
                            setName1("");
                            await refresh();
                        }}
                    >
                        + Qo‘shish
                    </Button>
                </div>

                <div className="hr" />
                <Table>
                    <T>
                        <thead>
                            <tr><th>Nomi</th><th></th></tr>
                        </thead>
                        <tbody>
                            {productCats.map((c) => (
                                <tr key={c.id}>
                                    <td style={{ fontWeight: 800 }}>{c.name}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                        <Button
                                            variant="danger"
                                            onClick={async () => {
                                                if (!confirm("O‘chirish?")) return;
                                                await categoriesService.remove(c.id);
                                                await refresh();
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {productCats.length === 0 && (
                                <tr><td colSpan={2} className="muted">Hozircha yo‘q.</td></tr>
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
                        />
                    </div>
                    <Button
                        onClick={async () => {
                            if (!name2.trim()) return;
                            await expenseCategoriesService.create(name2);
                            setName2("");
                            await refresh();
                        }}
                    >
                        + Qo‘shish
                    </Button>
                </div>

                <div className="hr" />
                <Table>
                    <T>
                        <thead>
                            <tr><th>Nomi</th><th></th></tr>
                        </thead>
                        <tbody>
                            {expenseCats.map((c) => (
                                <tr key={c.id}>
                                    <td style={{ fontWeight: 800 }}>{c.name}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                        <Button
                                            variant="danger"
                                            onClick={async () => {
                                                if (!confirm("O‘chirish?")) return;
                                                await expenseCategoriesService.remove(c.id);
                                                await refresh();
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {expenseCats.length === 0 && (
                                <tr><td colSpan={2} className="muted">Hozircha yo‘q.</td></tr>
                            )}
                        </tbody>
                    </T>
                </Table>
            </Card>
        </div>
    );
}
