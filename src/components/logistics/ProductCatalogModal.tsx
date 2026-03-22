"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Product } from "@/lib/types";
import { useI18n } from "@/components/i18n/I18nProvider";

function toPositiveInt(raw: string) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function ProductCatalogModal({
  open,
  onClose,
  products,
  title,
  onAdd,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  title: string;
  onAdd: (product: Product, quantity: number) => void;
  onRefresh?: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [refreshing, setRefreshing] = useState(false);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) => {
      const name = String(product.name ?? "").toLowerCase();
      const barcode = String(product.barcode ?? "").toLowerCase();
      return name.includes(normalized) || barcode.includes(normalized);
    });
  }, [products, query]);

  return (
    <Modal title={title} open={open} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Mahsulot nomi yoki barcode bo'yicha qidiring")}
            className="flex-1 rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none ring-berry-300 transition focus:ring-2"
          />
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.replace(/[^\d]/g, ""))}
            placeholder={t("Miqdor")}
            inputMode="numeric"
            className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none ring-berry-300 transition focus:ring-2 sm:w-28"
          />
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-2xl border border-cream-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-cream-50 text-xs uppercase tracking-wide text-cocoa-500">
              <tr>
                <th className="px-3 py-2 text-left">{t("Nomlanishi")}</th>
                <th className="px-3 py-2 text-left">{t("Kodi")}</th>
                <th className="px-3 py-2 text-right">{t("Qoldiq")}</th>
                <th className="px-3 py-2 text-right">{t("Qo'shish")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-cocoa-500">
                    {t("Hech narsa topilmadi.")}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t border-cream-200">
                    <td className="px-3 py-2 text-cocoa-900">{product.name}</td>
                    <td className="px-3 py-2 text-cocoa-700">{product.barcode ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-cocoa-700">{product.stock ?? 0}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const qty = toPositiveInt(quantity);
                          if (!qty) return;
                          onAdd(product, qty);
                        }}
                        className="rounded-lg bg-berry-700 px-3 py-1 text-xs font-semibold text-cream-50 hover:bg-berry-800"
                      >
                        {t("Qo'shish")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2">
          {onRefresh ? (
            <button
              type="button"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try { await onRefresh(); } finally { setRefreshing(false); }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition"
            >
              <svg className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? t("Yangilanmoqda...") : t("Yangilash")}
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-cocoa-700 hover:bg-cream-100"
          >
            {t("Yopish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

