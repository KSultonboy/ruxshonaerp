"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LineChart from "@/components/ui/LineChart";
import { Table, T } from "@/components/ui/Table";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { shopsService } from "@/services/shops";
import { transfersService } from "@/services/transfers";
import { returnsService } from "@/services/returns";
import { cashService } from "@/services/cash";
import { moneyUZS } from "@/lib/format";
import type { Product, Return, Shop, Transfer, CashEntry } from "@/lib/types";

type ShopRow = {
  shop: Shop;
  transferSum: number;
  returnSum: number;
  paidSum: number;
  debt: number;
};

function resolveShopItemPrice(item: {
  unitPrice?: number | null;
  product?: Product | null;
}) {
  return (
    item.unitPrice ??
    item.product?.shopPrice ??
    item.product?.salePrice ??
    item.product?.price ??
    0
  );
}

function sumItems(
  items: { quantity: number; unitPrice?: number | null; product?: Product | null }[],
) {
  return items.reduce(
    (sum, item) => sum + item.quantity * resolveShopItemPrice(item),
    0,
  );
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function DashboardShopsPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [shops, setShops] = useState<Shop[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [payments, setPayments] = useState<CashEntry[]>([]);
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const today = isoToday();
  const chartDates = useMemo(() => {
    const days = 30;
    return Array.from({ length: days }, (_, i) => isoDaysAgo(days - 1 - i));
  }, [today]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [shopList, transferList, returnList, paymentList] = await Promise.all([
        shopsService.list(),
        transfersService.list(),
        returnsService.list(),
        cashService.list(),
      ]);
      setShops(shopList);
      setTransfers(transferList);
      setReturns(returnList);
      setPayments(paymentList.filter((entry) => entry.sourceType === "SHOP"));
    } catch (e: any) {
      setErr(e?.message || t("Noma'lum xatolik"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    refresh();
  }, [refresh, user?.role]);

  useEffect(() => {
    if (!shops.length) return;
    setSelectedShopIds((prev) => {
      const available = new Set(shops.map((s) => s.id));
      const next = prev.filter((id) => available.has(id));
      return next.length ? next : shops.map((s) => s.id);
    });
  }, [shops]);

  const rows = useMemo<ShopRow[]>(() => {
    const transferSum = new Map<string, number>();
    transfers
      .filter((tr) => tr.targetType === "SHOP" && tr.shopId && tr.status === "RECEIVED")
      .forEach((tr) => {
        const sum = sumItems(tr.items ?? []);
        transferSum.set(tr.shopId as string, (transferSum.get(tr.shopId as string) ?? 0) + sum);
      });

    const returnSum = new Map<string, number>();
    returns
      .filter((ret) => ret.sourceType === "SHOP" && ret.shopId && ret.status === "APPROVED")
      .forEach((ret) => {
        const sum = sumItems(ret.items ?? []);
        returnSum.set(ret.shopId as string, (returnSum.get(ret.shopId as string) ?? 0) + sum);
      });

    const paidSum = new Map<string, number>();
    payments.forEach((payment) => {
      if (payment.sourceType !== "SHOP") return;
      paidSum.set(payment.sourceId, (paidSum.get(payment.sourceId) ?? 0) + payment.amount);
    });

    return shops.map((shop) => {
      const transferTotal = transferSum.get(shop.id) ?? 0;
      const returnTotal = returnSum.get(shop.id) ?? 0;
      const paid = paidSum.get(shop.id) ?? 0;
      const debt = (shop.initialDebt ?? 0) + transferTotal - returnTotal - paid;
      return {
        shop,
        transferSum: transferTotal,
        returnSum: returnTotal,
        paidSum: paid,
        debt,
      };
    });
  }, [payments, shops, returns, transfers]);

  const shopChartSeries = useMemo(() => {
    const colorPalette = ["#8F1D1D", "#B64242", "#E07A5F", "#7F5539", "#52796F", "#2A9D8F"];
    const transferMap = new Map<string, Map<string, number>>();
    transfers
      .filter((tr) => tr.targetType === "SHOP" && tr.shopId && tr.status === "RECEIVED")
      .forEach((tr) => {
        const sum = sumItems(tr.items ?? []);
        if (!chartDates.includes(tr.date)) return;
        const shopMap = transferMap.get(tr.shopId as string) ?? new Map<string, number>();
        shopMap.set(tr.date, (shopMap.get(tr.date) ?? 0) + sum);
        transferMap.set(tr.shopId as string, shopMap);
      });

    return selectedShopIds
      .map((id, idx) => {
        const shop = shops.find((s) => s.id === id);
        if (!shop) return null;
        return {
          id,
          label: shop.name,
          color: colorPalette[idx % colorPalette.length],
          values: chartDates.map((date) => transferMap.get(id)?.get(date) ?? 0),
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));
  }, [chartDates, selectedShopIds, shops, transfers]);

  const toggleShop = (id: string) => {
    setSelectedShopIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      return next.length ? next : shops.map((s) => s.id);
    });
  };

  const selectAllShops = () => {
    setSelectedShopIds(shops.map((s) => s.id));
  };

  if (user?.role !== "ADMIN") {
    return (
      <Card>
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Do'konlar")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Dashboard")}</p>
        </div>
      </div>

      {err ? (
        <Card className="border-rose-200/70 bg-rose-50/70">
          <div className="text-sm font-semibold text-rose-700">{t("Xatolik:")}</div>
          <div className="mt-1 text-sm text-rose-900">{err}</div>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-cocoa-900">{t("Savdo grafigi")}</div>
            <div className="text-xs text-cocoa-500">{t("Do'konlarni tanlang")}</div>
          </div>
          <Button
            variant={selectedShopIds.length === shops.length ? "primary" : "ghost"}
            className="px-3 py-1 text-xs"
            onClick={selectAllShops}
          >
            {t("Barchasi")}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {shops.map((shop) => {
            const active = selectedShopIds.includes(shop.id);
            return (
              <Button
                key={shop.id}
                variant={active ? "primary" : "ghost"}
                className="px-3 py-1 text-xs"
                onClick={() => toggleShop(shop.id)}
              >
                {shop.name}
              </Button>
            );
          })}
        </div>

        <div className="mt-4">
          <LineChart labels={chartDates} series={shopChartSeries} emptyLabel={t("Hozircha yo'q.")} />
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-cocoa-600">
          {shopChartSeries.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-cocoa-600">{t("Hozircha yo'q.")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Do'konlar")}</th>
                  <th>{t("Transfer summasi")}</th>
                  <th>{t("Vazvrat summasi")}</th>
                  <th>{t("Olingan pul")}</th>
                  <th>{t("Qarz")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.shop.id}>
                    <td className="font-semibold text-cocoa-900">{row.shop.name}</td>
                    <td className="text-cocoa-700">{moneyUZS(row.transferSum)}</td>
                    <td className="text-cocoa-700">{moneyUZS(row.returnSum)}</td>
                    <td className="text-cocoa-700">{moneyUZS(row.paidSum)}</td>
                    <td className="font-semibold text-cocoa-900">{moneyUZS(Math.max(0, row.debt))}</td>
                  </tr>
                ))}
              </tbody>
            </T>
          </Table>
        )}
      </Card>
    </div>
  );
}
