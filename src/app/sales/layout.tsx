"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { salesService } from "@/services/sales";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [openingShift, setOpeningShift] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    let active = true;
    const slowTimer = window.setTimeout(() => {
      if (active) setShowSlowHint(true);
    }, 4500);

    if (loading) {
      return () => {
        active = false;
        window.clearTimeout(slowTimer);
      };
    }

    if (!user) {
      router.replace("/login");
      if (active) setCheckedOnce(true);
      return () => {
        active = false;
        window.clearTimeout(slowTimer);
      };
    }

    if (user.role !== "SALES" && user.role !== "MANAGER" && user.role !== "ADMIN") {
      router.replace("/");
      if (active) setCheckedOnce(true);
      return () => {
        active = false;
        window.clearTimeout(slowTimer);
      };
    }

    if (user.role === "ADMIN") {
      setCheckedOnce(true);
      return () => {
        active = false;
        window.clearTimeout(slowTimer);
      };
    }

    (async () => {
      if (active) setOpeningShift(true);
      try {
        const shift = await salesService.getShift().catch(() => null);
        if (!active) return;

        if (shift?.status === "OPEN") {
          setCheckedOnce(true);
          return;
        }

        await salesService.openShift();
        if (active) setCheckedOnce(true);
      } catch {
        if (active) {
          setShowSlowHint(true);
          setCheckedOnce(true);
        }
      } finally {
        if (active) setOpeningShift(false);
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(slowTimer);
    };
  }, [loading, router, user]);

  if (!checkedOnce) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-cream-200 bg-white/90 p-6 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-cocoa-900">Smena ochish</h2>
          <p className="mt-2 text-sm text-cocoa-600">
            {openingShift ? "Smena avtomatik ochilmoqda..." : "Kirish tekshirilmoqda..."}
          </p>
          {showSlowHint ? (
            <p className="mt-2 text-xs text-amber-700">
              Tarmoq sekin ishlayapti. Xohlasangiz smena sahifasiga otib qolda tekshirishingiz mumkin.
            </p>
          ) : null}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.replace("/sales/shift")}
              className="rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-cocoa-700 hover:bg-cream-100"
            >
              Smena sahifasi
            </button>
            <button
              type="button"
              onClick={() => {
                void logout().catch(() => router.replace("/login"));
              }}
              className="rounded-xl bg-berry-700 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-berry-800"
            >
              Chiqish (logout)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
