import { getJSON, setJSON } from "./storage";
import type { AuthUser } from "./types";
import { normalizeAuthUser } from "./roles";

export type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  user: AuthUser;
};

const AUTH_KEY = "rx_auth";

type StoredAuthLike = Partial<StoredAuth> & {
  token?: string;
  refresh?: string;
  access_token?: string;
  refresh_token?: string;
  admin?: unknown;
  username?: string;
  role?: string;
};

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeStoredAuth(raw: unknown): StoredAuth | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as StoredAuthLike;

  const accessToken = pickString(value.accessToken, value.token, value.access_token);
  const refreshToken = pickString(value.refreshToken, value.refresh, value.refresh_token);
  let user = normalizeAuthUser(value.user as Partial<AuthUser> | null | undefined);
  if (!user) {
    user = normalizeAuthUser(
      (value.admin as Partial<AuthUser> | null | undefined) ??
        ({
          username: typeof value.username === "string" ? value.username : "admin",
          role: typeof value.role === "string" ? value.role : value.admin ? "ADMIN" : undefined,
          active: true,
        } as Partial<AuthUser>)
    );
  }

  if (!accessToken || !refreshToken || !user) return null;

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: value.accessTokenExpiresAt ?? null,
    refreshTokenExpiresAt: value.refreshTokenExpiresAt ?? null,
    user: user as AuthUser,
  };
}

export function getStoredAuth(): StoredAuth | null {
  const raw = getJSON<unknown>(AUTH_KEY, null);
  const normalized = normalizeStoredAuth(raw);
  if (normalized) {
    setJSON(AUTH_KEY, normalized);
  }
  return normalized;
}

export function setStoredAuth(value: StoredAuth) {
  const normalized = normalizeStoredAuth(value);
  if (!normalized) return;
  setJSON(AUTH_KEY, normalized);
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_KEY);
}

export function getAccessToken() {
  return getStoredAuth()?.accessToken ?? null;
}

export function getRefreshToken() {
  return getStoredAuth()?.refreshToken ?? null;
}
