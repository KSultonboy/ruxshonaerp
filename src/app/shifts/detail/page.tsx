"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { salesService } from "@/services/sales";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import type { ShiftReport, PaymentMethod } from "@/lib/types";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
};

const METHOD_COLOR: Record<PaymentMethod, string> = {
  CASH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CARD: "bg-blue-50 text-blue-700 border-blue-200",
  TRANSFER: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function ShiftDetailPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const shiftId = searchParams.get("id") ?? "";

  const [report, setReport] = useState<ShiftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!shiftId || user?.role !== "ADMIN") return;
    salesService
      .getShiftReport(shiftId)
      .then((data) => setReport(data))
      .catch((e: any) => toast.error(t("Xatolik"), e?.message || t("Yuklab bo'lmadi")))
      .finally(() => setLoading(false));
  }, [shiftId, user?.role, toast, t]);

  if (user?.role !== "ADMIN") {
    return (
      <Card>
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-slate-400">{t("Yuklanmoqda...")}</div>;
  }

  if (!report) {
    return (
      <Card>
        <div className="text-sm text-slate-500">{t("Smena topilmadi.")}</div>
      </Card>
    );
  }

  const { shift, totalAmount, totalGroups, byPaymentMethod, groups } = report;
  const isOpen = shift.status === "OPEN";

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/shifts"
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-berry-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t("Smenalar")}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            {t("Smena")} — {safeDateLabel(shift.date)}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {shift.branch?.name ?? "—"} · {shift.openedBy?.username ?? "—"}
          </p>
        </div>
        <span className={`mt-1 rounded-full px-3 py-1 text-xs font-semibold ${isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {isOpen ? t("Ochiq") : t("Yopilgan")}
        </span>
      </div>

      {/* Shift timing + amounts */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Ochildi")}</div>
            <div className="mt-1 text-sm font-semibold text-slate-700">
              {new Date(shift.createdAt).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Yopildi")}</div>
            <div className="mt-1 text-sm font-semibold text-slate-700">
              {shift.closedAt ? new Date(shift.closedAt).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Haqiqiy kassa")}</div>
            <div className="mt-1 text-lg font-bold text-slate-700">
              {shift.closingAmount != null ? moneyUZS(Number(shift.closingAmount)) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Jami cheklar")}</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">{totalGroups}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Jami summa")}</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{moneyUZS(totalAmount)}</div>
          </div>
        </div>
      </Card>

      {/* Payment method breakdown */}
      {byPaymentMethod.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{t("To'lov turlari bo'yicha")}</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            {byPaymentMethod.map(({ method, count, total }) => (
              <div key={method} className={`rounded-xl border p-4 ${METHOD_COLOR[method]}`}>
                <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{t(METHOD_LABEL[method])}</div>
                <div className="mt-2 text-xl font-bold">{moneyUZS(total)}</div>
                <div className="mt-1 text-xs font-medium opacity-60">{count} {t("ta chek")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sale groups */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">{t("Sotuvlar tarixi")}</h3>
        {groups.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">{t("Sotuvlar yo'q.")}</div>
        ) : (
          <div className="space-y-2">
            {groups.map((group, idx) => {
              const isExpanded = expandedGroup === group.id;
              const groupTotal = group.items.reduce((s, item) => s + item.price * item.quantity, 0);
              return (
                <div key={group.id} className="rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-400">#{idx + 1}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${METHOD_COLOR[group.paymentMethod]}`}>
                        {t(METHOD_LABEL[group.paymentMethod])}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(group.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-emerald-700">{moneyUZS(groupTotal)}</span>
                      <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400">
                            <th className="pb-2 text-left font-semibold">{t("Mahsulot")}</th>
                            <th className="pb-2 text-right font-semibold">{t("Narx")}</th>
                            <th className="pb-2 text-right font-semibold">{t("Miqdor")}</th>
                            <th className="pb-2 text-right font-semibold">{t("Jami")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => (
                            <tr key={item.saleId} className="border-t border-slate-100">
                              <td className="py-1.5 font-medium text-slate-700">{item.name}</td>
                              <td className="py-1.5 text-right text-slate-600">{moneyUZS(item.price)}</td>
                              <td className="py-1.5 text-right text-slate-600">{item.quantity}</td>
                              <td className="py-1.5 text-right font-semibold text-slate-800">{moneyUZS(item.price * item.quantity)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-200">
                            <td colSpan={3} className="pt-2 text-right text-xs font-semibold text-slate-500">{t("Jami")}:</td>
                            <td className="pt-2 text-right text-sm font-bold text-emerald-700">{moneyUZS(groupTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
