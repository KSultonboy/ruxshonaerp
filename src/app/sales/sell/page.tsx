"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { salesService } from "@/services/sales";

export default function SalesSellPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [checkingShift, setCheckingShift] = useState(true);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [shiftCheckError, setShiftCheckError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setCheckingShift(true);
      setShiftCheckError(null);
      try {
        const shift = await salesService.getShift();
        if (!active) return;
        setIsShiftOpen(shift?.status === "OPEN");
      } catch (error: unknown) {
        if (!active) return;
        setIsShiftOpen(false);
        setShiftCheckError(error instanceof Error ? error.message : t("Smena holatini tekshirib bo'lmadi"));
      } finally {
        if (active) setCheckingShift(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <div className="grid min-h-[calc(100vh-15rem)] place-items-center">
      <Card className="w-full max-w-3xl border-berry-200 bg-gradient-to-br from-white to-cream-100/70 p-8 sm:p-10">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-berry-600">{t("Sotuv")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-cocoa-900 sm:text-4xl">{t("Kassa")}</h1>
          <p className="mt-3 text-sm text-cocoa-600 sm:text-base">
            {t("Sotuv kiritish bo'limi endi alohida kassa ekranida ishlaydi.")}
          </p>
          {checkingShift ? (
            <p className="mt-4 text-sm font-medium text-cocoa-500">{t("Smena holati tekshirilmoqda...")}</p>
          ) : isShiftOpen ? (
            <p className="mt-4 text-sm font-medium text-emerald-700">{t("Smena ochiq. Kassaga kirishingiz mumkin.")}</p>
          ) : (
            <p className="mt-4 text-sm font-medium text-amber-700">{t("Avval Smena bo'limidan smena oching.")}</p>
          )}
          {!checkingShift && shiftCheckError ? (
            <p className="mt-2 text-xs text-rose-600">{shiftCheckError}</p>
          ) : null}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button
            onClick={() => router.push("/sales/cashier")}
            className="h-20 w-full rounded-2xl text-xl font-bold sm:text-2xl"
            disabled={checkingShift || !isShiftOpen}
          >
            {t("Kassaga kirish")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/sales/shift")}
            className="h-20 w-full rounded-2xl text-xl font-bold sm:text-2xl"
          >
            {t("Smena sahifasi")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
