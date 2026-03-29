"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { login } = useAuth();
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const authUser = await login(username.trim(), password);

      if (authUser.role === "SALES" || authUser.role === "MANAGER") {
        router.replace("/sales/sell");
      } else if (authUser.role === "PRODUCTION") {
        router.replace("/production/entry");
      } else {
        router.replace("/");
      }
    } catch (err: any) {
      toast.error(t("Kirishda xatolik"), err?.message || t("Login yoki parol noto'g'ri"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card className="rounded-3xl p-6">
        <div className="text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-berry-600">Ruxshona ERP</div>
          <h1 className="mt-2 font-display text-3xl font-semibold text-cocoa-900">{t("Kirish")}</h1>
          <p className="mt-2 text-sm text-cocoa-600">{t("Username va parol orqali tizimga kiring.")}</p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <Input label={t("Username")} value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input
            label={t("Parol")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            {loading ? t("Kirilmoqda...") : t("Kirish")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
