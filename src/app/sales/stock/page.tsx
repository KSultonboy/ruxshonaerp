"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Table, T } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { branchesService } from "@/services/branches";
import { salesService } from "@/services/sales";
import type { Branch, BranchStock } from "@/lib/types";
import { formatDigitsWithSpaces } from "@/lib/mask";

export default function SalesStockPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [branchId, setBranchId] = useState<string | undefined>(user?.branchId ?? undefined);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stocks, setStocks] = useState<BranchStock[]>([]);
  const [query, setQuery] = useState("");
  const canChooseBranch = user?.role === "ADMIN";

  useEffect(() => {
    async function load() {
      if (canChooseBranch) {
        const list = await branchesService.list();
        setBranches(list);
        if (!branchId && list[0]) setBranchId(list[0].id);
      }
    }
    load();
  }, [branchId, canChooseBranch]);

  useEffect(() => {
    async function load() {
      const res = await salesService.branchStock(branchId);
      setStocks(res);
    }
    load();
  }, [branchId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return stocks.filter((s) => s.product?.name?.toLowerCase().includes(q));
  }, [query, stocks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Omborxona (filial)")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Zaxira va qoldiq nazorati")}</p>
        </div>
        {canChooseBranch ? (
          <select
            className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm"
            value={branchId ?? ""}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null}
        <div className="w-full max-w-xs">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Qidirish")} />
        </div>
      </div>

      <Card>
        <Table>
          <T>
            <thead>
              <tr>
                <th>{t("Mahsulot")}</th>
                <th>{t("Barcode")}</th>
                <th>{t("Miqdor")}</th>
                <th>{t("Narx")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="flex items-center gap-2">
                    <Badge tone="neutral">{s.product?.unit?.short ?? ""}</Badge>
                    <span className="font-semibold text-cocoa-900">{s.product?.name}</span>
                  </td>
                  <td className="text-sm text-cocoa-700">{s.product?.barcode ?? "-"}</td>
                  <td className="font-semibold text-cocoa-900">
                    {formatDigitsWithSpaces(String(s.quantity))} {s.product?.unit?.short}
                  </td>
                  <td className="text-sm text-cocoa-700">
                    {formatDigitsWithSpaces(String(s.product?.salePrice ?? s.product?.price ?? 0))} so'm
                  </td>
                </tr>
              ))}
            </tbody>
          </T>
        </Table>
      </Card>
    </div>
  );
}
