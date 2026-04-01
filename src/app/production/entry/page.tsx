"use client";

import { useCallback, useMemo } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { expenseItemsService } from "@/services/expenseItems";
import { productsService } from "@/services/products";
import { warehouseService } from "@/services/warehouse";
import { getReceiptTemplateSettings } from "@/services/receipt-template";
import JsBarcode from "jsbarcode";
import { useForm, Controller, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import type { Product } from "@/lib/types";

type EntryForm = {
    productId: string;
    quantity: string;
    printMode: "PER_ITEM" | "SINGLE" | "NONE";
    note?: string;
};

function excludeExpenseLinkedProducts(products: Product[], expenseItems: { productId?: string | null }[]) {
    const blockedProductIds = new Set(
        expenseItems.map((item) => item.productId).filter((productId): productId is string => Boolean(productId))
    );
    return products.filter((product) => !blockedProductIds.has(product.id));
}

function sanitizeDecimalInput(value: string) {
    let normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const dotIndex = normalized.indexOf(".");
    if (dotIndex >= 0) {
        normalized = normalized.slice(0, dotIndex + 1) + normalized.slice(dotIndex + 1).replace(/\./g, "");
        const [intPart, decimalPart = ""] = normalized.split(".");
        normalized = `${intPart}.${decimalPart.slice(0, 3)}`;
    }
    return normalized;
}

function parseDecimalQuantity(value: string) {
    return Number.parseFloat(String(value || "").replace(",", "."));
}

export default function ProductionEntryPage() {
    const toast = useToast();
    const { t } = useI18n();
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [searchText, setSearchText] = useState("");

    const entrySchema = useMemo(
        () =>
            z.object({
                productId: z.string().min(1, t("Mahsulot tanlang")),
                quantity: z
                    .string()
                    .trim()
                    .refine(
                        (v) =>
                            /^\d+(?:[.,]\d{1,3})?$/.test(v) &&
                            Number.isFinite(parseDecimalQuantity(v)) &&
                            parseDecimalQuantity(v) > 0,
                        t("Miqdor 0 dan katta bo'lsin")
                    ),
                printMode: z.enum(["PER_ITEM", "SINGLE", "NONE"]),
                note: z.string().trim().max(200, t("Izoh 200 belgidan oshmasin")).optional(),
            }),
        [t]
    );

    const {
        control,
        register,
        handleSubmit,
        reset,
        setValue,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<EntryForm>({
        resolver: zodResolver(entrySchema),
        defaultValues: {
            productId: "",
            quantity: "",
            printMode: "NONE",
            note: "",
        },
    });

    const loadProducts = useCallback(async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const [nextProducts, expenseItems] = await Promise.all([
                productsService.list(),
                expenseItemsService.list(),
            ]);
            const filteredProducts = excludeExpenseLinkedProducts(nextProducts, expenseItems);
            setProducts(filteredProducts);

            const currentProductId = getValues("productId");
            const hasCurrentSelection = filteredProducts.some((item) => item.id === currentProductId);
            setValue("productId", hasCurrentSelection ? currentProductId : filteredProducts[0]?.id ?? "", {
                shouldValidate: true,
            });
            return;
        } catch (productError: unknown) {
            const message =
                productError instanceof Error
                    ? productError.message
                    : t("Mahsulotlar ro'yxatini yuklab bo'lmadi");
            setProducts([]);
            setValue("productId", "", { shouldValidate: true });
            setLoadError(message);
        } finally {
            setLoading(false);
        }
    }, [getValues, setValue, t, toast]);

    useEffect(() => {
        void loadProducts();
    }, [loadProducts]);

    const selectedProductId = useWatch({ control, name: "productId" });
    const selectedProduct = useMemo(
        () => products.find((p) => p.id === selectedProductId) ?? null,
        [products, selectedProductId]
    );

    const filteredProducts = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return products;
        return products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q));
    }, [products, searchText]);

    function escapeHtml(value: string) {
        return value
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function normalizeBarcodeValue(rawValue: string) {
        const cleaned = rawValue.trim().replace(/\s+/g, "");
        if (!cleaned) {
            throw new Error(t("Barcode bo'sh. Label chiqarib bo'lmadi."));
        }
        return cleaned;
    }

    function formatLabelProductionDate(date: Date) {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const yearShort = String(date.getFullYear()).slice(-2);
        return `${day}.${month}.${yearShort}`;
    }

    function buildBarcodeDataUrl(barcodeValue: string, widthMm: number, heightMm: number) {
        const safeBarcode = normalizeBarcodeValue(barcodeValue);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        const targetWidthPx = Math.max(120, Math.round(widthMm * 8));
        const targetHeightPx = Math.max(40, Math.round(heightMm * 8));
        const estimatedModules = /^\d{13}$/.test(safeBarcode) ? 95 : safeBarcode.length * 11 + 35;
        const barWidthPx = Math.max(1, Math.min(3, targetWidthPx / estimatedModules));

        try {
            JsBarcode(svg, safeBarcode, {
                format: /^\d{13}$/.test(safeBarcode) ? "EAN13" : "CODE128",
                displayValue: false,
                margin: 0,
                width: barWidthPx,
                height: targetHeightPx,
            });
        } catch {
            JsBarcode(svg, safeBarcode, {
                format: "CODE128",
                displayValue: false,
                margin: 0,
                width: Math.max(1, barWidthPx),
                height: targetHeightPx,
            });
        }

        const serialized = new XMLSerializer().serializeToString(svg);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    }

    function dispatchLabelsToPrint(html: string) {
        const popup = window.open("", "_blank", "width=480,height=700");
        if (popup) {
            try {
                popup.document.open();
                popup.document.write(html);
                popup.document.close();
                return true;
            } catch {
                try {
                    popup.close();
                } catch {
                    // ignore
                }
            }
        }

        const frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.position = "fixed";
        frame.style.width = "1px";
        frame.style.height = "1px";
        frame.style.opacity = "0";
        frame.style.pointerEvents = "none";
        frame.style.border = "0";
        frame.style.right = "0";
        frame.style.bottom = "0";
        document.body.appendChild(frame);

        try {
            frame.srcdoc = html;
            return true;
        } catch {
            frame.remove();
            return false;
        }
    }

    async function printLabels(product: Product, quantity: number, printMode: EntryForm["printMode"]) {
        if (!product.barcode || printMode === "NONE") return 0;

        const template = await getReceiptTemplateSettings();
        const labelWidthMm = template.labelWidthMm;
        const labelHeightMm = template.labelHeightMm;
        const labelPaddingMm = template.labelPaddingMm;
        const labelBarcodeWidthMm = Math.max(8, Math.min(template.labelBarcodeWidthMm, labelWidthMm - labelPaddingMm * 2));
        const labelBarcodeHeightMm = template.labelBarcodeHeightMm;
        const labelNameFontPx = template.labelNameFontPx;
        const labelMetaFontPx = template.labelMetaFontPx;
        const showLabelProductName = template.showLabelProductName;
        const showLabelBarcodeText = template.showLabelBarcodeText;
        const showLabelProductionDate = template.showLabelProductionDate;

        const labelCopies = printMode === "PER_ITEM" ? Math.max(1, quantity) : 1;
        if (labelCopies > 500) throw new Error(t("Bir martada 500 tadan ko'p label chiqarib bo'lmaydi"));

        const safeBarcode = normalizeBarcodeValue(product.barcode);
        const barcodeUrl = buildBarcodeDataUrl(safeBarcode, labelBarcodeWidthMm, labelBarcodeHeightMm);
        const productionDateText = formatLabelProductionDate(new Date());

        const safeName = escapeHtml(product.name);
        const safeCode = escapeHtml(safeBarcode);
        const safeProductionDate = escapeHtml(productionDateText);

        const labelsHtml = Array.from({ length: labelCopies })
            .map((_, index) => {
                const meta = labelCopies > 1 ? safeCode : `${safeCode} &middot; ${quantity}`;
                return `
          <section class="page${index === labelCopies - 1 ? " last" : ""}">
            <div class="label">
              ${showLabelProductName ? `<div class="name">${safeName}</div>` : ""}
              <img class="barcode" src="${barcodeUrl}" alt="barcode" />
              ${showLabelBarcodeText ? `<div class="meta">${meta}</div>` : ""}
              ${showLabelProductionDate ? `<div class="produced-date">${safeProductionDate}</div>` : ""}
            </div>
          </section>
        `;
            })
            .join("");

        const printHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Product Label</title>
          <style>
            @page { size: ${labelWidthMm}mm ${labelHeightMm}mm; margin: 0; }
            * { box-sizing: border-box; }
            html, body {
              width: ${labelWidthMm}mm !important;
              height: ${labelHeightMm}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: Arial, sans-serif;
              color: #1f1a17;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page {
              width: ${labelWidthMm}mm;
              height: ${labelHeightMm}mm;
              overflow: hidden;
              break-after: page;
              page-break-after: always;
            }
            .page.last {
              break-after: auto;
              page-break-after: auto;
            }
            .label {
              width: ${labelWidthMm}mm;
              height: ${labelHeightMm}mm;
              padding: ${labelPaddingMm}mm;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              text-align: center;
              overflow: hidden;
            }
            .name {
              font-size: ${labelNameFontPx}px;
              font-weight: 700;
              margin: 0;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .barcode {
              width: ${labelBarcodeWidthMm}mm;
              height: ${labelBarcodeHeightMm}mm;
              object-fit: contain;
              display: block;
              margin: 0.5mm auto 0;
            }
            .meta {
              margin-top: 0.5mm;
              font-size: ${labelMetaFontPx}px;
              color: #5c5048;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .produced-date {
              margin-top: 0.4mm;
              font-size: ${Math.max(5, labelMetaFontPx)}px;
              color: #5c5048;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            (function () {
              const imgs = Array.from(document.querySelectorAll("img"));
              let printed = false;

              const cleanup = () => {
                setTimeout(() => {
                  if (window.frameElement && window.frameElement.parentNode) {
                    window.frameElement.parentNode.removeChild(window.frameElement);
                    return;
                  }
                  if (window.opener && !window.closed) {
                    window.close();
                  }
                }, 400);
              };

              const printNow = () => {
                if (printed) return;
                printed = true;
                try {
                  window.focus();
                  window.print();
                } finally {
                  cleanup();
                }
              };

              window.addEventListener("afterprint", cleanup);

              if (imgs.length === 0 || imgs.every((img) => img.complete)) {
                setTimeout(printNow, 0);
              } else {
                let loaded = 0;
                const done = () => {
                  loaded += 1;
                  if (loaded >= imgs.length) printNow();
                };
                imgs.forEach((img) => {
                  if (img.complete) done();
                  else {
                    img.onload = done;
                    img.onerror = done;
                  }
                });
                setTimeout(printNow, 500);
              }
            })();
          </script>
        </body>
      </html>
    `;

        const dispatched = dispatchLabelsToPrint(printHtml);
        if (!dispatched) throw new Error(t("Label oynasini ochib bo'lmadi"));
        return labelCopies;
    }

    const onSubmit = handleSubmit(async (data) => {
        try {
            const numericQuantity = parseDecimalQuantity(data.quantity);
            const product = products.find((p) => p.id === data.productId) ?? null;

            await warehouseService.createMovement({
                productId: data.productId,
                type: "IN",
                quantity: numericQuantity,
                note: data.note?.trim(),
                createdById: user?.id,
            });

            toast.success(t("Saqlandi"));

            if (product?.barcode) {
                try {
                    const printedCount = await printLabels(product, numericQuantity, data.printMode);

                    if (printedCount > 0) {
                        toast.success(t("Label printerga yuborildi"), `${printedCount} ${t("ta label")}`);
                    }
                } catch (printError: unknown) {
                    const printMessage = printError instanceof Error ? printError.message : t("Label chiqarilmadi");
                    toast.error(t("Xatolik"), printMessage);
                }
            } else if (product) {
                toast.error(t("Xatolik"), t("Mahsulotda barcode yo'q. Label chiqarilmadi."));
            }

            reset({ ...data, quantity: "", printMode: "NONE", note: "" });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : t("Saqlab bo'lmadi");
            toast.error(t("Xatolik"), message);
        }
    });

    if (loading) return <div className="p-6">{t("Yuklanmoqda...")}</div>;

    if (loadError) {
        return (
            <div className="mx-auto max-w-2xl space-y-4">
                <Card>
                    <div className="space-y-3">
                        <h1 className="font-display text-2xl font-semibold text-cocoa-900">{t("Xatolik")}</h1>
                        <p className="text-sm text-cocoa-700">{loadError}</p>
                        <Button onClick={() => void loadProducts()}>{t("Qayta urinish")}</Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="font-display text-3xl font-semibold text-cocoa-900">
                    {t("Ishlab chiqarilgan mahsulot kiritish")}
                </h1>
                <p className="text-sm text-cocoa-600">{t("Ishlab chiqarilgan tayyor mahsulotlarni markaziy omborga kirim qilish")}</p>
            </div>

            <Card>
                <form onSubmit={onSubmit} className="grid gap-6">
                    <input type="hidden" {...register("productId")} />

                    <div className="grid gap-2">
                        <label className="text-sm font-semibold uppercase tracking-wide text-cocoa-600">{t("Mahsulot")}</label>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPickerOpen(true)}
                            className="w-full justify-between rounded-2xl border border-cream-200/70 px-4 py-3 text-left font-medium text-cocoa-900"
                        >
                            <span>{selectedProduct?.name ?? t("Mahsulot tanlang")}</span>
                            <span className="text-xs text-cocoa-500">{t("Tanlash")}</span>
                        </Button>
                        {errors.productId?.message ? <div className="text-xs font-medium text-berry-700">{errors.productId.message}</div> : null}
                    </div>

                    <Controller
                        name="quantity"
                        control={control}
                        render={({ field }) => (
                            <Input
                                label={t("Miqdor")}
                                inputMode="decimal"
                                value={field.value || ""}
                                onChange={(e) => field.onChange(sanitizeDecimalInput(e.target.value))}
                                error={errors.quantity?.message}
                                placeholder={t("Masalan: 5 yoki 0.5")}
                            />
                        )}
                    />

                    <Controller
                        name="printMode"
                        control={control}
                        render={({ field }) => (
                            <div className="grid gap-2">
                                <label className="text-sm font-semibold uppercase tracking-wide text-cocoa-600">{t("Label chiqarish")}</label>
                                <select
                                    value={field.value}
                                    onChange={(e) => field.onChange(e.target.value as EntryForm["printMode"])}
                                    className="w-full rounded-xl border border-cream-200/70 bg-cream-50/80 px-3 py-2 text-sm text-cocoa-900 focus:border-berry-300 focus:outline-none focus:ring-2 focus:ring-berry-200/70"
                                >
                                    <option value="PER_ITEM">{t("Har biriga bitta")}</option>
                                    <option value="SINGLE">{t("Umumiy bitta")}</option>
                                    <option value="NONE">{t("Umuman chiqarmaslik")}</option>
                                </select>
                            </div>
                        )}
                    />

                    <Textarea label={t("Izoh")} {...register("note")} error={errors.note?.message} placeholder={t("Ixtiyoriy...")} />

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? t("Saqlanmoqda...") : t("Saqlash")}
                    </Button>
                </form>
            </Card>

            <Modal title={t("Mahsulot tanlash")} open={pickerOpen} onClose={() => setPickerOpen(false)}>
                <div className="grid gap-4">
                    <Input
                        label={t("Qidirish")}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder={t("Nom yoki barcode bo'yicha qidiring")}
                    />

                    <div className="max-h-[50vh] overflow-auto rounded-2xl border border-cream-200/70 bg-cream-100/40 p-2">
                        {filteredProducts.length === 0 ? (
                            <div className="p-3 text-sm text-cocoa-600">{t("Hech narsa topilmadi.")}</div>
                        ) : (
                            <div className="grid gap-2">
                                {filteredProducts.map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => {
                                            setValue("productId", product.id, { shouldValidate: true });
                                            setPickerOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between rounded-xl border border-cream-200/70 bg-cream-50 px-3 py-2 text-left hover:bg-cream-100/70"
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-cocoa-900">{product.name}</div>
                                            <div className="text-xs text-cocoa-600">{product.barcode || "-"}</div>
                                        </div>
                                        {selectedProductId === product.id ? <span className="text-xs font-semibold text-berry-700">{t("Tanlangan")}</span> : null}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}

