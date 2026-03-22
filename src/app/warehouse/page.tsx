"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { branchesService } from "@/services/branches";
import { productsService } from "@/services/products";
import { salesService } from "@/services/sales";
import { warehouseService } from "@/services/warehouse";
import type { Branch, BranchStock, Product, WarehouseSummary } from "@/lib/types";
import { formatDigitsWithSpaces } from "@/lib/mask";

export default function WarehousePage() {
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const role = user?.role ?? "ADMIN";
  const canSelectBranch = role === "ADMIN";

  const [summary, setSummary] = useState<WarehouseSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouseTarget, setWarehouseTarget] = useState("central");
  const [branchStocks, setBranchStocks] = useState<BranchStock[]>([]);
  const [branchQuery, setBranchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadCentral = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, productRes] = await Promise.all([warehouseService.summary(), productsService.list()]);
      setSummary(summaryRes);
      setProducts(productRes);
      setBranchStocks([]);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const loadBranch = useCallback(async () => {
    if (warehouseTarget === "central") return;
    setLoading(true);
    try {
      const stocks = await salesService.branchStock(warehouseTarget);
      setBranchStocks(stocks);
      setSummary(null);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [toast, t, warehouseTarget]);

  useEffect(() => {
    if (!canSelectBranch) return;
    branchesService
      .list()
      .then(setBranches)
      .catch((e: any) => toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi")));
  }, [canSelectBranch, t, toast]);

  useEffect(() => {
    if (warehouseTarget === "central") {
      loadCentral();
    } else {
      loadBranch();
    }
  }, [loadBranch, loadCentral, warehouseTarget]);

  const centralMetricCards = [
    { key: "totalProducts", title: t("Umumiy mahsulotlar"), value: String(summary?.totalProducts ?? 0) },
    { key: "totalStock", title: t("Umumiy qoldiq"), value: String(summary?.totalStock ?? 0) },
    { key: "lowStock", title: t("Kam qoldiq"), value: String(summary?.lowStockCount ?? 0) },
  ];
  const branchMetricCards = useMemo(() => {
    const totalStock = branchStocks.reduce((sum, s) => sum + s.quantity, 0);
    const totalValue = branchStocks.reduce((sum, s) => {
      const price = s.product?.salePrice ?? s.product?.price ?? 0;
      return sum + s.quantity * price;
    }, 0);
    return [
      { key: "branchProducts", title: t("Umumiy mahsulotlar"), value: String(branchStocks.length) },
      { key: "branchStock", title: t("Umumiy qoldiq"), value: String(totalStock) },
      { key: "branchTotalValue", title: t("Umumiy summa"), value: `${formatDigitsWithSpaces(String(totalValue))} so'm` },
    ];
  }, [branchStocks, t]);
  const viewingCentral = warehouseTarget === "central";
  const selectedBranch = branches.find((b) => b.id === warehouseTarget);
  const warehouseOptions = useMemo(
    () => [{ value: "central", label: t("Markaziy ombor") }, ...branches.map((b) => ({ value: b.id, label: b.name }))],
    [branches, t]
  );
  const centralStocks = useMemo(() => products.filter((p) => p.stock > 0), [products]);
  const filteredBranchStocks = useMemo(() => {
    const q = branchQuery.trim().toLowerCase();
    if (!q) return branchStocks;
    return branchStocks.filter((s) => s.product?.name?.toLowerCase().includes(q) || s.product?.barcode?.includes(q));
  }, [branchQuery, branchStocks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold text-cocoa-900 sm:text-3xl">
            {viewingCentral ? t("Omborxona") : t("Omborxona (filial)")}
          </h1>
          <p className="mt-1 text-sm text-cocoa-600">
            {viewingCentral
              ? t("Zaxira va qoldiq nazorati")
              : `${t("Filial ombori")}: ${selectedBranch?.name ?? t("Filial tanlang")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {canSelectBranch ? (
            <div className="w-full min-w-[200px] max-w-xs">
              <Select
                label={t("Ombor filtri")}
                value={warehouseTarget}
                onChange={(e) => setWarehouseTarget(e.target.value)}
                options={warehouseOptions}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className={`grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 ${viewingCentral ? "lg:grid-cols-3" : "lg:grid-cols-3"}`}>
        {(viewingCentral ? centralMetricCards : branchMetricCards).map((card) => (
          <StatCard key={card.key} title={card.title} value={card.value} />
        ))}
      </div>

      {viewingCentral ? (
        <Card className="motion-safe:animate-fade-up">
          <div className="mb-4">
            <div className="text-sm font-semibold text-cocoa-800">{t("Mahsulotlar")}</div>
            <div className="text-xs text-cocoa-500">{t("Umumiy qoldiq")}</div>
          </div>
          {loading ? (
            <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
          ) : centralStocks.length === 0 ? (
            <div className="text-sm text-cocoa-600">{t("Hozircha yo'q.")}</div>
          ) : (
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
                  {centralStocks.map((product) => (
                    <tr key={product.id}>
                      <td className="font-semibold text-cocoa-900">{product.name}</td>
                      <td className="text-sm text-cocoa-700">{product.barcode ?? "-"}</td>
                      <td className="font-semibold text-cocoa-900">{formatDigitsWithSpaces(String(product.stock))}</td>
                      <td className="text-sm text-cocoa-700">
                        {formatDigitsWithSpaces(String(product.salePrice ?? product.price ?? 0))} so'm
                      </td>
                    </tr>
                  ))}
                </tbody>
              </T>
            </Table>
          )}
        </Card>
      ) : (
        <Card className="motion-safe:animate-fade-up">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-cocoa-800">{t("Omborxona (filial)")}</div>
              <div className="text-xs text-cocoa-500">{selectedBranch?.name ?? t("Filial tanlang")}</div>
            </div>
            <div className="w-full max-w-xs">
              <Input value={branchQuery} onChange={(e) => setBranchQuery(e.target.value)} placeholder={t("Qidirish")} />
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
          ) : filteredBranchStocks.length === 0 ? (
            <div className="text-sm text-cocoa-600">{t("Hozircha yo'q.")}</div>
          ) : (
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
                  {filteredBranchStocks.map((s) => (
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
          )}
        </Card>
      )}
    </div>
  );
}
