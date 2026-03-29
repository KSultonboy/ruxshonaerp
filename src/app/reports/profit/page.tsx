"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { apiFetch } from "@/services/http";

interface ProfitRow {
  productId: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  totalQty: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  margin: number;
}

function fmt(n: number) {
  return Math.round(n).toLocaleString();
}

function marginBadge(margin: number) {
  if (margin >= 40) return <Badge tone="success">{margin}%</Badge>;
  if (margin >= 20) return <Badge tone="neutral">{margin}%</Badge>;
  return <Badge tone="warning">{margin}%</Badge>;
}

export default function ProductProfitPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ProfitRow[]>(
        `/reports/product-profit?from=${from}&to=${to}`
      );
      setRows(data);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, t, toast]);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.reduce((s, r) => s + r.totalRevenue, 0);
  const totalCost = filtered.reduce((s, r) => s + r.totalCost, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  function handlePrint() {
    const rows_html = filtered.map((r) => `
      <tr>
        <td>${r.name}</td>
        <td>${r.category}</td>
        <td style="text-align:right">${fmt(r.totalQty)} ${r.unit}</td>
        <td style="text-align:right">${fmt(r.totalRevenue)}</td>
        <td style="text-align:right">${fmt(r.totalCost)}</td>
        <td style="text-align:right;color:${r.profit >= 0 ? "#15803d" : "#dc2626"};font-weight:700">${fmt(r.profit)}</td>
        <td style="text-align:right">${r.margin}%</td>
      </tr>
    `).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>Foyda Hisoboti ${from} – ${to}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#1f1a17}
        h2{margin:0 0 4px}p{margin:2px 0;font-size:11px;color:#5c5048}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{padding:5px 8px;border:1px solid #e5ded7;text-align:left}
        th{background:#f5f0ea;font-weight:700;font-size:11px}
        .summary{display:flex;gap:24px;margin-top:16px;padding:12px;background:#f5f0ea;border-radius:8px}
        .sum-item{text-align:center}.sum-item .lbl{font-size:10px;color:#5c5048}.sum-item .val{font-size:14px;font-weight:700}
        @media print{@page{margin:10mm}}
      </style></head><body>
      <h2>Mahsulot Foyda Hisoboti</h2>
      <p>Davr: <b>${from}</b> – <b>${to}</b></p>
      <table><thead><tr>
        <th>Mahsulot</th><th>Kategoriya</th><th style="text-align:right">Miqdor</th>
        <th style="text-align:right">Daromad</th><th style="text-align:right">Tannarx</th>
        <th style="text-align:right">Foyda</th><th style="text-align:right">Margin</th>
      </tr></thead><tbody>${rows_html}</tbody></table>
      <div class="summary">
        <div class="sum-item"><div class="lbl">Jami daromad</div><div class="val">${fmt(totalRevenue)} so'm</div></div>
        <div class="sum-item"><div class="lbl">Jami tannarx</div><div class="val">${fmt(totalCost)} so'm</div></div>
        <div class="sum-item"><div class="lbl">Jami foyda</div><div class="val" style="color:${totalProfit >= 0 ? "#15803d" : "#dc2626"}">${fmt(totalProfit)} so'm</div></div>
        <div class="sum-item"><div class="lbl">O'rtacha margin</div><div class="val">${avgMargin}%</div></div>
      </div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
      </body></html>`;

    const w = window.open("", "_blank", "width=900,height=950");
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Foyda hisoboti")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Mahsulot bo'yicha daromad, tannarx va foyda tahlili")}</p>
        </div>
        {rows.length > 0 && (
          <Button variant="ghost" onClick={handlePrint}>🖨 {t("Chop etish")}</Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-cocoa-700">{t("Dan")}:</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-cocoa-700">{t("Gacha")}:</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Mahsulot yoki kategoriya qidirish...")}
            className="flex-1 rounded-xl border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
          />
          <Button variant="ghost" onClick={() => void load()}>{t("Yuklash")}</Button>
        </div>
      </Card>

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <div className="text-xs font-semibold text-cocoa-600">{t("Jami daromad")}</div>
            <div className="mt-1 text-xl font-bold text-cocoa-900">{fmt(totalRevenue)} {t("so'm")}</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold text-cocoa-600">{t("Jami tannarx")}</div>
            <div className="mt-1 text-xl font-bold text-red-600">{fmt(totalCost)} {t("so'm")}</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold text-green-700">{t("Jami foyda")}</div>
            <div className={`mt-1 text-xl font-bold ${totalProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
              {totalProfit >= 0 ? "+" : ""}{fmt(totalProfit)} {t("so'm")}
            </div>
          </Card>
          <Card>
            <div className="text-xs font-semibold text-cocoa-600">{t("O'rtacha margin")}</div>
            <div className="mt-1 text-xl font-bold text-cocoa-900">{avgMargin}%</div>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <div className="py-8 text-center text-sm text-cocoa-500">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Mahsulot")}</th>
                  <th>{t("Kategoriya")}</th>
                  <th className="text-right">{t("Miqdor")}</th>
                  <th className="text-right">{t("Daromad")}</th>
                  <th className="text-right">{t("Tannarx")}</th>
                  <th className="text-right">{t("Foyda")}</th>
                  <th className="text-right">{t("Margin")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.productId}>
                    <td className="font-semibold text-cocoa-900">{row.name}</td>
                    <td className="text-sm text-cocoa-600">{row.category}</td>
                    <td className="text-right tabular-nums text-sm text-cocoa-700">
                      {fmt(row.totalQty)} {row.unit}
                    </td>
                    <td className="text-right tabular-nums text-sm font-semibold text-cocoa-900">
                      {fmt(row.totalRevenue)}
                    </td>
                    <td className="text-right tabular-nums text-sm text-red-600">
                      {fmt(row.totalCost)}
                    </td>
                    <td className={`text-right tabular-nums text-sm font-bold ${row.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {row.profit >= 0 ? "+" : ""}{fmt(row.profit)}
                    </td>
                    <td className="text-right">{marginBadge(row.margin)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-cocoa-500">
                      {t("Bu davrda sotuv ma'lumoti yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        )}
      </Card>
    </div>
  );
}
