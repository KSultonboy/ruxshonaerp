"use client";

import { useMemo } from "react";
import { formatDigitsWithSpaces } from "@/lib/mask";
import { useI18n } from "@/components/i18n/I18nProvider";

export type ReceiptType = "SALE" | "TRANSFER" | "RETURN";

type ReceiptLineItem = {
  name: string;
  quantity: number;
  price?: number;
};

interface ReceiptProps {
  type: ReceiptType;
  data: {
    id: string;
    date: string;
    productName: string;
    quantity: number;
    price?: number;
    paymentMethod?: string;
    branchName?: string;
    fromBranch?: string;
    toBranch?: string;
    sourceLabel?: string;
    sourceName?: string;
    items?: ReceiptLineItem[];
  };
}

type ReceiptDesign = {
  paperWidthMm: number;
  baseFontPx: number;
  titleFontPx: number;
  headerFontPx: number;
  storeName: string;
  storeSubtitle: string;
  thankYouLine: string;
  footerLine: string;
};

// NOTE: Receipt design is fixed in code and intentionally NOT loaded from admin settings.
const FIXED_RECEIPT_DESIGN: Record<ReceiptType, ReceiptDesign> = {
  SALE: {
    paperWidthMm: 72,
    baseFontPx: 11,
    titleFontPx: 17,
    headerFontPx: 10,
    storeName: "RUXSHONA TORT",
    storeSubtitle: "Tort do'koni",
    thankYouLine: "Xaridingiz uchun rahmat!",
    footerLine: "Qayta kelishingizni kutamiz",
  },
  TRANSFER: {
    paperWidthMm: 80,
    baseFontPx: 11,
    titleFontPx: 16,
    headerFontPx: 10,
    storeName: "RUXSHONA TORT",
    storeSubtitle: "Transfer xizmati",
    thankYouLine: "Transfer muvaffaqiyatli rasmiylashtirildi",
    footerLine: "Qabul qiluvchi imzosi: __________",
  },
  RETURN: {
    paperWidthMm: 80,
    baseFontPx: 11,
    titleFontPx: 16,
    headerFontPx: 10,
    storeName: "RUXSHONA TORT",
    storeSubtitle: "Vazvrat xizmati",
    thankYouLine: "Vazvrat hujjati rasmiylashtirildi",
    footerLine: "Mas'ul imzosi: __________",
  },
};

function formatReceiptDate(rawDate: string) {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return parsed.toLocaleString("uz-UZ", { hour12: false });
}

function paymentMethodLabel(paymentMethod: string | undefined, t: (key: string) => string) {
  if (paymentMethod === "CARD") return t("Karta");
  if (paymentMethod === "TRANSFER") return t("O'tkazma");
  return t("Naqd");
}

export default function Receipt({ type, data }: ReceiptProps) {
  const { t } = useI18n();
  const design = FIXED_RECEIPT_DESIGN[type];

  const lineItems: ReceiptLineItem[] =
    data.items && data.items.length > 0
      ? data.items
      : [{ name: data.productName, quantity: data.quantity, price: data.price }];

  const receiptMeta = useMemo(() => {
    const total = lineItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      return sum + qty * price;
    }, 0);

    const totalQty = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return { total, totalQty };
  }, [lineItems]);

  const title = useMemo(() => {
    switch (type) {
      case "TRANSFER":
        return t("Transfer cheki");
      case "RETURN":
        return t("Vazvrat cheki");
      default:
        return t("Sotuv cheki");
    }
  }, [t, type]);

  const widthMm = design.paperWidthMm;
  const receiptDate = formatReceiptDate(data.date);
  const receiptIdSuffix = data.id.slice(-8);
  const paymentLabel = paymentMethodLabel(data.paymentMethod, t);
  const hasPriceColumns = lineItems.some((item) => Number(item.price || 0) > 0) && type === "SALE";
  const sourceLabel = data.sourceLabel || t("Filial");
  const sourceName = data.sourceName || data.branchName || t("Markaziy");

  return (
    <div
      className="receipt-print mx-auto bg-white p-2 font-mono leading-tight text-black print:w-full print:p-0"
      style={{
        width: `${widthMm}mm`,
        fontSize: `${design.baseFontPx}px`,
      }}
    >
      <div className="text-center">
        <div className="font-bold tracking-wide" style={{ fontSize: `${design.titleFontPx}px` }}>
          {design.storeName}
        </div>
        <div className="uppercase tracking-[0.2em]" style={{ fontSize: `${design.headerFontPx}px` }}>
          {design.storeSubtitle}
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase">{title}</div>
      </div>

      <div className="mt-2 border-y border-black py-1" style={{ fontSize: `${design.headerFontPx}px` }}>
        <div className="flex items-center justify-between gap-2">
          <span>{t("Sana")}:</span>
          <span className="font-semibold">{receiptDate}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span>ID:</span>
          <span className="font-semibold">{receiptIdSuffix}</span>
        </div>
        {type === "TRANSFER" ? (
          <>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span>{t("Kimdan")}:</span>
              <span className="font-semibold">{data.fromBranch || "-"}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span>{t("Kimga")}:</span>
              <span className="font-semibold">{data.toBranch || "-"}</span>
            </div>
          </>
        ) : (
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span>{sourceLabel}:</span>
            <span className="font-semibold">{sourceName}</span>
          </div>
        )}
      </div>

      <div className="mt-2 border-b border-black pb-1 font-bold uppercase" style={{ fontSize: `${design.headerFontPx}px` }}>
        <div className="flex items-center justify-between">
          <span>{t("Mahsulot")}</span>
          <span>{type === "SALE" ? t("Jami") : t("Soni")}</span>
        </div>
      </div>

      <div className="space-y-1 pt-1">
        {lineItems.map((item, index) => {
          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.price) || 0;
          const lineTotal = qty * unitPrice;
          const hasPrice = Number.isFinite(unitPrice) && unitPrice > 0;
          return (
            <div key={`${item.name}-${index}`} className="border-b border-dotted border-black/40 pb-1">
              <div className="font-semibold">{item.name}</div>
              {type !== "SALE" || !hasPriceColumns ? (
                <div className="mt-0.5 flex items-center justify-end text-[10px] font-bold">{qty}</div>
              ) : (
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px]">
                  <span>
                    {qty}
                    {hasPrice ? ` x ${formatDigitsWithSpaces(String(unitPrice))}` : ""}
                  </span>
                  <span className="font-bold">{formatDigitsWithSpaces(String(lineTotal))}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {type === "SALE" ? (
        <div className="mt-2 border-t border-black pt-1">
          <div className="flex items-center justify-between text-[13px] font-bold">
            <span>{t("Jami")}:</span>
            <span>{formatDigitsWithSpaces(String(receiptMeta.total))} so'm</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px]">
            <span>{t("To'lov turi")}:</span>
            <span className="font-semibold">{paymentLabel}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px]">
            <span>{t("Soni")}:</span>
            <span className="font-semibold">{receiptMeta.totalQty}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 border-t border-black pt-1">
          <div className="flex items-center justify-between text-[12px] font-bold">
            <span>{t("Soni")}:</span>
            <span>{receiptMeta.totalQty}</span>
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-dashed border-black/70 pt-2 text-center text-[10px]">
        <div>{design.thankYouLine}</div>
        <div className="mt-0.5">{design.footerLine}</div>
      </div>

      <style jsx global>{`
        @media print {
          html {
            margin: 0 !important;
            padding: 0 !important;
          }

          body[data-receipt-print="1"] {
            margin: 0 !important;
            padding: 0 !important;
            width: ${widthMm}mm !important;
            max-width: ${widthMm}mm !important;
            min-width: ${widthMm}mm !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          body[data-receipt-print="1"] .receipt-print {
            position: fixed;
            left: 0;
            top: 0;
            width: ${widthMm}mm !important;
            max-width: ${widthMm}mm !important;
            min-width: ${widthMm}mm !important;
          }

          @page {
            size: ${widthMm}mm auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
