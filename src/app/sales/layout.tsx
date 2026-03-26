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

    salesService.getShift()
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
        if (!active) return;
        router.replace("/sales/open-shift");
        setCheckedOnce(true);
      });

    return () => {
      active = false;
    };
  }, [loading, router, user]);
  
  if (!checkedOnce) {
    return null;
  }

  return <>{children}</>;
}
