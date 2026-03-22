"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function SalesSellPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="grid min-h-[calc(100vh-15rem)] place-items-center">
      <Card className="w-full max-w-3xl border-berry-200 bg-gradient-to-br from-white to-cream-100/70 p-8 sm:p-10">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-berry-600">{t("Sotuv")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-cocoa-900 sm:text-4xl">{t("Kassa")}</h1>
          <p className="mt-3 text-sm text-cocoa-600 sm:text-base">
            {t("Sotuv kiritish bo'limi endi alohida kassa ekranida ishlaydi.")}
          </p>
        </div>

        <Button
          onClick={() => router.push("/sales/cashier")}
          className="mt-8 h-20 w-full rounded-2xl text-xl font-bold sm:text-2xl"
        >
          {t("Kassaga kirish")}
        </Button>
      </Card>
    </div>
  );
}
