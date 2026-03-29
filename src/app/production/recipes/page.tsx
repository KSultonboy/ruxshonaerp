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
import { productsService } from "@/services/products";
import type { Product } from "@/lib/types";

interface RecipeIngredient {
  id: string;
  productId: string;
  quantity: number;
  note?: string | null;
  product: { id: string; name: string; barcode?: string | null; stock: number; price?: number | null; unit: { name: string; short: string } };
}

interface Recipe {
  id: string;
  productId: string;
  note?: string | null;
  product: { id: string; name: string; barcode?: string | null; stock: number; unit: { name: string; short: string } };
  ingredients: RecipeIngredient[];
}

interface IngredientRow {
  productId: string;
  quantity: string;
  note: string;
}

export default function RecipesPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [recipeNote, setRecipeNote] = useState("");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { productId: "", quantity: "", note: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rList, pList] = await Promise.all([
        apiFetch<Recipe[]>("/production/recipes"),
        productsService.list(),
      ]);
      setRecipes(rList);
      setProducts(pList);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => { void load(); }, [load]);

  function openNew() {
    setEditRecipe(null);
    setSelectedProductId("");
    setRecipeNote("");
    setIngredients([{ productId: "", quantity: "", note: "" }]);
    setModalOpen(true);
  }

  function openEdit(recipe: Recipe) {
    setEditRecipe(recipe);
    setSelectedProductId(recipe.productId);
    setRecipeNote(recipe.note ?? "");
    setIngredients(
      recipe.ingredients.map((ing) => ({
        productId: ing.productId,
        quantity: String(ing.quantity),
        note: ing.note ?? "",
      }))
    );
    setModalOpen(true);
  }

  function addIngredientRow() {
    setIngredients((prev) => [...prev, { productId: "", quantity: "", note: "" }]);
  }

  function removeIngredientRow(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateIngredient(idx: number, field: keyof IngredientRow, value: string) {
    setIngredients((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  }

  async function handleSave() {
    if (!selectedProductId) { toast.error(t("Xatolik"), t("Mahsulot tanlanmagan")); return; }
    const validIngredients = ingredients.filter((r) => r.productId && r.quantity);
    if (validIngredients.length === 0) { toast.error(t("Xatolik"), t("Kamida 1 ta xom ashyo kerak")); return; }

    const body = {
      ingredients: validIngredients.map((r) => ({
        productId: r.productId,
        quantity: Number(r.quantity),
        note: r.note || undefined,
      })),
      note: recipeNote || undefined,
    };

    setSaving(true);
    try {
      await apiFetch(`/production/recipes/${selectedProductId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      toast.success(t("Saqlandi"), t("Retsept saqlandi"));
      setModalOpen(false);
      void load();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(recipe: Recipe) {
    if (!confirm(t("Retseptni o'chirishni tasdiqlaysizmi?"))) return;
    try {
      await apiFetch(`/production/recipes/${recipe.productId}`, { method: "DELETE" });
      toast.success(t("O'chirildi"), t("Retsept o'chirildi"));
      void load();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message);
    }
  }

  function calcCost(recipe: Recipe) {
    return recipe.ingredients.reduce(
      (sum, ing) => sum + (ing.product.price ?? 0) * ing.quantity,
      0,
    );
  }

  const recipeProductIds = new Set(recipes.map((r) => r.productId));
  const availableProducts = products.filter((p) => p.type === "PRODUCT");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Retseptlar")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Mahsulot tayyorlash uchun xom ashyo tarkibi")}</p>
        </div>
        <Button onClick={openNew}>{t("+ Retsept qo'shish")}</Button>
      </div>

      <Card>
        {loading ? (
          <div className="py-8 text-center text-sm text-cocoa-500">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Mahsulot")}</th>
                  <th>{t("Xom ashyolar")}</th>
                  <th>{t("Taxminiy tannarx")}</th>
                  <th className="text-right">{t("Amallar")}</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td>
                      <div className="font-semibold text-cocoa-900">{recipe.product.name}</div>
                      <div className="text-xs text-cocoa-500">{recipe.product.barcode}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {recipe.ingredients.map((ing) => (
                          <Badge key={ing.id} tone="neutral">
                            {ing.product.name} × {ing.quantity} {ing.product.unit.short}
                          </Badge>
                        ))}
                        {recipe.ingredients.length === 0 && (
                          <span className="text-xs text-cocoa-400 italic">{t("Bo'sh")}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="font-semibold text-cocoa-900">
                        {calcCost(recipe).toLocaleString()} {t("so'm")}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(recipe)}
                          className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-cocoa-600 hover:bg-cream-100"
                        >
                          {t("Tahrirlash")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(recipe)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          {t("O'chirish")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {recipes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-cocoa-500">
                      {t("Hech qanday retsept yo'q. Birinchi retseptni qo'shing.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        )}
      </Card>

      <Modal
        title={editRecipe ? t("Retseptni tahrirlash") : t("Yangi retsept")}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {/* Mahsulot tanlash */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Tayyor mahsulot")}</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={!!editRecipe}
              className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none focus:ring-2 focus:ring-berry-200 disabled:opacity-60"
            >
              <option value="">{t("Tanlang...")}</option>
              {availableProducts
                .filter((p) => !recipeProductIds.has(p.id) || p.id === selectedProductId)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          {/* Xom ashyolar */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-cocoa-700">{t("Xom ashyolar (1 ta mahsulot uchun)")}</label>
              <button type="button" onClick={addIngredientRow}
                className="rounded-lg bg-berry-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-berry-800">
                + {t("Qo'shish")}
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={row.productId}
                    onChange={(e) => updateIngredient(idx, "productId", e.target.value)}
                    className="flex-1 rounded-xl border border-cream-200 bg-cream-50 px-2.5 py-2 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
                  >
                    <option value="">{t("Xom ashyo...")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder={t("Miqdor")}
                    value={row.quantity}
                    onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                    className="w-24 rounded-xl border border-cream-200 bg-cream-50 px-2.5 py-2 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none"
                  />
                  <button type="button" onClick={() => removeIngredientRow(idx)}
                    className="rounded-lg border border-red-200 px-2.5 py-2 text-xs text-red-500 hover:bg-red-50">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Izoh */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-700">{t("Izoh (ixtiyoriy)")}</label>
            <input
              type="text"
              value={recipeNote}
              onChange={(e) => setRecipeNote(e.target.value)}
              className="w-full rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5 text-sm text-cocoa-900 focus:border-berry-400 focus:outline-none focus:ring-2 focus:ring-berry-200"
              placeholder={t("Retsept haqida qo'shimcha ma'lumot...")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t("Bekor")}</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? t("Saqlanmoqda...") : t("Saqlash")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
