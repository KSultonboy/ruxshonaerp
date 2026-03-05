"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import ProductCatalogModal from "@/components/logistics/ProductCatalogModal";
import { returnsService } from "@/services/returns";
import { shopsService } from "@/services/shops";
import { productsService } from "@/services/products";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Product, Return } from "@/lib/types";
import Receipt from "@/components/pos/Receipt";
import { printCurrentWindowByMode } from "@/lib/desktop-printer";

type ItemDraft = { id: string; productId: string; quantity: string };
type ReturnReceiptData = {
  id: string;
  date: string;
  productName: string;
  quantity: number;
  sourceLabel: string;
  sourceName: string;
  items: Array<{ name: string; quantity: number }>;
};

function createDraftRow(): ItemDraft {
  return { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, productId: "", quantity: "" };
}

async function waitForNextPaint() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export default function ReturnsShopsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const isAdmin = user?.role === "ADMIN";
  const canAccess = user?.role === "ADMIN" || user?.role === "PRODUCTION";

  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [shopId, setShopId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([createDraftRow()]);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastReturn, setLastReturn] = useState<ReturnReceiptData | null>(null);

  const productOptions = useMemo(() => products.map((p) => ({ value: p.id, label: p.name })), [products]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, shopList, productList] = await Promise.all([
        returnsService.list(),
        shopsService.list(),
        productsService.list(),
      ]);
      setReturns(list.filter((r) => r.sourceType === "SHOP"));
      setShops(shopList.map((s) => ({ id: s.id, name: s.name })));
      setProducts(productList);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (canAccess) refresh();
  }, [canAccess, refresh]);

  if (!canAccess) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  function addFromCatalog(product: Product, quantity: number) {
    setItems((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex((row) => row.productId === product.id);
      if (existingIndex >= 0) {
        const currentQuantity = Number(next[existingIndex].quantity || 0);
        next[existingIndex] = { ...next[existingIndex], quantity: String(currentQuantity + quantity) };
        return next;
      }

      next.push({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        productId: product.id,
        quantity: String(quantity),
      });
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Vazvrat")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Do'konlardan")}</p>
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
          {items.map((row, index) => (
            <div key={row.id} className="flex flex-wrap items-end gap-3">
              <div className="w-full md:w-80">
                <Select
                  label={t("Mahsulot")}
                  value={row.productId}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = { ...row, productId: e.target.value };
                    setItems(next);
                  }}
                  options={[{ value: "", label: t("Mahsulot tanlang") }, ...productOptions]}
                />
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
          ))}
          <Button variant="ghost" onClick={() => setItems((prev) => [...prev, createDraftRow()])}>
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
              if (!shopId) {
                toast.error(t("Xatolik"), t("Do'kon tanlang"));
                return;
              }

              const payload = items
                .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }))
                .filter((i) => i.productId && i.quantity > 0);

              if (payload.length === 0) {
                toast.error(t("Xatolik"), t("Mahsulot tanlang"));
                return;
              }

              setLoading(true);
              try {
                const savedReturn = editingReturnId
                  ? await returnsService.update(editingReturnId, { sourceType: "SHOP", shopId, note, items: payload })
                  : await returnsService.create({ sourceType: "SHOP", shopId, note, items: payload });

                const receiptItems = payload.map((item) => ({
                  name: products.find((p) => p.id === item.productId)?.name ?? item.productId,
                  quantity: item.quantity,
                }));
                const totalQuantity = receiptItems.reduce((sum, item) => sum + item.quantity, 0);
                const receiptData: ReturnReceiptData = {
                  id: savedReturn.id ?? String(Date.now()),
                  date: savedReturn.date ?? new Date().toLocaleString(),
                  productName: receiptItems.map((i) => i.name).join(", "),
                  quantity: totalQuantity,
                  sourceLabel: t("Do'kon"),
                  sourceName: shops.find((x) => x.id === shopId)?.name ?? "-",
                  items: receiptItems,
                };

                flushSync(() => {
                  setLastReturn(receiptData);
                });

                await waitForNextPaint();
                try {
                  await printCurrentWindowByMode("RECEIPT");
                } catch (printError: unknown) {
                  const message = printError instanceof Error ? printError.message : t("Chek chiqarilmadi");
                  toast.error(t("Xatolik"), message);
                }

                setShopId("");
                setNote("");
                setItems([createDraftRow()]);
                setEditingReturnId(null);
                await refresh();
                toast.success(t("Saqlandi"));
              } catch (e: any) {
                toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
              } finally {
                setLoading(false);
              }
            }}
          >
            {editingReturnId ? t("Tahrirlashni saqlash") : t("Saqlash")}
          </Button>

          {editingReturnId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingReturnId(null);
                setShopId("");
                setNote("");
                setItems([createDraftRow()]);
              }}
            >
              {t("Bekor")}
            </Button>
          ) : null}
        </div>
      </Card>

      {lastReturn && (
        <div className="hidden print:block">
          <Receipt type="RETURN" data={lastReturn} />
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
              {returns.map((ret) => (
                <tr key={ret.id}>
                  <td>{ret.date}</td>
                  <td>{ret.shop?.name || "-"}</td>
                  <td>{ret.status}</td>
                  <td className="text-sm text-cocoa-700">
                    {ret.items.map((item) => `${item.product?.name ?? item.productId} × ${item.quantity}`).join(", ")}
                  </td>
                  <td className="whitespace-nowrap">
                    {isAdmin && ret.status === "PENDING" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingReturnId(ret.id);
                            setShopId(ret.shopId ?? "");
                            setNote(ret.note ?? "");
                            setItems(
                              ret.items.map((item) => ({
                                id: item.id,
                                productId: item.productId,
                                quantity: String(item.quantity),
                              }))
                            );
                          }}
                        >
                          {t("Tahrir")}
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={async () => {
                            if (!window.confirm(t("Rostdan ham o'chirmoqchimisiz?"))) return;
                            try {
                              await returnsService.remove(ret.id);
                              if (editingReturnId === ret.id) {
                                setEditingReturnId(null);
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

                        <Button
                          onClick={async () => {
                            try {
                              await returnsService.approve(ret.id);
                              await refresh();
                              toast.success(t("Saqlandi"));
                            } catch (e: any) {
                              toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
                            }
                          }}
                        >
                          {t("Saqlash")}
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await returnsService.reject(ret.id);
                              await refresh();
                            } catch (e: any) {
                              toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
                            }
                          }}
                        >
                          {t("Bekor")}
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}

              {returns.length === 0 && (
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
