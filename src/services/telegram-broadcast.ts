import type {
  TelegramCampaignCategory,
  TelegramBroadcastCampaign,
  TelegramBroadcastTarget,
  TelegramTargetSegment,
  TelegramTargetType,
} from "@/lib/types";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

type CreateTargetDTO = {
  name: string;
  chatId: string;
  type: TelegramTargetType;
  segment?: TelegramTargetSegment;
  note?: string;
};

type UpdateTargetDTO = Partial<CreateTargetDTO> & {
  active?: boolean;
};

type CreateCampaignDTO = {
  title?: string;
  content: string;
  category?: TelegramCampaignCategory;
  buttonText?: string;
  buttonUrl?: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  targetIds?: string[];
  extraChatIds?: string[];
  targetSegment?: TelegramTargetSegment;
  scheduledAt?: string;
  sendNow?: boolean;
};

type EditCampaignDTO = {
  title?: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  scheduledAt?: string;
};

const local = {
  async listTargets(_segment?: TelegramTargetSegment): Promise<TelegramBroadcastTarget[]> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async createTarget(_dto: CreateTargetDTO): Promise<TelegramBroadcastTarget> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async updateTarget(_id: string, _dto: UpdateTargetDTO): Promise<TelegramBroadcastTarget> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async removeTarget(_id: string): Promise<{ ok: true; mode: "deactivated" | "deleted" }> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async listCampaigns(_limit?: number, _category?: TelegramCampaignCategory | "ALL"): Promise<TelegramBroadcastCampaign[]> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async createCampaign(_dto: CreateCampaignDTO): Promise<TelegramBroadcastCampaign> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async queueCampaign(_id: string, _scheduledAt?: string): Promise<TelegramBroadcastCampaign> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async cancelCampaign(_id: string): Promise<TelegramBroadcastCampaign> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async retryCampaign(_id: string): Promise<TelegramBroadcastCampaign> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async processCampaign(_id: string): Promise<TelegramBroadcastCampaign> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async editCampaign(_id: string, _dto: EditCampaignDTO): Promise<{ ok: true; edited: number; failed: number; campaign: TelegramBroadcastCampaign }> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
  async deleteCampaignMessages(_id: string): Promise<{ ok: true; deleted: number; failed: number; campaign: TelegramBroadcastCampaign }> {
    throw new Error("Telegram broadcast faqat API rejimida ishlaydi");
  },
};

const api = {
  async listTargets(segment?: TelegramTargetSegment): Promise<TelegramBroadcastTarget[]> {
    const query = segment ? `?segment=${segment}` : "";
    return apiFetch<TelegramBroadcastTarget[]>(`/telegram-broadcast/targets${query}`);
  },
  async createTarget(dto: CreateTargetDTO): Promise<TelegramBroadcastTarget> {
    return apiFetch<TelegramBroadcastTarget>("/telegram-broadcast/targets", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },
  async updateTarget(id: string, dto: UpdateTargetDTO): Promise<TelegramBroadcastTarget> {
    return apiFetch<TelegramBroadcastTarget>(`/telegram-broadcast/targets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  },
  async removeTarget(id: string): Promise<{ ok: true; mode: "deactivated" | "deleted" }> {
    return apiFetch<{ ok: true; mode: "deactivated" | "deleted" }>(`/telegram-broadcast/targets/${id}`, {
      method: "DELETE",
    });
  },
  async listCampaigns(
    limit = 50,
    category: TelegramCampaignCategory | "ALL" = "ALL",
  ): Promise<TelegramBroadcastCampaign[]> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (category !== "ALL") params.set("category", category);
    return apiFetch<TelegramBroadcastCampaign[]>(`/telegram-broadcast/campaigns?${params.toString()}`);
  },
  async createCampaign(dto: CreateCampaignDTO): Promise<TelegramBroadcastCampaign> {
    return apiFetch<TelegramBroadcastCampaign>("/telegram-broadcast/campaigns", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },
  async queueCampaign(id: string, scheduledAt?: string): Promise<TelegramBroadcastCampaign> {
    return apiFetch<TelegramBroadcastCampaign>(`/telegram-broadcast/campaigns/${id}/queue`, {
      method: "POST",
      body: JSON.stringify(scheduledAt ? { scheduledAt } : {}),
    });
  },
  async cancelCampaign(id: string): Promise<TelegramBroadcastCampaign> {
    return apiFetch<TelegramBroadcastCampaign>(`/telegram-broadcast/campaigns/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  async retryCampaign(id: string): Promise<TelegramBroadcastCampaign> {
    return apiFetch<TelegramBroadcastCampaign>(`/telegram-broadcast/campaigns/${id}/retry`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  async processCampaign(id: string): Promise<TelegramBroadcastCampaign> {
    return apiFetch<TelegramBroadcastCampaign>(`/telegram-broadcast/campaigns/${id}/process`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  async editCampaign(
    id: string,
    dto: EditCampaignDTO
  ): Promise<{ ok: true; edited: number; failed: number; campaign: TelegramBroadcastCampaign }> {
    return apiFetch<{ ok: true; edited: number; failed: number; campaign: TelegramBroadcastCampaign }>(
      `/telegram-broadcast/campaigns/${id}/edit`,
      {
        method: "PATCH",
        body: JSON.stringify(dto),
      }
    );
  },
  async deleteCampaignMessages(
    id: string
  ): Promise<{ ok: true; deleted: number; failed: number; campaign: TelegramBroadcastCampaign }> {
    return apiFetch<{ ok: true; deleted: number; failed: number; campaign: TelegramBroadcastCampaign }>(
      `/telegram-broadcast/campaigns/${id}/delete`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
  },
};

export const telegramBroadcastService = SERVICE_MODE === "api" ? api : local;
