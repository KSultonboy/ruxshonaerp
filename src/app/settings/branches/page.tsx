"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import { ensureSeed } from "@/lib/seed";
import type { Branch } from "@/lib/types";
import { branchesService } from "@/services/branches";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isAdminRole } from "@/lib/roles";
import type { BranchWarehouseMode } from "@/lib/types";

export default function BranchesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const [items, setItems] = useState<Branch[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [warehouseMode, setWarehouseMode] = useState<BranchWarehouseMode>("SEPARATE");
  const [editWarehouseMode, setEditWarehouseMode] = useState<BranchWarehouseMode>("SEPARATE");

  const warehouseModeOptions = [
    { value: "CENTRAL", label: t("Markaziy ombor") },
    { value: "SEPARATE", label: t("Alohida ombor") },
  ];

  function formatWarehouseMode(mode?: BranchWarehouseMode) {
    return mode === "CENTRAL" ? t("Markaziy ombor") : t("Alohida ombor");
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      ensureSeed();
      const data = await branchesService.list();
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
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Filiallar")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Filiallarni boshqarish")}</p>
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
              label={t("Yangi filial")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Masalan: Chilonzor")}
              disabled={loading}
            />
          </div>
          <div className="w-full md:w-56">
            <Select
              label={t("Ombor turi")}
              value={warehouseMode}
              onChange={(e) => setWarehouseMode(e.target.value as BranchWarehouseMode)}
              options={warehouseModeOptions}
            />
          </div>
          <Button
            disabled={loading}
            onClick={async () => {
              if (!name.trim()) return;
              setLoading(true);
              setErr("");
              try {
                await branchesService.create({
                  name: name.trim(),
                  warehouseMode,
                });
                setName("");
                setWarehouseMode("SEPARATE");
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
                  <th>{t("Ombor turi")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td className="font-semibold text-cocoa-900">
                      {editingId === b.id ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xs" />
                      ) : (
                        b.name
                      )}
                    </td>
                    <td className="text-cocoa-700">
                      {editingId === b.id ? (
                        <Select
                          value={editWarehouseMode}
                          onChange={(e) => setEditWarehouseMode(e.target.value as BranchWarehouseMode)}
                          options={warehouseModeOptions}
                        />
                      ) : (
                        formatWarehouseMode(b.warehouseMode)
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        {editingId === b.id ? (
                          <>
                            <Button
                              disabled={loading}
                              onClick={async () => {
                                if (!editName.trim()) return;
                                setLoading(true);
                                setErr("");
                                try {
                                  await branchesService.update(b.id, {
                                    name: editName.trim(),
                                    warehouseMode: editWarehouseMode,
                                  });
                                  setEditingId(null);
                                  setEditName("");
                                  setEditWarehouseMode("SEPARATE");
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
                                setEditWarehouseMode("SEPARATE");
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
                                setEditingId(b.id);
                                setEditName(b.name);
                                setEditWarehouseMode(b.warehouseMode ?? "SEPARATE");
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
                                  await branchesService.remove(b.id);
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
