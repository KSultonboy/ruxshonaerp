"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { usersService } from "@/services/users";
import { branchesService } from "@/services/branches";
import { permissionsService } from "@/services/permissions";
import type { Branch, Permission, User, UserPermission } from "@/lib/types";

type PermissionGroup = { group: string; permissions: Permission[] };

function labelFromPermission(permission: Permission) {
  return permission
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function usePermissionSet(initial: Permission[] = []) {
  const [items, setItems] = useState<Set<Permission>>(() => new Set(initial));
  const toggle = useCallback((permission: Permission) => {
    setItems((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }, []);
  const reset = useCallback((values: Permission[]) => setItems(new Set(values)), []);
  return { items, toggle, reset };
}

function PermissionChecklist({
  groups,
  selected,
  onToggle,
}: {
  groups: PermissionGroup[];
  selected: Set<Permission>;
  onToggle: (permission: Permission) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => (
        <div key={group.group} className="rounded-2xl border border-cream-200/70 bg-cream-50/70 p-4">
          <div className="text-sm font-semibold text-cocoa-900">{group.group}</div>
          <div className="mt-3 grid gap-2">
            {group.permissions.map((permission) => (
              <label key={permission} className="flex items-center gap-3 text-sm text-cocoa-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-cream-300 text-berry-600 focus:ring-berry-300"
                  checked={selected.has(permission)}
                  onChange={() => onToggle(permission)}
                />
                <span>{labelFromPermission(permission)}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PermissionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [activeBranchId, setActiveBranchId] = useState("");
  const [branchPermissions, setBranchPermissions] = useState<Record<string, Set<Permission>>>({});
  const [loading, setLoading] = useState(false);

  const globalPermissions = usePermissionSet();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [userList, branchList, defs] = await Promise.all([
        usersService.list(),
        branchesService.list(),
        permissionsService.definitions(),
      ]);
      setUsers(userList as User[]);
      setBranches(branchList as Branch[]);
      setGroups(defs);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadUserPermissions = useCallback(
    async (userId: string) => {
      if (!userId) return;
      setLoading(true);
      try {
        const items = (await permissionsService.list(userId)) as UserPermission[];
        const global = items.filter((item) => !item.branchId).map((item) => item.permission);
        const byBranch: Record<string, Set<Permission>> = {};
        items
          .filter((item) => item.branchId)
          .forEach((item) => {
            const key = item.branchId as string;
            if (!byBranch[key]) byBranch[key] = new Set();
            byBranch[key].add(item.permission);
          });
        globalPermissions.reset(global);
        setBranchPermissions(byBranch);
        if (!activeBranchId && branchListHas(branches, byBranch)) {
          setActiveBranchId(Object.keys(byBranch)[0] ?? "");
        }
      } catch (e: any) {
        toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
      } finally {
        setLoading(false);
      }
    },
    [activeBranchId, branches, globalPermissions, t, toast]
  );

  const activeBranchPermissions = useMemo(() => {
    if (!activeBranchId) return new Set<Permission>();
    return branchPermissions[activeBranchId] ?? new Set<Permission>();
  }, [activeBranchId, branchPermissions]);

  const toggleBranchPermission = useCallback(
    (permission: Permission) => {
      if (!activeBranchId) return;
      setBranchPermissions((prev) => {
        const next = { ...prev };
        const current = new Set(next[activeBranchId] ?? []);
        if (current.has(permission)) current.delete(permission);
        else current.add(permission);
        if (current.size === 0) {
          delete next[activeBranchId];
        } else {
          next[activeBranchId] = current;
        }
        return next;
      });
    },
    [activeBranchId]
  );

  if (user?.role !== "ADMIN") {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Ruxsatlar")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Rol va filialga biriktirish")}</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full md:w-64">
            <Select
              label={t("Ishchilar")}
              value={selectedUserId}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedUserId(next);
                loadUserPermissions(next);
              }}
              options={[
                { value: "", label: t("Tanlang") },
                ...users.map((u) => ({ value: u.id, label: `${u.username} (${u.role})` })),
              ]}
            />
          </div>
          <div className="w-full md:w-64">
            <Select
              label={t("Filiallar")}
              value={activeBranchId}
              onChange={(e) => setActiveBranchId(e.target.value)}
              options={[
                { value: "", label: t("Filiallar") },
                ...branches.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          </div>
          <div className="flex-1" />
          <Button
            disabled={!selectedUserId || loading}
            onClick={async () => {
              if (!selectedUserId) return;
              const payload: { permission: Permission; branchId?: string | null }[] = [
                ...Array.from(globalPermissions.items).map((permission) => ({ permission })),
                ...Object.entries(branchPermissions).flatMap(([branchId, perms]) =>
                  Array.from(perms).map((permission) => ({ permission, branchId }))
                ),
              ];
              setLoading(true);
              try {
                await permissionsService.replace(selectedUserId, payload);
                toast.success(t("Saqlandi"));
              } catch (e: any) {
                toast.error(t("Xatolik"), e?.message || t("Saqlab bo'lmadi"));
              } finally {
                setLoading(false);
              }
            }}
          >
            {t("Saqlash")}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="text-sm font-semibold text-cocoa-900">{t("Global ruxsatlar")}</div>
        <p className="mt-1 text-xs text-cocoa-500">
          {t("Global ruxsatlar barcha filiallarga tatbiq etiladi.")}
        </p>
        <div className="mt-4">
          <PermissionChecklist groups={groups} selected={globalPermissions.items} onToggle={globalPermissions.toggle} />
        </div>
      </Card>

      <Card>
        <div className="text-sm font-semibold text-cocoa-900">{t("Filial bo'yicha ruxsatlar")}</div>
        <p className="mt-1 text-xs text-cocoa-500">
          {t("Tanlangan filial uchun alohida ruxsatlar belgilanadi.")}
        </p>
        {activeBranchId ? (
          <div className="mt-4">
            <PermissionChecklist groups={groups} selected={activeBranchPermissions} onToggle={toggleBranchPermission} />
          </div>
        ) : (
          <div className="mt-4 text-sm text-cocoa-600">{t("Filial tanlang")}</div>
        )}
      </Card>
    </div>
  );
}

function branchListHas(branches: Branch[], byBranch: Record<string, Set<Permission>>) {
  if (!branches.length) return false;
  return Object.keys(byBranch).some((id) => branches.some((b) => b.id === id));
}
