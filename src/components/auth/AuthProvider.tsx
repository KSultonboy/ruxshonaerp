"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, Permission, UserPermission } from "@/lib/types";
import { SERVICE_MODE } from "@/services/config";
import { clearStoredAuth, getStoredAuth, setStoredAuth } from "@/lib/auth-store";
import { login as loginRequest, logout as logoutRequest } from "@/services/auth";
import { apiFetch } from "@/services/http";
import { salesService } from "@/services/sales";
import { isAdminRole, isSalesRole, normalizeAuthUser } from "@/lib/roles";

type AuthContextValue = {
  user: AuthUser | null;
  permissions: UserPermission[];
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (permission: Permission, branchId?: string | null) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("AUTH_TIMEOUT")), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPermissions = useCallback(async () => {
    if (SERVICE_MODE !== "api") {
      setPermissions([]);
      return;
    }
    try {
      const items = await apiFetch<UserPermission[]>("/auth/permissions");
      setPermissions(items);
    } catch {
      setPermissions([]);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (SERVICE_MODE !== "api") return;
    const stored = getStoredAuth();
    if (!stored?.accessToken) return;

    const me = await withTimeout(apiFetch<AuthUser>("/auth/me"));
    const normalized = normalizeAuthUser(me);
    if (!normalized) throw new Error("Role parse failed");
    setStoredAuth({ ...stored, user: normalized });
    setUser(normalized);
    await refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    if (SERVICE_MODE !== "api") {
      setUser({ id: "local", username: "local", role: "ADMIN", active: true });
      setLoading(false);
      return;
    }

    const stored = getStoredAuth();
    if (!stored?.accessToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    withTimeout(apiFetch<AuthUser>("/auth/me"))
      .then((me) => {
        const normalized = normalizeAuthUser(me);
        if (!normalized) throw new Error("Role parse failed");
        setStoredAuth({ ...stored, user: normalized });
        setUser(normalized);
      })
      .catch(() => {
        clearStoredAuth();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      return;
    }
    void refreshPermissions();
  }, [refreshPermissions, user?.id]);

  useEffect(() => {
    const onLogout = () => {
      clearStoredAuth();
      setUser(null);
    };
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginRequest(username, password);
    const normalized = normalizeAuthUser(res.user);
    if (!normalized) {
      throw new Error("Role parse failed");
    }
    setStoredAuth({ ...res, user: normalized });
    setUser(normalized);
    await refreshPermissions();
    return normalized;
  }, [refreshPermissions]);

  const logout = useCallback(async () => {
    if (isSalesRole(user?.role)) {
      const shift = await salesService.getShift().catch(() => null);
      if (shift?.status === "OPEN") {
        if (typeof window !== "undefined") {
          window.location.href = "/sales/shift?needClose=1";
        }
        throw new Error("Smena yopilmagan. Avval rasm yuklab smenani yoping.");
      }
    }
    const stored = getStoredAuth();
    if (stored?.refreshToken) {
      await logoutRequest(stored.refreshToken).catch(() => undefined);
    }
    clearStoredAuth();
    setUser(null);
    setPermissions([]);
  }, [user?.role]);

  const hasPermission = useCallback(
    (permission: Permission, branchId?: string | null) => {
      if (SERVICE_MODE !== "api") return true;
      if (isAdminRole(user?.role)) return true;
      const scopeId = branchId ?? user?.branchId ?? null;
      return permissions.some(
        (item) => item.permission === permission && (item.branchId == null || item.branchId === scopeId)
      );
    },
    [permissions, user?.branchId, user?.role]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      loading,
      login,
      logout,
      refreshUser,
      isAdmin: isAdminRole(user?.role),
      hasPermission,
    }),
    [user, permissions, loading, login, logout, refreshUser, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider />");
  return ctx;
}
