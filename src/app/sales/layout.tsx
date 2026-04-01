"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "SALES" && user.role !== "MANAGER" && user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-cocoa-500">Yuklanmoqda...</div>
    );
  }

  return <>{children}</>;
}
