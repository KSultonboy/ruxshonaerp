"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { statsService } from "@/services/stats";
import type { MarketingStats } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import Card from "@/components/ui/Card";

export default function WebsiteDashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    statsService
      .getMarketingStats()
      .then((value) => {
        if (active) setStats(value);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const maxProductQty = useMemo(() => {
    if (!stats?.topProducts?.length) return 1;
    return Math.max(...stats.topProducts.map((item) => item.quantity || 0), 1);
  }, [stats?.topProducts]);

  const maxCouponUse = useMemo(() => {
    if (!stats?.couponStats?.length) return 1;
    return Math.max(...stats.couponStats.map((item) => item.usedCount || 0), 1);
  }, [stats?.couponStats]);

  const averageCheck = useMemo(() => {
    if (!stats) return 0;
    const denominator = stats.deliveredOrders || stats.totalOrders || 1;
    return Math.round(stats.totalSales / denominator);
  }, [stats]);

  if (loading) {
    return <div className="p-6 animate-pulse">{t("Yuklanmoqda...")}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Website Analytics")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Website buyurtmalari, mijozlar va kuponlar samaradorligi")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-gradient-to-br from-berry-700 to-berry-500 text-cream-50">
          <div className="text-xs uppercase tracking-[0.2em] text-cream-100/80">{t("Jami website buyurtmalar")}</div>
          <div className="mt-2 text-3xl font-bold">{stats?.totalOrders ?? 0}</div>
          <div className="mt-1 text-xs text-cream-100/80">7 kun ichida: {stats?.recentOrders ?? 0}</div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-600 to-emerald-400 text-cream-50">
          <div className="text-xs uppercase tracking-[0.2em] text-cream-100/80">{t("Yetkazilgan tushum")}</div>
          <div className="mt-2 text-3xl font-bold">{formatCurrency(stats?.totalSales ?? 0)}</div>
          <div className="mt-1 text-xs text-cream-100/80">O'rtacha chek: {formatCurrency(averageCheck)}</div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Yangi mijozlar")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{stats?.newCustomers ?? 0}</div>
          <div className="mt-1 text-xs text-cocoa-500">{t("Oxirgi 30 kun")}</div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Pipeline")}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-700">NEW: <b>{stats?.newOrders ?? 0}</b></div>
            <div className="rounded-xl bg-sky-50 px-3 py-2 text-sky-700">DELIVERY: <b>{stats?.inDeliveryOrders ?? 0}</b></div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">DONE: <b>{stats?.deliveredOrders ?? 0}</b></div>
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">CANCELED: <b>{stats?.canceledOrders ?? 0}</b></div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-cocoa-900">{t("Top mahsulotlar")}</h2>
            <span className="text-xs text-cocoa-500">{t("Website manbasi")}</span>
          </div>

          {stats?.topProducts?.length ? (
            <div className="space-y-3">
              {stats.topProducts.map((product) => {
                const width = Math.max(8, Math.round((product.quantity / maxProductQty) * 100));
                return (
                  <div key={product.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-cocoa-700">
                      <span className="font-semibold text-cocoa-900">{product.name}</span>
                      <span>{product.quantity} ta</span>
                    </div>
                    <div className="h-2 rounded-full bg-cream-100">
                      <div className="h-2 rounded-full bg-berry-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-cocoa-500">{t("Ma'lumot yo'q")}</div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-cocoa-900">{t("Kupon samaradorligi")}</h2>
            <span className="text-xs text-cocoa-500">{t("TOP 10")}</span>
          </div>

          {stats?.couponStats?.length ? (
            <div className="space-y-3">
              {stats.couponStats.map((coupon) => {
                const width = Math.max(8, Math.round((coupon.usedCount / maxCouponUse) * 100));
                return (
                  <div key={coupon.code} className="rounded-2xl border border-cream-200 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-mono font-bold text-berry-700">{coupon.code}</span>
                      <span className="text-cocoa-500">-{formatCurrency(coupon.discount)}</span>
                    </div>
                    <div className="mb-1 h-2 rounded-full bg-cream-100">
                      <div className="h-2 rounded-full bg-cocoa-700" style={{ width: `${width}%` }} />
                    </div>
                    <div className="text-xs text-cocoa-500">{coupon.usedCount} marta ishlatilgan</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-cocoa-500">{t("Kuponlar hali ishlatilmagan")}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
