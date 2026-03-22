import type {
  CashbackAwardResult,
  CashbackSettleResult,
  TelegramCashbackUser,
  TelegramCashbackUserListItem,
  TelegramCashbackUserListResponse,
} from "@/lib/types";
import { getStoredAuth } from "@/lib/auth-store";
import { API_BASE_URL, SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

type AwardCashbackDTO = {
  barcode: string;
  saleIds: string[];
};

type SettleCashbackDTO = {
  barcode: string;
  saleIds: string[];
  redeemedAmount?: number;
};

type UsersPayload = TelegramCashbackUserListItem[] | TelegramCashbackUserListResponse;

function normalizeUsersResponse(payload: UsersPayload): TelegramCashbackUserListResponse {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: {
        total: payload.length,
        returned: payload.length,
        limit: payload.length,
        hasMore: false,
      },
    };
  }
  return payload;
}

function parseApiMessage(status: number, bodyText: string, fallback: string) {
  try {
    const parsed = JSON.parse(bodyText) as { message?: string | string[] };
    const message = Array.isArray(parsed.message)
      ? parsed.message.join(", ")
      : parsed.message;
    if (message && String(message).trim()) {
      return `API ${status}: ${message}`;
    }
  } catch {
    // no-op
  }
  if (bodyText.trim()) return `API ${status}: ${bodyText.trim()}`;
  return `API ${status}: ${fallback}`;
}

async function localApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getStoredAuth();
  if (!auth?.accessToken) {
    throw new Error("Cashback uchun avval tizimga qayta login qiling");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiMessage(res.status, text, res.statusText));
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

const apiMode = {
  async lookup(barcode: string): Promise<TelegramCashbackUser> {
    return apiFetch<TelegramCashbackUser>(`/telegram-cashback/lookup/${encodeURIComponent(barcode)}`);
  },
  async award(dto: AwardCashbackDTO): Promise<CashbackAwardResult> {
    return apiFetch<CashbackAwardResult>("/telegram-cashback/award", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },
  async settle(dto: SettleCashbackDTO): Promise<CashbackSettleResult> {
    return apiFetch<CashbackSettleResult>("/telegram-cashback/settle", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },
  async listUsers(params?: { q?: string; limit?: number }): Promise<TelegramCashbackUserListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.q?.trim()) searchParams.set("q", params.q.trim());
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    const payload = await apiFetch<UsersPayload>(`/telegram-cashback/users${qs ? `?${qs}` : ""}`);
    return normalizeUsersResponse(payload);
  },
};

const localMode = {
  async lookup(barcode: string): Promise<TelegramCashbackUser> {
    return localApiFetch<TelegramCashbackUser>(`/telegram-cashback/lookup/${encodeURIComponent(barcode)}`);
  },
  async award(dto: AwardCashbackDTO): Promise<CashbackAwardResult> {
    return localApiFetch<CashbackAwardResult>("/telegram-cashback/award", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },
  async settle(dto: SettleCashbackDTO): Promise<CashbackSettleResult> {
    return localApiFetch<CashbackSettleResult>("/telegram-cashback/settle", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },
  async listUsers(params?: { q?: string; limit?: number }): Promise<TelegramCashbackUserListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.q?.trim()) searchParams.set("q", params.q.trim());
    if (params?.limit != null) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    const payload = await localApiFetch<UsersPayload>(`/telegram-cashback/users${qs ? `?${qs}` : ""}`);
    return normalizeUsersResponse(payload);
  },
};

export const telegramCashbackService = SERVICE_MODE === "api" ? apiMode : localMode;
