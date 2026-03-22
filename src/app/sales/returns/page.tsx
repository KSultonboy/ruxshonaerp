"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { branchesService } from "@/services/branches";
import { returnsService } from "@/services/returns";
import { salesService } from "@/services/sales";
import type { Branch, BranchStock } from "@/lib/types";
import { onlyDigits } from "@/lib/mask";

type ReturnItemDraft = { id: string; barcode: string; productId: string; quantity: string };

function createDraftRow(): ReturnItemDraft {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    barcode: "",
    productId: "",
    quantity: "1",
  };
}

export default function SalesReturnsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();

  const [branchId, setBranchId] = useState<string | undefined>(user?.branchId ?? undefined);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stocks, setStocks] = useState<BranchStock[]>([]);
  const [items, setItems] = useState<ReturnItemDraft[]>([createDraftRow()]);
  const canChooseBranch = user?.role === "ADMIN";
  const barcodeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const stockByBarcode = useMemo(() => {
    const map = new Map<string, BranchStock>();
    stocks.forEach((stock) => {
      const code = stock.product?.barcode;
      if (code) map.set(String(code).trim(), stock);
    });
    return map;
  }, [stocks]);

  useEffect(() => {
    if (canChooseBranch) {
      branchesService.list().then((list) => {
        setBranches(list);
        if (!branchId && list[0]) setBranchId(list[0].id);
      });
    }
  }, [branchId, canChooseBranch]);

  useEffect(() => {
    async function load() {
      if (!branchId) return;
      const res = await salesService.branchStock(branchId);
      setStocks(res);
    }
    load();
  }, [branchId]);

  useEffect(() => {
    requestAnimationFrame(() => barcodeRefs.current[0]?.focus());
  }, []);

  function focusBarcode(index: number) {
    requestAnimationFrame(() => barcodeRefs.current[index]?.focus());
  }

  function resolveBarcode(index: number, rawBarcode?: string) {
    const barcode = (rawBarcode ?? items[index]?.barcode ?? "").trim();
    if (!barcode) return;

    const stock = stockByBarcode.get(barcode);
    if (!stock) {
      toast.error(t("Xatolik"), t("Mahsulot topilmadi"));
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const qty = next[index].quantity?.trim() ? next[index].quantity : "1";
      next[index] = { ...next[index], barcode, productId: stock.productId, quantity: qty };
      if (index === next.length - 1) {
        next.push(createDraftRow());
      }
      return next;
    });

    focusBarcode(index + 1);
  }

  async function submit() {
    const payload = items
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }))
      .filter((i) => i.productId && i.quantity > 0);
    if (payload.length === 0) {
      toast.error(t("Xatolik"), t("Mahsulot tanlang"));
      return;
    }
    try {
      await returnsService.create({
        sourceType: "BRANCH",
        branchId: branchId,
        items: payload,
      });
      toast.success(t("Yuborildi"));
      setItems([createDraftRow()]);
      focusBarcode(0);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Vazvrat yuborish")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Filiallarga")}</p>
      </div>

      <Card className="space-y-4">
        {canChooseBranch ? (
          <Select
            label={t("Filiallar")}
            value={branchId ?? ""}
            onChange={(e) => setBranchId(e.target.value)}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        ) : null}

        <div className="space-y-3">
          {items.map((row, index) => {
            const stock = stocks.find((s) => s.productId === row.productId);
            return (
              <div key={row.id} className="flex flex-wrap items-end gap-3">
                <div className="w-full md:w-72">
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
                  <Input
                    label={t("Mahsulot")}
                    value={stock?.product?.name ?? ""}
                    readOnly
                    placeholder={t("Scan qiling...")}
                  />
                </div>
                <div className="w-full md:w-44">
                  <Input label={t("Qoldiq")} value={String(stock?.quantity ?? 0)} readOnly />
                </div>
                <div className="w-full md:w-40">
                  <Input
                    label={t("Miqdor")}
                    value={row.quantity}
                    inputMode="numeric"
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...row, quantity: onlyDigits(e.target.value) };
                      setItems(next);
                    }}
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
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setItems([createDraftRow()]);
              focusBarcode(0);
            }}
          >
            {t("Bekor")}
          </Button>
          <Button onClick={submit}>{t("Tasdiqlash")}</Button>
        </div>
      </Card>
    </div>
  );
}
