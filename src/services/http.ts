// src/services/http.ts
import { API_BASE_URL, SERVICE_MODE } from "./config";
import { clearStoredAuth, getStoredAuth, setStoredAuth, type StoredAuth } from "@/lib/auth-store";
import { refresh as refreshRequest } from "./auth";

export type FetchOptions = RequestInit & {
  skipAuth?: boolean;
};

let refreshPromise: Promise<StoredAuth | null> | null = null;

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers as Record<string, string>;
}

function isFormBody(body: RequestInit["body"]) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function isJsonBody(body: RequestInit["body"]) {
  return typeof body === "string"; // in our app JSON bodies are stringified
}

async function safeReadText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function safeReadJson<T>(res: Response): Promise<T> {
  // Some endpoints may return empty body with 200
  const text = await safeReadText(res);
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // If backend returns plain text, still surface it
    throw new Error(text);
  }
}

async function refreshTokens(): Promise<StoredAuth | null> {
  const current = getStoredAuth();
  if (!current?.refreshToken) return null;

  try {
    const fresh = await refreshRequest(current.refreshToken);
    const next: StoredAuth = { ...current, ...fresh };
    setStoredAuth(next);
    return next;
  } catch {
    clearStoredAuth();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return null;
  }
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  const auth = getStoredAuth();
  const headers = normalizeHeaders(fetchOptions.headers);
  const isForm = isFormBody(fetchOptions.body);
  const method = (fetchOptions.method?.toUpperCase() || "GET") as string;
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  // Content-Type: only set for JSON string body (not for FormData)
  if (!isForm && isJsonBody(fetchOptions.body) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Auth header: only for API mode + not skipAuth
  if (SERVICE_MODE === "api" && !skipAuth && auth?.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  const url = `${API_BASE_URL}${path}`;

  const doFetch = async (overrideHeaders?: Record<string, string>) => {
    const res = await fetch(url, {
      ...fetchOptions,
      headers: overrideHeaders ?? headers,
    });

    // 204: no content
    if (res.status === 204) return undefined as T;

    if (!res.ok) {
      const text = await safeReadText(res);
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }

    // attempt json; if server returns text, safeReadJson will throw with text
    return await safeReadJson<T>(res);
  };

  try {
    return await doFetch();
  } catch (e: any) {
    // Refresh flow only for 401 (API mode + tokens exist + not skipAuth)
    const message = String(e?.message || "");
    const is401 = message.startsWith("API 401");

    if (is401 && SERVICE_MODE === "api" && !skipAuth && auth?.refreshToken) {
      if (!refreshPromise) refreshPromise = refreshTokens();
      const refreshed = await refreshPromise;
      refreshPromise = null;

      if (refreshed?.accessToken) {
        const retryHeaders = { ...headers, Authorization: `Bearer ${refreshed.accessToken}` };
        return await doFetch(retryHeaders);
      }
    }

    // Offline mutation queue (only for mutations, only in browser, only if offline)
    if (isMutation && typeof window !== "undefined" && !window.navigator.onLine) {
      if (isForm) {
        throw new Error("OFFLINE: Fayl yuborish hozircha oflayn navbatga olinmaydi");
      }
      const { syncService } = await import("./sync");
      syncService.enqueue(url, method, fetchOptions.body as unknown, headers);
      throw new Error("OFFLINE: Mutation queued for synchronization");
    }

    throw e;
  }
}