"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { checkDesktopUpdate, getDesktopVersion, isTauriDesktop, type DesktopUpdateInfo } from "@/lib/desktop-updater";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function SettingsUpdatePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [currentVersion, setCurrentVersion] = useState<string>("-");
  const [availableVersion, setAvailableVersion] = useState<string>("-");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>(t("Hozircha yo'q."));
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateInfo | null>(null);

  const desktop = useMemo(() => isTauriDesktop(), []);

  useEffect(() => {
    let isMounted = true;

    async function loadVersion() {
      if (!desktop) {
        setCurrentVersion("Web mode");
        setStatusText("Desktop app emas. Update faqat desktop ilovada ishlaydi.");
        return;
      }

      const version = await getDesktopVersion();
      if (!isMounted) return;
      setCurrentVersion(version ?? "-");
      setAvailableVersion(version ?? "-");
    }

    void loadVersion();
    return () => {
      isMounted = false;
    };
  }, [desktop]);

  const checkForUpdate = useCallback(async () => {
    if (!desktop) {
      toast.error(t("Xatolik"), "Desktop app emas. Update faqat desktop ilovada ishlaydi.");
      return;
    }

    setChecking(true);
    try {
      const found = await checkDesktopUpdate();
      setCheckedAt(new Date().toISOString());

      if (!found) {
        setUpdateInfo(null);
        setAvailableVersion(currentVersion);
        setStatusText(t("Hozircha yo'q."));
        toast.success(t("Saqlandi"), t("Hozircha yo'q."));
        return;
      }

      setUpdateInfo(found);
      setAvailableVersion(found.version);
      setStatusText(`${t("Yangilanish mavjud")}: ${found.version}`);
      toast.info(t("Yangilanish mavjud"), `${t("Yangi versiya")}: ${found.version}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("Xatolik");
      setStatusText(message);
      toast.error(t("Xatolik"), message);
    } finally {
      setChecking(false);
    }
  }, [currentVersion, desktop, t, toast]);

  const installUpdate = useCallback(async () => {
    if (!updateInfo || installing) return;

    setInstalling(true);
    try {
      toast.info(t("Yangilanish yuklanmoqda"), t("Iltimos kuting..."));
      await updateInfo.downloadAndInstall();
      setStatusText(t("Yangilanish o'rnatildi"));
      toast.success(
        t("Yangilanish o'rnatildi"),
        t("Ilova qayta yuklanmoqda, yangi versiya ishga tushadi.")
      );
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("Yangilanishni o'rnatib bo'lmadi");
      setStatusText(message);
      toast.error(t("Xatolik"), message);
    } finally {
      setInstalling(false);
    }
  }, [installing, t, toast, updateInfo]);

  if (user?.role !== "ADMIN") {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">Update</h1>
        <p className="mt-1 text-sm text-cocoa-600">Desktop ilova yangilanishini tekshirish va o'rnatish</p>
      </div>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-cream-200/70 bg-white/80 p-4">
            <div className="text-xs uppercase tracking-wide text-cocoa-500">Joriy versiya</div>
            <div className="mt-2 text-xl font-semibold text-cocoa-900">{currentVersion}</div>
          </div>
          <div className="rounded-2xl border border-cream-200/70 bg-white/80 p-4">
            <div className="text-xs uppercase tracking-wide text-cocoa-500">Mavjud versiya</div>
            <div className="mt-2 text-xl font-semibold text-cocoa-900">{availableVersion}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-cream-200/70 bg-cream-50/70 p-4">
          <div className="text-xs uppercase tracking-wide text-cocoa-500">Status</div>
          <div className="mt-2 text-sm font-medium text-cocoa-800">{statusText}</div>
          <div className="mt-1 text-xs text-cocoa-500">
            Oxirgi tekshiruv: {checkedAt ? formatDateTime(checkedAt) : "-"}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void checkForUpdate()} disabled={checking || installing}>
            {checking ? t("Yuklanmoqda...") : "Update tekshirish"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void installUpdate()}
            disabled={!updateInfo || installing || checking}
          >
            {installing ? t("Yangilanish yuklanmoqda") : t("O'rnatish")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
