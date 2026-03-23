"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import { Table, T } from "@/components/ui/Table";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { productsService } from "@/services/products";
import { API_ORIGIN, SERVICE_MODE } from "@/services/config";
import { moneyUZS } from "@/lib/format";
import type { Product } from "@/lib/types";

type FormState = {
  formalName: string;
  formalDescription: string;
  formalImage: string;
  publishToWebsite: boolean;
  publishToMobile: boolean;
};

const emptyForm: FormState = {
  formalName: "",
  formalDescription: "",
  formalImage: "",
  publishToWebsite: false,
  publishToMobile: false,
};

function normalizePrice(product: Product) {
  if (typeof product.salePrice === "number") return product.salePrice;
  if (typeof product.price === "number") return product.price;
  return null;
}

function resolveImage(src?: string | null) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  return SERVICE_MODE === "api" ? `${API_ORIGIN}${src}` : src;
}

export default function ProductFormalPage() {
  const { t } = useI18n();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await productsService.listFormal();
      setProducts(list);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Mahsulotlar yuklanmadi"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const formalized = products.filter((p) => Boolean(p.formalName?.trim()));
    if (!needle) return formalized;
    return formalized.filter((p) => {
      const target = [p.name, p.formalName, p.barcode, p.categoryId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return target.includes(needle);
    });
  }, [products, q]);

  const pendingFormalProducts = useMemo(
    () =>
      products
        .filter((p) => !p.formalName?.trim())
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  const selectedPendingProduct = useMemo(
    () => pendingFormalProducts.find((p) => p.id === selectedProductId) ?? null,
    [pendingFormalProducts, selectedProductId],
  );

  const pendingOptions = useMemo(
    () => [
      { value: "", label: t("Mahsulot tanlang") },
      ...pendingFormalProducts.map((p) => ({
        value: p.id,
        label: `${p.name}${p.barcode ? ` (${p.barcode})` : ""}`,
      })),
    ],
    [pendingFormalProducts, t],
  );

  const publishedWebsiteCount = useMemo(
    () => products.filter((p) => p.publishToWebsite).length,
    [products],
  );
  const publishedMobileCount = useMemo(
    () => products.filter((p) => p.publishToMobile).length,
    [products],
  );

  function startEdit(product: Product) {
    setSelectedProductId(product.id);
    setEditing(product);
    setForm({
      formalName: product.formalName ?? product.name,
      formalDescription: product.formalDescription ?? "",
      formalImage: product.formalImage ?? product.images?.[0] ?? "",
      publishToWebsite: Boolean(product.publishToWebsite),
      publishToMobile: Boolean(product.publishToMobile),
    });
  }

  function closeEdit() {
    setSelectedProductId("");
    setEditing(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!editing) return;

    if ((form.publishToWebsite || form.publishToMobile) && form.formalName.trim().length < 2) {
      toast.error(t("Xatolik"), t("Platformaga chiqarish uchun formal nom kamida 2 belgi bo'lsin"));
      return;
    }

    setSaving(true);
    try {
      await productsService.updateFormal(editing.id, {
        formalName: form.formalName.trim(),
        formalDescription: form.formalDescription.trim(),
        formalImage: form.formalImage.trim(),
        publishToWebsite: form.publishToWebsite,
        publishToMobile: form.publishToMobile,
      });
      toast.success(t("Saqlandi"), t("Formal ma'lumotlar yangilandi"));
      closeEdit();
      await refresh();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Formal mahsulotlar")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">
            {t("Ichki mahsulotlarga platformalar uchun formal nom, rasm va tavsif bering")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{t("Website")}: {publishedWebsiteCount}</Badge>
          <Badge tone="primary">{t("Mobile")}: {publishedMobileCount}</Badge>
          <Badge>{t("Formal berilmagan")}: {pendingFormalProducts.length}</Badge>
          <Badge>{t("Jami")}: {products.length}</Badge>
        </div>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Select
            label={t("Formal ma'lumot berish uchun mahsulot tanlang")}
            options={pendingOptions}
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            hint={t("Formal nom berilgan mahsulotlar bu ro'yxatda qayta ko'rinmaydi")}
          />
          <div className="flex items-end">
            <Button
              onClick={() => selectedPendingProduct && startEdit(selectedPendingProduct)}
              disabled={!selectedPendingProduct}
            >
              {t("Formal ma'lumot kiritish")}
            </Button>
          </div>
          <div className="flex items-end justify-end">
            <Button variant="ghost" onClick={() => void refresh()}>{t("Yangilash")}</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <Input
            label={t("Qidirish")}
            placeholder={t("Ichki nom, formal nom, barcode")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Ichki mahsulot")}</th>
                  <th>{t("Formal nom")}</th>
                  <th>{t("Narx")}</th>
                  <th>{t("Website")}</th>
                  <th>{t("Mobile")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold text-cocoa-900">{p.name}</div>
                      <div className="text-xs text-cocoa-500">{p.barcode || "-"}</div>
                    </td>
                    <td>{p.formalName || "-"}</td>
                    <td>{normalizePrice(p) !== null ? moneyUZS(normalizePrice(p) as number) : "-"}</td>
                    <td>
                      <Badge tone={p.publishToWebsite ? "primary" : "neutral"}>
                        {p.publishToWebsite ? t("Chiqarilgan") : t("Yopiq")}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={p.publishToMobile ? "primary" : "neutral"}>
                        {p.publishToMobile ? t("Chiqarilgan") : t("Yopiq")}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap">
                      <Button variant="ghost" onClick={() => startEdit(p)}>{t("Tahrirlash")}</Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-sm text-cocoa-600">
                      {q.trim()
                        ? t("Hech narsa topilmadi")
                        : t("Hali birorta mahsulotga formal nom berilmagan")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </T>
          </Table>
        )}
      </Card>

      {editing ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-cocoa-900">{t("Formal ma'lumotni tahrirlash")}</h2>
              <p className="mt-1 text-sm text-cocoa-600">
                {t("Ichki nom")}: <span className="font-semibold text-cocoa-900">{editing.name}</span>
              </p>
            </div>
            <Button variant="ghost" onClick={closeEdit}>{t("Yopish")}</Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Input
              label={t("Formal nom *")}
              value={form.formalName}
              onChange={(e) => setForm((prev) => ({ ...prev, formalName: e.target.value }))}
              placeholder={t("Masalan: Red Velvet Classic")}
            />
            <Input
              label={t("Formal rasm (URL)")}
              value={form.formalImage}
              onChange={(e) => setForm((prev) => ({ ...prev, formalImage: e.target.value }))}
              placeholder={t("Masalan: https://.../image.jpg")}
            />
            <div className="lg:col-span-2">
              <Textarea
                label={t("Formal tavsif")}
                value={form.formalDescription}
                onChange={(e) => setForm((prev) => ({ ...prev, formalDescription: e.target.value }))}
                placeholder={t("Website/mobile uchun qisqa tavsif")}
              />
            </div>

            {editing.images?.length ? (
              <div className="lg:col-span-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cocoa-600">
                  {t("Ichki rasm tanlash")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing.images.map((img) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, formalImage: img }))}
                      className={`h-16 w-16 overflow-hidden rounded-xl border ${form.formalImage === img ? "border-berry-700" : "border-cream-200"}`}
                      title={t("Formal rasm sifatida tanlash")}
                    >
                      <img src={resolveImage(img)} alt="Product" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3 text-sm font-semibold text-cocoa-800">
              <input
                type="checkbox"
                checked={form.publishToWebsite}
                onChange={(e) => setForm((prev) => ({ ...prev, publishToWebsite: e.target.checked }))}
              />
              {t("Website platformasida ko'rsatilsin")}
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3 text-sm font-semibold text-cocoa-800">
              <input
                type="checkbox"
                checked={form.publishToMobile}
                onChange={(e) => setForm((prev) => ({ ...prev, publishToMobile: e.target.checked }))}
              />
              {t("Mobile platformasida ko'rsatilsin")}
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={closeEdit} disabled={saving}>{t("Bekor")}</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? t("Saqlanmoqda...") : t("Saqlash")}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
