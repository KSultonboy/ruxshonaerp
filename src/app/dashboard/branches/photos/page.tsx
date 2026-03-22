"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { salesService, type UploadedShiftPhoto } from "@/services/sales";
import { API_ORIGIN } from "@/services/config";

function resolveImage(src: string) {
  if (!src) return src;
  if (src.startsWith("http")) return src;
  return `${API_ORIGIN}${src}`;
}

export default function BranchShiftPhotosPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<UploadedShiftPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [branchId, setBranchId] = useState("");
  const [query, setQuery] = useState("");
  const [deletingKey, setDeletingKey] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await salesService.listUploadedShiftPhotos();
      setRows(list);
    } catch (e: any) {
      setErr(e?.message || t("Noma'lum xatolik"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    void refresh();
  }, [refresh, user?.role]);

  const branches = useMemo(() => {
    const uniq = new Map<string, string>();
    rows.forEach((row) => {
      if (row.branch?.id && row.branch?.name) uniq.set(row.branch.id, row.branch.name);
    });
    return Array.from(uniq.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const byBranch = branchId ? row.branch?.id === branchId : true;
      if (!byBranch) return false;
      if (!q) return true;
      const hay = `${row.branch?.name ?? ""} ${row.openedBy?.username ?? ""} ${row.date}`.toLowerCase();
      return hay.includes(q);
    });
  }, [branchId, query, rows]);

  async function removePhoto(shiftId: string, src: string, idx: number) {
    if (!window.confirm(t("O'chirish?"))) return;

    const key = `${shiftId}:${idx}`;
    setDeletingKey(key);
    try {
      const photos = await salesService.deleteShiftPhoto(shiftId, src);
      setRows((prev) =>
        prev
          .map((row) => (row.id === shiftId ? { ...row, photos } : row))
          .filter((row) => (row.photos?.length ?? 0) > 0)
      );
      toast.success(t("Saqlandi"));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("Noma'lum xatolik");
      toast.error(t("O'chirishda xatolik"), message);
    } finally {
      setDeletingKey("");
    }
  }

  if (user?.role !== "ADMIN") {
    return (
      <Card>
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Filial rasmlari")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Smena rasmlari arxivi")}</p>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label={t("Filial")}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            options={[{ value: "", label: t("Barchasi") }, ...branches]}
          />
          <Input
            label={t("Qidirish")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Filial, user yoki sana")}
          />
        </div>
      </Card>

      {err ? (
        <Card className="border-rose-200/70 bg-rose-50/70">
          <div className="text-sm font-semibold text-rose-700">
            {t("Xatolik:")} {err}
          </div>
        </Card>
      ) : null}

      <Card>
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-cocoa-600">{t("Hozircha yo'q.")}</div>
        ) : (
          <div className="space-y-6">
            {filtered.map((row) => (
              <div key={row.id} className="space-y-3 rounded-2xl border border-cream-200 p-3">
                <div className="text-sm text-cocoa-700">
                  <span className="font-semibold text-cocoa-900">{row.branch?.name ?? "-"}</span>
                  <span className="mx-2">|</span>
                  <span>{row.date}</span>
                  <span className="mx-2">|</span>
                  <span>{row.openedBy?.username ?? "-"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {(row.photos ?? []).map((src, idx) => (
                    <div key={`${row.id}-${idx}`} className="relative overflow-hidden rounded-xl border border-cream-200">
                      <button
                        type="button"
                        onClick={() => void removePhoto(row.id, src, idx)}
                        disabled={deletingKey === `${row.id}:${idx}`}
                        className="absolute right-1 top-1 z-10 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("Delete")}
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveImage(src)} alt="" className="h-32 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
