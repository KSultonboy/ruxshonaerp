"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import { ensureSeed } from "@/lib/seed";
import type { Shop, ShopDebt } from "@/lib/types";
import { shopsService } from "@/services/shops";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isAdminRole } from "@/lib/roles";
import { moneyUZS } from "@/lib/format";

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  shop,
  onClose,
  onSaved,
  t,
  toast,
}: {
  shop: Shop;
  onClose: () => void;
  onSaved: () => void;
  t: (k: string) => string;
  toast: ReturnType<typeof import("@/components/ui/toast/ToastProvider").useToast>;
}) {
  const [editName, setEditName] = useState(shop.name);
  const [editDebt, setEditDebt] = useState(String(shop.initialDebt ?? 0));
  const [debtInfo, setDebtInfo] = useState<ShopDebt | null>(null);
  const [loadingDebt, setLoadingDebt] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingDebt(true);
    shopsService
      .getDebt(shop.id)
      .then(setDebtInfo)
      .catch(() => setDebtInfo(null))
      .finally(() => setLoadingDebt(false));
  }, [shop.id]);

  async function handleSave() {
    if (!editName.trim()) return;
    const parsedDebt = parseFloat(editDebt);
    if (isNaN(parsedDebt) || parsedDebt < 0) {
      toast.error(t("Xatolik"), t("Qarz miqdori noto'g'ri"));
      return;
    }
    setSaving(true);
    try {
      await shopsService.update(shop.id, { name: editName.trim(), initialDebt: parsedDebt });
      toast.success(t("Saqlandi"), shop.name);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        label={t("Do'kon nomi")}
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
      />

      {/* Hozirgi qarz breakdown */}
      <div className="rounded-xl border border-cream-200 bg-cream-50 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-500">
          {t("Hozirgi qarz holati (dastur bo'yicha)")}
        </p>
        {loadingDebt ? (
          <p className="text-sm text-cocoa-500">{t("Yuklanmoqda...")}</p>
        ) : debtInfo ? (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-cocoa-600">{t("Transferlar (jami)")}</span>
              <span className="font-medium text-cocoa-800">{moneyUZS(debtInfo.transfersTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cocoa-600">{t("Qaytarishlar")}</span>
              <span className="font-medium text-cocoa-800">− {moneyUZS(debtInfo.returnsTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cocoa-600">{t("To'lovlar")}</span>
              <span className="font-medium text-cocoa-800">− {moneyUZS(debtInfo.paymentsTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-cream-200 pt-1.5">
              <span className="font-medium text-cocoa-700">{t("Dastur hisoblagan qarz")}</span>
              <span className={`font-semibold ${debtInfo.calculatedDebt > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {moneyUZS(debtInfo.calculatedDebt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-cocoa-600">{t("Boshlang'ich qarz (qo'shilgan)")}</span>
              <span className="font-medium text-berry-700">{moneyUZS(debtInfo.initialDebt)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-rose-50 px-2 py-1.5 mt-1">
              <span className="font-semibold text-cocoa-800">{t("Jami qarz")}</span>
              <span className={`font-bold text-base ${debtInfo.totalDebt > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {moneyUZS(debtInfo.totalDebt)}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-sm font-medium text-amber-700">{t("Qarz ma'lumoti hali mavjud emas")}</p>
            <p className="text-xs text-amber-600 mt-0.5">{t("Server yangilanishi kerak: prisma migrate deploy → pm2 restart")}</p>
          </div>
        )}
      </div>

      <Input
        label={t("Boshqa platformalardan qarz (qo'shimcha)")}
        type="number"
        min="0"
        step="any"
        value={editDebt}
        onChange={(e) => setEditDebt(e.target.value)}
        hint={t("Bu raqam dastur qarziga qo'shib hisoblanadi")}
      />

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving || !editName.trim()} className="flex-1">
          {saving ? t("Saqlanmoqda...") : t("Saqlash")}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t("Bekor")}
        </Button>
      </div>
    </div>
  );
}

// ─── Asosiy sahifa ─────────────────────────────────────────────────────────────

export default function ShopsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const [items, setItems] = useState<Shop[]>([]);
  const [debts, setDebts] = useState<Map<string, ShopDebt>>(new Map());
  const [name, setName] = useState("");
  const [initialDebt, setInitialDebt] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      ensureSeed();
      const [data, allDebts] = await Promise.all([
        shopsService.list(),
        shopsService.getAllDebts().catch(() => [] as ShopDebt[]),
      ]);
      setItems(data);
      setDebts(new Map(allDebts.map((d) => [d.shopId, d])));
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

  async function handleCreate() {
    if (!name.trim()) return;
    const parsedDebt = initialDebt.trim() ? parseFloat(initialDebt) : 0;
    if (isNaN(parsedDebt) || parsedDebt < 0) {
      toast.error(t("Xatolik"), t("Qarz miqdori noto'g'ri"));
      return;
    }
    setLoading(true);
    setErr("");
    try {
      await shopsService.create({ name: name.trim(), initialDebt: parsedDebt || undefined });
      setName("");
      setInitialDebt("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || t("Saqlab bo'lmadi"));
    } finally {
      setLoading(false);
    }
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
        <p className="mb-3 text-sm font-semibold text-cocoa-800">{t("Yangi do'kon qo'shish")}</p>

        {/* Inputlar bir qatorda */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Input
              label={t("Do'kon nomi")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Masalan: Markaziy do'kon")}
              disabled={loading}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Input
              label={t("Boshlang'ich qarz (ixtiyoriy)")}
              type="number"
              min="0"
              step="any"
              value={initialDebt}
              onChange={(e) => setInitialDebt(e.target.value)}
              placeholder="0"
              disabled={loading}
              hint={t("Boshqa platformadan")}
            />
          </div>
          <Button disabled={loading || !name.trim()} onClick={handleCreate}>
            {t("+ Qo'shish")}
          </Button>
        </div>

        <div className="mt-6">
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Nomi")}</th>
                  <th>{t("Dastur qarzi")}</th>
                  <th>{t("Qo'shimcha qarz")}</th>
                  <th>{t("Jami qarz")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const d = debts.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="font-semibold text-cocoa-900">{s.name}</td>
                      <td className="text-sm">
                        {d ? (
                          <span className={d.calculatedDebt > 0 ? "font-medium text-rose-600" : "text-cocoa-400"}>
                            {d.calculatedDebt > 0 ? moneyUZS(d.calculatedDebt) : "—"}
                          </span>
                        ) : (
                          <span className="text-cocoa-300 text-xs">{t("...")}</span>
                        )}
                      </td>
                      <td className="text-sm">
                        {d && d.initialDebt > 0 ? (
                          <span className="font-medium text-berry-700">{moneyUZS(d.initialDebt)}</span>
                        ) : (
                          <span className="text-cocoa-400">—</span>
                        )}
                      </td>
                      <td className="text-sm">
                        {d ? (
                          <span className={`font-semibold ${d.totalDebt > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {moneyUZS(d.totalDebt)}
                          </span>
                        ) : (
                          <span className="text-cocoa-300 text-xs">{t("...")}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex gap-2">
                          <Button variant="ghost" disabled={loading} onClick={() => setEditingShop(s)}>
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
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-sm text-cocoa-600">
                      {t("Hozircha yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        </div>
      </Card>

      {editingShop && (
        <Modal
          title={`${t("Do'konni tahrirlash")}: ${editingShop.name}`}
          open={!!editingShop}
          onClose={() => setEditingShop(null)}
        >
          <EditModal
            shop={editingShop}
            onClose={() => setEditingShop(null)}
            onSaved={refresh}
            t={t}
            toast={toast}
          />
        </Modal>
      )}
    </div>
  );
}
