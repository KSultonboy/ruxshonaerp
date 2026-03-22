"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import { useI18n } from "@/components/i18n/I18nProvider";
import { platformsService } from "@/services/platforms";
import type { PlatformConfig, PlatformKey } from "@/lib/types";

type Field = {
  key: keyof PlatformConfig;
  label: string;
  placeholder?: string;
  type?: string;
};

type Props = {
  platformKey: PlatformKey;
  title: string;
  subtitle: string;
  fields: Field[];
  requiredKeys: (keyof PlatformConfig)[];
};

export default function PlatformSettingsPage({ platformKey, title, subtitle, fields, requiredKeys }: Props) {
  const { t } = useI18n();
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await platformsService.get(platformKey);
    setConfig(data);
  }, [platformKey]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = useMemo(() => {
    if (!config) return t("Ulanmagan");
    return config.status === "CONNECTED" ? t("Ulangan") : t("Ulanmagan");
  }, [config, t]);

  const statusTone = config?.status === "CONNECTED" ? "primary" : "neutral";

  async function save() {
    if (!config) return;
    setSaving(true);
    const filled = requiredKeys.every((key) => {
      const value = config[key];
      return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
    });
    const next = await platformsService.save({
      ...config,
      status: filled ? "CONNECTED" : "DISCONNECTED",
    });
    setConfig(next);
    setSaving(false);
  }

  if (!config) {
    return (
      <Card>
        <div className="text-sm text-cocoa-600">{t("Yuklanmoqda...")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t(title)}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t(subtitle)}</p>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <Input
              key={String(field.key)}
              label={t(field.label)}
              type={field.type ?? "text"}
              value={(config[field.key] as string) ?? ""}
              onChange={(e) => setConfig((prev) => (prev ? { ...prev, [field.key]: e.target.value } : prev))}
              placeholder={field.placeholder ? t(field.placeholder) : undefined}
            />
          ))}
          <div className="md:col-span-2">
            <Textarea
              label={t("Izoh")}
              value={config.note ?? ""}
              onChange={(e) => setConfig((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
              placeholder={t("Masalan: ulanish bo'yicha eslatma")}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? t("Saqlanmoqda...") : t("Saqlash")}
            </Button>
          </div>
        </div>
      </Card>

      {config.updatedAt ? (
        <Card className="text-sm text-cocoa-600">
          {t("Oxirgi yangilanish:")} {new Date(config.updatedAt).toLocaleString()}
        </Card>
      ) : null}
    </div>
  );
}
