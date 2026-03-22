"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Table, T } from "@/components/ui/Table";
import { ensureSeed } from "@/lib/seed";
import type { Shop } from "@/lib/types";
import { shopsService } from "@/services/shops";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isAdminRole } from "@/lib/roles";

export default function ShopsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const [items, setItems] = useState<Shop[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      ensureSeed();
      const data = await shopsService.list();
      setItems(data);
    } catch (e: any) {
      const message = e?.message || t("Ma'lumotlarni yuklab bo'lmadi");
      setErr(message);
      toast.error(t("Xatolik"), message);
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isAdminRole(user?.role)) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Do'konlar")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Do'konlarni boshqarish")}</p>
      </div>

      {err ? (
        <Card className="border-rose-200/70 bg-rose-50/70">
          <div className="text-sm font-semibold text-rose-700">{err}</div>
        </Card>
      ) : null}

      <Card className="motion-safe:animate-fade-up">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full md:w-64">
            <Input
              label={t("Yangi do'kon")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Masalan: Markaziy do'kon")}
              disabled={loading}
            />
          </div>
          <Button
            disabled={loading}
            onClick={async () => {
              if (!name.trim()) return;
              setLoading(true);
              setErr("");
              try {
                await shopsService.create({ name: name.trim() });
                setName("");
                await refresh();
              } catch (e: any) {
                setErr(e?.message || t("Saqlab bo'lmadi"));
              } finally {
                setLoading(false);
              }
            }}
          >
            {t("+ Qo'shish")}
          </Button>
        </div>

        <div className="mt-4">
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Nomi")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold text-cocoa-900">
                      {editingId === s.id ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xs" />
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        {editingId === s.id ? (
                          <>
                            <Button
                              disabled={loading}
                              onClick={async () => {
                                if (!editName.trim()) return;
                                setLoading(true);
                                setErr("");
                                try {
                                  await shopsService.update(s.id, {
                                    name: editName.trim(),
                                  });
                                  setEditingId(null);
                                  setEditName("");
                                  await refresh();
                                } catch (e: any) {
                                  setErr(e?.message || t("Saqlab bo'lmadi"));
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {t("Saqlash")}
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={loading}
                              onClick={() => {
                                setEditingId(null);
                                setEditName("");
                              }}
                            >
                              {t("Bekor")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              disabled={loading}
                              onClick={() => {
                                setEditingId(s.id);
                                setEditName(s.name);
                              }}
                            >
                              {t("Edit")}
                            </Button>
                            <Button
                              variant="danger"
                              disabled={loading}
                              onClick={async () => {
                                if (!confirm(t("O'chirish?"))) return;
                                setLoading(true);
                                setErr("");
                                try {
                                  await shopsService.remove(s.id);
                                  await refresh();
                                } catch (e: any) {
                                  setErr(e?.message || t("O'chirishda xatolik"));
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {t("Delete")}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-6 text-sm text-cocoa-600">
                      {t("Hozircha yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        </div>
      </Card>
    </div>
  );
}
