"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { salesService, type ShopOrder } from "@/services/sales";
import { moneyUZS } from "@/lib/format";

type TabStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

const TAB_LABELS: Record<TabStatus, string> = {
  ACTIVE: "Faol",
  COMPLETED: "Tugallangan",
  CANCELLED: "Bekor qilingan",
};

const STATUS_BADGE: Record<
  ShopOrder["status"],
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Kutilmoqda",
    className:
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700",
  },
  COMPLETED: {
    label: "Tugallangan",
    className:
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700",
  },
  CANCELLED: {
    label: "Bekor",
    className:
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700",
  },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatDeliveryDate(iso: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Returns true if delivery date is today or already passed */
function isDeliveryUrgent(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d <= today;
}

// ─── Print single order ──────────────────────────────────────────────────────

function printOrder(order: ShopOrder) {
  const remaining = order.totalAmount - order.paidAmount;
  const deliveryStr = formatDeliveryDate(order.deliveryDate) ?? "—";

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Buyurtma</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:13px;margin:0;padding:12px;color:#1a1a1a;max-width:300px}
      h2{margin:0 0 6px;font-size:16px;text-align:center}
      .sep{border:none;border-top:1px dashed #999;margin:8px 0}
      .row{display:flex;justify-content:space-between;margin-bottom:4px}
      .label{color:#555;font-size:12px}
      .val{font-weight:700;font-size:12px}
      .big{font-size:15px;font-weight:700}
      .delivery{background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:6px 10px;margin:8px 0;text-align:center;font-weight:700;font-size:14px}
      .prepared{background:#d1fae5;border:1px solid #34d399;border-radius:6px;padding:4px 10px;text-align:center;font-size:12px;margin-top:6px}
      @media print{@page{margin:4mm;size:80mm auto}}
    </style></head><body>
    <h2>📦 Buyurtma</h2>
    <hr class="sep"/>
    <div class="row"><span class="label">Sana:</span><span class="val">${formatDate(order.createdAt)}</span></div>
    ${order.customerName ? `<div class="row"><span class="label">Mijoz:</span><span class="val">${order.customerName}</span></div>` : ""}
    ${order.phone ? `<div class="row"><span class="label">Telefon:</span><span class="val">${order.phone}</span></div>` : ""}
    <hr class="sep"/>
    <div style="margin-bottom:8px">
      <div class="label" style="margin-bottom:2px">Tavsif:</div>
      <div class="big">${order.description}</div>
    </div>
    ${order.note ? `<div style="margin-bottom:8px"><div class="label">Izoh:</div><div>${order.note}</div></div>` : ""}
    <div class="delivery">🗓 Yetkazish: ${deliveryStr}</div>
    <hr class="sep"/>
    <div class="row"><span class="label">Jami:</span><span class="val">${moneyUZS(order.totalAmount)}</span></div>
    <div class="row"><span class="label">To'langan:</span><span class="val" style="color:#16a34a">${moneyUZS(order.paidAmount)}</span></div>
    ${remaining > 0 ? `<div class="row"><span class="label">Qoldiq:</span><span class="val" style="color:#ea580c">${moneyUZS(remaining)}</span></div>` : ""}
    ${order.preparedAt ? `<div class="prepared">✅ Tayyorlandi: ${formatDate(order.preparedAt)}</div>` : `<div style="margin-top:16px;border:1px dashed #ccc;height:40px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:11px">Tayyorlandi imzosi</div>`}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),600)}</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=380,height=600");
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
}

/** Print multiple orders with page-break between each */
export function printAllOrders(orders: ShopOrder[]) {
  if (orders.length === 0) return;

  const orderBlocks = orders.map((order) => {
    const remaining = order.totalAmount - order.paidAmount;
    const deliveryStr = formatDeliveryDate(order.deliveryDate) ?? "—";
    return `
      <div class="order-block">
        <h2>📦 Buyurtma</h2>
        <hr class="sep"/>
        <div class="row"><span class="label">Sana:</span><span class="val">${formatDate(order.createdAt)}</span></div>
        ${order.customerName ? `<div class="row"><span class="label">Mijoz:</span><span class="val">${order.customerName}</span></div>` : ""}
        ${order.phone ? `<div class="row"><span class="label">Telefon:</span><span class="val">${order.phone}</span></div>` : ""}
        <hr class="sep"/>
        <div style="margin-bottom:8px">
          <div class="label" style="margin-bottom:2px">Tavsif:</div>
          <div class="big">${order.description}</div>
        </div>
        ${order.note ? `<div style="margin-bottom:8px"><div class="label">Izoh:</div><div>${order.note}</div></div>` : ""}
        <div class="delivery">🗓 Yetkazish: ${deliveryStr}</div>
        <hr class="sep"/>
        <div class="row"><span class="label">Jami:</span><span class="val">${moneyUZS(order.totalAmount)}</span></div>
        <div class="row"><span class="label">To'langan:</span><span class="val" style="color:#16a34a">${moneyUZS(order.paidAmount)}</span></div>
        ${remaining > 0 ? `<div class="row"><span class="label">Qoldiq:</span><span class="val" style="color:#ea580c">${moneyUZS(remaining)}</span></div>` : ""}
        <div style="margin-top:16px;border:1px dashed #ccc;height:40px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:11px">Tayyorlandi imzosi</div>
      </div>
    `;
  }).join("\n");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Barcha buyurtmalar</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:13px;margin:0;padding:0;color:#1a1a1a}
      .order-block{max-width:300px;margin:0 auto;padding:12px;page-break-after:always}
      .order-block:last-child{page-break-after:avoid}
      h2{margin:0 0 6px;font-size:16px;text-align:center}
      .sep{border:none;border-top:1px dashed #999;margin:8px 0}
      .row{display:flex;justify-content:space-between;margin-bottom:4px}
      .label{color:#555;font-size:12px}
      .val{font-weight:700;font-size:12px}
      .big{font-size:15px;font-weight:700}
      .delivery{background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:6px 10px;margin:8px 0;text-align:center;font-weight:700;font-size:14px}
      @media print{@page{margin:4mm;size:80mm auto}}
    </style></head><body>
    ${orderBlocks}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),600)}</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=420,height=700");
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
}

// ─── Create Order Modal ──────────────────────────────────────────────────────

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (order: ShopOrder) => void;
}

function CreateOrderModal({ open, onClose, onCreated }: CreateOrderModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [payMode, setPayMode] = useState<"full" | "deposit">("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [note, setNote] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  function reset() {
    setDescription("");
    setCustomerName("");
    setPhone("");
    setTotalAmount("");
    setPayMode("deposit");
    setDepositAmount("");
    setNote("");
    setDeliveryDate("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const total = Number(totalAmount.replace(/\s/g, ""));
    if (!description.trim()) {
      toast.error("Tavsif kiritish majburiy");
      return;
    }
    if (!total || total <= 0) {
      toast.error("Jami summa kiritish majburiy");
      return;
    }
    const deposit = payMode === "full" ? total : Number(depositAmount.replace(/\s/g, ""));
    if (deposit < 0 || deposit > total) {
      toast.error("Boshlang'ich summa jami summadan katta bo'lishi mumkin emas");
      return;
    }

    setLoading(true);
    try {
      const order = await salesService.createShopOrder({
        description: description.trim(),
        totalAmount: total,
        depositAmount: deposit,
        customerName: customerName.trim() || undefined,
        phone: phone.trim() || undefined,
        note: note.trim() || undefined,
        deliveryDate: deliveryDate || undefined,
      });
      toast.success("Buyurtma yaratildi");
      onCreated(order);
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Yangi buyurtma" open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-1">
        <Input
          label="Tavsif *"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Masalan: 160 000 so'm tort"
          required
        />
        <Input
          label="Mijoz ismi"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Ixtiyoriy"
        />
        <Input
          label="Telefon"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998..."
          type="tel"
        />
        <Input
          label="Jami summa *"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          placeholder="160000"
          type="number"
          min={1}
          required
        />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-cocoa-600">
            To'lov turi
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="payMode"
              value="full"
              checked={payMode === "full"}
              onChange={() => setPayMode("full")}
              className="accent-cocoa-600"
            />
            <span className="text-sm">To'liq to'landi</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="payMode"
              value="deposit"
              checked={payMode === "deposit"}
              onChange={() => setPayMode("deposit")}
              className="accent-cocoa-600"
            />
            <span className="text-sm">Boshlang'ich summa kiritish</span>
          </label>
        </div>

        {payMode === "deposit" && (
          <Input
            label="Boshlang'ich summa"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="100000"
            type="number"
            min={0}
          />
        )}

        {/* Yetkazish sanasi */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-cocoa-600">
            Yetkazish sanasi
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-berry-500 focus:ring-1 focus:ring-berry-500"
          />
          <p className="text-xs text-cocoa-400">Buyurtma qachon tayyor bo'lishi kerak</p>
        </div>

        <Input
          label="Eslatma"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ixtiyoriy"
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Pay Order Modal ─────────────────────────────────────────────────────────

interface PayOrderModalProps {
  order: ShopOrder | null;
  onClose: () => void;
  onPaid: (order: ShopOrder) => void;
}

function PayOrderModal({ order, onClose, onPaid }: PayOrderModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (order) {
      setAmount(String(order.totalAmount - order.paidAmount));
    }
  }, [order]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    const value = Number(amount.replace(/\s/g, ""));
    if (!value || value <= 0) {
      toast.error("Summa kiritish majburiy");
      return;
    }

    setLoading(true);
    try {
      const updated = await salesService.payShopOrder(order.id, value);
      toast.success("To'lov amalga oshirildi");
      onPaid(updated);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  if (!order) return null;
  const remaining = order.totalAmount - order.paidAmount;

  return (
    <Modal title="Qolgan summani to'lash" open={!!order} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-1">
        <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
          <div className="font-medium text-slate-700">{order.description}</div>
          {order.customerName && (
            <div className="text-slate-500">Mijoz: {order.customerName}</div>
          )}
          <div className="text-slate-500">
            Jami: {moneyUZS(order.totalAmount)} | To'langan:{" "}
            {moneyUZS(order.paidAmount)} | Qoldiq:{" "}
            <span className="font-semibold text-orange-600">
              {moneyUZS(remaining)}
            </span>
          </div>
        </div>

        <Input
          label="To'lov summasi *"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(remaining)}
          type="number"
          min={1}
          max={remaining}
          required
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "To'lanmoqda..." : "To'lash"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ShopOrdersPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [tab, setTab] = useState<TabStatus>("ACTIVE");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [payOrder, setPayOrder] = useState<ShopOrder | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesService.listShopOrders(tab);
      setOrders(data);
    } catch (err: any) {
      toast.error(err?.message ?? "Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function handleCreated(order: ShopOrder) {
    if (order.status === tab || tab === "ACTIVE") {
      setOrders((prev) => [order, ...prev]);
    }
    if (order.status !== tab) {
      loadOrders();
    }
  }

  function handlePaid(updated: ShopOrder) {
    if (updated.status === tab) {
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== updated.id));
    }
  }

  async function handleCancel(id: string) {
    const confirmed = window.confirm(
      "Ushbu buyurtmani bekor qilmoqchimisiz?"
    );
    if (!confirmed) return;
    setCancellingId(id);
    try {
      await salesService.cancelShopOrder(id);
      toast.success("Buyurtma bekor qilindi");
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (err: any) {
      toast.error(err?.message ?? "Xatolik yuz berdi");
    } finally {
      setCancellingId(null);
    }
  }

  async function handlePrepared(order: ShopOrder) {
    setPreparingId(order.id);
    try {
      const updated = await salesService.markPrepared(order.id);
      toast.success(
        updated.preparedAt ? "Tayyorlandi belgisi qo'yildi ✅" : "Belgi olib tashlandi"
      );
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err: any) {
      toast.error(err?.message ?? "Xatolik yuz berdi");
    } finally {
      setPreparingId(null);
    }
  }

  const canCreate = user?.role === "SALES" || user?.role === "MANAGER";
  const canPrepare =
    user?.role === "PRODUCTION" ||
    user?.role === "SALES" ||
    user?.role === "MANAGER" ||
    user?.role === "ADMIN";

  const activeOrders = orders.filter((o) => o.status === "ACTIVE");

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">Buyurtmalar</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {tab === "ACTIVE" && activeOrders.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => printAllOrders(activeOrders)}
              className="flex items-center gap-1.5 text-xs"
            >
              🖨 Barchasini chop ({activeOrders.length})
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setShowCreate(true)}>
              + Yangi buyurtma
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["ACTIVE", "COMPLETED", "CANCELLED"] as TabStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === s
                ? "border-cocoa-600 text-cocoa-700"
                : "border-transparent text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {TAB_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Yuklanmoqda...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {tab === "ACTIVE"
              ? "Faol buyurtmalar yo'q"
              : tab === "COMPLETED"
              ? "Tugallangan buyurtmalar yo'q"
              : "Bekor qilingan buyurtmalar yo'q"}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => {
              const remaining = order.totalAmount - order.paidAmount;
              const badge = STATUS_BADGE[order.status];
              const urgent = isDeliveryUrgent(order.deliveryDate);
              return (
                <div
                  key={order.id}
                  className={[
                    "flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between",
                    order.preparedAt ? "bg-emerald-50/50" : "",
                  ].join(" ")}
                >
                  {/* Left: info */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">
                        {order.description}
                      </span>
                      <span className={badge.className}>{badge.label}</span>
                      {order.preparedAt && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                          ✅ Tayyorlandi
                        </span>
                      )}
                    </div>

                    {(order.customerName || order.phone) && (
                      <div className="text-xs text-slate-500">
                        {order.customerName && (
                          <span>Mijoz: {order.customerName}</span>
                        )}
                        {order.customerName && order.phone && (
                          <span> &bull; </span>
                        )}
                        {order.phone && <span>{order.phone}</span>}
                      </div>
                    )}

                    {/* Delivery date */}
                    {order.deliveryDate && (
                      <div
                        className={[
                          "text-xs font-semibold flex items-center gap-1",
                          urgent
                            ? "text-rose-600"
                            : "text-amber-600",
                        ].join(" ")}
                      >
                        🗓 Yetkazish:{" "}
                        <span>
                          {formatDeliveryDate(order.deliveryDate)}
                        </span>
                        {urgent && (
                          <span className="rounded bg-rose-100 px-1 py-0.5 text-[10px] font-bold text-rose-700">
                            BUGUN/O'TDI
                          </span>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-slate-500 flex flex-wrap gap-3 mt-0.5">
                      <span>
                        Jami:{" "}
                        <span className="font-medium text-slate-700">
                          {moneyUZS(order.totalAmount)}
                        </span>
                      </span>
                      <span>
                        To'langan:{" "}
                        <span className="font-medium text-green-700">
                          {moneyUZS(order.paidAmount)}
                        </span>
                      </span>
                      {remaining > 0 && (
                        <span>
                          Qoldiq:{" "}
                          <span className="font-medium text-orange-600">
                            {moneyUZS(remaining)}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 mt-0.5">
                      {formatDate(order.createdAt)}
                      {order.createdBy && (
                        <span> &bull; {order.createdBy.username}</span>
                      )}
                    </div>
                    {order.note && (
                      <div className="text-xs text-slate-500 italic">
                        {order.note}
                      </div>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {/* Print single order */}
                    {order.status === "ACTIVE" && (
                      <button
                        onClick={() => printOrder(order)}
                        title="Chop etish"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9"/>
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                          <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                      </button>
                    )}

                    {/* Tayyorlandi */}
                    {order.status === "ACTIVE" && canPrepare && (
                      <Button
                        variant={order.preparedAt ? "ghost" : "ghost"}
                        onClick={() => handlePrepared(order)}
                        disabled={preparingId === order.id}
                        className={[
                          "px-3 py-1 text-xs",
                          order.preparedAt
                            ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                            : "text-cocoa-700 hover:bg-cream-100",
                        ].join(" ")}
                      >
                        {preparingId === order.id
                          ? "..."
                          : order.preparedAt
                          ? "✅ Tayyorlandi"
                          : "Tayyorlandi"}
                      </Button>
                    )}

                    {order.status === "ACTIVE" && canCreate && (
                      <Button
                        className="px-3 py-1 text-xs"
                        onClick={() => setPayOrder(order)}
                      >
                        Qolgan summani to'lash
                      </Button>
                    )}
                    {order.status !== "COMPLETED" && (
                      <Button
                        variant="ghost"
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        {cancellingId === order.id
                          ? "Bekor qilinmoqda..."
                          : "Bekor qilish"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modals */}
      <CreateOrderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
      <PayOrderModal
        order={payOrder}
        onClose={() => setPayOrder(null)}
        onPaid={handlePaid}
      />
    </div>
  );
}
