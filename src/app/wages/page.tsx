"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Table, T } from "@/components/ui/Table";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { wagesService, type WageReportUser } from "@/services/wages";
import { moneyUZS } from "@/lib/format";
import { buildCSV, downloadCSV, fileStamp } from "@/lib/csv";
import { formatDigitsWithSpaces, onlyDigits } from "@/lib/mask";

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

export default function WagesPage() {
    const { t } = useI18n();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<WageReportUser[]>([]);

    const [from, setFrom] = useState(todayISO());
    const [to, setTo] = useState(todayISO());

    const [payOpen, setPayOpen] = useState(false);
    const [payUser, setPayUser] = useState<{ id: string; name: string } | null>(null);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("CASH");
    const [payNote, setPayNote] = useState("");
    const [payLoading, setPayLoading] = useState(false);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await wagesService.getReport(from, to);
            setReport(res);
        } catch (e: any) {
            toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [from, to]);

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payUser) return;

        setPayLoading(true);
        try {
            await wagesService.createPayment({
                userId: payUser.id,
                amount: Number(payAmount),
                paymentMethod: payMethod,
                note: payNote,
            });
            toast.success(t("To'lov amalga oshirildi"));
            setPayOpen(false);
            setPayAmount("");
            setPayNote("");
            fetchReport(); // Refresh report to update "Paid" and "Balance"
        } catch (e: any) {
            toast.error(t("Xatolik"), e?.message || t("To'lovni saqlab bo'lmadi"));
        } finally {
            setPayLoading(false);
        }
    };

    const openPayment = (user: { id: string; name: string }) => {
        setPayUser(user);
        setPayAmount("");
        setPayNote("");
        setPayOpen(true);
    };

    const exportCSV = () => {
        const headers = ["ID", "Sana", "Xodim", "Mahsulot", "Miqdor", "Birlik", "Narx (Ish haqi)", "Jami"];
        const rows: (string | number)[][] = [];

        report.forEach((userEntry) => {
            userEntry.items.forEach((item) => {
                rows.push([
                    item.id,
                    item.date,
                    userEntry.user.name,
                    item.productName,
                    item.quantity,
                    item.unit,
                    item.rate,
                    item.total,
                ]);
            });
        });

        const csv = buildCSV(headers, rows);
        downloadCSV(`wages-${fileStamp()}.csv`, csv);
    };

    // const grandTotal = report.reduce((sum, item) => sum + item.totalAmount, 0); // Deprecated logic

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1">
                    <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Ish haqi hisoboti")}</h1>
                    <p className="mt-1 text-sm text-cocoa-600">{t("Ishlab chiqarish bo'yicha xodimlar ish haqi va to'lovlar")}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={exportCSV} disabled={report.length === 0}>
                        {t("Export CSV")}
                    </Button>
                    <Button onClick={fetchReport} disabled={loading}>{t("Yangilash")}</Button>
                </div>
            </div>

            <Card>
                <div className="flex flex-wrap gap-4">
                    <Input
                        type="date"
                        label={t("Dan")}
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                    <Input
                        type="date"
                        label={t("Gacha")}
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </div>
            </Card>

            <div className="grid gap-6">
                {report.map((userEntry) => (
                    <Card key={userEntry.user.id} className="motion-safe:animate-fade-up">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                            <div>
                                <h2 className="text-lg font-bold text-cocoa-800">{userEntry.user.name}</h2>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm">
                                <div className="flex flex-col items-end">
                                    <span className="text-cocoa-500">{t("Ishladi")}</span>
                                    <span className="font-bold text-cocoa-900">{moneyUZS(userEntry.earned)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-cocoa-500">{t("Oldi")}</span>
                                    <span className="font-bold text-red-600">-{moneyUZS(userEntry.paid)}</span>
                                </div>
                                <div className="flex flex-col items-end border-l pl-4">
                                    <span className="text-cocoa-500">{t("Qoldiq (Balance)")}</span>
                                    <span className={`font-bold text-lg ${userEntry.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {moneyUZS(userEntry.balance)}
                                    </span>
                                </div>
                                <div>
                                    <Button onClick={() => openPayment(userEntry.user)}>
                                        {t("To'lov qilish")}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Table>
                            <T>
                                <thead>
                                    <tr>
                                        <th>{t("Sana")}</th>
                                        <th>{t("Mahsulot")}</th>
                                        <th className="text-right">{t("Miqdor")}</th>
                                        <th className="text-right">{t("Narx")}</th>
                                        <th className="text-right">{t("Jami")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userEntry.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="text-sm text-cocoa-600">{item.date}</td>
                                            <td className="font-medium text-cocoa-900">{item.productName}</td>
                                            <td className="text-right text-cocoa-900">
                                                {formatDigitsWithSpaces(String(item.quantity))} <span className="text-xs text-cocoa-500">{item.unit}</span>
                                            </td>
                                            <td className="text-right text-cocoa-600">{moneyUZS(item.rate)}</td>
                                            <td className="text-right font-medium text-cocoa-900">{moneyUZS(item.total)}</td>
                                        </tr>
                                    ))}
                                    {userEntry.items.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-sm text-cocoa-500">
                                                {t("Bu davrda ishlab chiqarish yo'q")}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </T>
                        </Table>
                    </Card>
                ))}

                {report.length === 0 && !loading && (
                    <div className="py-12 text-center text-cocoa-500">{t("Ma'lumot yo'q")}</div>
                )}
            </div>

            <Modal
                title={`${t("To'lov qilish")}: ${payUser?.name}`}
                open={payOpen}
                onClose={() => setPayOpen(false)}
            >
                <form onSubmit={handlePay} className="grid gap-4">
                    <Input
                        label={t("Summa")}
                        inputMode="numeric"
                        value={formatDigitsWithSpaces(payAmount)}
                        onChange={(e) => setPayAmount(onlyDigits(e.target.value))}
                        autoFocus
                        required
                    />
                    <Select
                        label={t("To'lov turi")}
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                        options={[
                            { value: "CASH", label: t("Naqd") },
                            { value: "CARD", label: t("Plastik") },
                            { value: "TRANSFER", label: t("O'tkazma") },
                        ]}
                    />
                    <Textarea
                        label={t("Izoh")}
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                        placeholder={t("Ixtiyoriy")}
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setPayOpen(false)}>
                            {t("Bekor qilish")}
                        </Button>
                        <Button type="submit" disabled={payLoading}>
                            {payLoading ? t("Saqlanmoqda...") : t("Saqlash")}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
