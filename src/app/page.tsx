"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";

import { ensureSeed } from "@/lib/seed";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import { buildCSV, downloadCSV, fileStamp } from "@/lib/csv";

import { productsService } from "@/services/products";
import { expensesService } from "@/services/expenses";
import { expenseCategoriesService } from "@/services/categories";
import { SERVICE_MODE } from "@/services/config";

import type { ProductType, Product, Expense, Category } from "@/lib/types";

const typeOptions: { value: ProductType; label: string }[] = [
  { value: "PRODUCT", label: "Tayyor mahsulot" },
  { value: "INGREDIENT", label: "Ingredient" },
  { value: "DECOR", label: "Dekor" },
  { value: "UTILITY", label: "Xo‘jalik" },
];

function typeLabel(t: ProductType) {
  return typeOptions.find((x) => x.value === t)?.label ?? t;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expCats, setExpCats] = useState<Category[]>([]);

  const today = isoToday();
  const from7 = isoDaysAgo(6);   // bugun + 6 kun oldin = 7 kun
  const from30 = isoDaysAgo(29); // 30 kun

  async function refresh() {
    setLoading(true);
    setErr("");

    try {
      // faqat local mode bo‘lsa seed qilish mantiqli
      if (SERVICE_MODE === "local") ensureSeed();

      const [ps, exps, cats] = await Promise.all([
        productsService.list(),
        expensesService.list(),
        expenseCategoriesService.list(),
      ]);

      setProducts(ps);
      setExpenses(exps);
      setExpCats(cats);
    } catch (e: any) {
      setErr(e?.message || "Noma’lum xatolik");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expCatMap = useMemo(() => new Map(expCats.map((c) => [c.id, c.name])), [expCats]);

  const todayTotal = useMemo(() => {
    return expenses.filter((e) => e.date === today).reduce((s, e) => s + e.amount, 0);
  }, [expenses, today]);

  const last7Total = useMemo(() => {
    return expenses
      .filter((e) => e.date >= from7 && e.date <= today)
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses, from7, today]);

  const last30Total = useMemo(() => {
    return expenses
      .filter((e) => e.date >= from30 && e.date <= today)
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses, from30, today]);

  const activeProducts = useMemo(() => products.filter((p) => p.active).length, [products]);
  const archivedProducts = useMemo(() => products.filter((p) => !p.active).length, [products]);

  const last6Expenses = useMemo(() => {
    return [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  }, [expenses]);

  function exportExpensesCSV() {
    const headers = ["Date", "Category", "Payment", "Amount_UZS", "Note"];
    const rows = expenses.map((e) => [
      e.date,
      expCatMap.get(e.categoryId) ?? "",
      e.paymentMethod,
      e.amount,
      e.note ?? "",
    ]);
    const csv = buildCSV(headers, rows);
    downloadCSV(`ruxshona-expenses-${fileStamp()}.csv`, csv);
  }

  function exportProductsCSV() {
    const headers = ["Name", "Type", "Price_UZS", "Active"];
    const rows = products.map((p) => [
      p.name,
      typeLabel(p.type),
      typeof p.price === "number" ? p.price : "",
      p.active ? "YES" : "NO",
    ]);
    const csv = buildCSV(headers, rows);
    downloadCSV(`ruxshona-products-${fileStamp()}.csv`, csv);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <h1 className="h1">Dashboard</h1>
          <div className="muted">
            Mode: <b>{SERVICE_MODE}</b> • Sana: <b>{safeDateLabel(today)}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={exportProductsCSV} disabled={products.length === 0}>
            Export Products CSV
          </Button>
          <Button variant="ghost" onClick={exportExpensesCSV} disabled={expenses.length === 0}>
            Export Expenses CSV
          </Button>
          <Button onClick={refresh}>↻ Refresh</Button>
        </div>
      </div>

      {err ? (
        <Card>
          <div style={{ color: "#9b0000", fontWeight: 900 }}>Xatolik:</div>
          <div className="muted">{err}</div>
        </Card>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <StatCard title="Bugungi xarajat" value={moneyUZS(todayTotal)} hint={`Sana: ${safeDateLabel(today)}`} />
        <StatCard title="Oxirgi 7 kun xarajat" value={moneyUZS(last7Total)} hint={`From: ${safeDateLabel(from7)}`} />
        <StatCard title="Oxirgi 30 kun xarajat" value={moneyUZS(last30Total)} hint={`From: ${safeDateLabel(from30)}`} />
        <StatCard title="Mahsulotlar (Active)" value={String(activeProducts)} hint={`Archived: ${archivedProducts}`} />
      </div>

      <Card>
        <div className="h2">Oxirgi xarajatlar</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {loading ? (
            <div className="muted">Yuklanmoqda...</div>
          ) : last6Expenses.length === 0 ? (
            <div className="muted">Hozircha xarajat yo‘q.</div>
          ) : (
            last6Expenses.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.55)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{expCatMap.get(e.categoryId) ?? "—"}</div>
                  <div className="muted">
                    {safeDateLabel(e.date)} • {e.paymentMethod}
                    {e.note ? ` • ${e.note}` : ""}
                  </div>
                </div>
                <div style={{ fontWeight: 900, color: "var(--primary)" }}>{moneyUZS(e.amount)}</div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="muted">
          Backend ulaganda faqat <b>.env.local</b> dagi <b>NEXT_PUBLIC_SERVICE_MODE</b> ni <b>api</b> qilamiz — UI o‘zgarmaydi.
        </div>
      </Card>
    </div>
  );
}
