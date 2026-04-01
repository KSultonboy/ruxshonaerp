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

  function reset() {
    setDescription("");
    setCustomerName("");
    setPhone("");
    setTotalAmount("");
    setPayMode("deposit");
    setDepositAmount("");
    setNote("");
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

  const canCreate = user?.role === "SALES" || user?.role === "MANAGER";

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Buyurtmalar</h1>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            + Yangi buyurtma
          </Button>
        )}
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
              return (
                <div
                  key={order.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  {/* Left: info */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">
                        {order.description}
                      </span>
                      <span className={badge.className}>{badge.label}</span>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
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
