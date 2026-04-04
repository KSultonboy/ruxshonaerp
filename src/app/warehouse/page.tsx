"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
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

  // Qoldiq tuzatish state
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const adjustInputRef = useRef<HTMLInputElement>(null);

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

  function openAdjust(product: Product) {
    setAdjustProduct(product);
    setAdjustQty(String(product.stock));
    setAdjustNote("");
    setTimeout(() => adjustInputRef.current?.select(), 80);
  }

  async function handleAdjustSave() {
    if (!adjustProduct) return;
    const newQty = parseFloat(adjustQty);
    if (isNaN(newQty) || newQty < 0) {
      toast.error(t("Xatolik"), t("Miqdor noto'g'ri kiritilgan"));
      return;
    }
    setAdjustSaving(true);
    try {
      await warehouseService.adjustStock(adjustProduct.id, newQty, adjustNote || undefined);
      toast.success(t("Saqlandi"), `${adjustProduct.name}: ${adjustProduct.stock} → ${newQty}`);
      setAdjustProduct(null);
      await loadCentral();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlashda xatolik"));
    } finally {
      setAdjustSaving(false);
    }
  }

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
                    {role === "ADMIN" ? <th /> : null}
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
                      {role === "ADMIN" ? (
                        <td>
                          <button
                            onClick={() => openAdjust(product)}
                            title={t("Qoldiqni tuzatish")}
                            className="rounded-lg p-1.5 text-cocoa-400 transition hover:bg-cream-100 hover:text-berry-700"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </td>
                      ) : null}
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

      {/* Qoldiq tuzatish modal */}
      <Modal
        title={t("Qoldiqni tuzatish")}
        open={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
      >
        {adjustProduct && (
          <div className="space-y-4">
            <div className="rounded-xl bg-cream-100 px-4 py-3">
              <p className="text-xs text-cocoa-500">{t("Mahsulot")}</p>
              <p className="font-semibold text-cocoa-900">{adjustProduct.name}</p>
              <p className="mt-0.5 text-sm text-cocoa-600">
                {t("Hozirgi qoldiq")}:{" "}
                <span className="font-semibold text-cocoa-800">
                  {formatDigitsWithSpaces(String(adjustProduct.stock))}
                </span>
              </p>
            </div>

            <Input
              ref={adjustInputRef}
              label={t("Yangi qoldiq miqdori")}
              type="number"
              min="0"
              step="any"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdjustSave(); }}
            />

            <Input
              label={t("Izoh (ixtiyoriy)")}
              placeholder={t("Inventarizatsiya tuzatish")}
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
            />

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleAdjustSave}
                disabled={adjustSaving || adjustQty === ""}
                className="flex-1"
              >
                {adjustSaving ? t("Saqlanmoqda...") : t("Saqlash")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setAdjustProduct(null)}
                disabled={adjustSaving}
              >
                {t("Bekor")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
