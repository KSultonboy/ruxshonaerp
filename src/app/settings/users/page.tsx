"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Table, T } from "@/components/ui/Table";
import { usersService } from "@/services/users";
import { ensureSeed } from "@/lib/seed";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import type { User } from "@/lib/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import { branchesService } from "@/services/branches";
import { isAdminRole } from "@/lib/roles";

export default function UsersPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useI18n();

  const roleOptions = [
    { value: "SALES", label: t("Sotuvchi") },
    { value: "MANAGER", label: t("Menejer") },
    { value: "PRODUCTION", label: t("Ishlab chiqarish") },
    { value: "ADMIN", label: t("Admin") },
  ];

  const [items, setItems] = useState<User[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("SALES");
  const [roleLabel, setRoleLabel] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      ensureSeed();
      const [data, branchData] = await Promise.all([usersService.list(), branchesService.list()]);
      setItems(data as User[]);
      setBranches(branchData.map((b) => ({ id: b.id, name: b.name })));
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Userlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetForm = useCallback(() => {
    setEditing(null);
    setName("");
    setUsername("");
    setPassword("");
    setRole("SALES");
    setRoleLabel("");
    setBranchId("");
  }, []);

  const startEdit = useCallback((u: User) => {
    setEditing(u);
    setName(u.name ?? "");
    setUsername(u.username);
    setPassword("");
    setRole(u.role);
    setRoleLabel(u.roleLabel ?? "");
    setBranchId(u.branch?.id ?? u.branchId ?? "");
  }, []);

  if (!isAdminRole(user?.role)) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Bu bo'lim faqat admin uchun.")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Ishchilar")}</h1>
        <p className="mt-1 text-sm text-cocoa-600">{t("Sotuv va ishlab chiqarish uchun userlar")}</p>
      </div>

      <Card className="motion-safe:animate-fade-up">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full md:w-56">
            <Input
              label={t("Ishchi nomi")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Masalan: Ali Valiyev")}
              disabled={loading}
            />
          </div>
          <div className="w-full md:w-56">
            <Input
              label={t("Username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("Masalan: sotuvchi1")}
              disabled={loading}
            />
          </div>
          <div className="w-full md:w-56">
            <Input
              label={t("Parol")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("Kamida 4 ta belgi")}
              disabled={loading}
            />
          </div>
          <div className="w-full md:w-48">
            <Select label={t("Rol")} value={role} onChange={(e) => setRole(e.target.value)} options={roleOptions} />
          </div>
          <div className="w-full md:w-56">
            <Input
              label={t("Rol nomi")}
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              placeholder={t("Masalan: Menejer")}
              disabled={loading}
            />
          </div>
          {role === "SALES" || role === "MANAGER" ? (
            <div className="w-full md:w-56">
              <Select
                label={t("Filiallar")}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                options={[
                  { value: "", label: t("Filiallar") },
                  ...branches.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </div>
          ) : null}
          <Button
            disabled={loading}
            onClick={async () => {
              const trimmedName = name.trim();
              const trimmedUsername = username.trim();
              const trimmedRoleLabel = roleLabel.trim();
              const trimmedPassword = password.trim();
              if (!trimmedName) {
                toast.error(t("Xatolik"), t("Ishchi nomini kiriting"));
                return;
              }
              if (!trimmedUsername) {
                toast.error(t("Xatolik"), t("Username ni kiriting"));
                return;
              }
              if (!editing && trimmedPassword.length < 4) {
                toast.error(t("Xatolik"), t("Parol kamida 4 ta belgi bo'lsin"));
                return;
              }
              if (editing && trimmedPassword && trimmedPassword.length < 4) {
                toast.error(t("Xatolik"), t("Parol kamida 4 ta belgi bo'lsin"));
                return;
              }
              if ((role === "SALES" || role === "MANAGER") && !branchId) {
                toast.error(t("Xatolik"), t("Filial tanlang"));
                return;
              }
              setLoading(true);
              try {
                const roleLabelPayload = editing ? trimmedRoleLabel : trimmedRoleLabel || undefined;
                const basePayload = {
                  name: trimmedName,
                  username: trimmedUsername,
                  role,
                  roleLabel: roleLabelPayload,
                  branchId:
                    role === "SALES" || role === "MANAGER"
                      ? branchId || undefined
                      : undefined,
                };
                if (editing) {
                  await usersService.update(editing.id, {
                    ...basePayload,
                    ...(trimmedPassword ? { password: trimmedPassword } : {}),
                  });
                } else {
                  await usersService.create({
                    ...basePayload,
                    password: trimmedPassword,
                  });
                }
                resetForm();
                toast.success(t("Saqlandi"));
                await refresh();
              } catch (e: any) {
                toast.error(t("Xatolik"), e?.message || (editing ? t("User yangilanmadi") : t("User qo'shilmadi")));
              } finally {
                setLoading(false);
              }
            }}
          >
            {editing ? t("Saqlash") : t("+ Qo'shish")}
          </Button>
          {editing ? (
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => {
                resetForm();
              }}
            >
              {t("Bekor")}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="motion-safe:animate-fade-up anim-delay-150">
        <Table>
          <T>
            <thead>
              <tr>
                <th>{t("Ishchi nomi")}</th>
                <th>{t("Username")}</th>
                <th>{t("Rol")}</th>
                <th>{t("Filiallar")}</th>
                <th>{t("Status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold text-cocoa-900">{u.name || "-"}</td>
                  <td>{u.username}</td>
                  <td>{u.roleLabel?.trim() || roleOptions.find((r) => r.value === u.role)?.label || u.role}</td>
                  <td>{u.branch?.name || "-"}</td>
                  <td>{u.active ? t("Active") : t("Blocked")}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={() => startEdit(u)}>
                        {t("Edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await usersService.update(u.id, { active: !u.active });
                            await refresh();
                          } catch (e: any) {
                            toast.error(t("Xatolik"), e?.message || t("Status yangilanmadi"));
                          }
                        }}
                      >
                        {u.active ? t("Block") : t("Activate")}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          if (!confirm(t("Userni bloklash?"))) return;
                          try {
                            await usersService.remove(u.id);
                            await refresh();
                          } catch (e: any) {
                            toast.error(t("Xatolik"), e?.message || t("User bloklanmadi"));
                          }
                        }}
                      >
                        {t("Disable")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-sm text-cocoa-600">
                    {t("Hozircha user yo'q.")}
                  </td>
                </tr>
              )}
            </tbody>
          </T>
        </Table>
      </Card>
    </div>
  );
}
