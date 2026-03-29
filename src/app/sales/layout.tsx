"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { salesService } from "@/services/sales";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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
    if (user.role !== "SALES" && user.role !== "MANAGER" && user.role !== "ADMIN") {
      router.replace("/");
      if (active) setCheckedOnce(true);
      return;
    }

    // Admin uchun shift tekshiruvi shart emas
    if (user.role === "ADMIN") {
      setCheckedOnce(true);
      return;
    }

    // SALES / MANAGER: ochiq smena bor-yo'qligini tekshiramiz
    // Yo'q bo'lsa — avtomatik ochamiz (opening summa oldingi smenadan ko'chadi)
    (async () => {
      try {
        const shift = await salesService.getShift().catch(() => null);
        if (!active) return;

        if (shift?.status === "OPEN") {
          if (active) setCheckedOnce(true);
          return;
        }

        // Smena yo'q — avtomatik ochamiz
        await salesService.openShift();
        if (active) setCheckedOnce(true);
      } catch {
        // Ochib bo'lmasa ham sahifani ko'rsatamiz (sell sahifasi xatolikni o'zi ko'rsatadi)
        if (active) setCheckedOnce(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [loading, router, user]);

  if (!checkedOnce) {
    return null;
  }

  return <>{children}</>;
}
