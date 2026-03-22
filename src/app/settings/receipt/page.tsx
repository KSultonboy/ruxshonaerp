"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { isAdminRole } from "@/lib/roles";
import type { ReceiptTemplateSettings } from "@/lib/types";
import {
  DEFAULT_RECEIPT_TEMPLATE,
  getReceiptTemplateSettings,
  resetReceiptTemplateSettings,
  saveReceiptTemplateSettings,
} from "@/services/receipt-template";

type LabelToggleField = {
  key: keyof Pick<ReceiptTemplateSettings, "showLabelProductName" | "showLabelBarcodeText" | "showLabelProductionDate">;
  label: string;
};

type NumberField =
  | "labelWidthMm"
  | "labelHeightMm"
  | "labelPaddingMm"
  | "labelBarcodeWidthMm"
  | "labelBarcodeHeightMm"
  | "labelNameFontPx"
  | "labelMetaFontPx";

const labelToggleFields: LabelToggleField[] = [
  { key: "showLabelProductName", label: "Labelda mahsulot nomi ko'rinsin" },
  { key: "showLabelBarcodeText", label: "Labelda barcode raqami ko'rinsin" },
  { key: "showLabelProductionDate", label: "Labelda ishlab chiqarilgan sana ko'rinsin" },
];

function formatLabelProductionDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const yearShort = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${yearShort}`;
}

export default function SettingsReceiptPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [settings, setSettings] = useState<ReceiptTemplateSettings>(DEFAULT_RECEIPT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = await getReceiptTemplateSettings();
        if (!mounted) return;
        setSettings(current);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const labelPreviewBarcodeWidth = Math.max(
    8,
    Math.min(settings.labelBarcodeWidthMm, settings.labelWidthMm - settings.labelPaddingMm * 2)
  );
  const labelPreviewProductionDate = formatLabelProductionDate(new Date());

  function setNumberField(field: NumberField, raw: string) {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      return;
    }
    setSettings((prev) => ({ ...prev, [field]: numeric }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await saveReceiptTemplateSettings({
        labelWidthMm: settings.labelWidthMm,
        labelHeightMm: settings.labelHeightMm,
        labelPaddingMm: settings.labelPaddingMm,
        labelBarcodeWidthMm: settings.labelBarcodeWidthMm,
        labelBarcodeHeightMm: settings.labelBarcodeHeightMm,
        labelNameFontPx: settings.labelNameFontPx,
        labelMetaFontPx: settings.labelMetaFontPx,
        showLabelProductName: settings.showLabelProductName,
        showLabelBarcodeText: settings.showLabelBarcodeText,
        showLabelProductionDate: settings.showLabelProductionDate,
      });
      setSettings(saved);
      toast.success(t("Saqlandi"));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("Saqlab bo'lmadi");
      toast.error(t("Xatolik"), message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Label sozlamalarini default holatga qaytaramizmi?")) {
      return;
    }
    const reset = await resetReceiptTemplateSettings();
    setSettings(reset);
    toast.success(t("Saqlandi"), "Default holatga qaytdi.");
  }

  if (!isAdminRole(user?.role)) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  if (loading) {
    return <div className="p-6">{t("Yuklanmoqda...")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">Barcode Label shabloni</h1>
        <p className="mt-1 text-sm text-cocoa-600">
          Chek dizayni endi kodda fixed holatda. Admin bu bo'limdan faqat barcode label ko'rinishini boshqaradi.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="Label eni (mm)"
              type="number"
              min={20}
              max={80}
              value={String(settings.labelWidthMm)}
              onChange={(event) => setNumberField("labelWidthMm", event.target.value)}
            />
            <Input
              label="Label bo'yi (mm)"
              type="number"
              min={10}
              max={80}
              value={String(settings.labelHeightMm)}
              onChange={(event) => setNumberField("labelHeightMm", event.target.value)}
            />
            <Input
              label="Ichki padding (mm)"
              type="number"
              min={0}
              max={5}
              value={String(settings.labelPaddingMm)}
              onChange={(event) => setNumberField("labelPaddingMm", event.target.value)}
            />
            <Input
              label="Barcode eni (mm)"
              type="number"
              min={10}
              max={75}
              value={String(settings.labelBarcodeWidthMm)}
              onChange={(event) => setNumberField("labelBarcodeWidthMm", event.target.value)}
            />
            <Input
              label="Barcode bo'yi (mm)"
              type="number"
              min={4}
              max={50}
              value={String(settings.labelBarcodeHeightMm)}
              onChange={(event) => setNumberField("labelBarcodeHeightMm", event.target.value)}
            />
            <Input
              label="Nomi shrift (px)"
              type="number"
              min={5}
              max={18}
              value={String(settings.labelNameFontPx)}
              onChange={(event) => setNumberField("labelNameFontPx", event.target.value)}
            />
            <Input
              label="Barcode matn shrift (px)"
              type="number"
              min={5}
              max={18}
              value={String(settings.labelMetaFontPx)}
              onChange={(event) => setNumberField("labelMetaFontPx", event.target.value)}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {labelToggleFields.map((field) => (
              <label
                key={field.key}
                className="flex items-center gap-3 rounded-xl border border-cream-200/70 bg-cream-50/70 px-3 py-2 text-sm text-cocoa-800"
              >
                <input
                  type="checkbox"
                  checked={settings[field.key]}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      [field.key]: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-berry-700"
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? t("Saqlanmoqda...") : t("Saqlash")}
            </Button>
            <Button variant="ghost" onClick={() => void handleReset()} disabled={saving}>
              Defaultga qaytarish
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-3 text-sm font-semibold text-cocoa-700">Ko'rinish (demo)</div>
          <div className="overflow-auto rounded-2xl border border-cream-200/70 bg-cream-100/40 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cocoa-600">Barcode Label</div>
            <div className="rounded-xl border border-dashed border-cocoa-300 bg-white p-3">
              <div
                className="mx-auto overflow-hidden border border-cream-300 bg-white"
                style={{
                  width: `${settings.labelWidthMm}mm`,
                  height: `${settings.labelHeightMm}mm`,
                  padding: `${settings.labelPaddingMm}mm`,
                }}
              >
                {settings.showLabelProductName ? (
                  <div
                    className="truncate text-center font-semibold text-cocoa-900"
                    style={{ fontSize: `${settings.labelNameFontPx}px` }}
                  >
                    Medovik tort
                  </div>
                ) : null}
                <div
                  className="mx-auto mt-1 bg-cocoa-900/90"
                  style={{
                    width: `${labelPreviewBarcodeWidth}mm`,
                    height: `${settings.labelBarcodeHeightMm}mm`,
                    backgroundImage:
                      "repeating-linear-gradient(90deg, rgba(255,255,255,0.98) 0 1px, rgba(0,0,0,1) 1px 2px, rgba(0,0,0,0.95) 2px 3px, rgba(255,255,255,0.98) 3px 4px)",
                  }}
                />
                {settings.showLabelBarcodeText ? (
                  <div
                    className="mt-1 truncate text-center text-cocoa-700"
                    style={{ fontSize: `${settings.labelMetaFontPx}px` }}
                  >
                    20765178331439
                  </div>
                ) : null}
                {settings.showLabelProductionDate ? (
                  <div
                    className="mt-1 truncate text-center text-cocoa-700"
                    style={{ fontSize: `${settings.labelMetaFontPx}px` }}
                  >
                    {labelPreviewProductionDate}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
