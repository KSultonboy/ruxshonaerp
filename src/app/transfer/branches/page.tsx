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
import { branchesService } from "@/services/branches";
import { productsService } from "@/services/products";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Product, Transfer, TransferStatus } from "@/lib/types";
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

const RECEIVED_TRANSFER_SPECIAL_CODE = "2112";

export default function TransferBranchesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const isSales = user?.role === "SALES" || user?.role === "MANAGER";
  const canCreate = user?.role === "ADMIN" || user?.role === "PRODUCTION" || isSales;

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branchId, setBranchId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([createDraftRow()]);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [editingTransferStatus, setEditingTransferStatus] = useState<TransferStatus | null>(null);
  const [editingSpecialCode, setEditingSpecialCode] = useState<string | null>(null);
  const [originalItemsMap, setOriginalItemsMap] = useState<Map<string, number>>(new Map());
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastTransfer, setLastTransfer] = useState<TransferReceiptData | null>(null);
  const [confirmPrintOpen, setConfirmPrintOpen] = useState(false);
  const barcodeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submitInProgressRef = useRef(false);

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
      const price = Number(productById.get(item.productId)?.price || 0);
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
        // Edit rejimida: avvalgi miqdor stokdan allaqachon ayrilgan,
        // shuning uchun faqat delta (yangi - eski) qo'shimcha stok talab qiladi
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

  async function submitTransfer(shouldPrintReceipt: boolean) {
    if (submitInProgressRef.current) return;
    if (!branchId) {
      toast.error(t("Xatolik"), t("Filial tanlang"));
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
      const updateSpecialCode = editingTransferStatus === "RECEIVED" ? editingSpecialCode ?? undefined : undefined;
      if (editingTransferStatus === "RECEIVED" && updateSpecialCode !== RECEIVED_TRANSFER_SPECIAL_CODE) {
        toast.error(t("Xatolik"), t("Maxsus kod noto'g'ri"));
        return;
      }
      const savedTransfer = editingTransferId
        ? await transfersService.update(editingTransferId, {
            targetType: "BRANCH",
            branchId,
            note,
            items: payload,
            ...(updateSpecialCode ? { specialCode: updateSpecialCode } : {}),
          })
        : await transfersService.create({ targetType: "BRANCH", branchId, note, items: payload });

      const receiptItems = payload.map((item) => {
        const product = productById.get(item.productId);
        return {
          name: product?.name ?? item.productId,
          quantity: item.quantity,
          price: product?.price ?? undefined,
        };
      });

      const totalQuantity = receiptItems.reduce((sum, item) => sum + item.quantity, 0);
      const receiptData: TransferReceiptData = {
        id: savedTransfer.id ?? String(Date.now()),
        date: savedTransfer.date ?? new Date().toLocaleString(),
        productName: receiptItems.map((item) => item.name).join(", "),
        quantity: totalQuantity,
        fromBranch: t("Markaziy Ombor"),
        toBranch: branches.find((item) => item.id === branchId)?.name ?? "-",
        items: receiptItems,
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

      setBranchId("");
      setNote("");
      setItems([createDraftRow()]);
      setEditingTransferId(null);
      setEditingTransferStatus(null);
      setEditingSpecialCode(null);
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
                  setEditingTransferStatus(null);
                  setEditingSpecialCode(null);
                  setOriginalItemsMap(new Map());
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
                      {canCreate && (transfer.status === "PENDING" || transfer.status === "RECEIVED") ? (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              if (transfer.status === "RECEIVED") {
                                const code = window.prompt(t("Maxsus kodni kiriting"), "")?.trim() ?? "";
                                if (!code) return;
                                if (code !== RECEIVED_TRANSFER_SPECIAL_CODE) {
                                  toast.error(t("Xatolik"), t("Maxsus kod noto'g'ri"));
                                  return;
                                }
                                setEditingSpecialCode(code);
                              } else {
                                setEditingSpecialCode(null);
                              }
                              setEditingTransferId(transfer.id);
                              setEditingTransferStatus(transfer.status);
                              setBranchId(transfer.branchId ?? "");
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
                                let specialCode: string | undefined;
                                if (transfer.status === "RECEIVED") {
                                  specialCode = window.prompt(t("Maxsus kodni kiriting"), "")?.trim() ?? "";
                                  if (!specialCode) return;
                                  if (specialCode !== RECEIVED_TRANSFER_SPECIAL_CODE) {
                                    toast.error(t("Xatolik"), t("Maxsus kod noto'g'ri"));
                                    return;
                                  }
                                }
                                await transfersService.remove(transfer.id, specialCode);
                                if (editingTransferId === transfer.id) {
                                  setEditingTransferId(null);
                                  setEditingTransferStatus(null);
                                  setEditingSpecialCode(null);
                                  setOriginalItemsMap(new Map());
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
        onRefresh={refreshProducts}
      />
    </div>
  );
}
