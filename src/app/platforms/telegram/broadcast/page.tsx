"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { telegramBroadcastService } from "@/services/telegram-broadcast";
import { productsService } from "@/services/products";
import type {
  Product,
  TelegramBroadcastCampaign,
  TelegramBroadcastTarget,
  TelegramCampaignCategory,
  TelegramCampaignStatus,
  TelegramTargetSegment,
  TelegramTargetType,
} from "@/lib/types";

type TargetFormState = {
  name: string;
  chatId: string;
  type: TelegramTargetType;
  segment: TelegramTargetSegment;
  note: string;
};

type SendMode = "MANUAL" | "SEGMENT";

type CampaignFormState = {
  title: string;
  content: string;
  category: TelegramCampaignCategory;
  buttonText: string;
  buttonUrl: string;
  parseMode: "HTML" | "Markdown" | "MarkdownV2";
  scheduledAt: string;
  targetIds: string[];
  targetSegment: TelegramTargetSegment;
  extraChatIdsRaw: string;
};

const TARGET_TYPE_OPTIONS = [
  { value: "GROUP", label: "Group" },
  { value: "CHANNEL", label: "Channel" },
] as const;

const TARGET_SEGMENT_OPTIONS = [
  { value: "GENERAL", label: "Umumiy" },
  { value: "ADVERTISEMENT", label: "Reklama" },
  { value: "DISCOUNT", label: "Chegirma" },
  { value: "OTHER", label: "Boshqa" },
] as const;

const CAMPAIGN_CATEGORY_OPTIONS = [
  { value: "ANNOUNCEMENT", label: "Yangilik / E'lon" },
  { value: "ADVERTISEMENT", label: "Reklama" },
  { value: "DISCOUNT", label: "Chegirma" },
  { value: "OTHER", label: "Boshqa" },
] as const;

const CAMPAIGN_FILTER_OPTIONS = [
  { value: "ALL", label: "Hammasi" },
  ...CAMPAIGN_CATEGORY_OPTIONS,
] as const;

const PARSE_MODE_OPTIONS = [
  { value: "HTML", label: "HTML" },
  { value: "Markdown", label: "Markdown" },
  { value: "MarkdownV2", label: "MarkdownV2" },
] as const;

const STATUS_COLORS: Record<TelegramCampaignStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  QUEUED: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-sky-100 text-sky-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-orange-100 text-orange-700",
  FAILED: "bg-rose-100 text-rose-700",
  CANCELED: "bg-cocoa-100 text-cocoa-700",
};
function toLocalDateTimeInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const corrected = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return corrected.toISOString().slice(0, 16);
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseChatIds(raw: string) {
  return Array.from(new Set(raw.split(/[\s,;\n]+/).map((item) => item.trim()).filter(Boolean)));
}

function inferCategoryBySegment(segment: TelegramTargetSegment): TelegramCampaignCategory {
  if (segment === "ADVERTISEMENT") return "ADVERTISEMENT";
  if (segment === "DISCOUNT") return "DISCOUNT";
  if (segment === "OTHER") return "OTHER";
  return "ANNOUNCEMENT";
}
export default function TelegramBroadcastPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<TelegramBroadcastTarget[]>([]);
  const [campaigns, setCampaigns] = useState<TelegramBroadcastCampaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [savingTarget, setSavingTarget] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [actioningCampaignId, setActioningCampaignId] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<SendMode>("MANUAL");
  const [targetSearch, setTargetSearch] = useState("");
  const [campaignCategoryFilter, setCampaignCategoryFilter] = useState<
    TelegramCampaignCategory | "ALL"
  >("ALL");

  const [targetForm, setTargetForm] = useState<TargetFormState>({
    name: "",
    chatId: "",
    type: "GROUP",
    segment: "GENERAL",
    note: "",
  });

  const [campaignForm, setCampaignForm] = useState<CampaignFormState>({
    title: "",
    content: "",
    category: "ANNOUNCEMENT",
    buttonText: "",
    buttonUrl: "",
    parseMode: "HTML",
    scheduledAt: "",
    targetIds: [],
    targetSegment: "GENERAL",
    extraChatIdsRaw: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editCampaignId, setEditCampaignId] = useState<string>("");
  const [editForm, setEditForm] = useState<
    Omit<
      CampaignFormState,
      "targetIds" | "targetSegment" | "extraChatIdsRaw" | "category"
    >
  >({
    title: "",
    content: "",
    buttonText: "",
    buttonUrl: "",
    parseMode: "HTML",
    scheduledAt: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [targetList, campaignList, productList] = await Promise.all([
        telegramBroadcastService.listTargets(),
        telegramBroadcastService.listCampaigns(60, campaignCategoryFilter),
        productsService.list(),
      ]);
      setTargets(targetList);
      setCampaigns(campaignList);
      setProducts(productList);
    } catch (error: any) {
      toast.error(
        "Xatolik",
        error?.message || "Telegram broadcast ma'lumotini yuklab bo'lmadi",
      );
    } finally {
      setLoading(false);
    }
  }, [campaignCategoryFilter, toast]);

  useEffect(() => {
    if (!canManage) return;
    void refresh();
  }, [canManage, refresh]);

  const selectedTargets = useMemo(
    () => targets.filter((target) => campaignForm.targetIds.includes(target.id)),
    [campaignForm.targetIds, targets],
  );

  const visibleTargets = useMemo(() => {
    const needle = targetSearch.trim().toLowerCase();
    if (!needle) return targets;
    return targets.filter(
      (target) =>
        target.name.toLowerCase().includes(needle) ||
        target.chatId.toLowerCase().includes(needle) ||
        target.segment.toLowerCase().includes(needle),
    );
  }, [targetSearch, targets]);

  const productOptions = useMemo(
    () => [
      { value: "", label: "Mahsulot tanlang" },
      ...products.map((product) => ({ value: product.id, label: product.name })),
    ],
    [products],
  );
  const appendProductTemplate = () => {
    if (!selectedProductId) {
      toast.error("Xatolik", "Mahsulot tanlang");
      return;
    }
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) {
      toast.error("Xatolik", "Mahsulot topilmadi");
      return;
    }
    const price = Number(product.salePrice ?? product.shopPrice ?? product.price ?? 0);
    const template = [
      `<b>${product.name}</b>`,
      product.barcode ? `Barcode: ${product.barcode}` : null,
      price > 0
        ? `Narx: ${new Intl.NumberFormat("uz-UZ").format(Math.round(price))} so'm`
        : null,
      "Buyurtma uchun yozing.",
    ]
      .filter(Boolean)
      .join("\n");

    setCampaignForm((prev) => ({
      ...prev,
      content: prev.content ? `${prev.content}\n\n${template}` : template,
      parseMode: "HTML",
    }));
  };

  const toggleTarget = (targetId: string) => {
    setCampaignForm((prev) => {
      const exists = prev.targetIds.includes(targetId);
      return {
        ...prev,
        targetIds: exists
          ? prev.targetIds.filter((id) => id !== targetId)
          : [...prev.targetIds, targetId],
      };
    });
  };

  const selectTargetsBySegment = (segment: TelegramTargetSegment) => {
    const ids = targets
      .filter((target) => target.active && target.segment === segment)
      .map((target) => target.id);
    setCampaignForm((prev) => ({ ...prev, targetIds: ids }));
  };

  const submitTarget = async () => {
    if (!targetForm.name.trim() || !targetForm.chatId.trim()) {
      toast.error("Xatolik", "Target nomi va chat ID majburiy");
      return;
    }

    setSavingTarget(true);
    try {
      await telegramBroadcastService.createTarget({
        name: targetForm.name.trim(),
        chatId: targetForm.chatId.trim(),
        type: targetForm.type,
        segment: targetForm.segment,
        note: targetForm.note.trim() || undefined,
      });
      toast.success("Saqlandi", "Telegram target qo'shildi");
      setTargetForm({
        name: "",
        chatId: "",
        type: "GROUP",
        segment: "GENERAL",
        note: "",
      });
      await refresh();
    } catch (error: any) {
      toast.error("Xatolik", error?.message || "Target saqlanmadi");
    } finally {
      setSavingTarget(false);
    }
  };

  const submitCampaign = async (sendNow: boolean) => {
    if (!campaignForm.content.trim()) {
      toast.error("Xatolik", "Xabar matnini kiriting");
      return;
    }
    if (!sendNow && !campaignForm.scheduledAt) {
      toast.error("Xatolik", "Queue uchun aniq vaqt kiriting");
      return;
    }

    const extraChatIds = parseChatIds(campaignForm.extraChatIdsRaw);
    const hasManualTargets = campaignForm.targetIds.length > 0;
    const hasSegmentTargeting = sendMode === "SEGMENT";
    const hasExtraIds = extraChatIds.length > 0;

    if (!hasManualTargets && !hasSegmentTargeting && !hasExtraIds) {
      toast.error("Xatolik", "Kamida bitta target tanlang yoki chat ID kiriting");
      return;
    }

    setSendingCampaign(true);
    try {
      await telegramBroadcastService.createCampaign({
        title: campaignForm.title.trim() || undefined,
        content: campaignForm.content.trim(),
        category: campaignForm.category,
        buttonText: campaignForm.buttonText.trim() || undefined,
        buttonUrl: campaignForm.buttonUrl.trim() || undefined,
        parseMode: campaignForm.parseMode,
        targetIds: hasManualTargets ? campaignForm.targetIds : undefined,
        targetSegment: sendMode === "SEGMENT" ? campaignForm.targetSegment : undefined,
        extraChatIds: hasExtraIds ? extraChatIds : undefined,
        scheduledAt: campaignForm.scheduledAt
          ? new Date(campaignForm.scheduledAt).toISOString()
          : undefined,
        sendNow,
      });
      toast.success(
        "Yuborildi",
        sendNow ? "Xabar yuborish navbatiga olindi" : "Queue vaqtiga saqlandi",
      );
      setCampaignForm({
        title: "",
        content: "",
        category: "ANNOUNCEMENT",
        buttonText: "",
        buttonUrl: "",
        parseMode: "HTML",
        scheduledAt: "",
        targetIds: [],
        targetSegment: "GENERAL",
        extraChatIdsRaw: "",
      });
      setSendMode("MANUAL");
      await refresh();
    } catch (error: any) {
      toast.error("Xatolik", error?.message || "Campaign yaratilmadi");
    } finally {
      setSendingCampaign(false);
    }
  };

  const openEditModal = (campaign: TelegramBroadcastCampaign) => {
    setEditCampaignId(campaign.id);
    setEditForm({
      title: campaign.title ?? "",
      content: campaign.content,
      buttonText: campaign.buttonText ?? "",
      buttonUrl: campaign.buttonUrl ?? "",
      parseMode:
        (campaign.parseMode as "HTML" | "Markdown" | "MarkdownV2") || "HTML",
      scheduledAt: toLocalDateTimeInput(campaign.scheduledAt),
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editCampaignId) return;
    if (!editForm.content.trim()) {
      toast.error("Xatolik", "Xabar matni bo'sh bo'lmasin");
      return;
    }
    setSavingEdit(true);
    try {
      const result = await telegramBroadcastService.editCampaign(editCampaignId, {
        title: editForm.title.trim() || undefined,
        content: editForm.content.trim(),
        buttonText: editForm.buttonText.trim() || undefined,
        buttonUrl: editForm.buttonUrl.trim() || undefined,
        parseMode: editForm.parseMode,
        scheduledAt: editForm.scheduledAt
          ? new Date(editForm.scheduledAt).toISOString()
          : undefined,
      });
      toast.success("Yangilandi", `Edit: ${result.edited} ta, xato: ${result.failed} ta`);
      setEditOpen(false);
      await refresh();
    } catch (error: any) {
      toast.error("Xatolik", error?.message || "Edit bajarilmadi");
    } finally {
      setSavingEdit(false);
    }
  };

  const runCampaignAction = async (
    campaignId: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setActioningCampaignId(campaignId);
    try {
      await action();
      toast.success("OK", successMessage);
      await refresh();
    } catch (error: any) {
      toast.error("Xatolik", error?.message || "Amal bajarilmadi");
    } finally {
      setActioningCampaignId(null);
    }
  };
  if (!canManage) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">
          {t("Bu bo'lim faqat admin yoki manager uchun.")}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">
          Telegram Broadcast
        </h1>
        <p className="mt-1 text-sm text-cocoa-600">
          Accordion ko'rinishida: ID qo'shish, alohida groupga yuborish,
          reklama/chegirma bo'yicha yuborish
        </p>
      </div>

      <Card>
        <details open className="group">
          <summary className="cursor-pointer list-none rounded-xl border border-cream-200/80 bg-cream-50/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cocoa-600">
                  1. ID bilan target qo'shish
                </div>
                <div className="text-xs text-cocoa-600">
                  Chat ID kiriting va uni bo'limga biriktiring
                </div>
              </div>
              <span className="rounded-full bg-cocoa-100 px-2 py-0.5 text-xs text-cocoa-700">
                {targets.length} ta target
              </span>
            </div>
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Input
                label="Nomi"
                value={targetForm.name}
                onChange={(e) =>
                  setTargetForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Masalan: Aksiya guruhi"
              />
              <Input
                label="Chat ID"
                value={targetForm.chatId}
                onChange={(e) =>
                  setTargetForm((prev) => ({ ...prev, chatId: e.target.value }))
                }
                placeholder="-1001234567890"
              />
              <Select
                label="Turi"
                value={targetForm.type}
                onChange={(e) =>
                  setTargetForm((prev) => ({
                    ...prev,
                    type: e.target.value as TelegramTargetType,
                  }))
                }
                options={TARGET_TYPE_OPTIONS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
              <Select
                label="Bo'lim"
                value={targetForm.segment}
                onChange={(e) =>
                  setTargetForm((prev) => ({
                    ...prev,
                    segment: e.target.value as TelegramTargetSegment,
                  }))
                }
                options={TARGET_SEGMENT_OPTIONS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
              <Input
                label="Izoh"
                value={targetForm.note}
                onChange={(e) =>
                  setTargetForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Ixtiyoriy..."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void submitTarget()} disabled={savingTarget}>
                {savingTarget ? "Saqlanmoqda..." : "Target qo'shish"}
              </Button>
              <Input
                className="min-w-[260px]"
                value={targetSearch}
                onChange={(e) => setTargetSearch(e.target.value)}
                placeholder="Target qidirish (nom/chatId/bo'lim)"
              />
            </div>

            <div className="grid gap-2">
              {visibleTargets.length === 0 ? (
                <div className="rounded-xl border border-cream-200/80 bg-cream-50/80 p-3 text-sm text-cocoa-600">
                  Target topilmadi
                </div>
              ) : (
                visibleTargets.map((target) => (
                  <div
                    key={target.id}
                    className="flex flex-col gap-3 rounded-2xl border border-cream-200/80 bg-white/70 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-cocoa-900">
                        {target.name}{" "}
                        <span className="rounded-full bg-cocoa-100 px-2 py-0.5 text-xs uppercase tracking-wide text-cocoa-700">
                          {target.type}
                        </span>{" "}
                        <span className="rounded-full bg-berry-100 px-2 py-0.5 text-xs uppercase tracking-wide text-berry-700">
                          {target.segment}
                        </span>
                        {!target.active ? (
                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                            inactive
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-cocoa-600">{target.chatId}</div>
                      {target.note ? (
                        <div className="text-xs text-cocoa-500">{target.note}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          void runCampaignAction(
                            target.id,
                            () =>
                              telegramBroadcastService.updateTarget(target.id, {
                                active: !target.active,
                              }),
                            target.active
                              ? "Target o'chirildi (inactive)"
                              : "Target qayta aktiv qilindi",
                          )
                        }
                      >
                        {target.active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (!window.confirm("Targetni o'chirishni tasdiqlaysizmi?"))
                            return;
                          void runCampaignAction(
                            target.id,
                            () => telegramBroadcastService.removeTarget(target.id),
                            "Target yangilandi",
                          );
                        }}
                      >
                        O'chirish
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </details>
      </Card>
      <Card>
        <details open className="group">
          <summary className="cursor-pointer list-none rounded-xl border border-cream-200/80 bg-cream-50/70 px-4 py-3">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cocoa-600">
              2. Xabar yuborish (group yoki bo'lim bo'yicha)
            </div>
          </summary>
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={sendMode === "MANUAL" ? "primary" : "ghost"}
                onClick={() => setSendMode("MANUAL")}
              >
                Alohida grouplar
              </Button>
              <Button
                variant={sendMode === "SEGMENT" ? "primary" : "ghost"}
                onClick={() => {
                  setSendMode("SEGMENT");
                  setCampaignForm((prev) => ({
                    ...prev,
                    category: inferCategoryBySegment(prev.targetSegment),
                  }));
                }}
              >
                Reklama / Chegirma / Boshqa bo'yicha
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                label="Sarlavha (ixtiyoriy)"
                value={campaignForm.title}
                onChange={(e) =>
                  setCampaignForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Masalan: Bugungi yangilik"
              />
              <Select
                label="Xabar turi"
                value={campaignForm.category}
                onChange={(e) =>
                  setCampaignForm((prev) => ({
                    ...prev,
                    category: e.target.value as TelegramCampaignCategory,
                  }))
                }
                options={CAMPAIGN_CATEGORY_OPTIONS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
              <Select
                label="Parse mode"
                value={campaignForm.parseMode}
                onChange={(e) =>
                  setCampaignForm((prev) => ({
                    ...prev,
                    parseMode: e.target.value as "HTML" | "Markdown" | "MarkdownV2",
                  }))
                }
                options={PARSE_MODE_OPTIONS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
              <Input
                label="Queue vaqti (aniq vaqt)"
                type="datetime-local"
                value={campaignForm.scheduledAt}
                onChange={(e) =>
                  setCampaignForm((prev) => ({ ...prev, scheduledAt: e.target.value }))
                }
              />

              <Select
                label="Mahsulotdan tez to'ldirish"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                options={productOptions}
              />
              <div className="flex items-end">
                <Button variant="ghost" onClick={appendProductTemplate}>
                  Mahsulot matnini qo'shish
                </Button>
              </div>
              <Input
                label="Button text (ixtiyoriy)"
                value={campaignForm.buttonText}
                onChange={(e) =>
                  setCampaignForm((prev) => ({ ...prev, buttonText: e.target.value }))
                }
                placeholder="Masalan: Buyurtma berish"
              />
              <Input
                label="Button URL (ixtiyoriy)"
                value={campaignForm.buttonUrl}
                onChange={(e) =>
                  setCampaignForm((prev) => ({ ...prev, buttonUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <Textarea
              label="Xabar matni"
              value={campaignForm.content}
              onChange={(e) =>
                setCampaignForm((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="Yuboriladigan xabar matni..."
            />

            <Textarea
              label="Qo'shimcha chat ID lar (ixtiyoriy)"
              value={campaignForm.extraChatIdsRaw}
              onChange={(e) =>
                setCampaignForm((prev) => ({
                  ...prev,
                  extraChatIdsRaw: e.target.value,
                }))
              }
              placeholder="-1001234567890&#10;-1009988776655&#10;@username_kabilar"
            />

            {sendMode === "MANUAL" ? (
              <div className="rounded-2xl border border-cream-200/80 bg-white/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cocoa-600">
                    Alohida grouplar tanlash
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TARGET_SEGMENT_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant="ghost"
                        onClick={() =>
                          selectTargetsBySegment(option.value as TelegramTargetSegment)
                        }
                      >
                        {option.label} ni belgilash
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {targets
                    .filter((target) => target.active)
                    .map((target) => {
                      const checked = campaignForm.targetIds.includes(target.id);
                      return (
                        <label
                          key={target.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                            checked
                              ? "border-berry-300 bg-berry-50 text-berry-900"
                              : "border-cream-200/70 bg-cream-50/70 text-cocoa-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={checked}
                            onChange={() => toggleTarget(target.id)}
                          />
                          <span>
                            <span className="block font-semibold">{target.name}</span>
                            <span className="text-xs text-cocoa-500">
                              {target.chatId} • {target.segment}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  {targets.filter((target) => target.active).length === 0 ? (
                    <div className="text-sm text-cocoa-600">Aktiv target topilmadi</div>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-cocoa-600">
                  Tanlanganlar:{" "}
                  {selectedTargets.length > 0
                    ? selectedTargets
                        .map((target) => `${target.name} (${target.segment})`)
                        .join(", ")
                    : "yo'q"}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-cream-200/80 bg-white/70 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    label="Bo'lim bo'yicha yuborish"
                    value={campaignForm.targetSegment}
                    onChange={(e) =>
                      setCampaignForm((prev) => {
                        const next = e.target.value as TelegramTargetSegment;
                        return {
                          ...prev,
                          targetSegment: next,
                          category: inferCategoryBySegment(next),
                        };
                      })
                    }
                    options={TARGET_SEGMENT_OPTIONS.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                  />
                  <div className="rounded-xl border border-cream-200/70 bg-cream-50/70 p-3 text-sm text-cocoa-700">
                    Ushbu bo'limdagi aktiv targetlar soni:{" "}
                    <span className="font-semibold">
                      {
                        targets.filter(
                          (target) =>
                            target.active &&
                            target.segment === campaignForm.targetSegment,
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void submitCampaign(true)} disabled={sendingCampaign}>
                {sendingCampaign ? "Yuborilmoqda..." : "Hozir yuborish"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void submitCampaign(false)}
                disabled={sendingCampaign}
              >
                Queuega qo'yish
              </Button>
            </div>
          </div>
        </details>
      </Card>
      <Card>
        <details open className="group">
          <summary className="cursor-pointer list-none rounded-xl border border-cream-200/80 bg-cream-50/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cocoa-600">
                3. Campaign tarix va boshqaruv
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={campaignCategoryFilter}
                  onChange={(e) =>
                    setCampaignCategoryFilter(
                      e.target.value as TelegramCampaignCategory | "ALL",
                    )
                  }
                  options={CAMPAIGN_FILTER_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                />
                <Button variant="ghost" onClick={() => void refresh()} disabled={loading}>
                  Yangilash
                </Button>
              </div>
            </div>
          </summary>
          <div className="mt-4">
            {loading ? (
              <div className="text-sm text-cocoa-600">Yuklanmoqda...</div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-xl border border-cream-200/80 bg-cream-50/80 p-3 text-sm text-cocoa-600">
                Campaignlar hali yo'q
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="rounded-2xl border border-cream-200/80 bg-white/75 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-cocoa-900">
                            {campaign.title || campaign.content.slice(0, 60)}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[campaign.status]}`}
                          >
                            {campaign.status}
                          </span>
                          <span className="rounded-full bg-berry-100 px-2 py-0.5 text-xs font-semibold text-berry-700">
                            {campaign.category}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-cocoa-500">
                          Yaratilgan: {formatDateTime(campaign.createdAt)} | Queue:{" "}
                          {formatDateTime(campaign.scheduledAt)}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-cocoa-700">
                          {campaign.content}
                        </div>
                        <div className="mt-2 text-xs text-cocoa-500">
                          Sent: {campaign.stats.sent} | Pending: {campaign.stats.pending} |
                          Failed: {campaign.stats.failed} | Deleted:{" "}
                          {campaign.stats.deleted}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          disabled={actioningCampaignId === campaign.id}
                          onClick={() =>
                            void runCampaignAction(
                              campaign.id,
                              () => telegramBroadcastService.processCampaign(campaign.id),
                              "Campaign qayta processing qilindi",
                            )
                          }
                        >
                          Process
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={actioningCampaignId === campaign.id}
                          onClick={() =>
                            void runCampaignAction(
                              campaign.id,
                              () => telegramBroadcastService.retryCampaign(campaign.id),
                              "Failed deliverylar retry qilindi",
                            )
                          }
                        >
                          Retry failed
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={actioningCampaignId === campaign.id}
                          onClick={() =>
                            void runCampaignAction(
                              campaign.id,
                              () => telegramBroadcastService.queueCampaign(campaign.id),
                              "Campaign queuega qaytarildi",
                            )
                          }
                        >
                          Queue
                        </Button>
                        <Button variant="ghost" onClick={() => openEditModal(campaign)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          disabled={actioningCampaignId === campaign.id}
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Telegramdagi yuborilgan xabarlarni o'chirishni tasdiqlaysizmi?",
                              )
                            )
                              return;
                            void runCampaignAction(
                              campaign.id,
                              () =>
                                telegramBroadcastService.deleteCampaignMessages(campaign.id),
                              "Telegramdagi xabarlar delete qilindi",
                            );
                          }}
                        >
                          Delete post
                        </Button>
                        <Button
                          variant="danger"
                          disabled={actioningCampaignId === campaign.id}
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Campaignni bekor qilishni tasdiqlaysizmi?",
                              )
                            )
                              return;
                            void runCampaignAction(
                              campaign.id,
                              () => telegramBroadcastService.cancelCampaign(campaign.id),
                              "Campaign bekor qilindi",
                            );
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-xl border border-cream-200/80">
                      <table className="min-w-full text-left text-xs sm:text-sm">
                        <thead className="bg-cream-100">
                          <tr>
                            <th className="px-3 py-2">Target</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Sent at</th>
                            <th className="px-3 py-2">Xato</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaign.deliveries.map((delivery) => (
                            <tr key={delivery.id} className="border-t border-cream-200/70">
                              <td className="px-3 py-2">
                                <div className="font-semibold text-cocoa-800">
                                  {delivery.target.name}
                                </div>
                                <div className="text-[11px] text-cocoa-500">
                                  {delivery.target.chatId} • {delivery.target.type}
                                </div>
                              </td>
                              <td className="px-3 py-2">{delivery.status}</td>
                              <td className="px-3 py-2">
                                {formatDateTime(delivery.sentAt)}
                              </td>
                              <td className="px-3 py-2 text-rose-700">
                                {delivery.lastError || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </Card>

      <Modal
        title="Campaignni tahrirlash"
        open={editOpen}
        onClose={() => setEditOpen(false)}
      >
        <div className="space-y-3">
          <Input
            label="Sarlavha"
            value={editForm.title}
            onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <Select
            label="Parse mode"
            value={editForm.parseMode}
            onChange={(e) =>
              setEditForm((prev) => ({
                ...prev,
                parseMode: e.target.value as "HTML" | "Markdown" | "MarkdownV2",
              }))
            }
            options={PARSE_MODE_OPTIONS.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
          />
          <Input
            label="Button text"
            value={editForm.buttonText}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, buttonText: e.target.value }))
            }
          />
          <Input
            label="Button URL"
            value={editForm.buttonUrl}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, buttonUrl: e.target.value }))
            }
          />
          <Input
            label="Queue vaqti"
            type="datetime-local"
            value={editForm.scheduledAt}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, scheduledAt: e.target.value }))
            }
          />
          <Textarea
            label="Xabar matni"
            value={editForm.content}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, content: e.target.value }))
            }
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={() => void submitEdit()} disabled={savingEdit}>
              {savingEdit ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
