"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { apiFetch } from "@/services/http";

interface ProductionOrderItem {
  id: string;
  quantity: number;
  status: "DRAFT" | "COMPLETED" | "CANCELED";
  note?: string | null;
  producedAt: string;
  recipe: {
    product: { id: string; name: string; barcode?: string | null; unit: { name: string; short: string } };
    ingredients: Array<{
      quantity: number;
      product: { id: string; name: string; price?: number | null; unit: { name: string; short: string } };
    }>;
  };
  createdBy?: { id: string; username: string } | null;
}

interface Recipe {
  id: string;
  productId: string;
  product: { id: string; name: string; barcode?: string | null; stock: number; unit: { name: string; short: string } };
  ingredients: Array<{
    quantity: number;
    product: { id: string; name: string; stock: number; unit: { name: string; short: string } };
  }>;
}

export default function ProductionOrdersPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [orders, setOrders] = useState<ProductionOrderItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Form
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oList, rList] = await Promise.all([
        apiFetch<ProductionOrderItem[]>(`/production/orders?from=${from}&to=${to}`),
        apiFetch<Recipe[]>("/production/recipes"),
      ]);
      setOrders(oList);
      setRecipes(rList);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, t, toast]);

  useEffect(() => { void load(); }, [load]);

  const selectedRecipe = recipes.find((r) => r.productId === selectedProductId);
  const qty = Number(quantity) || 0;

  function calcTotalCost(recipe: Recipe | undefined, multiplier: number) {
    if (!recipe) return 0;
    return recipe.ingredients.reduce(
      (sum, ing) => sum + (ing.product as any).price ?? 0 * ing.quantity * multiplier,
      0,
    );
  }

  function checkAvailability(recipe: Recipe | undefined, multiplier: number) {
    if (!recipe || multiplier <= 0) return [];
    return recipe.ingredients
      .filter((ing) => ing.product.stock < ing.quantity * multiplier)
      .map((ing) => ({
        name: ing.product.name,
        required: ing.quantity * multiplier,
        available: ing.product.stock,
      }));
  }

  const unavailable = checkAvailability(selectedRecipe, qty);

  async function handleCreate() {
    if (!selectedProductId) { toast.error(t("Xatolik"), t("Mahsulot tanlanmagan")); return; }
    if (qty <= 0) { toast.error(t("Xatolik"), t("Miqdor noto'g'ri")); return; }
    if (unavailable.length > 0) { toast.error(t("Xatolik"), t("Xom ashyo yetarli emas")); return; }

    setSaving(true);
    try {
      await apiFetch("/production/orders", {
        method: "POST",
        body: JSON.stringify({ productId: selectedProductId, quantity: qty, note: note || undefined }),
      });
      toast.success(t("Bajarildi"), t("Ishlab chiqarish buyurtmasi yaratildi. Xom ashyo chiqarildi, tayyor mahsulot omborda ko'paydi."));
      setModalOpen(false);
      setSelectedProductId(""); setQuantity("1"); setNote("");
      void load();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return <Badge tone="success">{t("Bajarildi")}</Badge>;
      case "CANCELED": return <Badge tone="warning">{t("Bekor qilindi")}</Badge>;
      default: return <Badge tone="neutral">{t("Qoralama")}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Ishlab chiqarish")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Retsept asosida mahsulot tayyorlash va ombor yangilash")}</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={recipes.length === 0}>
          {recipes.length === 0 ? t("Avval retsept kiriting") : t("+ Ishlab chiqarish")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
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
          <Button variant="ghost" onClick={() => void load()}>{t("Yuklash")}</Button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="py-8 text-center text-sm text-cocoa-500">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Mahsulot")}</th>
                  <th>{t("Miqdor")}</th>
                  <th>{t("Sana")}</th>
                  <th>{t("Xodim")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Izoh")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-semibold text-cocoa-900">
                      {order.recipe.product.name}
                    </td>
                    <td>
                      {order.quantity} {order.recipe.product.unit.short}
                    </td>
                    <td className="text-sm text-cocoa-600">
                      {new Date(order.producedAt).toLocaleDateString("uz-UZ")}
                    </td>
                    <td className="text-sm text-cocoa-600">
                      {order.createdBy?.username ?? "—"}
                    </td>
                    <td>{statusBadge(order.status)}</td>
                    <td className="text-sm text-cocoa-600">{order.note ?? "—"}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-cocoa-500">
                      {t("Bu oraliqda ishlab chiqarish buyurtmasi yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        )}
      </Card>

      {/* Create modal */}
      <Modal title={t("Ishlab chiqarish buyurtmasi")} open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Mahsulot")}</label>
            <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none">
              <option value="">{t("Tanlang...")}</option>
              {recipes.map((r) => (
                <option key={r.productId} value={r.productId}>{r.product.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Miqdor (nechta)")}</label>
            <input type="number" min="0.001" step="0.001" value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none" />
          </div>

          {/* Preview ingredients */}
          {selectedRecipe && qty > 0 && (
            <div className="rounded-xl border border-cream-200/80 bg-cream-100/70 p-3">
              <div className="mb-2 text-xs font-semibold text-cocoa-700">{t("Sarflanadigan xom ashyo")}:</div>
              <div className="space-y-1">
                {selectedRecipe.ingredients.map((ing) => {
                  const needed = ing.quantity * qty;
                  const ok = ing.product.stock >= needed;
                  return (
                    <div key={ing.product.id} className="flex items-center justify-between text-xs">
                      <span className={ok ? "text-cocoa-700" : "font-semibold text-red-600"}>
                        {ing.product.name}
                      </span>
                      <span className={ok ? "text-cocoa-500" : "font-semibold text-red-500"}>
                        {needed} {ing.product.unit.short}
                        {!ok && ` (mavjud: ${ing.product.stock})`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {unavailable.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              ⚠️ {t("Xom ashyo yetarli emas. Miqdorni kamaytiring yoki ombor to'ldiring.")}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Izoh (ixtiyoriy)")}</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
              placeholder={t("Qo'shimcha ma'lumot...")} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t("Bekor")}</Button>
            <Button onClick={() => void handleCreate()} disabled={saving || unavailable.length > 0}>
              {saving ? t("Bajarilyapti...") : t("Ishlab chiqarish")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
