import { API_BASE_URL } from "./config";
import type { AuthUser } from "@/lib/types";
import { normalizeAuthUser } from "@/lib/roles";

export type AuthResponse = {
  accessToken: string;
  accessTokenExpiresAt?: string | null;
  refreshToken: string;
  refreshTokenExpiresAt?: string | null;
  user: AuthUser;
};

type AuthResponseLike = Partial<AuthResponse> & {
  token?: unknown;
  refresh?: string;
  access_token?: string;
  refresh_token?: string;
  access?: string;
  data?: unknown;
  result?: unknown;
  payload?: unknown;
  tokens?: unknown;
  message?: string;
  error?: string;
  user?: AuthUser;
  profile?: AuthUser;
  admin?: unknown;
};

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTokenString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, "");
}

function deepFindByKeys(value: unknown, keySet: Set<string>, depth = 0): string | null {
  if (depth > 6 || value == null) return null;

  const direct = normalizeTokenString(value);
  if (direct && depth === 0) return direct;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindByKeys(item, keySet, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (!isObject(value)) return null;

  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.trim().toLowerCase();
    if (keySet.has(normalizedKey)) {
      const normalized = normalizeTokenString(nested);
      if (normalized) return normalized;
      const deep = deepFindByKeys(nested, keySet, depth + 1);
      if (deep) return deep;
    }
  }

  for (const nested of Object.values(value)) {
    const found = deepFindByKeys(nested, keySet, depth + 1);
    if (found) return found;
  }

  return null;
}

function collectCandidates(raw: AuthResponseLike) {
  const root = isObject(raw) ? raw : {};
  const token = isObject(root.token) ? root.token : {};
  const tokensObj = isObject(root.tokens) ? root.tokens : {};
  const data = isObject(root.data) ? root.data : {};
  const dataToken = isObject((data as any).token) ? (data as any).token : {};
  const result = isObject(root.result) ? root.result : {};
  const resultToken = isObject((result as any).token) ? (result as any).token : {};
  const payload = isObject(root.payload) ? root.payload : {};
  const payloadToken = isObject((payload as any).token) ? (payload as any).token : {};
  const rootAdmin = isObject(root.admin) ? root.admin : {};
  const dataAdmin = isObject((data as any).admin) ? (data as any).admin : {};
  const payloadAdmin = isObject((payload as any).admin) ? (payload as any).admin : {};

  return [
    root,
    token,
    tokensObj,
    data,
    dataToken,
    isObject((data as any).tokens) ? (data as any).tokens : {},
    result,
    resultToken,
    payload,
    payloadToken,
    rootAdmin,
    dataAdmin,
    payloadAdmin,
  ];
}

function normalizeAuthResponse(raw: AuthResponseLike): AuthResponse {
  const errorText = pickString(raw.error, raw.message);
  if (errorText && /invalid|incorrect|required|error/i.test(errorText)) {
    throw new Error(errorText);
  }

  const candidates = collectCandidates(raw);
  const accessTokenKeys = new Set([
    "accesstoken",
    "access_token",
    "access",
    "token",
    "jwt",
    "id_token",
  ]);
  const refreshTokenKeys = new Set(["refreshtoken", "refresh_token", "refresh"]);

  const accessToken = pickString(
    ...candidates.map((obj) =>
      pickString(
        obj.accessToken,
        obj.token,
        obj.access_token,
        obj.access,
        isObject(obj.token) ? (obj.token as any).accessToken : undefined,
        isObject(obj.token) ? (obj.token as any).access : undefined,
        isObject(obj.token) ? (obj.token as any).jwt : undefined,
        isObject(obj.token) ? (obj.token as any).token : undefined
      )
    ),
    deepFindByKeys(raw, accessTokenKeys)
  );

  const refreshToken = pickString(
    ...candidates.map((obj) =>
      pickString(
        obj.refreshToken,
        obj.refresh,
        obj.refresh_token,
        isObject(obj.token) ? (obj.token as any).refreshToken : undefined,
        isObject(obj.token) ? (obj.token as any).refresh_token : undefined,
        isObject(obj.token) ? (obj.token as any).refresh : undefined
      )
    ),
    deepFindByKeys(raw, refreshTokenKeys),
    // Legacy fallback: some backends only return one token.
    accessToken
  );

  const userCandidate = (candidates
    .map((obj) => {
      const byUser = obj.user;
      const byProfile = obj.profile;
      const byAdmin = obj.admin;
      return (isObject(byUser) ? byUser : isObject(byProfile) ? byProfile : isObject(byAdmin) ? byAdmin : null) as
        | AuthUser
        | null;
    })
    .find(Boolean) ?? null) as AuthUser | null;

  let user = normalizeAuthUser(userCandidate);
  if (!user) {
    const root = (isObject(raw) ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
    const username = pickString(
      typeof root.user === "string" ? root.user : undefined,
      root.username,
      isObject(root.user) ? (root.user as any).username : undefined,
      isObject(root.user) ? (root.user as any).login : undefined,
      isObject(root.user) ? (root.user as any).name : undefined,
      isObject(root.admin) ? (root.admin as any).username : undefined,
      isObject(root.admin) ? (root.admin as any).login : undefined,
      isObject(root.admin) ? (root.admin as any).name : undefined
    );
    const role = pickString(
      root.role,
      isObject(root.user) ? (root.user as any).role : undefined,
      isObject(root.admin) ? (root.admin as any).role : undefined,
      typeof root.admin === "string" ? root.admin : undefined,
      root.admin === true ? "ADMIN" : undefined,
      isObject(root.admin) && (root.admin as any).isAdmin ? "ADMIN" : undefined
    );
    if (username || role) {
      user = normalizeAuthUser({
        id: pickString(
          root.id,
          isObject(root.user) ? (root.user as any).id : undefined,
          isObject(root.admin) ? (root.admin as any).id : undefined,
          username ?? "admin"
        ) as string,
        username: username ?? "admin",
        role: (role ?? "ADMIN") as any,
        active: true,
      });
    }
  }

  if (!accessToken || !refreshToken || !user) {
    const keys = Object.keys(isObject(raw) ? raw : {}).join(", ");
    const rawToken = isObject(raw) ? (raw as any).token : undefined;
    const tokenType = typeof rawToken;
    const tokenKeys = isObject(rawToken) ? Object.keys(rawToken).join(", ") : "";
    const tokenInfo =
      isObject(raw) && "token" in raw
        ? `; tokenType=${tokenType}${tokenKeys ? `; tokenKeys=${tokenKeys}` : ""}`
        : "";
    throw new Error(`API auth response is missing token fields (keys: ${keys || "none"}${tokenInfo})`);
  }

  return {
    accessToken,
    accessTokenExpiresAt: raw.accessTokenExpiresAt ?? null,
    refreshToken,
    refreshTokenExpiresAt: raw.refreshTokenExpiresAt ?? null,
    user,
  };
}

async function request<T>(path: string, options: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(username: string, password: string) {
  const raw = await request<AuthResponseLike>("/auth/login", {
    method: "POST",
    // Compatibility: some deployed backends expect `login`, others expect `username`.
    body: JSON.stringify({ username, login: username, password }),
  });
  return normalizeAuthResponse(raw);
}

export async function refresh(refreshToken: string) {
  const raw = await request<AuthResponseLike>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  return normalizeAuthResponse(raw);
}

export async function logout(refreshToken: string) {
  return request<{ ok: true }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export async function me(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return (await res.json()) as AuthUser;
}
