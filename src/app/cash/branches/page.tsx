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
import { branchesService } from "@/services/branches";
import { cashService } from "@/services/cash";
import { transfersService } from "@/services/transfers";
import { returnsService } from "@/services/returns";
import { ensureSeed } from "@/lib/seed";
import { formatDigitsWithSpaces, onlyDigits } from "@/lib/mask";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import type { Branch, CashEntry, PaymentMethod, Return, Transfer } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function resolveBranchItemPrice(item: {
  unitPrice?: number | null;
  product?: { salePrice?: number | null; shopPrice?: number | null; price?: number | null } | null;
}) {
  return (
    item.unitPrice ??
    item.product?.salePrice ??
    item.product?.shopPrice ??
    item.product?.price ??
    0
  );
}

export default function CashBranchesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    date: todayISO(),
    branchId: "",
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
      const [branchList, cashList, transferList, returnList] = await Promise.all([
        branchesService.list(),
        cashService.list(),
        transfersService.list(),
        returnsService.list(),
      ]);
      setBranches(branchList);
      setEntries(cashList.filter((entry) => entry.sourceType === "BRANCH"));
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
    if (branches.length === 0) return;
    setForm((prev) => ({ ...prev, branchId: prev.branchId || branches[0]?.id || "" }));
  }, [branches]);

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries]);

  const debtByBranch = useMemo(() => {
    const transferSum = new Map<string, number>();
    transfers
      .filter((tr) => tr.targetType === "BRANCH" && tr.status === "RECEIVED" && tr.branchId)
      .forEach((tr) => {
        const branchId = tr.branchId as string;
        const value = (tr.items ?? []).reduce((sum, item) => {
          return sum + resolveBranchItemPrice(item) * item.quantity;
        }, 0);
        transferSum.set(branchId, (transferSum.get(branchId) ?? 0) + value);
      });

    const returnSum = new Map<string, number>();
    returns
      .filter((ret) => ret.sourceType === "BRANCH" && ret.status === "APPROVED" && ret.branchId)
      .forEach((ret) => {
        const branchId = ret.branchId as string;
        const value = (ret.items ?? []).reduce((sum, item) => {
          return sum + resolveBranchItemPrice(item) * item.quantity;
        }, 0);
        returnSum.set(branchId, (returnSum.get(branchId) ?? 0) + value);
      });

    const paymentSum = new Map<string, number>();
    entries.forEach((entry) => {
      const sourceId = entry.sourceId || entry.branchId;
      if (!sourceId) return;
      paymentSum.set(sourceId, (paymentSum.get(sourceId) ?? 0) + entry.amount);
    });

    const debt = new Map<string, number>();
    branches.forEach((branch) => {
      const branchId = branch.id;
      debt.set(
        branchId,
        (transferSum.get(branchId) ?? 0) - (returnSum.get(branchId) ?? 0) - (paymentSum.get(branchId) ?? 0)
      );
    });

    return debt;
  }, [branches, entries, returns, transfers]);

  const selectedDebt = useMemo(() => {
    if (!form.branchId) return 0;
    return debtByBranch.get(form.branchId) ?? 0;
  }, [debtByBranch, form.branchId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.branchId) {
      toast.error(t("Xatolik"), t("Filial tanlang"));
      return;
    }
    const amountNum = Number(onlyDigits(form.amount));
    if (!amountNum || amountNum <= 0) {
      toast.error(t("Xatolik"), t("Summa 0 dan katta raqam bo'lsin"));
      return;
    }
    await cashService.create({
      date: form.date,
      sourceType: "BRANCH",
      sourceId: form.branchId,
      amount: amountNum,
      paymentMethod: form.paymentMethod,
      note: form.note?.trim() || undefined,
    });
    toast.success(t("Saqlandi"));
    setForm({ date: todayISO(), branchId: form.branchId, amount: "", paymentMethod: "CASH", note: "" });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Filiallardan olish")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Kassa")}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-cocoa-400">{t("Jami")}</div>
          <div className="text-lg font-semibold text-berry-700">{moneyUZS(total)}</div>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <Input
            label={t("Sana")}
            type="date"
            value={form.date}
            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
          />
          <Select
            label={t("Filiallar")}
            value={form.branchId}
            onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Input label={t("Hozirgi qarz")} value={moneyUZS(selectedDebt)} readOnly />
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
              placeholder={t("Masalan: filialdan olingan to'lov")}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">{t("Saqlash")}</Button>
          </div>
        </form>
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
                  <th>{t("Filiallar")}</th>
                  <th>{t("To'lov")}</th>
                  <th>{t("Summa")}</th>
                  <th>{t("Izoh")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-semibold">{safeDateLabel(entry.date)}</td>
                    <td>{branchMap.get(entry.sourceId) ?? "-"}</td>
                    <td>{entry.paymentMethod}</td>
                    <td>{moneyUZS(entry.amount)}</td>
                    <td className="text-cocoa-600">{entry.note ?? "-"}</td>
                    <td className="whitespace-nowrap">
                      <Button variant="ghost" onClick={() => remove(entry.id)}>
                        {t("Delete")}
                      </Button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
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
