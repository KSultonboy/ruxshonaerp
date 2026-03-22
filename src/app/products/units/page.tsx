"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Table, T } from "@/components/ui/Table";
import { ensureSeed } from "@/lib/seed";
import type { Unit } from "@/lib/types";

import { unitsService } from "@/services/units";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function UnitsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [unitName, setUnitName] = useState("");
  const [unitShort, setUnitShort] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShort, setEditShort] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      await Promise.resolve(ensureSeed());
      const list = await unitsService.list();
      setUnits(list);
    } catch (e: any) {
      setErr(e?.message || t("Xatolik yuz berdi"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (user?.role !== "ADMIN") {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Birliklar")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("O'lchov birliklari")}</p>
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
              label={t("Nomi")}
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder={t("Masalan: Kilogram")}
              disabled={loading}
            />
          </div>
          <div className="w-full md:w-40">
            <Input
              label={t("Qisqa")}
              value={unitShort}
              onChange={(e) => setUnitShort(e.target.value)}
              placeholder={t("kg")}
              disabled={loading}
            />
          </div>
          <Button
            disabled={loading}
            onClick={async () => {
              if (!unitName.trim() || !unitShort.trim()) return;
              setLoading(true);
              setErr("");
              try {
                await unitsService.create(unitName.trim(), unitShort.trim());
                setUnitName("");
                setUnitShort("");
                await refresh();
              } catch (e: any) {
                setErr(e?.message || t("O'lchov birligini qo'shishda xatolik"));
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
                  <th>{t("Qisqa")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold text-cocoa-900">
                      {editingId === u.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="max-w-xs"
                        />
                      ) : (
                        u.name
                      )}
                    </td>
                    <td>
                      {editingId === u.id ? (
                        <Input
                          value={editShort}
                          onChange={(e) => setEditShort(e.target.value)}
                          className="max-w-[8rem]"
                        />
                      ) : (
                        u.short
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        {editingId === u.id ? (
                          <>
                            <Button
                              disabled={loading}
                              onClick={async () => {
                                if (!editName.trim() || !editShort.trim()) return;
                                setLoading(true);
                                setErr("");
                                try {
                                  await unitsService.update(u.id, {
                                    name: editName.trim(),
                                    short: editShort.trim(),
                                  });
                                  setEditingId(null);
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
                                setEditShort("");
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
                                setEditingId(u.id);
                                setEditName(u.name);
                                setEditShort(u.short);
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
                                  await unitsService.remove(u.id);
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

                {units.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-sm text-cocoa-600">
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
