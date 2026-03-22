"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { salesService } from "@/services/sales";
import { API_ORIGIN } from "@/services/config";
import type { Shift } from "@/lib/types";

const uploadInputId = "shift-photos-input";
const MAX_PHOTOS = 6;

function resolveImage(src: string) {
  if (!src) return src;
  if (src.startsWith("http")) return src;
  return `${API_ORIGIN}${src}`;
}

export default function SalesPhotosPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    salesService
      .getShift()
      .then((res) => setShift(res))
      .catch(() => setShift(null))
      .finally(() => setLoading(false));
  }, []);

  const remaining = useMemo(() => {
    const current = shift?.photos?.length ?? 0;
    return Math.max(0, MAX_PHOTOS - current);
  }, [shift?.photos?.length]);

  async function upload() {
    if (!files.length) return;
    setUploading(true);
    try {
      const selected = files.slice(0, remaining);
      const photos = await salesService.uploadShiftPhotos(selected);
      setShift((prev) => (prev ? { ...prev, photos } : prev));
      setFiles([]);
      toast.success(t("Saqlandi"));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Do'kon rasmlari")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Smena")}</p>
      </div>

      <Card className="space-y-4">
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : (
          <>
            <div className="text-sm text-cocoa-600">{t("Rasmlar (max 6 ta)")}</div>
            {shift?.photos?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {shift.photos.map((src, idx) => (
                  <div key={`${src}-${idx}`} className="overflow-hidden rounded-2xl border border-cream-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveImage(src)} alt="" className="h-32 w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-cocoa-600">{t("Hozircha rasm yo'q.")}</div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor={uploadInputId}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-cream-200 bg-cream-50 px-4 py-2 text-sm font-semibold text-cocoa-800"
              >
                {t("Rasm yuklash")}
              </label>
              <input
                id={uploadInputId}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  const capped = selected.slice(0, remaining);
                  setFiles(capped);
                }}
                disabled={remaining === 0}
              />
              <Button onClick={upload} disabled={uploading || remaining === 0 || files.length === 0}>
                {uploading ? t("Saqlanmoqda...") : t("Saqlash")}
              </Button>
              {remaining === 0 ? <span className="text-xs text-cocoa-600">{t("Rasmlar (max 6 ta)")}</span> : null}
            </div>

            <div className="text-xs text-cocoa-600">{t("Smena yopish uchun rasm yuklang")}</div>
          </>
        )}
      </Card>
    </div>
  );
}
