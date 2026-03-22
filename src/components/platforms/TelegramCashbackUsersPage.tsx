"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { Table, T } from "@/components/ui/Table";
import { moneyUZS } from "@/lib/format";
import type { TelegramCashbackUserListItem } from "@/lib/types";
import { telegramCashbackService } from "@/services/telegram-cashback";

const MAX_ROWS = 500;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function lastTransactionLabel(item: TelegramCashbackUserListItem) {
  if (!item.lastTransaction) return "-";
  const typeLabel =
    item.lastTransaction.type === "EARN"
      ? "Kirim"
      : item.lastTransaction.type === "REDEEM"
        ? "Yechim"
        : "Tuzatish";
  return `${typeLabel}: ${moneyUZS(item.lastTransaction.amount)} (${formatDateTime(item.lastTransaction.createdAt)})`;
}

export default function TelegramCashbackUsersPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<TelegramCashbackUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [listMeta, setListMeta] = useState({
    total: 0,
    returned: 0,
    limit: MAX_ROWS,
    hasMore: false,
  });

  const refresh = useCallback(
    async (nextQuery: string) => {
      setLoading(true);
      try {
        const data = await telegramCashbackService.listUsers({
          q: nextQuery || undefined,
          limit: MAX_ROWS,
        });
        setRows(data.items);
        setListMeta(data.meta);
      } catch (error) {
        const message = error instanceof Error ? error.message : t("Kutilmagan xatolik");
        toast.error(t("Xatolik"), message);
        setRows([]);
        setListMeta({
          total: 0,
          returned: 0,
          limit: MAX_ROWS,
          hasMore: false,
        });
      } finally {
        setLoading(false);
      }
    },
    [t, toast]
  );

  useEffect(() => {
    void refresh("");
  }, [refresh]);

  const summary = useMemo(() => {
    const totalUsers = rows.length;
    const verifiedUsers = rows.filter((item) => item.verifiedMember).length;
    const totalBalance = rows.reduce((sum, item) => sum + Number(item.balance || 0), 0);
    const totalEarned = rows.reduce((sum, item) => sum + Number(item.totalEarned || 0), 0);
    const totalRedeemed = rows.reduce((sum, item) => sum + Number(item.totalRedeemed || 0), 0);
    return {
      totalUsers,
      verifiedUsers,
      totalBalance,
      totalEarned,
      totalRedeemed,
    };
  }, [rows]);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const next = queryInput.trim();
    setQuery(next);
    await refresh(next);
  };

  const clearSearch = async () => {
    setQueryInput("");
    setQuery("");
    await refresh("");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[260px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Telegram cashback userlar")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">
            {t("Telegram bot orqali ro'yxatdan o'tgan userlar va cashback holati")}
          </p>
        </div>
        <Button variant="ghost" onClick={() => void refresh(query)}>
          {t("Yangilash")}
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-3" onSubmit={handleSearch}>
        <div className="min-w-[280px] flex-1">
          <Input
            label={t("Qidiruv")}
            placeholder={t("Ism, username, telegram ID yoki barcode")}
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
          />
        </div>
        <Button type="submit">{t("Qidirish")}</Button>
        <Button type="button" variant="ghost" onClick={clearSearch}>
          {t("Tozalash")}
        </Button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Userlar soni")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{summary.totalUsers}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("A'zo userlar")}</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{summary.verifiedUsers}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Jami balans")}</div>
          <div className="mt-2 text-2xl font-bold text-berry-700">{moneyUZS(summary.totalBalance)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Jami kirim")}</div>
          <div className="mt-2 text-2xl font-bold text-cocoa-900">{moneyUZS(summary.totalEarned)}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-500">{t("Jami yechim")}</div>
          <div className="mt-2 text-2xl font-bold text-cocoa-900">{moneyUZS(summary.totalRedeemed)}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-cocoa-900">{t("Telegram cashback ro'yxati")}</h2>
            <p className="mt-1 text-sm text-cocoa-600">
              {query
                ? `${t("Natija")}: "${query}"`
                : `${t("Oxirgi")} ${listMeta.limit || MAX_ROWS} ${t("ta yozuv")}`}
            </p>
            {!query && listMeta.hasMore ? (
              <p className="mt-1 text-xs text-amber-700">
                {t("Jami {total} ta userdan {returned} tasi ko'rsatildi", {
                  total: listMeta.total,
                  returned: listMeta.returned,
                })}
              </p>
            ) : null}
          </div>
        </div>

        <Table>
          <T>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("Foydalanuvchi")}</th>
                <th>{t("Balans")}</th>
                <th>{t("A'zolik")}</th>
                <th>{t("Oxirgi tranzaksiya")}</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="font-semibold text-cocoa-900">
                        {[item.firstName, item.lastName].filter(Boolean).join(" ").trim() || "-"}
                      </div>
                      <div className="text-xs text-cocoa-500">
                        {item.username ? `@${item.username}` : "-"} | ID:{" "}
                        <span className="font-mono">{item.telegramId}</span>
                      </div>
                      <div className="text-xs text-cocoa-500">{t("Qo'shilgan")}: {formatDateTime(item.createdAt)}</div>
                    </td>
                    <td className="font-semibold text-berry-700">{moneyUZS(item.balance)}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.verifiedMember
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {item.verifiedMember ? t("Tasdiqlangan") : t("Tasdiqlanmagan")}
                      </span>
                    </td>
                    <td className="text-xs text-cocoa-700">{lastTransactionLabel(item)}</td>
                  </tr>
                ))}
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-sm text-cocoa-600">
                    {t("Yuklanmoqda...")}
                  </td>
                </tr>
              ) : null}
              {!loading && rows.length === 0 ? (
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
