"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Product } from "@/lib/types";
import { productsService } from "@/services/products";
import { getReceiptTemplateSettings } from "@/services/receipt-template";
import { API_ORIGIN, SERVICE_MODE } from "@/services/config";
import JsBarcode from "jsbarcode";

function resolveImage(src: string) {
  if (!src) return src;
  if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  return SERVICE_MODE === "api" ? `${API_ORIGIN}${src}` : src;
}

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
    throw new Error("Barcode bo'sh");
  }
  return cleaned;
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

function formatLabelProductionDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const yearShort = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${yearShort}`;
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
        // ignore close errors
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

export default function IkpuPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const list = await productsService.list();
        if (!ignore) setProducts(list);
      } catch (e: any) {
        if (!ignore) toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [t, toast]);

  const missingCount = useMemo(() => products.filter((p) => !p.barcode).length, [products]);
  const barcodeProducts = useMemo(() => products.filter((p) => !!p.barcode), [products]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => products.some((p) => p.id === id)));
  }, [products]);

  const selectedProducts = useMemo(() => {
    const selected = new Set(selectedIds);
    return barcodeProducts.filter((p) => selected.has(p.id));
  }, [barcodeProducts, selectedIds]);

  function toggleProduct(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function selectAll() {
    setSelectedIds(barcodeProducts.map((p) => p.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function printProducts(items: Product[]) {
    if (items.length === 0) {
      toast.error(t("Xatolik"), t("Kamida bitta mahsulot tanlang"));
      return;
    }

    try {
      const template = await getReceiptTemplateSettings();
      const labelWidthMm = template.labelWidthMm;
      const labelHeightMm = template.labelHeightMm;
      const labelPaddingMm = template.labelPaddingMm;
      const labelBarcodeWidthMm = Math.max(1, Math.min(template.labelBarcodeWidthMm, labelWidthMm - labelPaddingMm * 2));
      const labelBarcodeHeightMm = Math.max(1, template.labelBarcodeHeightMm);
      const labelNameFontPx = template.labelNameFontPx;
      const labelMetaFontPx = template.labelMetaFontPx;
      const showLabelProductName = template.showLabelProductName;
      const showLabelBarcodeText = template.showLabelBarcodeText;
      const showLabelProductionDate = template.showLabelProductionDate;
      const productionDateText = formatLabelProductionDate(new Date());

      const labels = items
        .map((product, index) => {
          const safeBarcode = normalizeBarcodeValue(product.barcode ?? "");
          const barcodeUrl = buildBarcodeDataUrl(safeBarcode, labelBarcodeWidthMm, labelBarcodeHeightMm);
          return `
            <section class="page${index === items.length - 1 ? " last" : ""}">
              <div class="label">
                ${showLabelProductName ? `<div class="name">${escapeHtml(product.name)}</div>` : ""}
                <img class="barcode" src="${barcodeUrl}" alt="Barcode ${escapeHtml(product.name)}" />
                ${showLabelBarcodeText ? `<div class="code">${escapeHtml(safeBarcode)}</div>` : ""}
                ${showLabelProductionDate ? `<div class="produced-date">${escapeHtml(productionDateText)}</div>` : ""}
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
          <title>IKPU Barcode Print</title>
          <style>
            @page { size: ${labelWidthMm}mm ${labelHeightMm}mm; margin: 0; }
            * { box-sizing: border-box; }
            html, body {
              width: ${labelWidthMm}mm;
              height: ${labelHeightMm}mm;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              color: #1f1a17;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body {
              display: block;
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
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
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
            .code {
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
          ${labels}
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
      if (!dispatched) {
        toast.error(t("Xatolik"), t("Print oynasini ochib bo'lmadi"));
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("Label chiqarishda xatolik");
      toast.error(t("Xatolik"), message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("IKPU")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Barcode boshqaruvi")}</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
          <Badge tone="primary">{t("{count} ta mahsulot", { count: products.length })}</Badge>
          {missingCount > 0 ? (
            <Badge tone="neutral">{t("Barcode yo'q")}: {missingCount}</Badge>
          ) : (
            <Badge tone="neutral">{t("Barcode")}: {t("Saqlandi")}</Badge>
          )}
          </div>
          <Button onClick={() => setPrintOpen(true)} disabled={barcodeProducts.length === 0}>
            {t("Barcode test print")}
          </Button>
        </div>
        <div className="mt-4 text-xs text-cocoa-600">
          {t("Barcode avtomatik generatsiya qilinadi")}
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Mahsulot")}</th>
                  <th>{t("Barcode")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
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
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td>
                      {p.barcode ? (
                        <div className="flex flex-col gap-1">
                          <div
                            className="h-6 w-32 rounded-md border border-cream-200/70"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(90deg, rgba(40,24,20,0.8) 0 2px, transparent 2px 4px)",
                            }}
                          />
                          <span className="text-xs font-semibold text-cocoa-700">{p.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-cocoa-500">{t("Barcode yo'q")}</span>
                      )}
                    </td>
                    <td>{p.active ? t("Active") : t("Archived")}</td>
                  </tr>
                ))}
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-sm text-cocoa-600">
                      {t("Hech narsa topilmadi.")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </T>
          </Table>
        )}
      </Card>

      <Modal title={t("Barcode test print")} open={printOpen} onClose={() => setPrintOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-xl border border-cream-200/80 bg-cream-100/70 px-3 py-2 text-xs text-cocoa-700">
            {t("Bu test print: omborga mahsulot qo'shilmaydi va qoldiqlar o'zgarmaydi.")}
          </div>
          <div className="text-sm text-cocoa-700">
            {t("Tanlanganlar")}: <span className="font-semibold">{selectedProducts.length}</span> / {barcodeProducts.length}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={selectAll}>
              {t("Barchasini tanlash")}
            </Button>
            <Button variant="ghost" onClick={clearSelection}>
              {t("Tozalash")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void printProducts(barcodeProducts)}
              disabled={barcodeProducts.length === 0}
            >
              {t("Barchasini chiqarish")}
            </Button>
            <Button
              onClick={() => void printProducts(selectedProducts)}
              disabled={selectedProducts.length === 0}
            >
              {t("Tanlanganlarni chiqarish")}
            </Button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-auto rounded-2xl border border-cream-200/70 bg-cream-100/50 p-3">
            {barcodeProducts.map((product) => {
              const checked = selectedIds.includes(product.id);
              return (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-cream-200/70 bg-cream-50 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(product.id)}
                      className="h-4 w-4 rounded border-cream-300 text-berry-700"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-cocoa-900">{product.name}</div>
                      <div className="text-xs text-cocoa-600">{product.barcode}</div>
                    </div>
                  </div>
                </label>
              );
            })}
            {barcodeProducts.length === 0 ? (
              <div className="py-3 text-sm text-cocoa-600">{t("Barcode yo'q")}</div>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}
