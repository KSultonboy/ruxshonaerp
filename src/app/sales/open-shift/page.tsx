"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { salesService } from "@/services/sales";

export default function OpenShiftPage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);

  function normalizeShiftOpenError(error: unknown) {
    const message = String((error as any)?.message || "");
    const lower = message.toLowerCase();
    if (
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("api timeout") ||
      lower.includes("load failed")
    ) {
      return t("Server bilan aloqa uzildi. Internetni tekshirib qayta urinib ko'ring");
    }
    return message || t("Smena ochib bo'lmadi");
  }

  async function openAndGo() {
    setLoading(true);
    try {
      const openShift = await salesService.getShift().catch(() => null);
      if (openShift && openShift.status === "OPEN") {
        router.replace("/sales/sell");
        return;
      }
      await salesService.openShift();
      router.replace("/sales/sell");
    } catch (e: any) {
      setLoading(false);
      toast.error(t("Xatolik"), normalizeShiftOpenError(e));
    }
  }

  useEffect(() => {
    void openAndGo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    try {
      await logout();
      router.replace("/login");
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Smenani yopmasdan chiqib bo'lmaydi"));
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0d1117] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600/20">
          <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M12 7v5l3.5 2" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-white">{t("Smena ochish")}</h1>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          {loading ? t("Smena avtomatik ochilmoqda...") : t("Smenani qayta ochib ko'ring")}
        </p>

        {!loading && (
          <button
            type="button"
            onClick={openAndGo}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white shadow-lg transition hover:bg-emerald-500 active:scale-95"
          >
            {t("Qayta urinish")}
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full rounded-2xl border border-slate-700 bg-transparent py-3 text-sm font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
        >
          {t("Chiqish (logout)")}
        </button>
      </div>
    </div>
  );
}
