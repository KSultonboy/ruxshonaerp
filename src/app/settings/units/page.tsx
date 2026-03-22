"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function UnitsPage() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    router.replace("/products/units");
  }, [router]);

  return (
    <Card className="border-cream-200/70 bg-white/80">
      <div className="text-sm text-cocoa-700">{t("O'lchov birliklari endi Sozlamalar bo'limida.")}</div>
    </Card>
  );
}
