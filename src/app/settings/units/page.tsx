"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Table, T } from "@/components/ui/Table";
import { ensureSeed } from "@/lib/seed";
import { unitsService } from "@/services/units";
import type { Unit } from "@/lib/types";

export default function UnitsPage() {
    const [units, setUnits] = useState<Unit[]>([]);
    const [name, setName] = useState("");
    const [short, setShort] = useState("");

    async function refresh() {
        ensureSeed();
        setUnits(await unitsService.list());
    }

    useEffect(() => {
        refresh();
    }, []);

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <h1 className="h1">O‘lchov birliklari</h1>

            <Card>
                <div className="h2">Yangi birlik qo‘shish</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ flex: "1 1 260px" }}>
                        <Input label="Nomi" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Kilogram" />
                    </div>
                    <div style={{ width: 200 }}>
                        <Input label="Qisqa" value={short} onChange={(e) => setShort(e.target.value)} placeholder="kg" />
                    </div>
                    <Button
                        onClick={async () => {
                            if (!name.trim() || !short.trim()) return;
                            await unitsService.create(name, short);
                            setName(""); setShort("");
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
                            <tr><th>Nomi</th><th>Qisqa</th><th></th></tr>
                        </thead>
                        <tbody>
                            {units.map((u) => (
                                <tr key={u.id}>
                                    <td style={{ fontWeight: 800 }}>{u.name}</td>
                                    <td>{u.short}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                        <Button
                                            variant="danger"
                                            onClick={async () => {
                                                if (!confirm("O‘chirish?")) return;
                                                await unitsService.remove(u.id);
                                                await refresh();
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {units.length === 0 && (
                                <tr><td colSpan={3} className="muted">Hozircha yo‘q.</td></tr>
                            )}
                        </tbody>
                    </T>
                </Table>
            </Card>
        </div>
    );
}
