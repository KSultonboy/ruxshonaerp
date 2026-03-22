import type { AuthUser, UserRole } from "@/lib/types";

function normalizeRoleText(value?: string | null) {
  if (!value) return "";
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function mapRoleToken(token: string): UserRole | null {
  if (!token) return null;

  if (token === "ADMIN" || token === "ROLE_ADMIN" || token === "SUPERADMIN" || token === "SUPER_ADMIN") {
    return "ADMIN";
  }
  if (token === "SALES" || token === "SALE" || token === "SELLER" || token === "CASHIER") {
    return "SALES";
  }
  if (token === "MANAGER" || token === "ROLE_MANAGER" || token === "MANAGEMENT") {
    return "MANAGER";
  }
  if (token === "PRODUCTION" || token === "PRODUCER" || token === "FACTORY" || token === "MANUFACTURING") {
    return "PRODUCTION";
  }

  if (token.includes("ADMIN")) return "ADMIN";
  if (token.includes("MANAGER")) return "MANAGER";
  if (token.includes("SALE") || token.includes("SELL") || token.includes("CASHIER")) return "SALES";
  if (token.includes("PROD") || token.includes("FACTORY") || token.includes("MANUFACTUR")) return "PRODUCTION";

  return null;
}

export function normalizeUserRole(role?: string | null, roleLabel?: string | null): UserRole | null {
  const fromRole = mapRoleToken(normalizeRoleText(role));
  if (fromRole) return fromRole;
  return mapRoleToken(normalizeRoleText(roleLabel));
}

export function isAdminRole(role?: string | null): boolean {
  return normalizeUserRole(role) === "ADMIN";
}

export function isSalesRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === "SALES" || normalized === "MANAGER";
}

export function isProductionRole(role?: string | null): boolean {
  return normalizeUserRole(role) === "PRODUCTION";
}

export function isManagerRole(role?: string | null): boolean {
  return normalizeUserRole(role) === "MANAGER";
}

export function normalizeAuthUser(user?: Partial<AuthUser> | null): AuthUser | null {
  if (!user) return null;

  const normalizedRole = normalizeUserRole(String(user.role ?? ""), user.roleLabel ?? null);
  if (!normalizedRole) return null;

  const id = typeof user.id === "string" && user.id.trim() ? user.id : "unknown";
  const username =
    typeof user.username === "string" && user.username.trim()
      ? user.username
      : typeof user.name === "string" && user.name.trim()
      ? user.name
      : "user";

  return {
    id,
    name: user.name,
    username,
    role: normalizedRole,
    roleLabel: user.roleLabel,
    active: typeof user.active === "boolean" ? user.active : true,
    branchId: typeof user.branchId === "string" ? user.branchId : user.branchId ?? null,
  };
}
