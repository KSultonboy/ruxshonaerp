"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { moneyUZS } from "@/lib/format";
import { ordersService } from "@/services/orders";
import { apiFetch } from "@/services/http";
import { SERVICE_MODE } from "@/services/config";
import type { Order, OrderStatus, User } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 30_000;

type FilterTab = "ALL" | OrderStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL",         label: "Barchasi"    },
  { key: "NEW",         label: "Yangi"       },
  { key: "IN_DELIVERY", label: "Yetkazishda" },
  { key: "DELIVERED",   label: "Yetkazildi"  },
  { key: "CANCELED",    label: "Bekor"       },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW:         "Yangi",
  IN_DELIVERY: "Yetkazishda",
  DELIVERED:   "Yetkazildi",
  CANCELED:    "Bekor qilindi",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id: string) {
  return "#" + id.slice(0, 8).toUpperCase();
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("uz-UZ", {
    day:    "2-digit",
    month:  "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const cls =
    status === "NEW"
      ? "border-amber-200 bg-amber-100 text-amber-700"
      : status === "IN_DELIVERY"
        ? "border-sky-200 bg-sky-100 text-sky-700"
        : status === "DELIVERED"
          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
          : "border-rose-200 bg-rose-100 text-rose-700";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── DeliverySection ──────────────────────────────────────────────────────────

function DeliverySection({
  order,
  onAssign,
  onDeliver,
  busy,
}: {
  order: Order;
  onAssign: (userId: string, note?: string) => void;
  onDeliver: () => void;
  busy: boolean;
}) {
  const [users,        setUsers]        = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(order.deliveryUserId ?? "");
  const [note,         setNote]         = useState(order.deliveryNote ?? "");
  const [editing,      setEditing]      = useState(!order.deliveryUserId);

  useEffect(() => {
    setLoadingUsers(true);
    apiFetch<User[]>("/users?role=SALES")
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  // Sync if parent order changes (e.g. after successful assign)
  useEffect(() => {
    setSelectedUser(order.deliveryUserId ?? "");
    setNote(order.deliveryNote ?? "");
    setEditing(!order.deliveryUserId);
  }, [order.deliveryUserId, order.deliveryNote]);

  if (order.status !== "NEW" && order.status !== "IN_DELIVERY") return null;

  return (
    <div className="rounded-xl border border-cream-200 bg-cream-50 p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">
        Kuryer
      </div>

      {/* ── IN_DELIVERY: show assigned courier + deliver button ── */}
      {order.status === "IN_DELIVERY" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {order.deliveryUser ? (
              <span className="font-semibold text-cocoa-900">
                🚚 {order.deliveryUser.name || order.deliveryUser.username}
              </span>
            ) : (
              <span className="text-cocoa-500 text-sm">Kuryer tayinlanmagan</span>
            )}
            {order.deliveryNote && (
              <div className="text-xs text-cocoa-500 mt-0.5">{order.deliveryNote}</div>
            )}
          </div>
          <Button disabled={busy} onClick={onDeliver}>
            ✅ Yetkazildi
          </Button>
        </div>
      )}

      {/* ── NEW: assign form ── */}
      {order.status === "NEW" && (
        <>
          {order.deliveryUserId && !editing ? (
            /* Already assigned — show name + edit button */
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-cocoa-900">
                🚚 {order.deliveryUser?.name || order.deliveryUser?.username || order.deliveryUserId}
              </span>
              <Button variant="ghost" onClick={() => setEditing(true)}>
                ✏️ O&apos;zgartirish
              </Button>
            </div>
          ) : (
            /* Assign form */
            <div className="space-y-3">
              <select
                className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-cocoa-900 focus:outline-none focus:ring-2 focus:ring-berry-400"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                disabled={loadingUsers || busy}
              >
                <option value="">
                  {loadingUsers ? "Yuklanmoqda..." : "Kuryer tanlang..."}
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.username}
                  </option>
                ))}
              </select>

              <textarea
                className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-cocoa-900 placeholder-cocoa-400 focus:outline-none focus:ring-2 focus:ring-berry-400 resize-none"
                rows={2}
                placeholder="Kuryer uchun izoh (ixtiyoriy)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />

              <div className="flex gap-2">
                <Button
                  disabled={busy || !selectedUser}
                  onClick={() => onAssign(selectedUser, note || undefined)}
                >
                  Tayinlash
                </Button>
                {order.deliveryUserId && (
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Bekor
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── OrderDetailModal ─────────────────────────────────────────────────────────

function OrderDetailModal({
  order,
  onClose,
  onStatusChange,
  onAssign,
  onDeliver,
  busy,
}: {
  order: Order;
  onClose: () => void;
  onStatusChange: (o: Order, s: OrderStatus) => void;
  onAssign: (orderId: string, userId: string, note?: string) => void;
  onDeliver: (orderId: string) => void;
  busy: boolean;
}) {
  return (
    <Modal title={`Buyurtma ${shortId(order.id)}`} open onClose={onClose}>
      <div className="space-y-5 text-sm text-cocoa-800">

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Mijoz</div>
            <div className="mt-1 font-semibold text-cocoa-900">{order.customerName}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Telefon</div>
            <div className="mt-1">{order.phone ?? "—"}</div>
          </div>
          {order.address && (
            <div className="col-span-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Manzil</div>
              <div className="mt-1">{order.address}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Holat</div>
            <div className="mt-1"><StatusBadge status={order.status} /></div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Jami summa</div>
            <div className="mt-1 font-bold text-berry-700">{moneyUZS(order.total)}</div>
          </div>
          {order.trackCode && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Track kodi</div>
              <div className="mt-1 font-mono text-xs">{order.trackCode}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Sana</div>
            <div className="mt-1">{timeLabel(order.createdAt)}</div>
          </div>
          {order.note && (
            <div className="col-span-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Izoh</div>
              <div className="mt-1 italic text-cocoa-600">{order.note}</div>
            </div>
          )}
        </div>

        {/* Items */}
        {order.items && order.items.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-cocoa-500">
              Mahsulotlar ({order.items.length} ta)
            </div>
            <Table>
              <T>
                <thead>
                  <tr>
                    <th>Nomi</th>
                    <th>Miqdor</th>
                    <th>Narxi</th>
                    <th>Jami</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={item.id ?? i}>
                      <td className="font-medium">{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>{moneyUZS(item.unitPrice)}</td>
                      <td className="font-semibold">{moneyUZS(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </T>
            </Table>
          </div>
        )}

        {/* Delivery */}
        <DeliverySection
          order={order}
          onAssign={(userId, note) => onAssign(order.id, userId, note)}
          onDeliver={() => onDeliver(order.id)}
          busy={busy}
        />

        {/* Actions */}
        <div className="flex flex-wrap gap-2 border-t border-cream-200 pt-4">
          {order.status === "NEW" && (
            <>
              <Button
                disabled={busy}
                onClick={() => onStatusChange(order, "IN_DELIVERY")}
              >
                Qabul qilish
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => onStatusChange(order, "CANCELED")}
              >
                Bekor qilish
              </Button>
            </>
          )}
          {order.status === "IN_DELIVERY" && (
            <>
              <Button
                disabled={busy}
                onClick={() => onStatusChange(order, "DELIVERED")}
              >
                Yetkazildi
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => onStatusChange(order, "CANCELED")}
              >
                Bekor qilish
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={onClose}>
            Yopish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const toast = useToast();

  const [orders,    setOrders]    = useState<Order[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busyId,    setBusyId]    = useState<string | null>(null);
  const [tab,       setTab]       = useState<FilterTab>("ALL");
  const [detail,    setDetail]    = useState<Order | null>(null);
  const [newBanner, setNewBanner] = useState(0);   // count of new arrived orders
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");

  const lastCheckRef = useRef<string>(new Date().toISOString());

  // ─── Initial load ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ordersService.list();
      setOrders(list);
    } catch (e) {
      toast.error("Xatolik", e instanceof Error ? e.message : "Ma'lumot yuklanmadi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ─── Notification permission ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotifPerm("unsupported");
      return;
    }
    setNotifPerm(Notification.permission);
  }, []);

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  // ─── Polling every 30 seconds ──────────────────────────────────────────────
  useEffect(() => {
    if (SERVICE_MODE !== "api") return;

    const tick = async () => {
      const since = lastCheckRef.current;
      lastCheckRef.current = new Date().toISOString();

      try {
        const incoming = await apiFetch<Order[]>(
          `/orders?since=${encodeURIComponent(since)}`
        );
        if (incoming.length === 0) return;

        setOrders((prev) => {
          const prevIds = new Set(prev.map((o) => o.id));
          const brand_new = incoming.filter((o) => !prevIds.has(o.id));
          if (brand_new.length === 0) return prev;
          return [...brand_new, ...prev];
        });

        const newCount = incoming.filter((o) => o.status === "NEW").length;
        if (newCount > 0) {
          setNewBanner((c) => c + newCount);

          // Browser notification
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification("Yangi buyurtma!", {
              body: `${newCount} ta yangi buyurtma keldi`,
              icon: "/favicon.ico",
            });
          }
        }
      } catch {
        // Silent — don't disrupt UX on poll failure
      }
    };

    const id = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(id);
  }, []);

  // ─── Status change ─────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    async (order: Order, status: OrderStatus) => {
      setBusyId(order.id);
      try {
        await ordersService.updateStatus(order.id, status);
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status } : o))
        );
        if (detail?.id === order.id) setDetail((d) => d ? { ...d, status } : d);
        toast.success(`${STATUS_LABELS[status]} ✓`);
      } catch (e) {
        toast.error("Xatolik", e instanceof Error ? e.message : "Holat o'zgartirilmadi");
      } finally {
        setBusyId(null);
      }
    },
    [detail, toast]
  );

  // ─── Assign delivery ───────────────────────────────────────────────────────
  const handleAssign = useCallback(
    async (orderId: string, userId: string, note?: string) => {
      setBusyId(orderId);
      try {
        const updated = await apiFetch<Order>(`/orders/${orderId}/assign`, {
          method: "POST",
          body: JSON.stringify({ userId, note }),
        });
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
        );
        if (detail?.id === orderId) setDetail((d) => d ? { ...d, ...updated } : d);
        toast.success("Kuryer tayinlandi ✓");
      } catch (e) {
        toast.error("Xatolik", e instanceof Error ? e.message : "Tayinlab bo'lmadi");
      } finally {
        setBusyId(null);
      }
    },
    [detail, toast]
  );

  // ─── Mark delivered ────────────────────────────────────────────────────────
  const handleDeliver = useCallback(
    async (orderId: string) => {
      setBusyId(orderId);
      try {
        const updated = await apiFetch<Order>(`/orders/${orderId}/deliver`, {
          method: "POST",
        });
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
        );
        if (detail?.id === orderId)
          setDetail((d) => d ? { ...d, status: "DELIVERED" as OrderStatus } : d);
        toast.success("Yetkazildi ✓");
      } catch (e) {
        toast.error("Xatolik", e instanceof Error ? e.message : "Holat o'zgartirilmadi");
      } finally {
        setBusyId(null);
      }
    },
    [detail, toast]
  );

  // ─── Derived data ──────────────────────────────────────────────────────────
  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const filtered = useMemo(
    () => (tab === "ALL" ? sorted : sorted.filter((o) => o.status === tab)),
    [sorted, tab]
  );

  const counts = useMemo(
    () => ({
      NEW:         orders.filter((o) => o.status === "NEW").length,
      IN_DELIVERY: orders.filter((o) => o.status === "IN_DELIVERY").length,
      DELIVERED:   orders.filter((o) => o.status === "DELIVERED").length,
      CANCELED:    orders.filter((o) => o.status === "CANCELED").length,
      revenue:     orders.filter((o) => o.status === "DELIVERED").reduce((s, o) => s + o.total, 0),
    }),
    [orders]
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-6">

      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">
            Buyurtmalar
          </h1>
          <p className="mt-1 text-sm text-cocoa-600">
            Barcha platformalardan kelgan buyurtmalar — har 30 soniyada yangilanadi
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notifPerm === "default" && (
            <Button variant="ghost" onClick={() => void requestNotifPermission()}>
              🔔 Xabarnomalar
            </Button>
          )}
          {notifPerm === "granted" && (
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              🔔 Xabarnomalar yoqilgan
            </span>
          )}
          <Button variant="ghost" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Yuklanmoqda..." : "↻ Yangilash"}
          </Button>
        </div>
      </div>

      {/* New orders banner */}
      {newBanner > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛎️</span>
            <div>
              <div className="font-semibold text-amber-900">
                {newBanner} ta yangi buyurtma keldi!
              </div>
              <div className="text-sm text-amber-700">
                Sahifa avtomatik yangilandi
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => { setTab("NEW"); setNewBanner(0); }}>
              Ko'rish
            </Button>
            <Button variant="ghost" onClick={() => setNewBanner(0)}>
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-600">Yangi</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{counts.NEW}</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-widest text-sky-600">Yetkazishda</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{counts.IN_DELIVERY}</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Yetkazildi</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{counts.DELIVERED}</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-widest text-rose-600">Bekor</div>
          <div className="mt-2 text-3xl font-bold text-cocoa-900">{counts.CANCELED}</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-widest text-cocoa-500">Yetkazilgan tushum</div>
          <div className="mt-2 text-lg font-bold text-berry-700">{moneyUZS(counts.revenue)}</div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-cream-200 bg-cream-50 p-1.5">
        {TABS.map(({ key, label }) => {
          const count = key === "ALL" ? orders.length : counts[key as OrderStatus] ?? 0;
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                active
                  ? "bg-white text-cocoa-900 shadow-card"
                  : "text-cocoa-500 hover:text-cocoa-800"
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  active ? "bg-berry-100 text-berry-700" : "bg-cream-200 text-cocoa-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card className="p-0">
        <Table>
          <T>
            <thead>
              <tr>
                <th>ID</th>
                <th>Mijoz</th>
                <th>Manzil</th>
                <th>Summa</th>
                <th>Holat</th>
                <th>Vaqt</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-cocoa-500">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-cocoa-500">
                    Hozircha buyurtma yo'q.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(order)}
                  >
                    {/* ID */}
                    <td>
                      <span className="font-mono text-xs text-cocoa-500">
                        {shortId(order.id)}
                      </span>
                    </td>

                    {/* Mijoz */}
                    <td>
                      <div className="font-semibold text-cocoa-900">
                        {order.customerName}
                      </div>
                      {order.phone && (
                        <div className="text-xs text-cocoa-500">{order.phone}</div>
                      )}
                    </td>

                    {/* Manzil */}
                    <td className="max-w-[180px] truncate text-cocoa-600">
                      {order.address ?? "—"}
                    </td>

                    {/* Summa */}
                    <td className="font-semibold text-berry-700">
                      {moneyUZS(order.total)}
                    </td>

                    {/* Holat */}
                    <td>
                      <StatusBadge status={order.status} />
                    </td>

                    {/* Vaqt */}
                    <td className="whitespace-nowrap text-xs text-cocoa-500">
                      {timeLabel(order.createdAt)}
                    </td>

                    {/* Actions */}
                    <td
                      className="whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {order.status === "NEW" && (
                          <>
                            <Button
                              variant="ghost"
                              className="px-3 py-1.5 text-xs"
                              disabled={busyId === order.id}
                              onClick={() => void handleStatusChange(order, "IN_DELIVERY")}
                            >
                              Qabul
                            </Button>
                            <Button
                              variant="danger"
                              className="px-3 py-1.5 text-xs"
                              disabled={busyId === order.id}
                              onClick={() => void handleStatusChange(order, "CANCELED")}
                            >
                              Bekor
                            </Button>
                          </>
                        )}
                        {order.status === "IN_DELIVERY" && (
                          <>
                            <Button
                              variant="ghost"
                              className="px-3 py-1.5 text-xs"
                              disabled={busyId === order.id}
                              onClick={() => void handleStatusChange(order, "DELIVERED")}
                            >
                              Yetkazildi
                            </Button>
                            <Button
                              variant="danger"
                              className="px-3 py-1.5 text-xs"
                              disabled={busyId === order.id}
                              onClick={() => void handleStatusChange(order, "CANCELED")}
                            >
                              Bekor
                            </Button>
                          </>
                        )}
                        {(order.status === "DELIVERED" ||
                          order.status === "CANCELED") && (
                          <span className="text-xs text-cocoa-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </T>
        </Table>
      </Card>

      {/* Detail modal */}
      {detail && (
        <OrderDetailModal
          order={detail}
          onClose={() => setDetail(null)}
          onStatusChange={(o, s) => void handleStatusChange(o, s)}
          onAssign={(id, userId, note) => void handleAssign(id, userId, note)}
          onDeliver={(id) => void handleDeliver(id)}
          busy={busyId === detail.id}
        />
      )}
    </div>
  );
}
