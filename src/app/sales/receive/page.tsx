"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { transfersService } from "@/services/transfers";
import type { Transfer } from "@/lib/types";
import { formatDigitsWithSpaces } from "@/lib/mask";

export default function SalesReceivePage() {
  const { t } = useI18n();
  const toast = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const list = await transfersService.list();
      setTransfers(list.filter((t) => t.status === "PENDING"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function receive(id: string) {
    try {
      await transfersService.receive(id);
      toast.success(t("Qabul qilindi"));
      await load();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Qabul qilish (transfer)")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Filiallarga")}</p>
      </div>

      <Card>
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : transfers.length === 0 ? (
          <div className="text-sm text-cocoa-600">{t("Hozircha yo'q.")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Sana")}</th>
                  <th>{t("Filiallar")}</th>
                  <th>{t("Miqdor")}</th>
                  <th>{t("Harakat turi")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tr) => (
                  <tr key={tr.id}>
                    <td className="font-semibold">{tr.date}</td>
                    <td>{tr.branch?.name ?? "-"}</td>
                    <td>
                      {tr.items.map((i) => (
                        <div key={i.id} className="text-sm text-cocoa-700">
                          {i.product?.name} — {formatDigitsWithSpaces(String(i.quantity))}
                        </div>
                      ))}
                    </td>
                    <td>
                      <Badge tone="neutral">{tr.status}</Badge>
                    </td>
                    <td className="text-right">
                      <Button onClick={() => receive(tr.id)}>{t("Tasdiqlash")}</Button>
                    </td>
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
