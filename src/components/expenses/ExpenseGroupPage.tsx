"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Table, T } from "@/components/ui/Table";
import { useI18n } from "@/components/i18n/I18nProvider";
import { expenseCategoriesService } from "@/services/categories";
import { expensesService } from "@/services/expenses";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import type { Category, Expense } from "@/lib/types";

type Props = {
  title: string;
  subtitle: string;
  keywords: string[];
};

function matchKeywords(name: string, keywords: string[]) {
  const lower = name.toLowerCase();
  return keywords.some((key) => lower.includes(key));
}

export default function ExpenseGroupPage({ title, subtitle, keywords }: Props) {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [cats, exps] = await Promise.all([expenseCategoriesService.list(), expensesService.list()]);
      setCategories(cats);
      setExpenses(exps);
    } catch (e: any) {
      setErr(e?.message || t("Noma'lum xatolik"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const groupCategories = useMemo(
    () => categories.filter((c) => matchKeywords(c.name, keywords)),
    [categories, keywords]
  );

  const groupCategoryIds = useMemo(() => new Set(groupCategories.map((c) => c.id)), [groupCategories]);

  const groupExpenses = useMemo(
    () => expenses.filter((e) => groupCategoryIds.has(e.categoryId)),
    [expenses, groupCategoryIds]
  );

  const total = useMemo(() => groupExpenses.reduce((sum, e) => sum + e.amount, 0), [groupExpenses]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t(title)}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t(subtitle)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/expenses?new=1">{t("+ Xarajat qo'shish")}</Link>
          </Button>
        </div>
      </div>

      {err ? (
        <Card className="border-rose-200/70 bg-rose-50/70">
          <div className="text-sm font-semibold text-rose-700">{t("Xatolik:")}</div>
          <div className="mt-1 text-sm text-rose-900">{err}</div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-400">{t("Kategoriyalar")}</div>
          <div className="mt-2 text-2xl font-semibold text-cocoa-900">{groupCategories.length}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-400">{t("Xarajatlar soni")}</div>
          <div className="mt-2 text-2xl font-semibold text-cocoa-900">{groupExpenses.length}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-400">{t("Jami")}</div>
          <div className="mt-2 text-2xl font-semibold text-berry-700">{moneyUZS(total)}</div>
          <div className="mt-1 text-xs text-cocoa-500">{t("Xarajatlar yig'indisi")}</div>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Sana")}</th>
                  <th>{t("Kategoriya")}</th>
                  <th>{t("To'lov")}</th>
                  <th>{t("Summa")}</th>
                  <th>{t("Izoh")}</th>
                </tr>
              </thead>
              <tbody>
                {groupExpenses.map((e) => (
                  <tr key={e.id}>
                    <td className="font-semibold">{safeDateLabel(e.date)}</td>
                    <td>{catMap.get(e.categoryId) ?? "-"}</td>
                    <td>{e.paymentMethod}</td>
                    <td>{moneyUZS(e.amount)}</td>
                    <td className="text-cocoa-600">{e.note ?? "-"}</td>
                  </tr>
                ))}
                {groupExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-sm text-cocoa-600">
                      {t("Hozircha xarajat yo'q.")}
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
