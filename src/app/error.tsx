"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-10">
      <Card className="w-full max-w-xl border-rose-200/70 bg-white/90">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-600">Ruxshona ERP</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-cocoa-900">Bo'limni ochishda xatolik chiqdi</h1>
            <p className="mt-2 text-sm text-cocoa-600">
              Sahifa ishlashida kutilmagan muammo bo'ldi. Qayta urinib ko'ring. Agar qayta chiqsa, aynan qaysi bo'limda
              chiqqanini yozib yuboring, biz uni aniq joyidan ushlaymiz.
            </p>
          </div>

          {error?.message ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error.message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={reset}>Qayta urinish</Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Ilovani yangilash
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
