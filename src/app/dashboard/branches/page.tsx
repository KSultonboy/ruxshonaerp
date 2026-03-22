"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LineChart from "@/components/ui/LineChart";
import { Table, T } from "@/components/ui/Table";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { branchesService } from "@/services/branches";
import { transfersService } from "@/services/transfers";
import { returnsService } from "@/services/returns";
import { salesService } from "@/services/sales";
import { cashService } from "@/services/cash";
import { moneyUZS, safeDateLabel } from "@/lib/format";
import type { Branch, Transfer, Return, Sale, CashEntry, ShiftWithMeta, PaymentMethod } from "@/lib/types";

const METHOD_LABEL: Record<PaymentMethod, string> = { CASH: "Naqd", CARD: "Karta", TRANSFER: "O'tkazma" };
const METHOD_COLOR: Record<PaymentMethod, string> = {
  CASH: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CARD: "bg-blue-50 text-blue-700 border-blue-200",
  TRANSFER: "bg-amber-50 text-amber-700 border-amber-200",
};

function isoToday() { return new Date().toISOString().slice(0, 10); }
function isoDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
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
function sumItems(items: { quantity: number; unitPrice?: number | null; product?: any }[]) {
  return items.reduce((s, i) => s + i.quantity * resolveBranchItemPrice(i), 0);
}

type Tab = "overview" | "sales" | "shifts" | "transactions";

export default function DashboardBranchesPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("overview");

  // data
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<CashEntry[]>([]);
  const [shifts, setShifts] = useState<ShiftWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // filters
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(isoToday());

  const chartDates = useMemo(() => {
    const n = 30;
    return Array.from({ length: n }, (_, i) => isoDaysAgo(n - 1 - i));
  }, []);

  // load branches once
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    branchesService.list().then((list) => {
      setBranches(list);
      if (list.length) setSelectedId(list[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.role]);

  // load detail data when branch or dates change
  const loadDetail = useCallback(async (branchId: string) => {
    if (!branchId) return;
    setDetailLoading(true);
    try {
      const [trList, retList, salList, payList, shiftList] = await Promise.all([
        transfersService.list(),
        returnsService.list(),
        salesService.list({ branchId, from: chartDates[0], to }),
        cashService.list(),
        salesService.listShifts({ branchId, from, to }),
      ]);
      setTransfers(trList.filter((tr) => tr.targetType === "BRANCH" && tr.branchId === branchId));
      setReturns(retList.filter((ret) => ret.sourceType === "BRANCH" && ret.branchId === branchId));
      setSales(salList);
      setPayments(payList.filter((p) => p.sourceType === "BRANCH" && p.sourceId === branchId));
      setShifts(shiftList);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }, [chartDates, from, to]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const branch = useMemo(() => branches.find((b) => b.id === selectedId), [branches, selectedId]);

  // financial KPIs
  const financials = useMemo(() => {
    const transferTotal = transfers.filter((tr) => tr.status === "RECEIVED").reduce((s, tr) => s + sumItems(tr.items ?? []), 0);
    const returnTotal = returns.filter((ret) => ret.status === "APPROVED").reduce((s, ret) => s + sumItems(ret.items ?? []), 0);
    const paidTotal = payments.reduce((s, p) => s + p.amount, 0);
    const debt = transferTotal - returnTotal - paidTotal;
    const saleTotal = sales.reduce((s, sale) => s + sale.price * sale.quantity, 0);
    return { transferTotal, returnTotal, paidTotal, debt, saleTotal };
  }, [transfers, returns, payments, sales]);

  // sales by payment method
  const salesByMethod = useMemo(() => {
    const map = new Map<PaymentMethod, { count: number; total: number }>();
    // group sales into sale groups
    const groups = new Map<string, { method: PaymentMethod; total: number }>();
    for (const sale of sales) {
      const gId = String(sale.saleGroupId || sale.id);
      const ex = groups.get(gId);
      const line = sale.price * sale.quantity;
      if (ex) { ex.total += line; }
      else { groups.set(gId, { method: sale.paymentMethod, total: line }); }
    }
    for (const { method, total } of groups.values()) {
      const ex = map.get(method) ?? { count: 0, total: 0 };
      ex.count += 1; ex.total += total;
      map.set(method, ex);
    }
    return Array.from(map.entries()).map(([method, stat]) => ({ method, ...stat }));
  }, [sales]);

  // sales chart (30 days for selected branch)
  const chartSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    sales.forEach((sale) => {
      if (!chartDates.includes(sale.date)) return;
      byDate.set(sale.date, (byDate.get(sale.date) ?? 0) + sale.price * sale.quantity);
    });
    return branch ? [{
      id: branch.id, label: branch.name, color: "#C41230",
      values: chartDates.map((d) => byDate.get(d) ?? 0),
    }] : [];
  }, [sales, chartDates, branch]);

  // filtered sales for table (from..to)
  const filteredSales = useMemo(() =>
    sales.filter((s) => s.date >= from && s.date <= to)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50),
  [sales, from, to]);

  if (user?.role !== "ADMIN") {
    return <Card><div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div></Card>;
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: t("Umumiy") },
    { key: "sales", label: t("Sotuvlar") },
    { key: "shifts", label: t("Smenalar") },
    { key: "transactions", label: t("Tranzaksiyalar") },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("Filiallar dashboardi")}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("Filial tanlang va to'liq ma'lumotlarni ko'ring")}</p>
      </div>

      {/* Branch selector */}
      {loading ? (
        <div className="text-sm text-slate-400">{t("Yuklanmoqda...")}</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => { setSelectedId(b.id); setTab("overview"); }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                selectedId === b.id
                  ? "border-berry-700 bg-berry-700 text-white shadow-glow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {!selectedId || !branch ? null : (
        <>
          {/* Date range + tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
              {TABS.map((tb) => (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setTab(tb.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tab === tb.key
                      ? "bg-berry-700 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="w-36">
                <Input label={t("Dan")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="w-36">
                <Input label={t("Gacha")} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <Button onClick={() => loadDetail(selectedId)} disabled={detailLoading} className="mb-0.5">
                {detailLoading ? "..." : t("Yangilash")}
              </Button>
            </div>
          </div>

          {detailLoading ? (
            <div className="py-10 text-center text-sm text-slate-400">{t("Yuklanmoqda...")}</div>
          ) : (
            <>
              {/* ===== OVERVIEW TAB ===== */}
              {tab === "overview" && (
                <div className="space-y-6">
                  {/* KPI strip */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {[
                      { label: t("Jami sotuv"), value: financials.saleTotal, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                      { label: t("Transfer (kirim)"), value: financials.transferTotal, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                      { label: t("Vazvrat"), value: financials.returnTotal, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                      { label: t("Olingan pul"), value: financials.paidTotal, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
                      { label: t("Qarz"), value: Math.max(0, financials.debt), color: financials.debt > 0 ? "text-rose-700" : "text-emerald-700", bg: financials.debt > 0 ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200" },
                    ].map((kpi) => (
                      <div key={kpi.label} className={`rounded-xl border p-3 ${kpi.bg}`}>
                        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{kpi.label}</div>
                        <div className={`mt-1 text-base font-bold ${kpi.color}`}>{moneyUZS(kpi.value)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Payment method breakdown */}
                  {salesByMethod.length > 0 && (
                    <div>
                      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("To'lov usullari bo'yicha sotuv")}</h2>
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                        {salesByMethod.map(({ method, count, total }) => (
                          <div key={method} className={`rounded-xl border p-4 ${METHOD_COLOR[method]}`}>
                            <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{t(METHOD_LABEL[method])}</div>
                            <div className="mt-2 text-xl font-bold">{moneyUZS(total)}</div>
                            <div className="mt-1 text-xs opacity-60">{count} {t("ta chek")}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 30-day chart */}
                  <Card>
                    <div className="mb-3 text-sm font-semibold text-slate-700">{t("30 kunlik sotuv grafigi")} — {branch.name}</div>
                    <LineChart labels={chartDates} series={chartSeries} emptyLabel={t("Sotuvlar yo'q.")} />
                  </Card>

                  {/* Recent shifts summary */}
                  {shifts.length > 0 && (
                    <Card>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-700">{t("So'nggi smenalar")}</div>
                        <button type="button" onClick={() => setTab("shifts")} className="text-xs text-berry-700 hover:underline">{t("Barchasi →")}</button>
                      </div>
                      <div className="space-y-2">
                        {shifts.slice(0, 4).map((s) => (
                          <Link key={s.id} href={`/shifts/detail?id=${s.id}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs hover:border-berry-700/30 transition">
                            <span className="font-semibold text-slate-700">{safeDateLabel(s.date)} · {s.openedBy?.username}</span>
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${s.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                              {s.status === "OPEN" ? t("Ochiq") : t("Yopilgan")}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ===== SALES TAB ===== */}
              {tab === "sales" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">{t("Jami sotuv")}</div>
                      <div className="mt-1 text-lg font-bold text-emerald-700">{moneyUZS(financials.saleTotal)}</div>
                    </div>
                    {salesByMethod.map(({ method, count, total }) => (
                      <div key={method} className={`rounded-xl border p-3 ${METHOD_COLOR[method]}`}>
                        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{t(METHOD_LABEL[method])}</div>
                        <div className="mt-1 text-lg font-bold">{moneyUZS(total)}</div>
                        <div className="mt-0.5 text-[11px] opacity-60">{count} chek</div>
                      </div>
                    ))}
                  </div>

                  <Card>
                    <div className="mb-3 text-sm font-semibold text-slate-700">{t("Sotuvlar")} ({filteredSales.length})</div>
                    {filteredSales.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">{t("Sotuvlar topilmadi.")}</div>
                    ) : (
                      <Table>
                        <T>
                          <thead>
                            <tr>
                              <th>{t("Sana")}</th>
                              <th>{t("Mahsulot")}</th>
                              <th>{t("To'lov")}</th>
                              <th>{t("Miqdor")}</th>
                              <th>{t("Narx")}</th>
                              <th>{t("Jami")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSales.map((sale) => (
                              <tr key={sale.id}>
                                <td className="font-semibold">{safeDateLabel(sale.date)}</td>
                                <td>{(sale.product as any)?.name ?? "—"}</td>
                                <td>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${METHOD_COLOR[sale.paymentMethod]}`}>
                                    {t(METHOD_LABEL[sale.paymentMethod])}
                                  </span>
                                </td>
                                <td>{sale.quantity}</td>
                                <td>{moneyUZS(sale.price)}</td>
                                <td className="font-semibold text-emerald-700">{moneyUZS(sale.price * sale.quantity)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </T>
                      </Table>
                    )}
                  </Card>
                </div>
              )}

              {/* ===== SHIFTS TAB ===== */}
              {tab === "shifts" && (
                <Card>
                  <div className="mb-3 text-sm font-semibold text-slate-700">{t("Smenalar")} — {branch.name}</div>
                  {shifts.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">{t("Smenalar topilmadi.")}</div>
                  ) : (
                    <div className="space-y-2">
                      {shifts.map((s) => (
                        <Link
                          key={s.id}
                          href={`/shifts/detail?id=${s.id}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 hover:border-berry-700/30 hover:shadow-card-md transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${s.status === "OPEN" ? "bg-emerald-500" : "bg-slate-400"}`} />
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{safeDateLabel(s.date)}</div>
                              <div className="text-xs text-slate-500">{s.openedBy?.username ?? "—"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{t("Ochildi")}: {new Date(s.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</span>
                            {s.closedAt && <span>{t("Yopildi")}: {new Date(s.closedAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</span>}
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${s.status === "OPEN" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {s.status === "OPEN" ? t("Ochiq") : t("Yopilgan")}
                            </span>
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* ===== TRANSACTIONS TAB ===== */}
              {tab === "transactions" && (
                <div className="space-y-4">
                  {/* Transfers */}
                  <Card>
                    <div className="mb-3 text-sm font-semibold text-slate-700">{t("Transferlar")} ({transfers.length})</div>
                    {transfers.length === 0 ? (
                      <div className="py-4 text-center text-sm text-slate-400">{t("Yo'q.")}</div>
                    ) : (
                      <Table>
                        <T>
                          <thead>
                            <tr>
                              <th>{t("Sana")}</th>
                              <th>{t("Status")}</th>
                              <th>{t("Summa")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transfers.slice(0, 30).map((tr) => (
                              <tr key={tr.id}>
                                <td>{safeDateLabel(tr.date)}</td>
                                <td>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    tr.status === "RECEIVED" ? "bg-emerald-50 text-emerald-700" :
                                    tr.status === "CANCELED" ? "bg-red-50 text-red-700" :
                                    "bg-amber-50 text-amber-700"
                                  }`}>{tr.status}</span>
                                </td>
                                <td className="font-semibold">{moneyUZS(sumItems(tr.items ?? []))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </T>
                      </Table>
                    )}
                  </Card>

                  {/* Returns */}
                  <Card>
                    <div className="mb-3 text-sm font-semibold text-slate-700">{t("Vazvratlar")} ({returns.length})</div>
                    {returns.length === 0 ? (
                      <div className="py-4 text-center text-sm text-slate-400">{t("Yo'q.")}</div>
                    ) : (
                      <Table>
                        <T>
                          <thead>
                            <tr>
                              <th>{t("Sana")}</th>
                              <th>{t("Status")}</th>
                              <th>{t("Summa")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {returns.slice(0, 30).map((ret) => (
                              <tr key={ret.id}>
                                <td>{safeDateLabel(ret.date)}</td>
                                <td>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    ret.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" :
                                    ret.status === "REJECTED" ? "bg-red-50 text-red-700" :
                                    "bg-amber-50 text-amber-700"
                                  }`}>{ret.status}</span>
                                </td>
                                <td className="font-semibold">{moneyUZS(sumItems(ret.items ?? []))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </T>
                      </Table>
                    )}
                  </Card>

                  {/* Cash payments */}
                  <Card>
                    <div className="mb-3 text-sm font-semibold text-slate-700">{t("Kassa to'lovlari")} ({payments.length})</div>
                    {payments.length === 0 ? (
                      <div className="py-4 text-center text-sm text-slate-400">{t("Yo'q.")}</div>
                    ) : (
                      <Table>
                        <T>
                          <thead>
                            <tr>
                              <th>{t("Sana")}</th>
                              <th>{t("To'lov turi")}</th>
                              <th>{t("Summa")}</th>
                              <th>{t("Izoh")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.slice(0, 30).map((p) => (
                              <tr key={p.id}>
                                <td>{safeDateLabel(p.date)}</td>
                                <td>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${METHOD_COLOR[p.paymentMethod]}`}>
                                    {t(METHOD_LABEL[p.paymentMethod])}
                                  </span>
                                </td>
                                <td className="font-semibold text-emerald-700">{moneyUZS(p.amount)}</td>
                                <td className="text-slate-500 text-xs">{p.note ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </T>
                      </Table>
                    )}
                  </Card>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
