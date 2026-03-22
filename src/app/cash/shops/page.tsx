"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { shopsService } from "@/services/shops";
import { cashService } from "@/services/cash";
import { transfersService } from "@/services/transfers";
import { returnsService } from "@/services/returns";
import { ensureSeed } from "@/lib/seed";
import { formatDigitsWithSpaces, onlyDigits } from "@/lib/mask";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import type { CashEntry, PaymentMethod, Return, Shop, Transfer } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function resolveShopItemPrice(item: {
  unitPrice?: number | null;
  product?: { shopPrice?: number | null; salePrice?: number | null; price?: number | null } | null;
}) {
  return (
    item.unitPrice ??
    item.product?.shopPrice ??
    item.product?.salePrice ??
    item.product?.price ??
    0
  );
}

export default function CashShopsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    date: todayISO(),
    shopId: "",
    amount: "",
    paymentMethod: "CASH" as PaymentMethod,
    note: "",
  });

  const payOptions = useMemo(
    () => [
      { value: "CASH", label: t("Naqd") },
      { value: "CARD", label: t("Karta") },
      { value: "TRANSFER", label: t("O'tkazma") },
    ],
    [t]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    ensureSeed();
    try {
      const [shopList, cashList, transferList, returnList] = await Promise.all([
        shopsService.list(),
        cashService.list(),
        transfersService.list(),
        returnsService.list(),
      ]);
      setShops(shopList);
      setEntries(cashList.filter((entry) => entry.sourceType === "SHOP"));
      setTransfers(transferList);
      setReturns(returnList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    refresh();
  }, [refresh, user?.role]);

  useEffect(() => {
    if (shops.length === 0) return;
    setForm((prev) => ({ ...prev, shopId: prev.shopId || shops[0]?.id || "" }));
  }, [shops]);

  const shopMap = useMemo(() => new Map(shops.map((s) => [s.id, s.name])), [shops]);

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries]);

  const debtByShop = useMemo(() => {
    const transferSum = new Map<string, number>();
    transfers
      .filter((tr) => tr.targetType === "SHOP" && tr.status === "RECEIVED" && tr.shopId)
      .forEach((tr) => {
        const shopId = tr.shopId as string;
        const value = (tr.items ?? []).reduce((sum, item) => {
          return sum + resolveShopItemPrice(item) * item.quantity;
        }, 0);
        transferSum.set(shopId, (transferSum.get(shopId) ?? 0) + value);
      });

    const returnSum = new Map<string, number>();
    returns
      .filter((ret) => ret.sourceType === "SHOP" && ret.status === "APPROVED" && ret.shopId)
      .forEach((ret) => {
        const shopId = ret.shopId as string;
        const value = (ret.items ?? []).reduce((sum, item) => {
          return sum + resolveShopItemPrice(item) * item.quantity;
        }, 0);
        returnSum.set(shopId, (returnSum.get(shopId) ?? 0) + value);
      });

    const paymentSum = new Map<string, number>();
    entries.forEach((entry) => {
      const sourceId = entry.sourceId || entry.shopId;
      if (!sourceId) return;
      paymentSum.set(sourceId, (paymentSum.get(sourceId) ?? 0) + entry.amount);
    });

    const debt = new Map<string, number>();
    shops.forEach((shop) => {
      const shopId = shop.id;
      debt.set(shopId, (transferSum.get(shopId) ?? 0) - (returnSum.get(shopId) ?? 0) - (paymentSum.get(shopId) ?? 0));
    });

    return debt;
  }, [entries, returns, shops, transfers]);

  const selectedDebt = useMemo(() => {
    if (!form.shopId) return 0;
    return debtByShop.get(form.shopId) ?? 0;
  }, [debtByShop, form.shopId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.shopId) {
      toast.error(t("Xatolik"), t("Do'kon tanlang"));
      return;
    }
    const amountNum = Number(onlyDigits(form.amount));
    if (!amountNum || amountNum <= 0) {
      toast.error(t("Xatolik"), t("Summa 0 dan katta raqam bo'lsin"));
      return;
    }
    await cashService.create({
      date: form.date,
      sourceType: "SHOP",
      sourceId: form.shopId,
      amount: amountNum,
      paymentMethod: form.paymentMethod,
      note: form.note?.trim() || undefined,
    });
    toast.success(t("Saqlandi"));
    setForm({ date: todayISO(), shopId: form.shopId, amount: "", paymentMethod: "CASH", note: "" });
    await refresh();
  }

  async function remove(id: string) {
    await cashService.remove(id);
    toast.info(t("O'chirildi"));
    await refresh();
  }

  if (user?.role !== "ADMIN") {
    return (
      <Card>
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  const totalDebt = useMemo(
    () => Array.from(debtByShop.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0),
    [debtByShop],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cocoa-900">{t("Do'konlardan olish")}</h1>
          <p className="mt-0.5 text-sm text-cocoa-500">{t("Kassa — do'konlardan to'lov qabul qilish")}</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-cream-200 bg-white px-4 py-2.5 text-center shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-cocoa-400">{t("Jami olingan")}</div>
            <div className="mt-0.5 text-lg font-bold text-emerald-700">{moneyUZS(total)}</div>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-center shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">{t("Umumiy qarz")}</div>
            <div className="mt-0.5 text-lg font-bold text-red-700">{moneyUZS(totalDebt)}</div>
          </div>
        </div>
      </div>

      {/* Per-shop debt summary */}
      {shops.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-cocoa-400">{t("Do'konlar qarz holati")}</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shops.map((shop) => {
              const debt = debtByShop.get(shop.id) ?? 0;
              const isDebt = debt > 0;
              return (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, shopId: shop.id }))}
                  className={`rounded-xl border p-3 text-left transition hover:shadow-card-md ${
                    form.shopId === shop.id
                      ? "border-berry-700 bg-berry-50 ring-1 ring-berry-700"
                      : isDebt
                        ? "border-red-200 bg-red-50"
                        : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="truncate text-xs font-semibold text-cocoa-700">{shop.name}</div>
                  <div className={`mt-1 text-sm font-bold ${isDebt ? "text-red-700" : "text-emerald-700"}`}>
                    {moneyUZS(Math.abs(debt))}
                  </div>
                  <div className={`mt-0.5 text-[10px] font-medium ${isDebt ? "text-red-400" : "text-emerald-500"}`}>
                    {isDebt ? t("Qarz") : t("Ortiqcha")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entry form */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-cocoa-800">{t("Yangi to'lov qabul qilish")}</h3>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <Input
            label={t("Sana")}
            type="date"
            value={form.date}
            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
          />
          <Select
            label={t("Do'konlar")}
            value={form.shopId}
            onChange={(e) => setForm((prev) => ({ ...prev, shopId: e.target.value }))}
            options={shops.map((s) => ({ value: s.id, label: s.name }))}
          />
          <div>
            <Input label={t("Hozirgi qarz")} value={moneyUZS(selectedDebt)} readOnly />
            {selectedDebt > 0 && (
              <p className="mt-1 text-xs font-medium text-red-600">⚠ {t("Do'kon qarzdor")}</p>
            )}
          </div>
          <Input
            label={t("Summa (so'm) *")}
            inputMode="numeric"
            value={formatDigitsWithSpaces(form.amount)}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: onlyDigits(e.target.value) }))}
          />
          <Select
            label={t("To'lov turi")}
            value={form.paymentMethod}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value as PaymentMethod }))}
            options={payOptions}
          />
          <div className="md:col-span-2">
            <Textarea
              label={t("Izoh")}
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder={t("Masalan: do'kondan olingan to'lov")}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">{t("Saqlash")}</Button>
          </div>
        </form>
      </Card>

      {/* Entries table */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-cocoa-800">{t("To'lovlar tarixi")}</h3>
        {loading ? (
          <div className="py-6 text-center text-sm text-cocoa-400">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Sana")}</th>
                  <th>{t("Do'kon")}</th>
                  <th>{t("To'lov turi")}</th>
                  <th>{t("Summa")}</th>
                  <th>{t("Izoh")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-semibold">{safeDateLabel(entry.date)}</td>
                    <td>{shopMap.get(entry.sourceId) ?? "-"}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        entry.paymentMethod === "CASH"     ? "bg-emerald-50 text-emerald-700" :
                        entry.paymentMethod === "CARD"     ? "bg-blue-50 text-blue-700" :
                                                             "bg-amber-50 text-amber-700"
                      }`}>
                        {entry.paymentMethod === "CASH" ? t("Naqd") : entry.paymentMethod === "CARD" ? t("Karta") : t("O'tkazma")}
                      </span>
                    </td>
                    <td className="font-semibold text-emerald-700">{moneyUZS(entry.amount)}</td>
                    <td className="text-cocoa-500 text-sm">{entry.note ?? "—"}</td>
                    <td className="whitespace-nowrap">
                      <Button variant="danger" className="text-xs px-2 py-1" onClick={() => remove(entry.id)}>
                        {t("O'chirish")}
                      </Button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-cocoa-400">
                      {t("Hozircha to'lovlar yo'q.")}
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
