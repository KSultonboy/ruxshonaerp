"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import ProductCatalogModal from "@/components/logistics/ProductCatalogModal";
import { transfersService } from "@/services/transfers";
import { shopsService } from "@/services/shops";
import { productsService } from "@/services/products";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Product, Transfer } from "@/lib/types";
import Receipt from "@/components/pos/Receipt";
import { printCurrentWindowByMode } from "@/lib/desktop-printer";
import { moneyUZS } from "@/lib/format";

type ItemDraft = { id: string; barcode: string; productId: string; quantity: string };
type TransferReceiptData = {
  id: string;
  date: string;
  productName: string;
  quantity: number;
  fromBranch: string;
  toBranch: string;
  items: Array<{ name: string; quantity: number; price?: number }>;
  previousDebt?: number;
};

function createDraftRow(): ItemDraft {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    barcode: "",
    productId: "",
    quantity: "1",
  };
}

async function waitForNextPaint() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export default function TransferShopsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const canCreate =
    user?.role === "ADMIN" ||
    user?.role === "PRODUCTION" ||
    user?.role === "SALES" ||
    user?.role === "MANAGER";

  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [shopId, setShopId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([createDraftRow()]);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [originalItemsMap, setOriginalItemsMap] = useState<Map<string, number>>(new Map());
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastTransfer, setLastTransfer] = useState<TransferReceiptData | null>(null);
  const barcodeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submitInProgressRef = useRef(false);
  const [confirmPrintOpen, setConfirmPrintOpen] = useState(false);

  const productByBarcode = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => {
      if (product.barcode) map.set(String(product.barcode).trim(), product);
    });
    return map;
  }, [products]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const draftTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(productById.get(item.productId)?.shopPrice || 0);
      return sum + qty * price;
    }, 0);
  }, [items, productById]);

  function findInsufficientStock(payload: Array<{ productId: string; quantity: number }>) {
    const requestedByProduct = new Map<string, number>();
    payload.forEach((item) => {
      requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
    });

    return Array.from(requestedByProduct.entries())
      .map(([productId, requested]) => {
        const product = productById.get(productId);
        const stock = product?.stock ?? 0;
        const originalQty = originalItemsMap.get(productId) ?? 0;
        const needed = Math.max(0, requested - originalQty);
        return {
          productId,
          name: product?.name ?? productId,
          stock,
          requested,
          insufficient: needed > stock,
        };
      })
      .filter((item) => item.insufficient);
  }

  const refreshProducts = useCallback(async () => {
    const productList = await productsService.list();
    setProducts(productList);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, shopList, productList] = await Promise.all([
        transfersService.list(),
        shopsService.list(),
        productsService.list(),
      ]);
      setTransfers(list.filter((t) => t.targetType === "SHOP"));
      setShops(shopList.map((s) => ({ id: s.id, name: s.name })));
      setProducts(productList);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    requestAnimationFrame(() => barcodeRefs.current[0]?.focus());
  }, []);

  function focusBarcode(index: number) {
    requestAnimationFrame(() => barcodeRefs.current[index]?.focus());
  }

  function resolveBarcode(index: number, rawBarcode?: string) {
    const barcode = (rawBarcode ?? items[index]?.barcode ?? "").trim();
    if (!barcode) return;

    const product = productByBarcode.get(barcode);
    if (!product) {
      toast.error(t("Xatolik"), t("Mahsulot topilmadi"));
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const quantity = next[index].quantity?.trim() ? next[index].quantity : "1";
      next[index] = { ...next[index], barcode, productId: product.id, quantity };
      if (index === next.length - 1) next.push(createDraftRow());
      return next;
    });

    focusBarcode(index + 1);
  }

  function addFromCatalog(product: Product, quantity: number) {
    setItems((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex((row) => row.productId === product.id);
      if (existingIndex >= 0) {
        const currentQuantity = Number(next[existingIndex].quantity || 0);
        next[existingIndex] = {
          ...next[existingIndex],
          barcode: String(product.barcode ?? next[existingIndex].barcode ?? ""),
          quantity: String(currentQuantity + quantity),
        };
        return next;
      }

      next.push({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        barcode: String(product.barcode ?? ""),
        productId: product.id,
        quantity: String(quantity),
      });
      return next;
    });
  }

  async function submitTransfer(shouldPrintReceipt: boolean) {
    if (submitInProgressRef.current) return;
    if (!shopId) {
      toast.error(t("Xatolik"), t("Do'kon tanlang"));
      return;
    }

    const payload = items
      .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
      .filter((item) => item.productId && item.quantity > 0);

    if (payload.length === 0) {
      toast.error(t("Xatolik"), t("Mahsulot tanlang"));
      return;
    }

    const insufficient = findInsufficientStock(payload);
    if (insufficient.length > 0) {
      const details = insufficient.map((item) => `${item.name} (qoldiq: ${item.stock}, so'ralgan: ${item.requested})`).join("; ");
      toast.error(t("Xatolik"), `${t("Qoldiq yetarli emas")}: ${details}`);
      return;
    }

    submitInProgressRef.current = true;
    setLoading(true);
    try {
      // Avvalgi qarzni oldindan yuklash (transfer yozilishidan oldingi holat)
      let previousDebt: number | undefined;
      try {
        const debtInfo = await shopsService.getDebt(shopId);
        previousDebt = debtInfo.totalDebt ?? debtInfo.calculatedDebt;
      } catch { /* qarz ma'lumoti bo'lmasa chekda ko'rsatmaymiz */ }

      const savedTransfer = editingTransferId
        ? await transfersService.update(editingTransferId, { targetType: "SHOP", shopId, note, items: payload })
        : await transfersService.create({ targetType: "SHOP", shopId, note, items: payload });

      const receiptItems = payload.map((item) => {
        const product = productById.get(item.productId);
        return {
          name: product?.name ?? item.productId,
          quantity: item.quantity,
          price: product?.shopPrice ?? undefined,
        };
      });

      const totalQuantity = receiptItems.reduce((sum, item) => sum + item.quantity, 0);

      const receiptData: TransferReceiptData = {
        id: savedTransfer.id ?? String(Date.now()),
        date: savedTransfer.date ?? new Date().toLocaleString(),
        productName: receiptItems.map((item) => item.name).join(", "),
        quantity: totalQuantity,
        fromBranch: t("Markaziy Ombor"),
        toBranch: shops.find((item) => item.id === shopId)?.name ?? "-",
        items: receiptItems,
        previousDebt,
      };

      flushSync(() => {
        setLastTransfer(receiptData);
      });

      if (shouldPrintReceipt) {
        await waitForNextPaint();
        try {
          await printCurrentWindowByMode("RECEIPT");
        } catch (printError: unknown) {
          const message = printError instanceof Error ? printError.message : t("Chek chiqarilmadi");
          toast.error(t("Xatolik"), message);
        }
      }

      setShopId("");
      setNote("");
      setItems([createDraftRow()]);
      setEditingTransferId(null);
      setOriginalItemsMap(new Map());
      await refresh();
      toast.success(t("Saqlandi"));
      focusBarcode(0);
    } catch (error: any) {
      toast.error(t("Xatolik"), error?.message || t("Saqlab bo'lmadi"));
    } finally {
      submitInProgressRef.current = false;
      setLoading(false);
    }
  }

  if (!canCreate) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Transfer xizmati")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Do'konlarga")}</p>
      </div>

      <Card className="motion-safe:animate-fade-up print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full md:w-64">
            <Select
              label={t("Do'konlar")}
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              options={[{ value: "", label: t("Do'konlar") }, ...shops.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>
          <div className="w-full md:flex-1">
            <Input label={t("Izoh")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Ixtiyoriy...")} />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((row, index) => {
            const selectedProduct = productById.get(row.productId);
            return (
              <div key={row.id} className="flex min-w-0 items-end gap-2">
                <div className="min-w-0 flex-[3]">
                  <Input
                    ref={(el) => {
                      barcodeRefs.current[index] = el;
                    }}
                    label={t("Barcode")}
                    value={row.barcode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setItems((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], barcode: value };
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        resolveBarcode(index, e.currentTarget.value);
                      }
                    }}
                    placeholder={t("Barcode ni skan qiling")}
                  />
                </div>

                <div className="min-w-0 flex-[3]">
                  <Input label={t("Mahsulot")} value={selectedProduct?.name ?? ""} readOnly placeholder={t("Scan qiling...")} />
                </div>

                <div className="min-w-0 flex-[2]">
                  <Input label={t("Qoldiq")} value={String(selectedProduct?.stock ?? 0)} readOnly />
                </div>

                <div className="w-28 shrink-0 rounded-xl border border-amber-300 bg-amber-50 p-1">
                  <Input
                    label={t("Miqdor")}
                    value={row.quantity}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...row, quantity: e.target.value };
                      setItems(next);
                    }}
                    placeholder={t("Masalan: 5")}
                    inputMode="numeric"
                  />
                </div>

                <div className="shrink-0">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const next = items.filter((_, i) => i !== index);
                      setItems(next.length ? next : [createDraftRow()]);
                    }}
                  >
                    {t("Delete")}
                  </Button>
                </div>
              </div>
            );
          })}

          <Button
            variant="ghost"
            onClick={() => {
              setItems((prev) => [...prev, createDraftRow()]);
              focusBarcode(items.length);
            }}
          >
            {t("+ Qo'shish")}
          </Button>

          <Button variant="ghost" onClick={() => setSearchOpen(true)}>
            {t("Katalogdan qidirish")}
          </Button>

          <Button variant="ghost" onClick={() => refreshProducts().catch(() => undefined)}>
            {t("Qoldiqni yangilash")}
          </Button>
        </div>

        {draftTotal > 0 && (
          <div className="mt-3 flex items-center justify-end gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">{t("Jami summa")}:</span>
            <span className="text-lg font-bold text-emerald-700">{moneyUZS(draftTotal)}</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            disabled={loading}
            onClick={() => setConfirmPrintOpen(true)}
          >
            {editingTransferId ? t("Tahrirlashni saqlash") : t("Saqlash")}
          </Button>

          {editingTransferId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingTransferId(null);
                setOriginalItemsMap(new Map());
                setShopId("");
                setNote("");
                setItems([createDraftRow()]);
                focusBarcode(0);
              }}
            >
              {t("Bekor")}
            </Button>
          ) : null}
        </div>
      </Card>

      <Modal title={t("Chek chiqarilsinmi?")} open={confirmPrintOpen} onClose={() => setConfirmPrintOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-cocoa-700">{t("Saqlangandan keyin chek chiqarilsinmi?")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => {
                setConfirmPrintOpen(false);
                void submitTransfer(false);
              }}
            >
              {t("Yo'q")}
            </Button>
            <Button
              disabled={loading}
              onClick={() => {
                setConfirmPrintOpen(false);
                void submitTransfer(true);
              }}
            >
              {t("Ha")}
            </Button>
          </div>
        </div>
      </Modal>

      {lastTransfer && (
        <div className="hidden print:block">
          <Receipt type="TRANSFER" data={lastTransfer} />
        </div>
      )}

      <Card className="motion-safe:animate-fade-up anim-delay-150 print:hidden">
        <Table>
          <T>
            <thead>
              <tr>
                <th>{t("Sana")}</th>
                <th>{t("Do'konlar")}</th>
                <th>{t("Status")}</th>
                <th>{t("Mahsulotlar")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td>{transfer.date}</td>
                  <td>{transfer.shop?.name || "-"}</td>
                  <td>{transfer.status}</td>
                  <td className="text-sm text-cocoa-700">
                    {transfer.items.map((item) => `${item.product?.name ?? item.productId} × ${item.quantity}`).join(", ")}
                  </td>
                  <td className="whitespace-nowrap">
                    {canCreate &&
                    (transfer.status === "PENDING" ||
                      (transfer.targetType === "SHOP" && transfer.status === "RECEIVED")) ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingTransferId(transfer.id);
                            setShopId(transfer.shopId ?? "");
                            setNote(transfer.note ?? "");
                            const origMap = new Map<string, number>();
                            transfer.items.forEach((item) => {
                              origMap.set(item.productId, (origMap.get(item.productId) ?? 0) + item.quantity);
                            });
                            setOriginalItemsMap(origMap);
                            setItems(
                              transfer.items.map((item) => ({
                                id: item.id,
                                barcode: String(item.product?.barcode ?? ""),
                                productId: item.productId,
                                quantity: String(item.quantity),
                              }))
                            );
                            focusBarcode(0);
                          }}
                        >
                          {t("Tahrir")}
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={async () => {
                            if (!window.confirm(t("Rostdan ham o'chirmoqchimisiz?"))) return;
                            try {
                              await transfersService.remove(transfer.id);
                              if (editingTransferId === transfer.id) {
                                setEditingTransferId(null);
                                setOriginalItemsMap(new Map());
                                setShopId("");
                                setNote("");
                                setItems([createDraftRow()]);
                              }
                              await refresh();
                              toast.success(t("Saqlandi"));
                            } catch (e: any) {
                              toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
                            }
                          }}
                        >
                          {t("Delete")}
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}

              {transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-sm text-cocoa-600">
                    {t("Hozircha yo'q.")}
                  </td>
                </tr>
              )}
            </tbody>
          </T>
        </Table>
      </Card>

      <ProductCatalogModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
        title={t("Mahsulot qidirish")}
        onAdd={(product, quantity) => addFromCatalog(product, quantity)}
        onRefresh={refreshProducts}
      />
    </div>
  );
}
