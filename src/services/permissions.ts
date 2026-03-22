import type { Permission, UserPermission } from "@/lib/types";
import { getJSON, safeId, setJSON } from "@/lib/storage";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";

const STORAGE_KEY = "rx_permissions";

const PERMISSION_GROUPS: { group: string; permissions: Permission[] }[] = [
  { group: "Users", permissions: ["USERS_READ", "USERS_WRITE"] },
  { group: "Branches", permissions: ["BRANCHES_READ", "BRANCHES_WRITE"] },
  { group: "Shops", permissions: ["SHOPS_READ", "SHOPS_WRITE"] },
  { group: "Products", permissions: ["PRODUCTS_READ", "PRODUCTS_WRITE"] },
  { group: "Expenses", permissions: ["EXPENSES_READ", "EXPENSES_WRITE"] },
  { group: "Warehouse", permissions: ["WAREHOUSE_READ", "WAREHOUSE_WRITE"] },
  { group: "Transfers", permissions: ["TRANSFERS_READ", "TRANSFERS_WRITE", "TRANSFERS_RECEIVE"] },
  { group: "Returns", permissions: ["RETURNS_READ", "RETURNS_WRITE", "RETURNS_APPROVE"] },
  { group: "Sales", permissions: ["SALES_READ", "SALES_WRITE"] },
  { group: "Payments", permissions: ["PAYMENTS_READ", "PAYMENTS_WRITE"] },
  { group: "Reports", permissions: ["REPORTS_READ"] },
  { group: "Alerts", permissions: ["ALERTS_READ", "ALERTS_WRITE"] },
  { group: "Audit", permissions: ["AUDIT_READ"] },
];

type PermissionInput = { permission: Permission; branchId?: string | null };

const local = {
  async definitions() {
    return PERMISSION_GROUPS;
  },
  async list(userId?: string) {
    const items = getJSON<UserPermission[]>(STORAGE_KEY, []);
    if (!userId) return items;
    return items.filter((item) => item.userId === userId);
  },
  async replace(userId: string, permissions: PermissionInput[]) {
    const items = getJSON<UserPermission[]>(STORAGE_KEY, []);
    const filtered = items.filter((item) => item.userId !== userId);
    const now = new Date().toISOString();
    const next = permissions.map((item) => ({
      id: safeId("perm"),
      userId,
      permission: item.permission,
      branchId: item.branchId ?? null,
      createdAt: now,
    }));
    setJSON(STORAGE_KEY, [...filtered, ...next]);
    return { ok: true };
  },
};

const api = {
  async definitions() {
    return apiFetch<{ group: string; permissions: Permission[] }[]>("/permissions/definitions");
  },
  async list(userId?: string) {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return apiFetch<UserPermission[]>(`/permissions${query}`);
  },
  async replace(userId: string, permissions: PermissionInput[]) {
    return apiFetch<void>(`/permissions/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    });
  },
};

export const permissionsService = SERVICE_MODE === "api" ? api : local;
