"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function computeEan13Check(base12: string) {
  let odd = 0, even = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(base12[i]);
    if (i % 2 === 0) odd += d; else even += d;
  }
  return (10 - ((odd + even * 3) % 10)) % 10;
}

function generateEan13(prefix = "20") {
  let base = prefix;
  while (base.length < 12) base += String(Math.floor(Math.random() * 10));
  base = base.slice(0, 12);
  return `${base}${computeEan13Check(base)}`;
}

function normalizeBarcodeValue(rawValue: string) {
  const cleaned = rawValue.trim().replace(/\s+/g, "");
  if (!cleaned) throw new Error("Barcode bo'sh");
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
      displayValue: false, margin: 0, width: barWidthPx, height: targetHeightPx,
    });
  } catch {
    JsBarcode(svg, safeBarcode, {
      format: "CODE128", displayValue: false, margin: 0,
      width: Math.max(1, barWidthPx), height: targetHeightPx,
    });
  }
  const serialized = new XMLSerializer().serializeToString(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
}

function formatLabelDate(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getFullYear()).slice(-2)}`;
}

function dispatchLabelsToPrint(html: string) {
  const popup = window.open("", "_blank", "width=480,height=700");
  if (popup) {
    try {
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      return true;
    } catch { try { popup.close(); } catch { /* ignore */ } }
  }
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;right:0;bottom:0";
  document.body.appendChild(frame);
  try { frame.srcdoc = html; return true; } catch { frame.remove(); return false; }
}

async function printLabels(items: Product[]) {
  const template = await getReceiptTemplateSettings();
  const { labelWidthMm, labelHeightMm, labelPaddingMm, labelBarcodeHeightMm, labelNameFontPx, labelMetaFontPx,
    showLabelProductName, showLabelBarcodeText, showLabelProductionDate } = template;
  const labelBarcodeWidthMm = Math.max(1, Math.min(template.labelBarcodeWidthMm, labelWidthMm - labelPaddingMm * 2));
  const productionDateText = formatLabelDate(new Date());

  const labels = items.map((product, index) => {
    const safeBarcode = normalizeBarcodeValue(product.barcode ?? "");
    const barcodeUrl = buildBarcodeDataUrl(safeBarcode, labelBarcodeWidthMm, labelBarcodeHeightMm);
    return `<section class="page${index === items.length - 1 ? " last" : ""}">
      <div class="label">
        ${showLabelProductName ? `<div class="name">${escapeHtml(product.name)}</div>` : ""}
        <img class="barcode" src="${barcodeUrl}" alt="Barcode ${escapeHtml(product.name)}" />
        ${showLabelBarcodeText ? `<div class="code">${escapeHtml(safeBarcode)}</div>` : ""}
        ${showLabelProductionDate ? `<div class="produced-date">${escapeHtml(productionDateText)}</div>` : ""}
      </div>
    </section>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Barcode Print</title>
    <style>
      @page{size:${labelWidthMm}mm ${labelHeightMm}mm;margin:0}
      *{box-sizing:border-box}
      html,body{width:${labelWidthMm}mm;height:${labelHeightMm}mm;margin:0;padding:0;font-family:Arial,sans-serif;color:#1f1a17;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{width:${labelWidthMm}mm;height:${labelHeightMm}mm;overflow:hidden;break-after:page;page-break-after:always}
      .page.last{break-after:auto;page-break-after:auto}
      .label{width:${labelWidthMm}mm;height:${labelHeightMm}mm;padding:${labelPaddingMm}mm;text-align:center;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden}
      .name{font-size:${labelNameFontPx}px;font-weight:700;margin:0;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .barcode{width:${labelBarcodeWidthMm}mm;height:${labelBarcodeHeightMm}mm;object-fit:contain;display:block;margin:0.5mm auto 0}
      .code{margin-top:0.5mm;font-size:${labelMetaFontPx}px;color:#5c5048;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .produced-date{margin-top:0.4mm;font-size:${Math.max(5, labelMetaFontPx)}px;color:#5c5048;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    </style></head><body>${labels}
    <script>(function(){const imgs=Array.from(document.querySelectorAll("img"));let printed=false;const cleanup=()=>{setTimeout(()=>{if(window.frameElement&&window.frameElement.parentNode){window.frameElement.parentNode.removeChild(window.frameElement);return}if(window.opener&&!window.closed)window.close()},400)};const printNow=()=>{if(printed)return;printed=true;try{window.focus();window.print()}finally{cleanup()}};window.addEventListener("afterprint",cleanup);if(imgs.length===0||imgs.every(i=>i.complete)){setTimeout(printNow,0)}else{let loaded=0;const done=()=>{loaded++;if(loaded>=imgs.length)printNow()};imgs.forEach(i=>{if(i.complete)done();else{i.onload=done;i.onerror=done}});setTimeout(printNow,500)}})();</script>
    </body></html>`;
}

export default function IkpuPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await productsService.list();
      setProducts(list);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const missingCount = useMemo(() => products.filter((p) => !p.barcode).length, [products]);
  const usedBarcodes = useMemo(() => new Set(products.map((p) => p.barcode).filter(Boolean) as string[]), [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q));
  }, [products, search]);

  const barcodeProducts = useMemo(() => products.filter((p) => !!p.barcode), [products]);
  const selectedProducts = useMemo(() => {
    const s = new Set(selectedIds);
    return barcodeProducts.filter((p) => s.has(p.id));
  }, [barcodeProducts, selectedIds]);

  function toggleProduct(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditValue(product.barcode ?? "");
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  function generateForProduct(product: Product) {
    let candidate = "";
    for (let i = 0; i < 10; i++) {
      candidate = generateEan13();
      if (!usedBarcodes.has(candidate)) break;
    }
    setEditingId(product.id);
    setEditValue(candidate);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  async function saveBarcode(productId: string) {
    const val = editValue.trim();
    if (!val) { toast.error(t("Xatolik"), t("Barcode kiritilmagan")); return; }
    if (val !== products.find((p) => p.id === productId)?.barcode && usedBarcodes.has(val)) {
      toast.error(t("Xatolik"), t("Bu barcode allaqachon ishlatilgan"));
      return;
    }
    setSaving(true);
    try {
      await productsService.update(productId, { barcode: val } as any);
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, barcode: val } : p));
      setEditingId(null);
      toast.success(t("Saqlandi"), t("Barcode yangilandi"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlashda xatolik"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePrintOne(product: Product) {
    if (!product.barcode) { toast.error(t("Xatolik"), t("Barcode yo'q")); return; }
    try {
      const html = await printLabels([product]);
      if (!dispatchLabelsToPrint(html)) toast.error(t("Xatolik"), t("Print oynasini ochib bo'lmadi"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Label chiqarishda xatolik"));
    }
  }

  async function handlePrintBatch(items: Product[]) {
    if (items.length === 0) { toast.error(t("Xatolik"), t("Kamida bitta mahsulot tanlang")); return; }
    try {
      const html = await printLabels(items);
      if (!dispatchLabelsToPrint(html)) toast.error(t("Xatolik"), t("Print oynasini ochib bo'lmadi"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Label chiqarishda xatolik"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("IKPU — Barcode boshqaruvi")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Mahsulotlarga barcode tayinlash, tahrirlash va chop etish")}</p>
        </div>
        <Button onClick={() => setBatchOpen(true)} disabled={barcodeProducts.length === 0}>
          {t("Barcode chop etish")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Badge tone="primary">{t("{count} ta mahsulot", { count: products.length })}</Badge>
        {missingCount > 0 ? (
          <Badge tone="warning">{t("Barcode yo'q")}: {missingCount}</Badge>
        ) : (
          <Badge tone="success">{t("Barcha mahsulotlarda barcode bor")}</Badge>
        )}
        <Badge tone="neutral">{t("Barcode bor")}: {products.length - missingCount}</Badge>
      </div>

      <Card>
        <input
          type="text"
          placeholder={t("Mahsulot nomi yoki barcode bo'yicha qidirish...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-cream-200 bg-cream-50 px-4 py-2.5 text-sm text-cocoa-900 placeholder:text-cocoa-400 focus:border-berry-400 focus:outline-none focus:ring-2 focus:ring-berry-200"
        />
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
                  <th>{t("Barcode")}</th>
                  <th>{t("Status")}</th>
                  <th className="text-right">{t("Amallar")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img src={resolveImage(p.images[0])} alt={p.name}
                              className="h-10 w-10 flex-shrink-0 rounded-xl border border-cream-200/70 object-cover" />
                          ) : (
                            <div className="h-10 w-10 flex-shrink-0 rounded-xl border border-cream-200/70 bg-cream-100/80" />
                          )}
                          <div>
                            <div className="font-semibold text-cocoa-900">{p.name}</div>
                            <div className="text-xs text-cocoa-500">{p.active ? t("Aktiv") : t("Arxivlangan")}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveBarcode(p.id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="w-44 rounded-lg border border-berry-300 bg-white px-2.5 py-1.5 text-sm font-mono text-cocoa-900 focus:border-berry-500 focus:outline-none focus:ring-2 focus:ring-berry-200"
                              placeholder="1234567890123"
                            />
                            <button
                              type="button"
                              onClick={() => void saveBarcode(p.id)}
                              disabled={saving}
                              className="rounded-lg bg-berry-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-berry-800 disabled:opacity-50"
                            >
                              {t("Saqlash")}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-cocoa-600 hover:bg-cream-100"
                            >
                              {t("Bekor")}
                            </button>
                          </div>
                        ) : p.barcode ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="h-6 w-32 rounded-md border border-cream-200/70"
                              style={{ backgroundImage: "repeating-linear-gradient(90deg,rgba(40,24,20,.8) 0 2px,transparent 2px 4px)" }} />
                            <span className="font-mono text-xs font-semibold text-cocoa-700">{p.barcode}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-cocoa-400 italic">{t("Barcode yo'q")}</span>
                        )}
                      </td>
                      <td>
                        {p.barcode ? (
                          <Badge tone="success">{t("Barcode bor")}</Badge>
                        ) : (
                          <Badge tone="warning">{t("Tayinlanmagan")}</Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          {!isEditing && (
                            <>
                              <button
                                type="button"
                                onClick={() => generateForProduct(p)}
                                className="rounded-lg border border-cream-300 px-2.5 py-1.5 text-xs font-semibold text-cocoa-600 hover:bg-cream-100"
                                title={t("Avtomatik barcode yaratish")}
                              >
                                {t("Yaratish")}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(p)}
                                className="rounded-lg border border-cream-300 px-2.5 py-1.5 text-xs font-semibold text-cocoa-600 hover:bg-cream-100"
                              >
                                {t("Tahrirlash")}
                              </button>
                              {p.barcode && (
                                <button
                                  type="button"
                                  onClick={() => void handlePrintOne(p)}
                                  className="rounded-lg bg-berry-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-berry-800"
                                >
                                  🖨 {t("Chop")}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-cocoa-500">
                      {search ? t("Qidiruv natijasi topilmadi.") : t("Mahsulotlar yo'q.")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </T>
          </Table>
        )}
      </Card>

      {/* Batch print modal */}
      <Modal title={t("Barcode chop etish")} open={batchOpen} onClose={() => setBatchOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-xl border border-cream-200/80 bg-cream-100/70 px-3 py-2 text-xs text-cocoa-700">
            {t("Bu test print: omborga mahsulot qo'shilmaydi.")}
          </div>
          <div className="text-sm text-cocoa-700">
            {t("Tanlanganlar")}: <span className="font-semibold">{selectedProducts.length}</span> / {barcodeProducts.length}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setSelectedIds(barcodeProducts.map((p) => p.id))}>
              {t("Barchasini tanlash")}
            </Button>
            <Button variant="ghost" onClick={() => setSelectedIds([])}>
              {t("Tozalash")}
            </Button>
            <Button variant="ghost" onClick={() => void handlePrintBatch(barcodeProducts)} disabled={barcodeProducts.length === 0}>
              {t("Barchasini chiqarish")}
            </Button>
            <Button onClick={() => void handlePrintBatch(selectedProducts)} disabled={selectedProducts.length === 0}>
              {t("Tanlanganlarni chiqarish")}
            </Button>
          </div>
          <div className="max-h-[380px] space-y-1.5 overflow-auto rounded-2xl border border-cream-200/70 bg-cream-100/50 p-3">
            {barcodeProducts.map((product) => (
              <label key={product.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-cream-200/70 bg-cream-50 px-3 py-2">
                <input type="checkbox" checked={selectedIds.includes(product.id)}
                  onChange={() => toggleProduct(product.id)}
                  className="h-4 w-4 rounded border-cream-300 text-berry-700" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-cocoa-900">{product.name}</div>
                  <div className="font-mono text-xs text-cocoa-500">{product.barcode}</div>
                </div>
                <button type="button" onClick={(e) => { e.preventDefault(); void handlePrintOne(product); }}
                  className="rounded-lg bg-berry-700 px-2 py-1 text-xs font-semibold text-white hover:bg-berry-800">
                  🖨
                </button>
              </label>
            ))}
            {barcodeProducts.length === 0 && (
              <div className="py-3 text-center text-sm text-cocoa-500">{t("Barcode yo'q")}</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
