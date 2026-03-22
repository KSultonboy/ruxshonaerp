"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Table, T } from "@/components/ui/Table";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { alertsService } from "@/services/alerts";
import { branchesService } from "@/services/branches";
import { productsService } from "@/services/products";
import type { Alert, AlertRule, AlertRuleType, Branch, Product } from "@/lib/types";

export default function AlertsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    type: "BRANCH_DEBT_LIMIT" as AlertRuleType,
    threshold: "",
    branchId: "",
    productId: "",
    note: "",
  });

  const ruleTypes = useMemo(
    () => [
      { value: "BRANCH_DEBT_LIMIT", label: t("Filial qarz limiti") },
      { value: "BRANCH_STOCK_MIN", label: t("Filial min qoldiq") },
      { value: "PAYMENT_OVERDUE_DAYS", label: t("To'lov kechikishi") },
    ],
    [t]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleList, alertList, branchList, productList] = await Promise.all([
        alertsService.listRules(),
        alertsService.listAlerts(),
        branchesService.list(),
        productsService.list(),
      ]);
      setRules(ruleList);
      setAlerts(alertList);
      setBranches(branchList);
      setProducts(productList);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

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
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Ogohlantirishlar")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Limitlar va nazorat")}</p>
      </div>

      <Card>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const threshold = Number(form.threshold);
            if (!threshold || threshold <= 0) {
              toast.error(t("Xatolik"), t("Summa 0 dan katta raqam bo'lsin"));
              return;
            }
            try {
              await alertsService.createRule({
                type: form.type,
                threshold,
                branchId: form.branchId || undefined,
                productId: form.type === "BRANCH_STOCK_MIN" ? form.productId || undefined : undefined,
                note: form.note || undefined,
              });
              toast.success(t("Saqlandi"));
              setForm({ type: "BRANCH_DEBT_LIMIT", threshold: "", branchId: "", productId: "", note: "" });
              await refresh();
            } catch (e: any) {
              toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
            }
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <Select
            label={t("Alert turi")}
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as AlertRuleType }))}
            options={ruleTypes}
          />
          <Input
            label={t("Threshold")}
            inputMode="numeric"
            value={form.threshold}
            onChange={(e) => setForm((prev) => ({ ...prev, threshold: e.target.value }))}
          />
          <Select
            label={t("Filiallar")}
            value={form.branchId}
            onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))}
            options={[{ value: "", label: t("Barchasi") }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
          />
          {form.type === "BRANCH_STOCK_MIN" ? (
            <Select
              label={t("Mahsulot")}
              value={form.productId}
              onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
              options={[{ value: "", label: t("Barchasi") }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
            />
          ) : null}
          <div className="md:col-span-2">
            <Textarea
              label={t("Izoh")}
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder={t("Ixtiyoriy...")}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">{t("Saqlash")}</Button>
          </div>
        </form>
      </Card>

      <Card>
        {loading ? (
          <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Alert turi")}</th>
                  <th>{t("Threshold")}</th>
                  <th>{t("Filiallar")}</th>
                  <th>{t("Mahsulot")}</th>
                  <th>{t("Status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="font-semibold text-cocoa-900">{rule.type}</td>
                    <td>{rule.threshold}</td>
                    <td>{rule.branch?.name ?? "-"}</td>
                    <td>{rule.product?.name ?? "-"}</td>
                    <td>{rule.active ? t("Active") : t("Blocked")}</td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await alertsService.updateRule(rule.id, { active: !rule.active });
                              await refresh();
                            } catch (e: any) {
                              toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
                            }
                          }}
                        >
                          {rule.active ? t("Block") : t("Activate")}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={async () => {
                            try {
                              await alertsService.removeRule(rule.id);
                              await refresh();
                            } catch (e: any) {
                              toast.error(t("Xatolik"), e?.message || t("O'chirib bo'lmadi"));
                            }
                          }}
                        >
                          {t("Delete")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-sm text-cocoa-600">
                      {t("Hozircha yo'q.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        )}
      </Card>

      <Card>
        <div className="text-sm font-semibold text-cocoa-900">{t("Ogohlantirishlar")}</div>
        <div className="mt-3 grid gap-3">
          {alerts.map((alert, idx) => (
            <div key={`${alert.ruleId}-${idx}`} className="rounded-2xl border border-cream-200/70 bg-white/80 p-3">
              <div className="text-sm font-semibold text-cocoa-900">{alert.message}</div>
              <div className="mt-1 text-xs text-cocoa-600">
                {alert.branch?.name ? `${t("Filiallar")}: ${alert.branch.name}` : null}
                {alert.product?.name ? ` • ${t("Mahsulot")}: ${alert.product.name}` : null}
              </div>
              <div className="mt-1 text-xs text-cocoa-500">
                {t("Threshold")}: {alert.threshold ?? "-"} • {t("Summa")}: {alert.value ?? "-"}
              </div>
            </div>
          ))}
          {alerts.length === 0 && <div className="text-sm text-cocoa-600">{t("Hozircha yo'q.")}</div>}
        </div>
      </Card>
    </div>
  );
}
