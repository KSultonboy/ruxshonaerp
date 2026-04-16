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
    subtotal?: number;
    cashbackUsed?: number;
    cashbackEarned?: number;
    finalPaid?: number;
    cashbackBalance?: number;
    cashSplitAmount?: number;
    fromBranch?: string;
    toBranch?: string;
    sourceLabel?: string;
    sourceName?: string;
    items?: ReceiptLineItem[];
    /** Avvalgi (transfer yozilishidan oldingi) do'kon qarzi */
    previousDebt?: number;
    /** Gift card chegirmasi */
    giftCardDiscount?: number;
    /** Foizli karta foizi (PERCENTAGE turi uchun) */
    giftCardPercent?: number;
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
    paperWidthMm: 72,
    baseFontPx: 11,
    titleFontPx: 16,
    headerFontPx: 10,
    storeName: "RUXSHONA TORT",
    storeSubtitle: "Transfer xizmati",
    thankYouLine: "Transfer muvaffaqiyatli rasmiylashtirildi",
    footerLine: "Qabul qiluvchi imzosi: __________",
  },
  RETURN: {
    paperWidthMm: 72,
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
    const subtotal = Number(data.subtotal ?? total) || 0;
    const cashbackUsed = Number(data.cashbackUsed ?? 0) || 0;
    const cashbackEarned = Number(data.cashbackEarned ?? 0) || 0;
    const finalPaid = Number(data.finalPaid ?? Math.max(0, subtotal - cashbackUsed)) || 0;
    const cashbackBalance = Number(data.cashbackBalance ?? 0) || 0;
    return { total, totalQty, subtotal, cashbackUsed, cashbackEarned, finalPaid, cashbackBalance };
  }, [data.cashbackBalance, data.cashbackEarned, data.cashbackUsed, data.finalPaid, data.subtotal, lineItems]);

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
  const receiptPadding = "2.2mm 3.2mm 2.4mm 2.2mm";
  const receiptDate = formatReceiptDate(data.date);
  const receiptIdSuffix = data.id.slice(-8);
  const paymentLabel = paymentMethodLabel(data.paymentMethod, t);
  const hasPriceColumns = lineItems.some((item) => Number(item.price || 0) > 0) && (type === "SALE" || type === "TRANSFER");
  const sourceLabel = data.sourceLabel || t("Filial");
  const sourceName = data.sourceName || data.branchName || t("Markaziy");
  const previousDebt = Number(data.previousDebt ?? 0) || 0;

  return (
    <div
      className="receipt-print mx-auto bg-white font-mono leading-tight text-black print:w-full"
      style={{
        width: `${widthMm}mm`,
        fontSize: `${design.baseFontPx}px`,
        padding: receiptPadding,
        boxSizing: "border-box",
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
          <span className="shrink-0 pl-2 text-right font-semibold">{receiptDate}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span>ID:</span>
          <span className="shrink-0 pl-2 text-right font-semibold">{receiptIdSuffix}</span>
        </div>
        {type === "TRANSFER" ? (
          <>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span>{t("Kimdan")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">{data.fromBranch || "-"}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span>{t("Kimga")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">{data.toBranch || "-"}</span>
            </div>
            {data.previousDebt !== undefined && (
              <div className="mt-1 border-t border-dashed border-black/40 pt-1 flex items-center justify-between gap-2 font-bold">
                <span>{t("Joriy qarz")}:</span>
                <span className="shrink-0 pl-2 text-right">
                  {formatDigitsWithSpaces(String(Math.round(data.previousDebt)))} so'm
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span>{sourceLabel}:</span>
            <span className="shrink-0 pl-2 text-right font-semibold">{sourceName}</span>
          </div>
        )}
      </div>

      <div className="mt-2 border-b border-black pb-1 font-bold uppercase" style={{ fontSize: `${design.headerFontPx}px` }}>
        <div className="flex items-center justify-between">
          <span>{t("Mahsulot")}</span>
          <span>{hasPriceColumns ? t("Jami") : t("Soni")}</span>
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
              {!hasPriceColumns ? (
                <div className="mt-0.5 flex items-center justify-end text-[10px] font-bold">{qty}</div>
              ) : (
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px]">
                  <span>
                    {qty}
                    {hasPrice ? ` x ${formatDigitsWithSpaces(String(unitPrice))}` : ""}
                  </span>
                  <span className="min-w-[18mm] shrink-0 pl-2 text-right font-bold">
                    {hasPrice ? formatDigitsWithSpaces(String(lineTotal)) : String(qty)}
                  </span>
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
            <span className="shrink-0 pl-2 text-right">{formatDigitsWithSpaces(String(receiptMeta.subtotal))} so'm</span>
          </div>
          {receiptMeta.cashbackUsed > 0 ? (
            <div className="mt-0.5 flex items-center justify-between text-[10px]">
              <span>{t("Cashback ishlatildi")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">
                -{formatDigitsWithSpaces(String(receiptMeta.cashbackUsed))} so'm
              </span>
            </div>
          ) : null}
          {receiptMeta.cashbackEarned > 0 ? (
            <div className="mt-0.5 flex items-center justify-between text-[10px]">
              <span>{t("Yozilgan cashback")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">
                +{formatDigitsWithSpaces(String(receiptMeta.cashbackEarned))} so'm
              </span>
            </div>
          ) : null}
          {data.giftCardDiscount != null && data.giftCardDiscount > 0 ? (
            <div className="mt-0.5 flex items-center justify-between text-[10px]">
              <span>{t("Aksiya kartasi")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold text-emerald-700">
                {data.giftCardPercent
                  ? `-${data.giftCardPercent}% (${formatDigitsWithSpaces(String(data.giftCardDiscount))} so'm)`
                  : `-${formatDigitsWithSpaces(String(data.giftCardDiscount))} so'm`}
              </span>
            </div>
          ) : null}
          {receiptMeta.cashbackUsed > 0 ? (
            <div className="mt-0.5 flex items-center justify-between text-[11px] font-bold">
              <span>{t("To'lanadi")}:</span>
              <span className="shrink-0 pl-2 text-right">
                {formatDigitsWithSpaces(String(receiptMeta.finalPaid))} so'm
              </span>
            </div>
          ) : null}
          {receiptMeta.cashbackEarned > 0 || receiptMeta.cashbackUsed > 0 ? (
            <div className="mt-0.5 flex items-center justify-between text-[10px]">
              <span>{t("Yangi balans")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">
                {formatDigitsWithSpaces(String(receiptMeta.cashbackBalance))} so'm
              </span>
            </div>
          ) : null}
          {data.cashSplitAmount != null && data.cashSplitAmount > 0 && data.paymentMethod === "CASH" ? (
            <>
              <div className="mt-0.5 flex items-center justify-between text-[10px]">
                <span>{t("Naqd")}:</span>
                <span className="shrink-0 pl-2 text-right font-semibold">
                  {formatDigitsWithSpaces(String(data.cashSplitAmount))} so'm
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[10px]">
                <span>{t("Karta")}:</span>
                <span className="shrink-0 pl-2 text-right font-semibold">
                  {formatDigitsWithSpaces(String(Math.max(0, receiptMeta.finalPaid - data.cashSplitAmount)))} so'm
                </span>
              </div>
            </>
          ) : (
            <div className="mt-0.5 flex items-center justify-between text-[10px]">
              <span>{t("To'lov turi")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">{paymentLabel}</span>
            </div>
          )}
          <div className="mt-0.5 flex items-center justify-between text-[10px]">
            <span>{t("Soni")}:</span>
            <span className="shrink-0 pl-2 text-right font-semibold">{receiptMeta.totalQty}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 border-t border-black pt-1">
          <div className="flex items-center justify-between text-[12px] font-bold">
            <span>{t("Soni")}:</span>
            <span className="shrink-0 pl-2 text-right">{receiptMeta.totalQty}</span>
          </div>
          {type === "TRANSFER" ? (
            <div className="mt-0.5 flex items-center justify-between text-[12px]">
              <span>{t("Hozirgi transfer summasi")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">
                {formatDigitsWithSpaces(String(receiptMeta.total))} so'm
              </span>
            </div>
          ) : type === "RETURN" ? (
            <div className="mt-0.5 flex items-center justify-between text-[12px]">
              <span>{t("Hozirgi vazvrat summasi")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">
                {formatDigitsWithSpaces(String(receiptMeta.total))} so'm
              </span>
            </div>
          ) : receiptMeta.total > 0 ? (
            <div className="mt-0.5 flex items-center justify-between text-[12px]">
              <span>{t("Tovarlar summasi")}:</span>
              <span className="shrink-0 pl-2 text-right font-semibold">
                {formatDigitsWithSpaces(String(receiptMeta.total))} so'm
              </span>
            </div>
          ) : null}
          {type === "TRANSFER" ? (
            <>
              <div className="mt-1 border-t border-dashed border-black/40 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>{t("Hozirgi qarz")}:</span>
                  <span className="shrink-0 pl-2 text-right font-semibold">
                    {formatDigitsWithSpaces(String(Math.round(previousDebt)))} so'm
                  </span>
                </div>
              </div>
              <div className="mt-1 border-t-2 border-black pt-1 flex items-center justify-between text-[14px] font-bold">
                <span>{t("Umumiy qarz")}:</span>
                <span className="shrink-0 pl-2 text-right">
                  {formatDigitsWithSpaces(String(Math.round(previousDebt + receiptMeta.total)))} so'm
                </span>
              </div>
            </>
          ) : type === "RETURN" && data.previousDebt !== undefined ? (
            <>
              <div className="mt-1 border-t border-dashed border-black/40 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>{t("Hozirgi qarz")}:</span>
                  <span className="shrink-0 pl-2 text-right font-semibold">
                    {formatDigitsWithSpaces(String(Math.round(previousDebt)))} so'm
                  </span>
                </div>
              </div>
              <div className="mt-1 border-t-2 border-black pt-1 flex items-center justify-between text-[14px] font-bold">
                <span>{t("Umumiy qarz")}:</span>
                <span className="shrink-0 pl-2 text-right">
                  {formatDigitsWithSpaces(String(Math.round(previousDebt - receiptMeta.total)))} so'm
                </span>
              </div>
            </>
          ) : null}
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
            position: static !important;
            margin: 0 !important;
            padding: ${receiptPadding} !important;
            box-sizing: border-box !important;
            width: ${widthMm}mm !important;
            max-width: ${widthMm}mm !important;
            min-width: ${widthMm}mm !important;
            page-break-inside: avoid;
            break-inside: avoid;
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
