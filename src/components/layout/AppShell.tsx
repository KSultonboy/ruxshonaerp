"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ToastProvider } from "@/components/ui/toast/ToastProvider";
import { SERVICE_MODE } from "@/services/config";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { getDesktopVersion, isTauriDesktop } from "@/lib/desktop-updater";
import { setDesktopFullscreen } from "@/lib/desktop-window";

const DESKTOP_VERSION_KEY = "ruxshona.desktop.version";
const DESKTOP_VERSION_RELOAD_KEY = "ruxshona.desktop.version.reloaded";
const DESKTOP_VERSION_PURGED_KEY = "ruxshona.desktop.version.purged";

async function clearIndexedDbDatabase(name: string) {
  await new Promise<void>((resolve) => {
    try {
      const request = window.indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearDesktopRuntimeData() {
  const keepLocalKeys = new Set([DESKTOP_VERSION_KEY, DESKTOP_VERSION_PURGED_KEY]);
  const localKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key) localKeys.push(key);
  }
  for (const key of localKeys) {
    if (!keepLocalKeys.has(key)) {
      window.localStorage.removeItem(key);
    }
  }

  window.sessionStorage.clear();

  if ("caches" in window) {
    try {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    } catch {
      // noop
    }
  }

  const indexedDbFactory = window.indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  if (typeof indexedDbFactory.databases === "function") {
    try {
      const databases = await indexedDbFactory.databases();
      await Promise.all(
        databases
          .map((db) => db.name)
          .filter((name): name is string => Boolean(name))
          .map((name) => clearIndexedDbDatabase(name))
      );
    } catch {
      // noop
    }
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const warmedUserKeyRef = useRef<string | null>(null);

  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const isLogin = pathname === "/login";
  const isOpenShift = pathname === "/sales/open-shift";
  const isCashier = pathname === "/sales/cashier";
  const isLogisticsCashier = pathname === "/logistics/cashier";

  useEffect(() => {
    if (SERVICE_MODE !== "api") return;
    if (loading) return;
    if (!user && !isLogin) router.replace("/login");
    if (user && isLogin) {
      if (user.role === "SALES" || user.role === "MANAGER") router.replace("/sales/open-shift");
      else router.replace("/");
    }
  }, [loading, user, isLogin, router]);

  useEffect(() => {
    let cancelled = false;

    if (!isTauriDesktop()) {
      return;
    }

    async function ensureFreshDesktopBundle() {
      try {
        const version = await getDesktopVersion();
        if (!version || cancelled) return;

        const previousVersion = window.localStorage.getItem(DESKTOP_VERSION_KEY);
        const purgedForVersion = window.localStorage.getItem(DESKTOP_VERSION_PURGED_KEY);
        const reloadedForVersion = window.sessionStorage.getItem(DESKTOP_VERSION_RELOAD_KEY);

        if (reloadedForVersion && reloadedForVersion !== version) {
          window.sessionStorage.removeItem(DESKTOP_VERSION_RELOAD_KEY);
        }

        if (previousVersion && previousVersion !== version && purgedForVersion !== version) {
          await clearDesktopRuntimeData();
          if (cancelled) return;
          window.localStorage.setItem(DESKTOP_VERSION_PURGED_KEY, version);
          window.localStorage.setItem(DESKTOP_VERSION_KEY, version);
          window.sessionStorage.setItem(DESKTOP_VERSION_RELOAD_KEY, version);
          window.location.reload();
          return;
        }

        window.localStorage.setItem(DESKTOP_VERSION_KEY, version);

        if (previousVersion && previousVersion !== version && reloadedForVersion !== version) {
          window.sessionStorage.setItem(DESKTOP_VERSION_RELOAD_KEY, version);
          window.location.reload();
        }
      } catch {
        // Desktop version check is a resilience improvement; ignore failures.
      }
    }

    void ensureFreshDesktopBundle();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const shouldUseFullscreen = Boolean(user) && !isLogin;
    void setDesktopFullscreen(shouldUseFullscreen);
  }, [loading, user, isLogin]);

  useEffect(() => {
    if (!user || isLogin || loading) return;

    const userKey = `${user.id}:${user.role}`;
    if (warmedUserKeyRef.current === userKey) return;
    warmedUserKeyRef.current = userKey;

    const warmup = async () => {
      const baseRoutes =
        user.role === "SALES" || user.role === "MANAGER"
          ? ["/sales/sell", "/sales/cashier", "/sales/stock", "/sales/shift"]
          : user.role === "PRODUCTION"
            ? ["/production/entry", "/production/history", "/warehouse"]
            : ["/", "/products", "/warehouse", "/reports", "/settings/update"];

      await new Promise<void>((resolve) => window.setTimeout(resolve, 200));

      for (const route of baseRoutes) {
        router.prefetch(route);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 20));
      }
    };

    void warmup();
  }, [isLogin, loading, router, user]);

  const showShell = !isLogin && !isOpenShift && !isCashier && !isLogisticsCashier;
  const showLoading = SERVICE_MODE === "api" && loading && !isLogin;
  const showBlock = SERVICE_MODE === "api" && !user && !isLogin;

  return (
    <ToastProvider>
      <div className="relative min-h-screen overflow-hidden bg-cream-100 text-cocoa-900">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-berry-100/30 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-96 w-96 translate-x-1/4 rounded-full bg-cream-200/60 blur-3xl" />
        </div>

        {showLoading || showBlock ? (
          <div className="grid min-h-screen place-items-center px-6">
            <div className="rounded-3xl border border-cream-200/70 bg-white/80 px-6 py-5 text-sm text-cocoa-700 shadow-card">
              {t("Kirish tekshirilmoqda...")}
            </div>
          </div>
        ) : showShell ? (
          <div className="flex min-h-screen flex-col lg:flex-row">
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            <div className="flex min-h-screen flex-1 flex-col">
              <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
              <div className="flex-1 px-3 pb-8 pt-3 sm:px-4 sm:pt-5 lg:px-6 lg:pt-6">
                <div className="mx-auto w-full max-w-7xl motion-safe:animate-fade-up">{children}</div>
              </div>
            </div>
          </div>
        ) : isCashier || isLogisticsCashier ? (
          <div className="h-[100dvh] overflow-hidden p-2 sm:p-3 lg:p-4">{children}</div>
        ) : isOpenShift ? (
          <>{children}</>
        ) : (
          <div className="flex min-h-screen items-center justify-center px-6 py-12">{children}</div>
        )}
      </div>
    </ToastProvider>
  );
}
