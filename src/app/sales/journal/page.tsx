"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/services/http";
import { formatDigitsWithSpaces } from "@/lib/mask";

interface Branch {
  id: string;
  name: string;
}

interface LedgerEntry {
  id: string;
  type: "OPENING" | "CASH_SALE" | "CASH_OUT" | "ADJUSTMENT";
  direction: "IN" | "OUT";
  amount: number;
  note?: string | null;
  occurredAt: string;
}

interface PendingCashOut {
  id: string;
  amount: number;
  recipientType: "OWNER" | "SUPPLIER" | "OTHER";
  note?: string | null;
  createdAt: string;
  createdBy: { username: string };
  shift: { id: string; date: string; branch: { name: string } };
}

const RECIPIENT_LABEL: Record<string, string> = {
  OWNER: "Xo'jayin",
  SUPPLIER: "Ta'minotchi",
  OTHER: "Boshqa",
};

interface ShiftInfo {
  id: string;
  date: string;
  status: string;
  branchName: string;
  cashierName: string;
  openingAmount: number;
  closingAmount?: number | null;
  expectedAmount?: number | null;
  differenceAmount?: number | null;
  snapshot?: { cashSalesTotal: number; cashOutTotal: number; currentCash: number } | null;
}

interface ShiftListItem {
  id: string;
  date: string;
  status: string;
  branch: { id: string; name: string };
  openedBy: { username: string };
  openingAmount: number;
  closedAt?: string | null;
}

interface LedgerResponse {
  shift: ShiftInfo;
  entries: LedgerEntry[];
}

function typeLabel(type: string, t: (k: string) => string) {
  switch (type) {
    case "OPENING": return t("Boshlang'ich qoldiq");
    case "CASH_SALE": return t("Naqd sotuv");
    case "CASH_OUT": return t("Chiqim");
    case "ADJUSTMENT": return t("Tuzatish");
    default: return type;
  }
}

function typeBadge(type: string, direction: string, t: (k: string) => string) {
  if (direction === "IN") {
    return <Badge tone="primary">↑ {typeLabel(type, t)}</Badge>;
  }
  return <Badge tone="neutral">↓ {typeLabel(type, t)}</Badge>;
}

function parseRaw(val: string) {
  return Number(val.replace(/\s/g, "")) || 0;
}

export default function KassaJournalPage() {
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [shifts, setShifts] = useState<ShiftListItem[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Filial joriy kassa qoldig'i
  const [branchCash, setBranchCash] = useState<{
    currentCash: number;
    shiftDate: string | null;
    shiftStatus: string | null;
    hasData: boolean;
  } | null>(null);

  // Tuzatish modali
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjDirection, setAdjDirection] = useState<"IN" | "OUT">("IN");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  // Kutayotgan chiqimlar
  const [pendingCashOuts, setPendingCashOuts] = useState<PendingCashOut[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPendingCashOuts = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const qs = new URLSearchParams();
      if (branchId) qs.set("branchId", branchId);
      const list = await apiFetch<PendingCashOut[]>(`/sales/cash-outs/pending?${qs}`);
      setPendingCashOuts(list);
    } catch { /* ignore */ }
  }, [isAdmin, branchId]);

  useEffect(() => { void loadPendingCashOuts(); }, [loadPendingCashOuts]);

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      await apiFetch(`/sales/cash-outs/${id}/approve`, { method: "POST" });
      toast.success(t("Tasdiqlandi"), t("Chiqim balansddan ayirildi"));
      void loadPendingCashOuts();
      void loadLedger();
      void loadBranchCash();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    try {
      await apiFetch(`/sales/cash-outs/${id}/reject`, { method: "POST" });
      toast.success(t("Rad etildi"), t("Chiqim rad etildi"));
      void loadPendingCashOuts();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setProcessingId(null);
    }
  }

  // Boshlang'ich qoldiq (admin-open) modali
  const [initOpen, setInitOpen] = useState(false);
  const [initBranchId, setInitBranchId] = useState("");
  const [initAmount, setInitAmount] = useState("");
  const [initNote, setInitNote] = useState("");
  const [initSaving, setInitSaving] = useState(false);

  async function handleAdminOpen() {
    const amount = parseRaw(initAmount);
    if (!initBranchId) {
      toast.error(t("Xatolik"), t("Filial tanlang"));
      return;
    }
    if (amount < 0) {
      toast.error(t("Xatolik"), t("Summa manfiy bo'lmasin"));
      return;
    }
    setInitSaving(true);
    try {
      const res = await apiFetch<{ shiftId: string; created: boolean }>("/sales/shifts/admin-open", {
        method: "POST",
        body: JSON.stringify({ branchId: initBranchId, openingAmount: amount, note: initNote.trim() || undefined }),
      });
      toast.success(
        t("Saqlandi"),
        res.created ? t("Yangi smena ochildi va boshlang'ich qoldiq yozildi") : t("Mavjud smenaga qoldiq qo'shildi"),
      );
      setInitOpen(false);
      setInitAmount("");
      setInitNote("");
      void loadShifts();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setInitSaving(false);
    }
  }

  // Filiallar ro'yxatini yuklash
  useEffect(() => {
    apiFetch<Branch[]>("/branches")
      .then((list) => setBranches(list))
      .catch(() => {});
  }, []);

  // Filial tanlanganda joriy kassani yuklash
  const loadBranchCash = useCallback(async () => {
    if (!branchId || !isAdmin) { setBranchCash(null); return; }
    try {
      const data = await apiFetch<{ currentCash: number; shiftDate: string | null; shiftStatus: string | null; hasData: boolean }>(
        `/sales/branch-cash?branchId=${branchId}`
      );
      setBranchCash(data);
    } catch { setBranchCash(null); }
  }, [branchId, isAdmin]);

  useEffect(() => { void loadBranchCash(); }, [loadBranchCash]);

  const loadShifts = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ from, to });
      if (branchId) qs.set("branchId", branchId);
      const list = await apiFetch<ShiftListItem[]>(`/sales/shifts?${qs}`);
      setShifts(list);
      // Smena o'zgarganda avtomatik birinchisini tanlash
      setSelectedShiftId(list.length > 0 ? list[0].id : "");
      if (list.length === 0) setLedger(null);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    }
  }, [from, to, branchId, t, toast]);

  useEffect(() => { void loadShifts(); }, [loadShifts]);

  const loadLedger = useCallback(async () => {
    if (!selectedShiftId) { setLedger(null); return; }
    setLoading(true);
    try {
      const data = await apiFetch<LedgerResponse>(`/sales/shifts/${selectedShiftId}/ledger`);
      setLedger(data);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }, [selectedShiftId, t, toast]);

  useEffect(() => { void loadLedger(); }, [loadLedger]);

  async function handleAdjustment() {
    const amount = parseRaw(adjAmount);
    if (!amount || amount <= 0) {
      toast.error(t("Xatolik"), t("Summa 0 dan katta bo'lsin"));
      return;
    }
    if (!selectedShiftId) return;
    setAdjSaving(true);
    try {
      await apiFetch(`/sales/shifts/${selectedShiftId}/adjustment`, {
        method: "POST",
        body: JSON.stringify({ amount, direction: adjDirection, note: adjNote.trim() || undefined }),
      });
      toast.success(t("Saqlandi"), t("Kassa tuzatish yozildi"));
      setAdjOpen(false);
      setAdjAmount("");
      setAdjNote("");
      void loadLedger();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setAdjSaving(false);
    }
  }

  function handlePrint() {
    if (!ledger) return;
    const { shift, entries } = ledger;
    const currentCash = shift.snapshot?.currentCash ?? (totalIn - totalOut);

    const rows = entries.map((e) => `
      <tr>
        <td>${new Date(e.occurredAt).toLocaleTimeString("uz-UZ")}</td>
        <td>${typeLabel(e.type, t)}</td>
        <td style="color:${e.direction === "IN" ? "#15803d" : "#dc2626"};text-align:right;font-weight:600">
          ${e.direction === "IN" ? "+" : "−"}${e.amount.toLocaleString()}
        </td>
        <td>${e.note ?? "—"}</td>
      </tr>
    `).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>Kassa Jurnali — ${shift.date}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;margin:16px;color:#1f1a17}
        h2{margin:0 0 4px}p{margin:2px 0;font-size:11px;color:#5c5048}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{padding:6px 8px;border:1px solid #e5ded7;text-align:left}
        th{background:#f5f0ea;font-weight:700;font-size:11px}
        .summary{display:flex;gap:24px;margin-top:16px;padding:12px;background:#f5f0ea;border-radius:8px}
        .sum-item{text-align:center}.sum-item .lbl{font-size:10px;color:#5c5048}.sum-item .val{font-size:14px;font-weight:700}
        .cash-box{margin-top:14px;padding:12px 16px;background:#1a2e1a;color:#fff;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
        @media print{@page{margin:10mm}}
      </style></head><body>
      <h2>Kassa Jurnali</h2>
      <p>Sana: <b>${shift.date}</b> | Filial: <b>${shift.branchName}</b> | Kassir: <b>${shift.cashierName}</b></p>
      <p>Boshlang'ich: <b>${shift.openingAmount.toLocaleString()} so'm</b>
        ${shift.closingAmount != null ? ` | Yopilish: <b>${shift.closingAmount.toLocaleString()} so'm</b>` : ""}
        ${shift.differenceAmount != null ? ` | Farq: <b>${shift.differenceAmount > 0 ? "+" : ""}${shift.differenceAmount.toLocaleString()} so'm</b>` : ""}
      </p>
      <table><thead><tr><th>Vaqt</th><th>Tur</th><th>Summa</th><th>Izoh</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="summary">
        <div class="sum-item"><div class="lbl">Jami kirim</div><div class="val" style="color:#15803d">+${totalIn.toLocaleString()}</div></div>
        <div class="sum-item"><div class="lbl">Jami chiqim</div><div class="val" style="color:#dc2626">−${totalOut.toLocaleString()}</div></div>
        <div class="sum-item"><div class="lbl">Kirim − Chiqim</div><div class="val">${(totalIn - totalOut).toLocaleString()}</div></div>
      </div>
      <div class="cash-box">
        <span style="font-size:13px;font-weight:600">Kassada hozir:</span>
        <span style="font-size:20px;font-weight:700">${currentCash.toLocaleString()} so'm</span>
      </div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
      </body></html>`;

    const w = window.open("", "_blank", "width=700,height=900");
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  const totalIn = ledger?.entries.filter((e) => e.direction === "IN").reduce((s, e) => s + e.amount, 0) ?? 0;
  const totalOut = ledger?.entries.filter((e) => e.direction === "OUT").reduce((s, e) => s + e.amount, 0) ?? 0;
  const currentCash = ledger?.shift.snapshot?.currentCash ?? (totalIn - totalOut);
  const isOpen = ledger?.shift.status === "OPEN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Kassa Jurnali")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Filial va smena bo'yicha kassa kirim-chiqim tarixi")}</p>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filial tanlov */}
          <select
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setSelectedShiftId(""); }}
            className="rounded-xl border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
          >
            <option value="">{t("Barcha filiallar")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-cocoa-700">{t("Dan")}:</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-cocoa-700">{t("Gacha")}:</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none" />
          </div>
          <select
            value={selectedShiftId}
            onChange={(e) => setSelectedShiftId(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl border border-cream-200 bg-cream-50 px-3 py-1.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
          >
            <option value="">{t("Smena tanlang...")}</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.date} — {s.branch.name} — {s.openedBy.username} ({s.status === "OPEN" ? t("Ochiq") : t("Yopilgan")})
              </option>
            ))}
          </select>
          {ledger && (
            <Button variant="ghost" onClick={handlePrint}>🖨 {t("Chop etish")}</Button>
          )}
        </div>
      </Card>

      {/* Filial joriy kassa qoldig'i — har doim ko'rinadi */}
      {isAdmin && branchId && (
        <div className={`rounded-2xl border-2 px-6 py-5 flex flex-wrap items-center justify-between gap-4 ${
          branchCash?.shiftStatus === "OPEN"
            ? "border-green-300 bg-green-50"
            : branchCash?.hasData
            ? "border-slate-200 bg-slate-50"
            : "border-amber-200 bg-amber-50"
        }`}>
          <div>
            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${
              branchCash?.shiftStatus === "OPEN" ? "text-green-700"
              : branchCash?.hasData ? "text-slate-500"
              : "text-amber-700"
            }`}>
              {branchCash?.shiftStatus === "OPEN"
                ? `🟢 ${t("Ochiq smena")} — ${branches.find(b => b.id === branchId)?.name ?? ""}`
                : branchCash?.hasData
                ? `⚫ ${t("Yopilgan smena")} — ${branches.find(b => b.id === branchId)?.name ?? ""}`
                : `⚠️ ${t("Ma'lumot yo'q")} — ${branches.find(b => b.id === branchId)?.name ?? ""}`}
            </div>
            {branchCash?.shiftDate && (
              <div className="text-sm text-slate-600">
                {t("Oxirgi smena")}: <b>{branchCash.shiftDate}</b>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${
              branchCash?.shiftStatus === "OPEN" ? "text-green-700" : "text-slate-500"
            }`}>
              {t("Kassada hozir")}
            </div>
            <div className={`text-5xl font-black tabular-nums ${
              branchCash?.shiftStatus === "OPEN" ? "text-green-700"
              : branchCash?.hasData ? "text-slate-800"
              : "text-amber-600"
            }`}>
              {(branchCash?.currentCash ?? 0).toLocaleString()}
              <span className="text-2xl font-semibold ml-2">{t("so'm")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Kutayotgan chiqimlar — admin tasdiqlashi kerak */}
      {isAdmin && pendingCashOuts.length > 0 && (
        <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 px-6 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white">
              {pendingCashOuts.length}
            </span>
            <span className="text-sm font-bold text-orange-800">
              {t("Kassadan chiqim so'rovlari — tasdiq kutmoqda")}
            </span>
          </div>
          <div className="space-y-2">
            {pendingCashOuts.map((co) => (
              <div key={co.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-white px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="text-orange-600">{co.amount.toLocaleString()} {t("so'm")}</span>
                    <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                      {RECIPIENT_LABEL[co.recipientType] ?? co.recipientType}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {co.shift.branch.name} · {co.shift.date} · {co.createdBy.username}
                    {co.note ? ` · "${co.note}"` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={processingId === co.id}
                    onClick={() => void handleApprove(co.id)}
                    className="rounded-lg border border-green-600 bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    ✓ {t("Tasdiqlash")}
                  </button>
                  <button
                    type="button"
                    disabled={processingId === co.id}
                    onClick={() => void handleReject(co.id)}
                    className="rounded-lg border border-red-500 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    ✗ {t("Rad etish")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin: Boshlang'ich qoldiq o'rnatish — smena yo'q bo'lganda */}
      {isAdmin && shifts.length === 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-1 text-amber-700">
              ⚠️ {t("Bu oraliqda smena topilmadi")}
            </div>
            <div className="text-sm text-amber-800">
              {t("Kassadagi boshlang'ich qoldiqni o'rnatish uchun yangi smena oching.")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setInitBranchId(branchId || (branches[0]?.id ?? "")); setInitOpen(true); }}
            className="rounded-xl border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition"
          >
            + {t("Boshlang'ich qoldiq o'rnatish")}
          </button>
        </div>
      )}

      {/* Kassadagi pul — asosiy ko'rsatgich */}
      {ledger && (
        <div className={`rounded-2xl border-2 px-6 py-5 flex flex-wrap items-center justify-between gap-4 ${
          isOpen
            ? "border-green-300 bg-green-50"
            : "border-slate-200 bg-slate-50"
        }`}>
          <div>
            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isOpen ? "text-green-700" : "text-slate-500"}`}>
              {isOpen ? `🟢 ${t("Ochiq smena")} — ${ledger.shift.branchName}` : `⚫ ${t("Yopilgan smena")} — ${ledger.shift.branchName}`}
            </div>
            <div className="text-sm text-slate-600">
              {t("Kassir")}: <b>{ledger.shift.cashierName}</b> · {t("Sana")}: <b>{ledger.shift.date}</b>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => { setAdjDirection("IN"); setAdjOpen(true); }}
                className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                + {t("Kassa tuzatish")}
              </button>
            )}
          </div>
          <div className="text-right">
            <div className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${isOpen ? "text-green-700" : "text-slate-500"}`}>
              {isOpen ? t("Hozir kassada") : t("Smena yakunida kassada")}
            </div>
            <div className={`text-4xl font-black tabular-nums ${isOpen ? "text-green-700" : "text-slate-800"}`}>
              {currentCash.toLocaleString()} <span className="text-xl font-semibold">{t("so'm")}</span>
            </div>
            {ledger.shift.differenceAmount != null && (
              <div className={`mt-1 text-sm font-semibold ${ledger.shift.differenceAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                {ledger.shift.differenceAmount >= 0 ? "+" : ""}{ledger.shift.differenceAmount.toLocaleString()} {t("so'm farq")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary cards */}
      {ledger && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <div className="text-xs font-semibold text-cocoa-600">{t("Boshlang'ich")}</div>
            <div className="mt-1 text-xl font-bold text-cocoa-900">
              {ledger.shift.openingAmount.toLocaleString()} {t("so'm")}
            </div>
          </Card>
          <Card>
            <div className="text-xs font-semibold text-green-700">{t("Jami kirim")}</div>
            <div className="mt-1 text-xl font-bold text-green-700">+{totalIn.toLocaleString()} {t("so'm")}</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold text-red-600">{t("Jami chiqim")}</div>
            <div className="mt-1 text-xl font-bold text-red-600">−{totalOut.toLocaleString()} {t("so'm")}</div>
          </Card>
          <Card>
            <div className="text-xs font-semibold text-cocoa-600">{t("Naqd sotuv")}</div>
            <div className="mt-1 text-xl font-bold text-cocoa-900">
              {(ledger.shift.snapshot?.cashSalesTotal ?? 0).toLocaleString()} {t("so'm")}
            </div>
          </Card>
        </div>
      )}

      {/* Ledger entries */}
      <Card>
        {loading ? (
          <div className="py-8 text-center text-sm text-cocoa-500">{t("Yuklanmoqda...")}</div>
        ) : !ledger ? (
          <div className="py-8 text-center text-sm text-cocoa-500">
            {shifts.length === 0
              ? t("Bu oraliqda smena topilmadi.")
              : t("Smena tanlanmagan.")}
          </div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Vaqt")}</th>
                  <th>{t("Tur")}</th>
                  <th className="text-right">{t("Summa")}</th>
                  <th>{t("Izoh")}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-sm text-cocoa-600 tabular-nums">
                      {new Date(entry.occurredAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{typeBadge(entry.type, entry.direction, t)}</td>
                    <td className={`text-right font-semibold tabular-nums ${entry.direction === "IN" ? "text-green-700" : "text-red-600"}`}>
                      {entry.direction === "IN" ? "+" : "−"}{entry.amount.toLocaleString()}
                    </td>
                    <td className="text-sm text-cocoa-600">{entry.note ?? "—"}</td>
                  </tr>
                ))}
                {ledger.entries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-cocoa-500">
                      {t("Bu smena uchun jurnal yozuvlari yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        )}
      </Card>
      {/* Kassa tuzatish modali (faqat admin) */}
      {/* Boshlang'ich qoldiq modal */}
      {isAdmin && (
        <Modal
          title={t("Boshlang'ich qoldiq o'rnatish")}
          open={initOpen}
          onClose={() => { setInitOpen(false); setInitAmount(""); setInitNote(""); }}
        >
          <div className="space-y-4">
            <p className="text-sm text-cocoa-600">
              {t("ERP birinchi marta ishga tushganda yoki kassada fizik pul bo'lganda shu yerdan kiriting. Filial va summa tanlang.")}
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Filial")}</label>
              <select
                value={initBranchId}
                onChange={(e) => setInitBranchId(e.target.value)}
                className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
              >
                <option value="">{t("Filial tanlang...")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Kassadagi boshlang'ich summa (so'm)")}</label>
              <input
                type="text"
                inputMode="numeric"
                value={initAmount ? formatDigitsWithSpaces(initAmount.replace(/\s/g, "")) : ""}
                onChange={(e) => setInitAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="Masalan: 1 000 000"
                className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Izoh (ixtiyoriy)")}</label>
              <input
                type="text"
                value={initNote}
                onChange={(e) => setInitNote(e.target.value)}
                placeholder={t("Masalan: Dastlabki balans, Naqd kirim...")}
                className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setInitOpen(false)}>{t("Bekor")}</Button>
              <Button
                onClick={() => void handleAdminOpen()}
                disabled={initSaving || !initBranchId}
              >
                {initSaving ? t("Saqlanmoqda...") : t("Saqlash")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isAdmin && (
        <Modal
          title={t("Kassa tuzatish")}
          open={adjOpen}
          onClose={() => { setAdjOpen(false); setAdjAmount(""); setAdjNote(""); }}
        >
          <div className="space-y-4">
            <p className="text-sm text-cocoa-600">
              {t("ERP boshlanganda yoki qo'lda pul kirim/chiqim bo'lganda kassa balansini to'g'irlang.")}
            </p>

            {/* Yo'nalish */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjDirection("IN")}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  adjDirection === "IN"
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-cream-300 bg-white text-cocoa-700 hover:bg-cream-50"
                }`}
              >
                ↑ {t("Kassaga kirim")}
                <div className="text-xs font-normal opacity-75">{t("Pul qo'shish")}</div>
              </button>
              <button
                type="button"
                onClick={() => setAdjDirection("OUT")}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  adjDirection === "OUT"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-cream-300 bg-white text-cocoa-700 hover:bg-cream-50"
                }`}
              >
                ↓ {t("Kassadan chiqim")}
                <div className="text-xs font-normal opacity-75">{t("Pul ayirish")}</div>
              </button>
            </div>

            {/* Summa */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Summa (so'm)")}</label>
              <input
                type="text"
                inputMode="numeric"
                value={adjAmount ? formatDigitsWithSpaces(adjAmount.replace(/\s/g, "")) : ""}
                onChange={(e) => setAdjAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="Masalan: 500 000"
                className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
              />
            </div>

            {/* Izoh */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Sabab / izoh")}</label>
              <input
                type="text"
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                placeholder={t("Masalan: Boshlang'ich qoldiq, Naqd to'ldirish...")}
                className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
              />
            </div>

            {/* Hisob */}
            {adjAmount && parseRaw(adjAmount) > 0 && (
              <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                adjDirection === "IN" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
              }`}>
                {t("Kassada hozir")}: {currentCash.toLocaleString()} {t("so'm")}
                <span className="mx-2">{adjDirection === "IN" ? "+" : "−"}</span>
                {parseRaw(adjAmount).toLocaleString()} {t("so'm")}
                <span className="mx-2">=</span>
                <b>{(adjDirection === "IN"
                  ? currentCash + parseRaw(adjAmount)
                  : currentCash - parseRaw(adjAmount)
                ).toLocaleString()} {t("so'm")}</b>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setAdjOpen(false)}>{t("Bekor")}</Button>
              <Button
                onClick={() => void handleAdjustment()}
                disabled={adjSaving || !adjAmount || parseRaw(adjAmount) <= 0}
              >
                {adjSaving ? t("Saqlanmoqda...") : t("Saqlash")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
