import type { Branch, User } from "@/lib/types";
import { getJSON, setJSON, safeId } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/seed";
import { SERVICE_MODE } from "./config";
import { apiFetch } from "./http";
import type { IUsersService } from "./contracts";

const local: IUsersService = {
  async list() {
    const users = getJSON<User[]>(STORAGE_KEYS.users, []);
    const branches = getJSON<Branch[]>(STORAGE_KEYS.branches, []);
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    return users.map((u) =>
      u.branchId ? { ...u, branch: branchMap.get(u.branchId) ?? null } : u
    );
  },

  async create(dto) {
    const items = getJSON<User[]>(STORAGE_KEYS.users, []);
    const now = new Date().toISOString();
    if ((dto.role === "SALES" || dto.role === "MANAGER") && !dto.branchId) {
      throw new Error("Branch required for sales/manager user");
    }
    const user: User = {
      id: safeId("user"),
      name: dto.name?.trim() ?? "",
      username: dto.username.trim(),
      role: dto.role as any,
      roleLabel: dto.roleLabel?.trim() || undefined,
      active: true,
      branchId: dto.role === "SALES" || dto.role === "MANAGER" ? dto.branchId ?? null : null,
      createdAt: now,
      updatedAt: now,
    };
    setJSON(STORAGE_KEYS.users, [user, ...items]);
    return user;
  },

  async update(id, dto) {
    const items = getJSON<User[]>(STORAGE_KEYS.users, []).map((u) =>
      u.id === id
        ? {
            ...u,
            ...dto,
            name: dto.name !== undefined ? dto.name.trim() : u.name,
            roleLabel: dto.roleLabel === undefined ? u.roleLabel : dto.roleLabel?.trim() || undefined,
            branchId:
              dto.role === "SALES" || dto.role === "MANAGER"
                ? dto.branchId ?? u.branchId ?? null
                : dto.role
                  ? null
                  : dto.branchId ?? u.branchId ?? null,
            updatedAt: new Date().toISOString(),
          }
        : u
    );
    setJSON(STORAGE_KEYS.users, items);
  },

  async remove(id) {
    const items = getJSON<User[]>(STORAGE_KEYS.users, []).map((u) =>
      u.id === id ? { ...u, active: false, updatedAt: new Date().toISOString() } : u
    );
    setJSON(STORAGE_KEYS.users, items);
  },
};

const api: IUsersService = {
  async list() {
    return apiFetch<User[]>("/users");
  },

  async create(dto) {
    return apiFetch<User>("/users", { method: "POST", body: JSON.stringify(dto) });
  },

  async update(id, dto) {
    await apiFetch<void>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(dto) });
  },

  async remove(id) {
    await apiFetch<void>(`/users/${id}`, { method: "DELETE" });
  },
};

export const usersService: IUsersService = SERVICE_MODE === "api" ? api : local;
