"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import TransferBranchesPage from "@/app/transfer/branches/page";
import TransferShopsPage from "@/app/transfer/shops/page";
import ReturnsBranchesPage from "@/app/returns/branches/page";
import ReturnsShopsPage from "@/app/returns/shops/page";

type ModeKey = "transfer-branches" | "transfer-shops" | "returns-branches" | "returns-shops";

const MODE_LABELS: Record<ModeKey, string> = {
  "transfer-branches": "Transfer: Filiallar",
  "transfer-shops": "Transfer: Do'konlar",
  "returns-branches": "Vazvrat: Filiallar",
  "returns-shops": "Vazvrat: Do'konlar",
};

function DefaultModeByRole(role?: string): ModeKey {
  if (role === "SALES") return "transfer-branches";
  if (role === "MANAGER") return "transfer-branches";
  if (role === "PRODUCTION") return "transfer-branches";
  return "transfer-branches";
}

function isModeAllowed(mode: ModeKey, role?: string) {
  if (role === "ADMIN") return true;
  if (role === "PRODUCTION") return true;
  if (role === "SALES") return true;
  if (role === "MANAGER") return true;
  return false;
}

export default function LogisticsCashierPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const role = user?.role;

  const [mode, setMode] = useState<ModeKey>(() => DefaultModeByRole(role));

  const availableModes = useMemo(
    () => (Object.keys(MODE_LABELS) as ModeKey[]).filter((item) => isModeAllowed(item, role)),
    [role]
  );

  const activeMode = useMemo<ModeKey>(() => {
    if (availableModes.includes(mode)) return mode;
    return availableModes[0] ?? DefaultModeByRole(role);
  }, [availableModes, mode, role]);

  if (!user) {
    return null;
  }

  if (availableModes.length === 0) {
    return (
      <div className="grid h-[100dvh] place-items-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {t("Bu bo'lim faqat admin uchun.")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[1460px] flex-col gap-2 overflow-hidden px-1.5 py-1.5 sm:px-2 md:px-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white px-3 py-2 shadow-card">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold text-cocoa-900 sm:text-2xl">
            {t("Transfer va vazvrat")}
          </h1>
          <p className="mt-0.5 text-xs text-cocoa-600 sm:text-sm">{t("Kassa uslubidagi yagona ekran")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {availableModes.map((item) => {
            const active = activeMode === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                  active
                    ? "border-berry-700 bg-berry-700 text-cream-50"
                    : "border-cream-300 bg-white text-cocoa-700 hover:bg-cream-100"
                }`}
              >
                {t(MODE_LABELS[item])}
              </button>
            );
          })}

          <Button variant="ghost" onClick={() => router.push("/")}>
            {t("Orqaga")}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-cream-200 bg-white px-2 py-2 shadow-card sm:px-3 sm:py-3">
        {activeMode === "transfer-branches" && <TransferBranchesPage />}
        {activeMode === "transfer-shops" && <TransferShopsPage />}
        {activeMode === "returns-branches" && <ReturnsBranchesPage />}
        {activeMode === "returns-shops" && <ReturnsShopsPage />}
      </div>
    </div>
  );
}
