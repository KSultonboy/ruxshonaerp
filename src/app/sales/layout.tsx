"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { salesService } from "@/services/sales";
import { useI18n } from "@/components/i18n/I18nProvider";

function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("SHIFT_TIMEOUT")), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [checkedOnce, setCheckedOnce] = useState(false);

  useEffect(() => {
    let active = true;

    if (loading) return;
    if (!user) {
      router.replace("/login");
      if (active) setCheckedOnce(true);
      return;
    }
    if (user.role !== "SALES" && user.role !== "MANAGER") {
      router.replace("/");
      if (active) setCheckedOnce(true);
      return;
    }

    // open-shift page handles its own auth — skip shift check there
    if (window.location.pathname === "/sales/open-shift") {
      setCheckedOnce(true);
      return;
    }

    withTimeout(salesService.getShift())
      .then((shift) => {
        if (!active) return;
        if (!shift || shift.status !== "OPEN") {
          router.replace("/sales/open-shift");
          if (active) setCheckedOnce(true);
          return;
        }
        if (active) setCheckedOnce(true);
      })
      .catch(() => {
        if (active) setCheckedOnce(true);
      });

    return () => {
      active = false;
    };
  }, [loading, logout, router, user]);
  
  if (!checkedOnce && loading) {
    return null;
  }

  return <>{children}</>;
}
