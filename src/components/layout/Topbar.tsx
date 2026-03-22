"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SERVICE_MODE } from "@/services/config";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import Button from "@/components/ui/Button";
import OfflineIndicator from "@/components/ui/OfflineIndicator";
import DesktopUpdateBell from "@/components/system/DesktopUpdateBell";

interface TopbarProps {
  onOpenSidebar: () => void;
}

export default function Topbar({ onOpenSidebar }: TopbarProps) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { t, lang, setLang } = useI18n();
  const role = useMemo(
    () =>
      user?.role
        ? t(
            user.role === "ADMIN"
              ? "Admin"
              : user.role === "SALES"
              ? "Sotuvchi"
              : user.role === "MANAGER"
              ? "Menejer"
              : "Ishlab chiqarish"
          )
        : null,
    [user, t]
  );

  async function handleLogout() {
    try {
      await logout();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Smenani yopmasdan chiqib bo'lmaydi"));
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 motion-safe:animate-fade-in sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-lg border border-cream-200 bg-white p-2 text-cocoa-600 shadow-card transition hover:bg-cream-100 focus:outline-none lg:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-cocoa-900 sm:text-base">{t("Assalomu alaykum")}{user ? `, ${user.username}` : ""}</div>
            <div className="hidden truncate text-xs text-cocoa-500 sm:block">{t("Ruxshona Tort boshqaruv paneli")}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <OfflineIndicator />

          <div className="flex items-center gap-0.5 rounded-lg border border-cream-200 bg-cream-50 p-0.5 text-xs font-semibold">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 transition ${
                lang === "uz_latn" ? "bg-berry-700 text-white shadow-glow-sm" : "text-cocoa-600 hover:bg-cream-100"
              }`}
              onClick={() => setLang("uz_latn")}
            >
              UZ
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 transition ${
                lang === "uz_cyrl" ? "bg-berry-700 text-white shadow-glow-sm" : "text-cocoa-600 hover:bg-cream-100"
              }`}
              onClick={() => setLang("uz_cyrl")}
            >
              УЗ
            </button>
          </div>

          {user ? (
            <div className="hidden items-center gap-2 rounded-lg border border-cream-200 bg-white px-3 py-1.5 text-xs font-medium text-cocoa-700 shadow-card sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-berry-100 text-[10px] font-bold text-berry-700">
                {user.username.charAt(0).toUpperCase()}
              </span>
              {user.username} {role ? <span className="text-cocoa-400">• {role}</span> : ""}
            </div>
          ) : null}

          <DesktopUpdateBell />

          {user && SERVICE_MODE === "api" ? (
            <Button variant="ghost" onClick={handleLogout} className="px-3 py-1.5 text-xs">
              {t("Chiqish")}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
