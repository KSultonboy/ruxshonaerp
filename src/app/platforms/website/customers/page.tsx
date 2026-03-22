"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function WebsiteCustomersPage() {
    const { t } = useI18n();
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">{t("Website Mijozlari")}</h1>
            <p className="text-cocoa-600">{t("Ro'yxatdan o'tgan mijozlar ro'yxati va ularning ma'lumotlari.")}</p>

            <div className="mt-8 overflow-hidden rounded-2xl border border-cream-200 bg-white">
                <table className="w-full text-left">
                    <thead className="bg-cream-50 text-xs font-semibold uppercase text-cocoa-500">
                        <tr>
                            <th className="px-6 py-4">{t("Ism")}</th>
                            <th className="px-6 py-4">{t("Telefon")}</th>
                            <th className="px-6 py-4">{t("Sana")}</th>
                            <th className="px-6 py-4 text-right">{t("Amallar")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-100 italic text-cocoa-400">
                        <tr>
                            <td colSpan={4} className="px-6 py-10 text-center">
                                {t("Mijozlar mavjud emas")}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
