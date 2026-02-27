"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ordersService } from "@/services/orders";
import { formatDigitsWithSpaces, onlyDigits } from "@/lib/mask";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import type { Order, OrderChannel } from "@/lib/types";

export default function OrdersReceivePage() {
  const { t } = useI18n();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    address: "",
    channel: "WEBSITE" as OrderChannel,
    total: "",
    note: "",
  });

  const channelOptions = useMemo(
    () => [
      { value: "WEBSITE", label: t("Website") },
      { value: "TELEGRAM", label: t("Telegram bot") },
      { value: "PHONE", label: t("Telefon") },
      { value: "OTHER", label: t("Boshqa") },
    ],
    [t]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await ordersService.list();
    setOrders(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const incoming = useMemo(
    () =>
      orders
        .filter((o) => o.status === "NEW")
        .sort((a, b) => {
          const aWebsite = (a.source || "").toUpperCase() === "WEBSITE" ? 1 : 0;
          const bWebsite = (b.source || "").toUpperCase() === "WEBSITE" ? 1 : 0;
          if (aWebsite !== bWebsite) return bWebsite - aWebsite;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }),
    [orders]
  );

  const websiteIncomingCount = useMemo(
    () => incoming.filter((order) => (order.source || "").toUpperCase() === "WEBSITE").length,
    [incoming]
  );

  const total = useMemo(() => incoming.reduce((sum, o) => sum + o.total, 0), [incoming]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName.trim()) {
      toast.error(t("Xatolik"), t("Mijoz nomini kiriting"));
      return;
    }

    const amountNum = Number(onlyDigits(form.total));
    if (!amountNum || amountNum <= 0) {
      toast.error(t("Xatolik"), t("Summa 0 dan katta raqam bo'lsin"));
      return;
    }

    await ordersService.create({
      customerName: form.customerName,
      phone: form.phone,
      address: form.address,
      channel: form.channel,
      total: amountNum,
      note: form.note,
    });

    toast.success(t("Saqlandi"));
    setForm({
      customerName: "",
      phone: "",
      address: "",
      channel: "WEBSITE",
      total: "",
      note: "",
    });
    await refresh();
  }

  async function accept(order: Order) {
    await ordersService.updateStatus(order.id, "IN_DELIVERY");
    toast.success(t("Qabul qilindi"));
    await refresh();
  }

  async function cancel(order: Order) {
    await ordersService.updateStatus(order.id, "CANCELED");
    toast.info(t("Bekor qilindi"));
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Buyurtmani qabul qilish")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">
            {t("Website buyurtmalari shu bo'limda qabul qilinadi")}. {websiteIncomingCount} ta website yangi buyurtma.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-400">{t("Jami")}</div>
          <div className="text-lg font-semibold text-berry-700">{moneyUZS(total)}</div>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-cocoa-700">{t("Qo'lda buyurtma qo'shish (ixtiyoriy)")}</div>
          <Button variant="ghost" onClick={() => setShowManualForm((prev) => !prev)}>
            {showManualForm ? t("Yopish") : t("Ochish")}
          </Button>
        </div>

        {showManualForm ? (
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Input
              label={t("Mijoz")}
              value={form.customerName}
              onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
              placeholder={t("Masalan: Dilnoza")}
            />
            <Input
              label={t("Telefon")}
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder={t("Masalan: +998 90 000 00 00")}
            />
            <Input
              label={t("Manzil")}
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder={t("Masalan: Chilonzor")}
            />
            <Select
              label={t("Platformalar")}
              value={form.channel}
              onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value as OrderChannel }))}
              options={channelOptions}
            />
            <Input
              label={t("Summa (so'm) *")}
              inputMode="numeric"
              value={formatDigitsWithSpaces(form.total)}
              onChange={(e) => setForm((prev) => ({ ...prev, total: onlyDigits(e.target.value) }))}
              placeholder={t("Masalan: 250000")}
            />
            <Textarea
              label={t("Izoh")}
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder={t("Masalan: 2 qavatli tort")}
            />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">{t("Saqlash")}</Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card>
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Sana")}</th>
                  <th>{t("Mijoz")}</th>
                  <th>{t("Platformalar")}</th>
                  <th>{t("Summa")}</th>
                  <th>{t("Izoh")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {incoming.map((order) => {
                  const isWebsite = (order.source || "").toUpperCase() === "WEBSITE";
                  return (
                    <tr key={order.id} className={isWebsite ? "bg-amber-50/40" : undefined}>
                      <td className="font-semibold">{safeDateLabel(order.date)}</td>
                      <td>
                        <div className="font-semibold text-cocoa-900">{order.customerName}</div>
                        <div className="text-xs text-cocoa-500">
                          {order.phone || "-"} • {order.source || "-"} • {order.trackCode || "-"}
                        </div>
                      </td>
                      <td>{channelOptions.find((c) => c.value === order.channel)?.label ?? order.channel}</td>
                      <td>{moneyUZS(order.total)}</td>
                      <td className="text-cocoa-600">{order.note ?? "-"}</td>
                      <td className="whitespace-nowrap">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" onClick={() => void accept(order)}>
                            {t("Qabul qilish")}
                          </Button>
                          <Button variant="danger" onClick={() => void cancel(order)}>
                            {t("Bekor")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {incoming.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-sm text-cocoa-600">
                      {t("Hozircha yo'q.")}
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
