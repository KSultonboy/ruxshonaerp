"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Table, T } from "@/components/ui/Table";
import { useI18n } from "@/components/i18n/I18nProvider";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import { matchesPlatformOrder } from "@/lib/order-platforms";
import type { Order, PlatformConfig, PlatformKey } from "@/lib/types";
import { ordersService } from "@/services/orders";
import { platformsService } from "@/services/platforms";

type Props = {
  platformKey: Extract<PlatformKey, "telegram" | "mobile">;
  title: string;
  subtitle: string;
};

export default function PlatformAnalyticsPage({ platformKey, title, subtitle }: Props) {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [list, nextConfig] = await Promise.all([ordersService.list(), platformsService.get(platformKey)]);
    setOrders(list);
    setConfig(nextConfig);
    setLoading(false);
  }, [platformKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const platformOrders = useMemo(
    () =>
      orders
        .filter((order) => matchesPlatformOrder(order, platformKey))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, platformKey]
  );

  const stats = useMemo(() => {
    const totalOrders = platformOrders.length;
    const newOrders = platformOrders.filter((order) => order.status === "NEW").length;
    const inDeliveryOrders = platformOrders.filter((order) => order.status === "IN_DELIVERY").length;
    const deliveredOrders = platformOrders.filter((order) => order.status === "DELIVERED").length;
    const canceledOrders = platformOrders.filter((order) => order.status === "CANCELED").length;
    const totalSales = platformOrders
      .filter((order) => order.status === "DELIVERED")
      .reduce((sum, order) => sum + order.total, 0);
    const averageCheck = deliveredOrders ? Math.round(totalSales / deliveredOrders) : 0;

    return {
      totalOrders,
      newOrders,
      inDeliveryOrders,
      deliveredOrders,
      canceledOrders,
      totalSales,
      averageCheck,
    };
  }, [platformOrders]);

  if (loading) {
    return <div className="p-6 text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t(title)}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t(subtitle)}</p>
        </div>
        <Badge tone={config?.status === "CONNECTED" ? "primary" : "neutral"}>
          {config?.status === "CONNECTED" ? t("Ulangan") : t("Ulanmagan")}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Jami buyurtmalar")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{stats.totalOrders}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Yetkazilgan tushum")}</div>
          <div className="mt-2 text-3xl font-bold text-berry-700">{moneyUZS(stats.totalSales)}</div>
          <div className="mt-1 text-xs text-cocoa-500">
            {t("O'rtacha chek")}: {moneyUZS(stats.averageCheck)}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Yangi buyurtmalar")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{stats.newOrders}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Yetkazishda")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{stats.inDeliveryOrders}</div>
          <div className="mt-1 text-xs text-cocoa-500">
            {t("Bekor qilingan")}: {stats.canceledOrders}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-cocoa-900">{t("So'nggi buyurtmalar")}</h2>
            <p className="mt-1 text-sm text-cocoa-600">{t("Platforma bo'yicha joriy oqim")}</p>
          </div>
          <div className="rounded-2xl bg-cream-100 px-4 py-2 text-sm font-semibold text-cocoa-700">
            DONE: {stats.deliveredOrders}
          </div>
        </div>

        <Table>
          <T>
            <thead>
              <tr>
                <th>{t("Sana")}</th>
                <th>{t("Mijoz")}</th>
                <th>{t("Holat")}</th>
                <th>{t("Summa")}</th>
              </tr>
            </thead>
            <tbody>
              {platformOrders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold">{safeDateLabel(order.date)}</td>
                  <td>
                    <div className="font-semibold text-cocoa-900">{order.customerName}</div>
                    <div className="text-xs text-cocoa-500">{order.phone || order.trackCode || "-"}</div>
                  </td>
                  <td>{order.status}</td>
                  <td>{moneyUZS(order.total)}</td>
                </tr>
              ))}
              {platformOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-sm text-cocoa-600">
                    {t("Hozircha ma'lumot yo'q.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </T>
        </Table>
      </Card>
    </div>
  );
}
