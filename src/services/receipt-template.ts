import { getJSON, setJSON } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import type { ReceiptTemplateSettings } from "@/lib/types";

const RECEIPT_TEMPLATE_EVENT = "receipt-template:changed";

const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplateSettings = {
  storeName: "Ruxshona Tort",
  headerLine: "",
  thankYouLine: "Xaridingiz uchun rahmat!",
  footerLine: "",
  paperWidthMm: 65,
  baseFontSizePx: 12,
  titleFontSizePx: 20,
  labelWidthMm: 30,
  labelHeightMm: 20,
  labelPaddingMm: 1,
  labelBarcodeWidthMm: 28,
  labelBarcodeHeightMm: 10,
  labelNameFontPx: 7,
  labelMetaFontPx: 6,
  showLabelProductName: true,
  showLabelBarcodeText: true,
  showLabelProductionDate: true,
  showReceiptType: true,
  showDate: true,
  showBranchBlock: true,
  showPaymentMethod: true,
  showUnitPrice: true,
  showLineTotal: true,
  showTotal: true,
  showSignatures: true,
  showReceiptId: true,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeText(value: unknown, fallback: string, maxLength = 120) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

export function normalizeReceiptTemplateSettings(
  value?: Partial<ReceiptTemplateSettings> | null
): ReceiptTemplateSettings {
  const source = value ?? {};
  return {
    storeName: normalizeText(source.storeName, DEFAULT_RECEIPT_TEMPLATE.storeName, 80),
    headerLine: normalizeText(source.headerLine, DEFAULT_RECEIPT_TEMPLATE.headerLine, 120),
    thankYouLine: normalizeText(source.thankYouLine, DEFAULT_RECEIPT_TEMPLATE.thankYouLine, 120),
    footerLine: normalizeText(source.footerLine, DEFAULT_RECEIPT_TEMPLATE.footerLine, 120),
    paperWidthMm: clampNumber(source.paperWidthMm, 50, 100, DEFAULT_RECEIPT_TEMPLATE.paperWidthMm),
    baseFontSizePx: clampNumber(source.baseFontSizePx, 9, 16, DEFAULT_RECEIPT_TEMPLATE.baseFontSizePx),
    titleFontSizePx: clampNumber(source.titleFontSizePx, 14, 28, DEFAULT_RECEIPT_TEMPLATE.titleFontSizePx),
    labelWidthMm: clampNumber(source.labelWidthMm, 20, 80, DEFAULT_RECEIPT_TEMPLATE.labelWidthMm),
    labelHeightMm: clampNumber(source.labelHeightMm, 10, 80, DEFAULT_RECEIPT_TEMPLATE.labelHeightMm),
    labelPaddingMm: clampNumber(source.labelPaddingMm, 0, 5, DEFAULT_RECEIPT_TEMPLATE.labelPaddingMm),
    labelBarcodeWidthMm: clampNumber(
      source.labelBarcodeWidthMm,
      10,
      75,
      DEFAULT_RECEIPT_TEMPLATE.labelBarcodeWidthMm
    ),
    labelBarcodeHeightMm: clampNumber(
      source.labelBarcodeHeightMm,
      4,
      50,
      DEFAULT_RECEIPT_TEMPLATE.labelBarcodeHeightMm
    ),
    labelNameFontPx: clampNumber(source.labelNameFontPx, 5, 18, DEFAULT_RECEIPT_TEMPLATE.labelNameFontPx),
    labelMetaFontPx: clampNumber(source.labelMetaFontPx, 5, 18, DEFAULT_RECEIPT_TEMPLATE.labelMetaFontPx),
    showLabelProductName: normalizeBoolean(
      source.showLabelProductName,
      DEFAULT_RECEIPT_TEMPLATE.showLabelProductName
    ),
    showLabelBarcodeText: normalizeBoolean(
      source.showLabelBarcodeText,
      DEFAULT_RECEIPT_TEMPLATE.showLabelBarcodeText
    ),
    showLabelProductionDate: normalizeBoolean(
      source.showLabelProductionDate,
      DEFAULT_RECEIPT_TEMPLATE.showLabelProductionDate
    ),
    showReceiptType: normalizeBoolean(source.showReceiptType, DEFAULT_RECEIPT_TEMPLATE.showReceiptType),
    showDate: normalizeBoolean(source.showDate, DEFAULT_RECEIPT_TEMPLATE.showDate),
    showBranchBlock: normalizeBoolean(source.showBranchBlock, DEFAULT_RECEIPT_TEMPLATE.showBranchBlock),
    showPaymentMethod: normalizeBoolean(source.showPaymentMethod, DEFAULT_RECEIPT_TEMPLATE.showPaymentMethod),
    showUnitPrice: normalizeBoolean(source.showUnitPrice, DEFAULT_RECEIPT_TEMPLATE.showUnitPrice),
    showLineTotal: normalizeBoolean(source.showLineTotal, DEFAULT_RECEIPT_TEMPLATE.showLineTotal),
    showTotal: normalizeBoolean(source.showTotal, DEFAULT_RECEIPT_TEMPLATE.showTotal),
    showSignatures: normalizeBoolean(source.showSignatures, DEFAULT_RECEIPT_TEMPLATE.showSignatures),
    showReceiptId: normalizeBoolean(source.showReceiptId, DEFAULT_RECEIPT_TEMPLATE.showReceiptId),
  };
}

function emitTemplateChange(settings: ReceiptTemplateSettings) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ReceiptTemplateSettings>(RECEIPT_TEMPLATE_EVENT, { detail: settings }));
}

export async function getReceiptTemplateSettings(): Promise<ReceiptTemplateSettings> {
  const saved = getJSON<Partial<ReceiptTemplateSettings> | null>(STORAGE_KEYS.receiptTemplate, null);
  return normalizeReceiptTemplateSettings(saved);
}

export async function saveReceiptTemplateSettings(
  value: Partial<ReceiptTemplateSettings>
): Promise<ReceiptTemplateSettings> {
  const current = getJSON<Partial<ReceiptTemplateSettings> | null>(STORAGE_KEYS.receiptTemplate, null);
  const merged = normalizeReceiptTemplateSettings({
    ...(current ?? {}),
    ...value,
  });
  setJSON(STORAGE_KEYS.receiptTemplate, merged);
  emitTemplateChange(merged);
  return merged;
}

export async function resetReceiptTemplateSettings(): Promise<ReceiptTemplateSettings> {
  setJSON(STORAGE_KEYS.receiptTemplate, DEFAULT_RECEIPT_TEMPLATE);
  emitTemplateChange(DEFAULT_RECEIPT_TEMPLATE);
  return DEFAULT_RECEIPT_TEMPLATE;
}

export function subscribeReceiptTemplateSettings(
  listener: (value: ReceiptTemplateSettings) => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ReceiptTemplateSettings>;
    if (customEvent.detail) {
      listener(customEvent.detail);
    }
  };

  window.addEventListener(RECEIPT_TEMPLATE_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(RECEIPT_TEMPLATE_EVENT, handler as EventListener);
  };
}

export { DEFAULT_RECEIPT_TEMPLATE };
