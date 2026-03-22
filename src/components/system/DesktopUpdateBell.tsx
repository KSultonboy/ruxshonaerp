"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { checkDesktopUpdate, getDesktopVersion, isTauriDesktop, type DesktopUpdateInfo } from "@/lib/desktop-updater";

export default function DesktopUpdateBell() {
  const { t } = useI18n();
  const toast = useToast();

  const checkedRef = useRef(false);
  const installingRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateInfo | null>(null);

  const hasUpdate = Boolean(updateInfo);

  useEffect(() => {
    if (checkedRef.current) return;
    if (!isTauriDesktop()) return;

    checkedRef.current = true;
    setChecking(true);

    let cancelled = false;

    async function run() {
      try {
        const [curr, upd] = await Promise.all([getDesktopVersion(), checkDesktopUpdate()]);
        if (cancelled) return;
        setCurrentVersion(curr);
        setUpdateInfo(upd);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[desktop-updater] update check failed", error);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusText = useMemo(() => {
    if (checking) return t("Tekshirilmoqda...");
    if (hasUpdate) return t("Yangilanish mavjud");
    return t("Yangilanish topilmadi");
  }, [checking, hasUpdate, t]);

  if (!isTauriDesktop()) return null;

  async function handleInstall() {
    if (!updateInfo) return;
    if (installingRef.current) return;
    installingRef.current = true;

    try {
      toast.info(t("Yangilanish yuklanmoqda"), t("Iltimos kuting..."));
      await updateInfo.downloadAndInstall();
      toast.success(t("Yangilanish o'rnatildi"), t("Ilova qayta yuklanmoqda."));
      setOpen(false);
      setUpdateInfo(null);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error: any) {
      toast.error(t("Xatolik"), error?.message || t("Yangilanishni o'rnatib bo'lmadi"));
    } finally {
      installingRef.current = false;
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-xl border border-cream-200 bg-white p-2 text-cocoa-700 shadow-sm transition hover:bg-cream-50"
        aria-label="Desktop update"
        title={t("Update")}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v10m0 0-3-3m3 3 3-3M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {hasUpdate ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-berry-700 px-1 text-[10px] font-bold text-white">
            1
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-cream-200 bg-white p-4 text-sm shadow-card">
          <div className="mb-2 font-semibold text-cocoa-900">{t("Desktop Update")}</div>
          <div className="space-y-1 text-cocoa-700">
            <div>{statusText}</div>
            <div>
              {t("Joriy versiya")}: <span className="font-semibold">{currentVersion ?? "-"}</span>
            </div>
            <div>
              {t("Oxirgi versiya")}: <span className="font-semibold">{updateInfo?.version ?? "-"}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button onClick={() => void handleInstall()} disabled={!hasUpdate || checking}>
              {t("O'rnatish")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("Yopish")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
