"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Table, T } from "@/components/ui/Table";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import { matchesPlatformOrder } from "@/lib/order-platforms";
import type { Order, OrderStatus, PlatformKey } from "@/lib/types";
import { ordersService } from "@/services/orders";

type Props = {
  platformKey: PlatformKey;
  title: string;
  subtitle: string;
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const classes =
    status === "NEW"
      ? "border-amber-200 bg-amber-100 text-amber-700"
      : status === "IN_DELIVERY"
        ? "border-sky-200 bg-sky-100 text-sky-700"
        : status === "DELIVERED"
          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
          : "border-rose-200 bg-rose-100 text-rose-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

export default function PlatformOrdersPage({ platformKey, title, subtitle }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ordersService.list();
      setOrders(list);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const pendingOrders = useMemo(
    () => platformOrders.filter((order) => order.status === "NEW"),
    [platformOrders]
  );
  const deliveryOrders = useMemo(
    () => platformOrders.filter((order) => order.status === "IN_DELIVERY"),
    [platformOrders]
  );
  const historyOrders = useMemo(
    () => platformOrders.filter((order) => order.status === "DELIVERED" || order.status === "CANCELED"),
    [platformOrders]
  );

  const deliveredRevenue = useMemo(
    () => historyOrders.filter((order) => order.status === "DELIVERED").reduce((sum, order) => sum + order.total, 0),
    [historyOrders]
  );
  const pendingTotal = useMemo(
    () => pendingOrders.reduce((sum, order) => sum + order.total, 0),
    [pendingOrders]
  );

  const updateStatus = useCallback(
    async (order: Order, status: OrderStatus, successMessage: string) => {
      setBusyId(order.id);
      try {
        await ordersService.updateStatus(order.id, status);
        toast.success(t(successMessage));
        await refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : t("Kutilmagan xatolik");
        toast.error(t("Xatolik"), message);
      } finally {
        setBusyId(null);
      }
    },
    [refresh, t, toast]
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t(title)}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t(subtitle)}</p>
        </div>
        <div className="rounded-3xl border border-cream-200 bg-cream-100 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Pending summa")}</div>
          <div className="mt-1 text-lg font-semibold text-berry-700">{moneyUZS(pendingTotal)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Yangi buyurtmalar")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{pendingOrders.length}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Yetkazishda")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{deliveryOrders.length}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Yetkazilganlar")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">
            {historyOrders.filter((order) => order.status === "DELIVERED").length}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Yetkazilgan tushum")}</div>
          <div className="mt-2 text-3xl font-bold text-berry-700">{moneyUZS(deliveredRevenue)}</div>
          <div className="mt-1 text-xs text-cocoa-500">
            {t("Bekor qilinganlar")}: {historyOrders.filter((order) => order.status === "CANCELED").length}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-cocoa-900">{t("Yangi buyurtmalar")}</h2>
            <p className="mt-1 text-sm text-cocoa-600">{t("Qabul qilish yoki bekor qilish uchun navbat")}</p>
          </div>
          <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            NEW: {pendingOrders.length}
          </div>
        </div>
        <Table>
          <T>
            <thead>
              <tr>
                <th>{t("Sana")}</th>
                <th>{t("Mijoz")}</th>
                <th>{t("Summa")}</th>
                <th>{t("Izoh")}</th>
                <th>{t("Holat")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold">{safeDateLabel(order.date)}</td>
                  <td>
                    <div className="font-semibold text-cocoa-900">{order.customerName}</div>
                    <div className="text-xs text-cocoa-500">
                      {order.phone || "-"} • {order.trackCode || "-"}
                    </div>
                  </td>
                  <td>{moneyUZS(order.total)}</td>
                  <td className="text-cocoa-600">{order.note ?? "-"}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        disabled={busyId === order.id}
                        onClick={() => void updateStatus(order, "IN_DELIVERY", "Qabul qilindi")}
                      >
                        {t("Qabul qilish")}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busyId === order.id}
                        onClick={() => void updateStatus(order, "CANCELED", "Bekor qilindi")}
                      >
                        {t("Bekor")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-sm text-cocoa-600">
                    {t("Hozircha yo'q.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </T>
        </Table>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-cocoa-900">{t("Yetkazib berish")}</h2>
            <p className="mt-1 text-sm text-cocoa-600">{t("Qabul qilingan buyurtmalar oqimi")}</p>
          </div>
          <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
            DELIVERY: {deliveryOrders.length}
          </div>
        </div>
        <Table>
          <T>
            <thead>
              <tr>
                <th>{t("Sana")}</th>
                <th>{t("Mijoz")}</th>
                <th>{t("Manzil")}</th>
                <th>{t("Summa")}</th>
                <th>{t("Holat")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deliveryOrders.map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold">{safeDateLabel(order.date)}</td>
                  <td>
                    <div className="font-semibold text-cocoa-900">{order.customerName}</div>
                    <div className="text-xs text-cocoa-500">
                      {order.phone || "-"} • {order.trackCode || "-"}
                    </div>
                  </td>
                  <td className="text-cocoa-600">{order.address || "-"}</td>
                  <td>{moneyUZS(order.total)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        disabled={busyId === order.id}
                        onClick={() => void updateStatus(order, "DELIVERED", "Yetkazildi")}
                      >
                        {t("Yetkazildi")}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busyId === order.id}
                        onClick={() => void updateStatus(order, "CANCELED", "Bekor qilindi")}
                      >
                        {t("Bekor")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {deliveryOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-sm text-cocoa-600">
                    {t("Hozircha yo'q.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </T>
        </Table>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-cocoa-900">{t("So'nggi buyurtmalar")}</h2>
            <p className="mt-1 text-sm text-cocoa-600">{t("Yakunlangan va bekor qilingan buyurtmalar tarixi")}</p>
          </div>
          <div className="rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-cocoa-700">
            {t("Jami")}: {platformOrders.length}
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
                <th>{t("Track code")}</th>
              </tr>
            </thead>
            <tbody>
              {historyOrders.slice(0, 10).map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold">{safeDateLabel(order.date)}</td>
                  <td>
                    <div className="font-semibold text-cocoa-900">{order.customerName}</div>
                    <div className="text-xs text-cocoa-500">{order.phone || "-"}</div>
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>{moneyUZS(order.total)}</td>
                  <td className="font-mono text-xs text-cocoa-500">{order.trackCode || "-"}</td>
                </tr>
              ))}
              {historyOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-sm text-cocoa-600">
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
