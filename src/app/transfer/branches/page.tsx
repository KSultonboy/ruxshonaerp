"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import ProductCatalogModal from "@/components/logistics/ProductCatalogModal";
import { transfersService } from "@/services/transfers";
import { branchesService } from "@/services/branches";
import { productsService } from "@/services/products";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Product, Transfer } from "@/lib/types";
import Receipt from "@/components/pos/Receipt";
import { printCurrentWindowByMode } from "@/lib/desktop-printer";

type ItemDraft = { id: string; barcode: string; productId: string; quantity: string };
type TransferReceiptData = {
  id: string;
  date: string;
  productName: string;
  quantity: number;
  fromBranch: string;
  toBranch: string;
  items: Array<{ name: string; quantity: number }>;
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

export default function TransferBranchesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const isSales = user?.role === "SALES";
  const canCreate = user?.role === "ADMIN" || user?.role === "PRODUCTION";

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branchId, setBranchId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([createDraftRow()]);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastTransfer, setLastTransfer] = useState<TransferReceiptData | null>(null);
  const barcodeRefs = useRef<Array<HTMLInputElement | null>>([]);

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

  function findInsufficientStock(payload: Array<{ productId: string; quantity: number }>) {
    const requestedByProduct = new Map<string, number>();
    payload.forEach((item) => {
      requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
    });

    return Array.from(requestedByProduct.entries())
      .map(([productId, requested]) => {
        const product = productById.get(productId);
        const stock = product?.stock ?? 0;
        return {
          productId,
          name: product?.name ?? productId,
          stock,
          requested,
          insufficient: requested > stock,
        };
      })
      .filter((item) => item.insufficient);
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, branchesList, productList] = await Promise.all([
        transfersService.list(),
        branchesService.list(),
        productsService.list(),
      ]);
      setTransfers(list.filter((x) => x.targetType === "BRANCH"));
      setBranches(branchesList.map((b) => ({ id: b.id, name: b.name })));
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

  function focusBarcode(index: number) {
    requestAnimationFrame(() => barcodeRefs.current[index]?.focus());
  }

  useEffect(() => {
    focusBarcode(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Transfer xizmati")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Filiallarga")}</p>
      </div>

      {canCreate ? (
        <Card className="motion-safe:animate-fade-up print:hidden">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full md:w-64">
              <Select
                label={t("Filiallar")}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                options={[{ value: "", label: t("Filiallar") }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
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
                <div key={row.id} className="flex flex-wrap items-end gap-3">
                  <div className="w-full md:w-80">
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
                  <div className="w-full md:w-72">
                    <Input label={t("Mahsulot")} value={selectedProduct?.name ?? ""} readOnly placeholder={t("Scan qiling...")} />
                  </div>
                  <div className="w-full md:w-44">
                    <Input label={t("Qoldiq")} value={String(selectedProduct?.stock ?? 0)} readOnly />
                  </div>
                  <div className="w-full md:w-40">
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
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={loading}
              onClick={async () => {
                if (!branchId) {
                  toast.error(t("Xatolik"), t("Filial tanlang"));
                  return;
                }

                const payload = items
                  .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }))
                  .filter((i) => i.productId && i.quantity > 0);

                if (payload.length === 0) {
                  toast.error(t("Xatolik"), t("Mahsulot tanlang"));
                  return;
                }

                const insufficient = findInsufficientStock(payload);
                if (insufficient.length > 0) {
                  const details = insufficient.map((x) => `${x.name} (qoldiq: ${x.stock}, so'ralgan: ${x.requested})`).join("; ");
                  toast.error(t("Xatolik"), `${t("Qoldiq yetarli emas")}: ${details}`);
                  return;
                }

                setLoading(true);
                try {
                  const savedTransfer = editingTransferId
                    ? await transfersService.update(editingTransferId, { targetType: "BRANCH", branchId, note, items: payload })
                    : await transfersService.create({ targetType: "BRANCH", branchId, note, items: payload });

                  const receiptItems = payload.map((item) => ({
                    name: productById.get(item.productId)?.name ?? item.productId,
                    quantity: item.quantity,
                  }));

                  const totalQuantity = receiptItems.reduce((sum, item) => sum + item.quantity, 0);
                  const receiptData: TransferReceiptData = {
                    id: savedTransfer.id ?? String(Date.now()),
                    date: savedTransfer.date ?? new Date().toLocaleString(),
                    productName: receiptItems.map((i) => i.name).join(", "),
                    quantity: totalQuantity,
                    fromBranch: t("Markaziy Ombor"),
                    toBranch: branches.find((x) => x.id === branchId)?.name ?? "-",
                    items: receiptItems,
                  };

                  flushSync(() => {
                    setLastTransfer(receiptData);
                  });

                  await waitForNextPaint();
                  try {
                    await printCurrentWindowByMode("RECEIPT");
                  } catch (printError: unknown) {
                    const message = printError instanceof Error ? printError.message : t("Chek chiqarilmadi");
                    toast.error(t("Xatolik"), message);
                  }

                  setBranchId("");
                  setNote("");
                  setItems([createDraftRow()]);
                  setEditingTransferId(null);
                  await refresh();
                  toast.success(t("Saqlandi"));
                  focusBarcode(0);
                } catch (e: any) {
                  toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {editingTransferId ? t("Tahrirlashni saqlash") : t("Saqlash")}
            </Button>

            {editingTransferId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingTransferId(null);
                  setBranchId("");
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
      ) : null}

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
                <th>{t("Filiallar")}</th>
                <th>{t("Status")}</th>
                <th>{t("Mahsulotlar")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td>{transfer.date}</td>
                  <td>{transfer.branch?.name || "-"}</td>
                  <td>{transfer.status}</td>
                  <td className="text-sm text-cocoa-700">
                    {transfer.items.map((item) => `${item.product?.name ?? item.productId} × ${item.quantity}`).join(", ")}
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      {canCreate && transfer.status === "PENDING" ? (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditingTransferId(transfer.id);
                              setBranchId(transfer.branchId ?? "");
                              setNote(transfer.note ?? "");
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
                                  setBranchId("");
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
                        </>
                      ) : null}

                      {isSales && transfer.status === "PENDING" ? (
                        <Button
                          onClick={async () => {
                            try {
                              await transfersService.receive(transfer.id);
                              await refresh();
                              toast.success(t("Saqlandi"));
                            } catch (e: any) {
                              toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
                            }
                          }}
                        >
                          {t("Qabul qilish")}
                        </Button>
                      ) : null}
                    </div>
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
      />
    </div>
  );
}
