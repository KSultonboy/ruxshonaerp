"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import Textarea from "@/components/ui/Textarea";

import { ensureSeed } from "@/lib/seed";
import type { Product, Category, Unit, ExpenseCategory, ExpenseItem } from "@/lib/types";
import { categoriesService, expenseCategoriesService } from "@/services/categories";
import { expenseItemsService } from "@/services/expenseItems";
import { unitsService } from "@/services/units";
import { productsService } from "@/services/products";
import { moneyUZS } from "@/lib/format";
import { buildCSV, downloadCSV, fileStamp } from "@/lib/csv";
import { API_ORIGIN, SERVICE_MODE } from "@/services/config";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useToast } from "@/components/ui/toast/ToastProvider";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { onlyDigits, formatDigitsWithSpaces } from "@/lib/mask";

function resolveImage(src: string) {
  if (!src) return src;
  if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  return SERVICE_MODE === "api" ? `${API_ORIGIN}${src}` : src;
}

function generateBase12(prefix = "20") {
  let out = prefix;
  while (out.length < 12) {
    out += String(Math.floor(Math.random() * 10));
  }
  return out.slice(0, 12);
}

function computeEan13(base12: string) {
  let odd = 0;
  let even = 0;
  for (let i = 0; i < base12.length; i += 1) {
    const digit = Number(base12[i]);
    if (i % 2 === 0) odd += digit;
    else even += digit;
  }
  const sum = odd + even * 3;
  const check = (10 - (sum % 10)) % 10;
  return `${base12}${check}`;
}

function generateUniqueBarcode(used: Set<string>) {
  for (let i = 0; i < 8; i += 1) {
    const barcode = computeEan13(generateBase12());
    if (!used.has(barcode)) {
      used.add(barcode);
      return barcode;
    }
  }
  return computeEan13(generateBase12());
}

type ProductForm = {
  name: string;
  barcode: string;
  categoryId: string;
  unitId: string;
  salePrice: string;
  shopPrice: string;
  labourPrice: string;
  active: "true" | "false";
  note?: string;
};

export default function ProductsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isCreateView = searchParams.get("new") === "1";

  const [categories, setCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopMounted, setScrollTopMounted] = useState(false);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const uploadInputId = "product-images-input";

  const productSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t("Nom kamida 2 ta belgidan iborat bo'lsin")),
        barcode: z
          .string()
          .trim()
          .refine((v) => v === "" || /^\d{13}$/.test(v), t("Barcode 13 xonali raqam bo'lsin")),
        categoryId: z.string().min(1, t("Kategoriya tanlang")),
        unitId: z.string().min(1, t("Birlik tanlang")),
        salePrice: z
          .string()
          .trim()
          .refine((v) => v === "" || /^\d+$/.test(v), t("Narx faqat raqam bo'lsin (masalan: 180000)")),
        shopPrice: z
          .string()
          .trim()
          .refine((v) => v === "" || /^\d+$/.test(v), t("Narx faqat raqam bo'lsin (masalan: 180000)")),
        labourPrice: z
          .string()
          .trim()
          .refine((v) => v === "" || /^\d+$/.test(v), t("Narx faqat raqam bo'lsin (masalan: 180000)")),
        active: z.enum(["true", "false"]),
        note: z.string().trim().max(200, t("Izoh 200 belgidan oshmasin")).optional(),
      }),
    [t]
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      barcode: "",
      categoryId: "",
      unitId: "",
      salePrice: "",
      shopPrice: "",
      labourPrice: "",
      active: "true",
      note: "",
    },
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    ensureSeed();
    try {
      const [cats, expenseCats, expenseRows, us, ps] = await Promise.all([
        categoriesService.list(),
        expenseCategoriesService.list(),
        expenseItemsService.list(),
        unitsService.list(),
        productsService.list(),
      ]);
      setCategories(cats);
      setExpenseCategories(expenseCats);
      setExpenseItems(expenseRows);
      setUnits(us);
      setProducts(ps);

      if (cats[0] && us[0]) {
        reset((prev) => ({
          ...prev,
          categoryId: prev.categoryId || cats[0].id,
          unitId: prev.unitId || us[0].id,
        }));
      }
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [reset, toast, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => setFocus("name"), 0);
  }, [open, setFocus]);

  useEffect(() => {
    setScrollTopMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const imagePreviews = useMemo(() => imageFiles.map((file) => URL.createObjectURL(file)), [imageFiles]);
  const remainingSlots = Math.max(0, 3 - existingImages.length - imageFiles.length);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const expenseCatMap = useMemo(
    () => new Map(expenseCategories.map((c) => [c.id, c.name])),
    [expenseCategories]
  );
  const expenseItemByProductId = useMemo(
    () =>
      new Map(
        expenseItems
          .filter((item) => item.productId)
          .map((item) => [item.productId as string, item])
      ),
    [expenseItems]
  );
  const unitMap = useMemo(
    () => new Map(units.map((u) => [u.id, `${u.name} (${u.short})`])),
    [units]
  );

  const getCategoryLabel = useCallback(
    (product: Product) => {
      const linkedExpenseItem = expenseItemByProductId.get(product.id);
      if (linkedExpenseItem) {
        return expenseCatMap.get(linkedExpenseItem.categoryId) ?? catMap.get(product.categoryId) ?? "-";
      }
      return catMap.get(product.categoryId) ?? "-";
    },
    [catMap, expenseCatMap, expenseItemByProductId]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.active) return false;
      const okQ = qq ? p.name.toLowerCase().includes(qq) : true;
      return okQ;
    });
  }, [products, q]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setExistingImages([]);
    setImageFiles([]);
    const used = new Set(products.map((p) => p.barcode).filter(Boolean) as string[]);
    const autoBarcode = generateUniqueBarcode(used);
    reset({
      name: "",
      barcode: autoBarcode,
      categoryId: categories[0]?.id ?? "",
      unitId: units[0]?.id ?? "",
      salePrice: "",
      shopPrice: "",
      labourPrice: "",
      active: "true",
      note: "",
    });
    setOpen(true);
  }, [categories, products, reset, units]);

  function openEdit(p: Product) {
    setEditing(p);
    setExistingImages(p.images ?? []);
    setImageFiles([]);
    let currentBarcode = "";
    if (p.barcode) {
      currentBarcode = p.barcode;
    } else {
      const used = new Set(products.map((item) => item.barcode).filter(Boolean) as string[]);
      const autoBarcode = generateUniqueBarcode(used);
      currentBarcode = autoBarcode;
    }
    reset({
      name: p.name,
      barcode: currentBarcode,
      categoryId: p.categoryId,
      unitId: p.unitId,
      salePrice:
        typeof p.salePrice === "number"
          ? String(p.salePrice)
          : typeof p.price === "number"
            ? String(p.price)
            : "",
      shopPrice: typeof p.shopPrice === "number" ? String(p.shopPrice) : "",
      labourPrice: typeof p.labourPrice === "number" ? String(p.labourPrice) : "",
      active: p.active ? "true" : "false",
      note: "",
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!isCreateView) return;
    if (open) return;
    if (categories.length === 0 || units.length === 0) return;
    openCreate();
  }, [categories.length, isCreateView, open, openCreate, units.length]);

  useEffect(() => {
    if (isCreateView) return;
    if (editing) return;
    if (open) {
      setOpen(false);
    }
  }, [isCreateView, editing, open]);

  function closeForm() {
    setExistingImages([]);
    setImageFiles([]);
    setOpen(false);
    if (isCreateView) {
      router.push(pathname);
    }
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      const barcode = data.barcode.trim();
      const salePriceNum = data.salePrice?.trim() ? Number(data.salePrice) : undefined;
      const shopPriceNum = data.shopPrice?.trim() ? Number(data.shopPrice) : undefined;
      const labourPriceNum = data.labourPrice?.trim() ? Number(data.labourPrice) : undefined;
      const activeBool = data.active === "true";

      if (editing) {
        await productsService.update(editing.id, {
          name: data.name.trim(),
          barcode: barcode || undefined,
          categoryId: data.categoryId,
          unitId: data.unitId,
          salePrice: salePriceNum,
          shopPrice: shopPriceNum,
          labourPrice: labourPriceNum,
          active: activeBool,
          images: existingImages,
        });
        if (imageFiles.length > 0) {
          await productsService.uploadImages(editing.id, imageFiles);
        }
      } else {
        const created = await productsService.create({
          name: data.name.trim(),
          barcode: barcode || undefined,
          categoryId: data.categoryId,
          unitId: data.unitId,
          salePrice: salePriceNum,
          shopPrice: shopPriceNum,
          labourPrice: labourPriceNum,
          active: activeBool,
        });
        if (imageFiles.length > 0) {
          await productsService.uploadImages(created.id, imageFiles);
        }
      }

      toast.success(t("Saqlandi"));
      setExistingImages([]);
      setImageFiles([]);
      setOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    }
  });

  async function remove(p: Product) {
    setDeletingId(p.id);
    try {
      await productsService.remove(p.id);

      toast.info(t("O'chirildi"), undefined, {
        label: t("Undo"),
        onClick: async () => {
          await productsService.create({
            id: p.id,
            name: p.name,
            categoryId: p.categoryId,
            unitId: p.unitId,
            price: p.price,
            salePrice: p.salePrice,
            shopPrice: p.shopPrice,
            labourPrice: p.labourPrice,
            active: p.active,
          });
          toast.success(t("Qaytarildi"));
          await refresh();
        },
      });

      await refresh();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("O'chirib bo'lmadi"));
    } finally {
      setDeletingId(null);
    }
  }

  function exportCSV() {
    const headers = ["Name", "Barcode", "Category", "Unit", "Price_UZS", "SalePrice_UZS", "ShopPrice_UZS", "LabourPrice_UZS", "Active"];
    const rows = filtered.map((p) => [
      p.name,
      p.barcode ?? "",
      getCategoryLabel(p),
      unitMap.get(p.unitId) ?? "",
      typeof p.price === "number" ? p.price : "",
      typeof p.salePrice === "number" ? p.salePrice : "",
      typeof p.shopPrice === "number" ? p.shopPrice : "",
      typeof p.labourPrice === "number" ? p.labourPrice : "",
      p.active ? "YES" : "NO",
    ]);
    const csv = buildCSV(headers, rows);
    downloadCSV(`ruxshona-products-${fileStamp()}.csv`, csv);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Katalog (Mahsulotlar)")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Retsept, birlik va narxlar boshqaruvi")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={exportCSV} disabled={filtered.length === 0}>
            {t("Export CSV")}
          </Button>
          {!isCreateView ? (
            <Button onClick={() => router.push(`${pathname}?new=1`)}>{t("+ Mahsulot qo'shish")}</Button>
          ) : null}
        </div>
      </div>

      {!isCreateView && (
        <>
          <Card className="motion-safe:animate-fade-up">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full md:w-64">
                <Input
                  label={t("Qidirish")}
                  placeholder={t("Masalan: Napoleon")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="ml-auto flex flex-wrap gap-2">
                <div className="rounded-full bg-cream-100 px-3 py-2 text-xs font-semibold text-cocoa-700">
                  {t("{count} ta mahsulot", { count: filtered.length })}
                </div>
              </div>
            </div>
          </Card>

          <Card className="motion-safe:animate-fade-up anim-delay-150">
            {loading ? (
              <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
            ) : (
              <Table>
                <T>
                  <thead>
                    <tr>
                      <th>{t("Nomi")}</th>
                      <th>{t("Kategoriya")}</th>
                      <th>{t("Birlik")}</th>
                      <th>{t("Narx")}</th>
                      <th>{t("Status")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const mainPrice = typeof p.salePrice === "number" ? p.salePrice : p.price;
                      const shopPrice = p.shopPrice;
                      return (
                        <tr key={p.id}>
                          <td className="font-semibold text-cocoa-900">
                            <div className="flex items-center gap-3">
                              {p.images?.[0] ? (
                                <img
                                  src={resolveImage(p.images[0])}
                                  alt={p.name}
                                  className="h-10 w-10 rounded-xl border border-cream-200/70 object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-xl border border-cream-200/70 bg-cream-100/80" />
                              )}
                              <div className="flex flex-col">
                                <span>{p.name}</span>
                                {p.barcode ? (
                                  <span className="text-xs text-cocoa-500">
                                    {t("Barcode")}: {p.barcode}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>{getCategoryLabel(p)}</td>
                          <td>{unitMap.get(p.unitId) ?? "-"}</td>
                          <td>
                            <div className="flex flex-col">
                              <span>{typeof mainPrice === "number" ? moneyUZS(mainPrice) : "-"}</span>
                              {typeof shopPrice === "number" ? (
                                <span className="text-xs text-cocoa-500">
                                  {t("Do'konlarga berilish narxi")}: {moneyUZS(shopPrice)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>{p.active ? t("Active") : t("Archived")}</td>
                          <td className="whitespace-nowrap">
                            <div className="flex flex-wrap gap-2">
                              <Button variant="ghost" onClick={() => openEdit(p)}>
                                {t("Edit")}
                              </Button>
                              <Button variant="danger" disabled={deletingId === p.id} onClick={() => remove(p)}>
                                {deletingId === p.id ? t("Deleting...") : t("Delete")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-sm text-cocoa-600">
                          {t("Hech narsa topilmadi.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </T>
              </Table>
            )}
          </Card>
        </>
      )}

      {open && (isCreateView || Boolean(editing)) && (
        <Card className="motion-safe:animate-fade-up">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-cocoa-900">
              {editing ? t("Mahsulotni tahrirlash") : t("Yangi mahsulot")}
            </h2>
            <Button
              variant="ghost"
              onClick={closeForm}
            >
              {isCreateView ? t("Mahsulotlar ro'yxati") : t("Yopish")}
            </Button>
          </div>

          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-cocoa-600">
                {t("Yuklangan rasmlar")}
              </div>
              <div className="flex flex-wrap gap-3">
                {imagePreviews.map((src, i) => (
                  <div
                    key={`${src}-${i}`}
                    className="group relative h-20 w-20 overflow-hidden rounded-2xl border border-cream-200/70 bg-white/70"
                  >
                    <img src={src} alt="Yangi rasm" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-cream-50/90 px-2 py-1 text-xs font-semibold text-cocoa-700 opacity-0 transition group-hover:opacity-100"
                      onClick={() => setImageFiles((prev) => prev.filter((_, index) => index !== i))}
                    >
                      X
                    </button>
                  </div>
                ))}
                {existingImages.map((src, i) => (
                  <div
                    key={`${src}-${i}`}
                    className="group relative h-20 w-20 overflow-hidden rounded-2xl border border-cream-200/70 bg-white/70"
                  >
                    <img src={resolveImage(src)} alt="Mahsulot rasmi" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full bg-cream-50/90 px-2 py-1 text-xs font-semibold text-cocoa-700 opacity-0 transition group-hover:opacity-100"
                      onClick={() => setExistingImages((prev) => prev.filter((_, index) => index !== i))}
                    >
                      X
                    </button>
                  </div>
                ))}
                {remainingSlots > 0 ? (
                  <label
                    htmlFor={uploadInputId}
                    className="group flex h-20 w-20 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-berry-300/70 bg-cream-100/70 text-cocoa-500 transition hover:border-berry-400"
                  >
                    <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-cream-200 bg-white/80">
                      <span className="text-lg font-semibold text-cocoa-500">+</span>
                    </div>
                  </label>
                ) : null}
              </div>
              {remainingSlots > 0 ? (
                <>
                  <div className="text-sm font-semibold text-cocoa-800">{t("Rasm yuklash")}</div>
                  <div className="text-xs text-cocoa-500">
                    {t("JPEG, PNG yoki WEBP formatidagi rasmni yuklang. Fayl hajmi 10 MB dan oshmasligi kerak.")}
                  </div>
                </>
              ) : null}
              <input
                id={uploadInputId}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const maxCount = Math.max(0, 3 - (editing?.images?.length ?? 0) - imageFiles.length);
                  const files = Array.from(e.target.files ?? []).slice(0, maxCount);
                  if ((e.target.files?.length ?? 0) > maxCount) {
                    toast.error(t("Xatolik"), t("Rasm soni 3 tadan oshmasin"));
                  }
                  if (files.length > 0) {
                    setImageFiles((prev) => [...prev, ...files]);
                  }
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <Input
              label={t("Nomi *")}
              {...register("name")}
              error={errors.name?.message}
              placeholder={t("Masalan: Medovik tort")}
            />

            <Input
              label={t("Barcode")}
              {...register("barcode")}
              inputMode="numeric"
              maxLength={13}
              error={errors.barcode?.message}
              hint={t("Barcode avtomatik beriladi, xohlasangiz qo'lda o'zgartiring")}
            />

            <Select
              label={t("Kategoriya")}
              {...register("categoryId")}
              error={errors.categoryId?.message}
              hint={t("Mahsulot kategoriyasini belgilang.")}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />

            <Select
              label={t("O'lchov birligi")}
              {...register("unitId")}
              error={errors.unitId?.message}
              options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.short})` }))}
            />

            <>
              <Controller
                name="salePrice"
                control={control}
                render={({ field }) => (
                  <Input
                    label={t("Sotuv narxi")}
                    inputMode="numeric"
                    value={formatDigitsWithSpaces(field.value || "")}
                    onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                    error={errors.salePrice?.message}
                    placeholder={t("Masalan: 180000")}
                  />
                )}
              />
              <Controller
                name="shopPrice"
                control={control}
                render={({ field }) => (
                  <Input
                    label={t("Do'konlarga berilish narxi")}
                    inputMode="numeric"
                    value={formatDigitsWithSpaces(field.value || "")}
                    onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                    error={errors.shopPrice?.message}
                    placeholder={t("Masalan: 180000")}
                  />
                )}
              />
              <Controller
                name="labourPrice"
                control={control}
                render={({ field }) => (
                  <Input
                    label={t("Ish haqi (narxi)")}
                    inputMode="numeric"
                    value={formatDigitsWithSpaces(field.value || "")}
                    onChange={(e) => field.onChange(onlyDigits(e.target.value))}
                    error={errors.labourPrice?.message}
                    placeholder={t("Masalan: 5000")}
                  />
                )}
              />
            </>

            <Select
              label={t("Status")}
              {...register("active")}
              error={errors.active?.message}
              hint={t("Status orqali faol yoki arxiv holatini belgilang.")}
              options={[
                { value: "true", label: t("Active") },
                { value: "false", label: t("Archived") },
              ]}
            />

            <Textarea
              label={t("Izoh")}
              {...register("note")}
              error={errors.note?.message}
              placeholder={t("Ixtiyoriy...")}
            />

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={closeForm}
                disabled={isSubmitting}
              >
                {t("Bekor")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("Saqlanmoqda...") : t("Saqlash")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {scrollTopMounted && showScrollTop && !open
        ? createPortal(
            <Button
              className="fixed bottom-6 right-6 z-[80] h-12 w-12 rounded-full p-0 shadow-[0_18px_30px_rgba(122,11,11,0.28)]"
              onClick={scrollToTop}
              aria-label={t("Tepaga qaytish")}
              title={t("Tepaga qaytish")}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>,
            document.body
          )
        : null}
    </div>
  );
}
