"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isAdminRole } from "@/lib/roles";

const settingsLinks = [
  {
    href: "/settings/branches",
    title: "Filiallar",
    description: "Filiallar ro'yxati va kontaktlari",
  },
  {
    href: "/settings/shops",
    title: "Do'konlar",
    description: "Do'konlar ro'yxati va manzillari",
  },
  {
    href: "/settings/users",
    title: "Ishchilar",
    description: "Rol va filialga biriktirish",
  },
  {
    href: "/products/categories",
    title: "Kategoriyalar",
    description: "Mahsulot kategoriyalarini boshqarish",
  },
  {
    href: "/products/units",
    title: "Birliklar",
    description: "O'lchov birliklarini boshqarish",
  },
  {
    href: "/settings/permissions",
    title: "Ruxsatlar",
    description: "Rol va filial bo'yicha ruxsatlar",
  },
  {
    href: "/settings/alerts",
    title: "Ogohlantirishlar",
    description: "Limitlar va nazorat",
  },
  {
    href: "/settings/receipt",
    title: "Chek/Barcode shabloni",
    description: "Chek va barcode label shakli hamda o'lchamlarini sozlash",
  },
  {
    href: "/settings/audit",
    title: "Audit log",
    description: "So'nggi harakatlar",
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();

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
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Sozlamalar")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Tizim bo'limlarini sozlash va boshqarish")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsLinks.map((item) => (
          <Card key={item.href} className="flex flex-col gap-3">
            <div className="text-lg font-semibold text-cocoa-900">{t(item.title)}</div>
            <div className="text-sm text-cocoa-600">{t(item.description)}</div>
            <Button asChild variant="ghost" className="w-fit">
              <Link href={item.href}>{t("Ochish")}</Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
