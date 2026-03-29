"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { salesService } from "@/services/sales";
import { moneyUZS } from "@/lib/format";
import type { Shift, PaymentMethod, ShiftCashSummary } from "@/lib/types";

type MethodStat = { method: PaymentMethod; count: number; total: number };

const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  CASH: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="7" width="20" height="13" rx="2" /><circle cx="12" cy="13.5" r="2.5" />
    </svg>
  ),
  CARD: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 10h20" strokeLinecap="round" />
    </svg>
  ),
  TRANSFER: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m0 0-3-3m3 3-3 3M16 17H8m0 0 3-3m-3 3 3 3" />
    </svg>
  ),
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Naqd",
  CARD: "Karta + Aralash",
  TRANSFER: "Nasiya",
};

const METHOD_COLORS: Record<PaymentMethod, string> = {
  CASH: "text-emerald-400",
  CARD: "text-blue-400",
  TRANSFER: "text-amber-400",
};

interface Props {
  shift: Shift;
  onClose: () => void;
  onShiftClosed: () => void;
}

export default function ShiftCloseModal({ shift, onClose, onShiftClosed }: Props) {
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ total: number; groups: number; byMethod: MethodStat[] }>({ total: 0, groups: 0, byMethod: [] });
  const [cashSummary, setCashSummary] = useState<ShiftCashSummary | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      salesService.getShiftReport(shift.id),
      salesService.getShiftCashSummary().catch(() => null),
    ])
      .then(([report, cash]) => {
        if (!active) return;
        setStats({
          total: report.totalAmount,
          groups: report.totalGroups,
          byMethod: report.byPaymentMethod,
        });
        setCashSummary(cash);
      })
      .catch(() => {
        if (!active) return;
        setStats({ total: 0, groups: 0, byMethod: [] });
        setCashSummary(null);
      });

    return () => {
      active = false;
    };
  }, [shift.id]);

  const openedTime = new Date(shift.createdAt).toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  async function handleClose() {
    setLoading(true);
    try {
      await salesService.closeShift();
      onShiftClosed();
    } catch (e: any) {
      // bubble up for parent to handle
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-3">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-[#1a2332] shadow-2xl border border-slate-700/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path strokeLinecap="round" d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <span className="text-base font-bold text-white">{t("Smena yopish")}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Shift open info */}
          <div className="rounded-2xl bg-[#0d1117] px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{t("Smena ochildi")}</span>
              <span className="font-semibold text-white">{openedTime}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{t("Boshlang'ich kassa")}</span>
              <span className="font-semibold text-white">{moneyUZS(cashSummary?.openingAmount ?? shift.openingAmount ?? 0)}</span>
            </div>
          </div>

          {/* Sales stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#0d1117] px-3 py-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0-3-3m3 3-3 3M4 12h8m8 4H4m0 0 3 3m-3-3 3-3" />
                </svg>
                {t("Jami sotuv")}
              </div>
              <div className="mt-1.5 text-lg font-bold text-white">{moneyUZS(stats.total)}</div>
              <div className="text-xs text-slate-500">{stats.groups} {t("ta chek")}</div>
            </div>

            {(["CASH", "CARD", "TRANSFER"] as PaymentMethod[]).map((method) => {
              const stat = stats.byMethod.find((m) => m.method === method);
              return (
                <div key={method} className="rounded-2xl bg-[#0d1117] px-3 py-3">
                  <div className={`flex items-center gap-2 text-xs ${METHOD_COLORS[method]}`}>
                    {METHOD_ICONS[method]}
                    {t(METHOD_LABELS[method])}
                  </div>
                  <div className="mt-1.5 text-base font-bold text-white">{moneyUZS(stat?.total ?? 0)}</div>
                </div>
              );
            })}
          </div>

          {cashSummary && (
            <div className="rounded-2xl bg-[#0d1117] px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{t("Kassadan chiqim")}</span>
                <span className="font-semibold text-rose-300">{moneyUZS(cashSummary.cashOutTotal)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-slate-300">{t("Kutilgan kassa (boshlang'ich + naqd - chiqim)")}</span>
                <span className="font-bold text-emerald-300">{moneyUZS(cashSummary.currentCash)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-amber-500 active:scale-95 disabled:opacity-60"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path strokeLinecap="round" d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {loading ? t("Yopilmoqda...") : t("Smena yopish")}
          </button>
        </div>
      </div>
    </div>
  );
}
