"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import { Table, T } from "@/components/ui/Table";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { auditService } from "@/services/audit";
import { usersService } from "@/services/users";
import type { AuditLog, User } from "@/lib/types";
import { buildCSV, downloadCSV, fileStamp } from "@/lib/csv";
import Badge from "@/components/ui/Badge";

function formatTimestamp(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function AuditPage() {
  const { user, hasPermission } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const take = 50;

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    entity: "",
    userId: "",
    action: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const canView = useMemo(
    () => Boolean(user && (user.role === "ADMIN" || hasPermission("AUDIT_READ"))),
    [hasPermission, user]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const loadUsers = user?.role === "ADMIN" ? usersService.list() : Promise.resolve([]);
      const [res, userList] = await Promise.all([
        auditService.list({
          from: filters.from || undefined,
          to: filters.to || undefined,
          entity: filters.entity || undefined,
          userId: filters.userId || undefined,
          action: filters.action || undefined,
          skip: (page - 1) * take,
          take,
        }),
        loadUsers,
      ]);
      setLogs(res.items);
      setTotal(res.total);
      setUsers(userList as User[]);
    } catch (e: any) {
      toast.error(t("Xatolik"), e?.message || t("Ma'lumotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }, [filters, page, take, t, toast, user?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    try {
      let parsed;
      try {
        parsed = JSON.parse(editContent);
      } catch {
        toast.error(t("JSON formati noto'g'ri"));
        return;
      }

      setLoading(true);
      await auditService.update(editId, parsed);
      toast.success(t("O'zgartirildi"));
      setEditOpen(false);
      refresh();
    } catch {
      toast.error(t("Xatolik"));
      setLoading(false);
    }
  };

  const openEdit = (log: AuditLog) => {
    setEditId(log.id);
    setEditContent(JSON.stringify(log.meta || {}, null, 2));
    setEditOpen(true);
  };

  if (!canView) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/70">
        <div className="text-sm font-semibold text-rose-700">{t("Ruxsat yo'q.")}</div>
      </Card>
    );
  }

  const exportCSV = () => {
    const headers = ["Date", "User", "Action", "Entity", "EntityId", "Method", "Path", "Status", "Payload"];
    const rows = logs.map((log) => [
      formatTimestamp(log.createdAt),
      log.user?.username ?? "-",
      log.action,
      log.entity,
      resolveEntityId(log),
      log.method,
      log.path,
      String(log.meta?.statusCode ?? ""),
      log.meta ? JSON.stringify(log.meta) : "",
    ]);
    const csv = buildCSV(headers, rows);
    downloadCSV(`audit-log-${fileStamp()}.csv`, csv);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "create": return <Badge tone="primary">{t("Yaratish")}</Badge>;
      case "update": return <Badge tone="neutral" className="bg-amber-100 text-amber-700 border-amber-200">{t("O'zgartirish")}</Badge>;
      case "delete": return <Badge tone="neutral" className="bg-rose-100 text-rose-700 border-rose-200">{t("O'chirish")}</Badge>;
      default: return <Badge tone="neutral">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-display text-3xl font-semibold text-cocoa-900">{t("Audit log")}</h1>
          <p className="mt-1 text-sm text-cocoa-600">{t("Tizimdagi barcha o'zgarishlarni kuzatish")}</p>
        </div>
        <Button variant="ghost" onClick={exportCSV} disabled={logs.length === 0}>
          {t("Export CSV")}
        </Button>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-5">
          <Input
            label={t("Dan")}
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
          />
          <Input
            label={t("Gacha")}
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
          />
          <Select
            label={t("Bo'lim")}
            value={filters.entity}
            onChange={(e) => setFilters((prev) => ({ ...prev, entity: e.target.value }))}
            options={[
              { value: "", label: t("Barchasi") },
              { value: "products", label: t("Mahsulotlar") },
              { value: "users", label: t("Ishchilar") },
              { value: "warehouse", label: t("Omborxona") },
              { value: "inventory", label: t("Reviziya") },
              { value: "sales", label: t("Sotuv") },
            ]}
          />
          <Select
            label={t("Ishchilar")}
            value={filters.userId}
            onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
            disabled={user?.role !== "ADMIN"}
            options={[
              { value: "", label: t("Barchasi") },
              ...users.map((u) => ({ value: u.id, label: u.username })),
            ]}
          />
          <Select
            label={t("Harakat")}
            value={filters.action}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, action: e.target.value }));
              setPage(1);
            }}
            options={[
              { value: "", label: t("Barchasi") },
              { value: "create", label: t("Yaratish") },
              { value: "update", label: t("O'zgartirish") },
              { value: "delete", label: t("O'chirish") },
            ]}
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="py-8 text-center text-cocoa-600 italic">{t("Yuklanmoqda...")}</div>
        ) : (
          <Table>
            <T>
              <thead>
                <tr>
                  <th>{t("Vaqt")}</th>
                  <th>{t("Ishchi")}</th>
                  <th>{t("Harakat")}</th>
                  <th>{t("Bo'lim")}</th>
                  <th>ID</th>
                  <th>{t("Batafsil")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr className={expandedId === log.id ? "bg-cream-50/30" : ""}>
                      <td className="text-xs text-cocoa-500 whitespace-nowrap">{formatTimestamp(log.createdAt)}</td>
                      <td className="font-medium text-cocoa-900">{log.user?.username ?? "-"}</td>
                      <td>{getActionBadge(log.action)}</td>
                      <td className="text-cocoa-600 text-xs">{log.entity}</td>
                      <td className="text-cocoa-400 font-mono text-[10px]">{resolveEntityId(log)}</td>
                      <td className="text-right flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          onClick={() => setExpandedId((prev) => (prev === log.id ? null : log.id))}
                        >
                          {expandedId === log.id ? "↑" : "↓"}
                        </Button>
                        {user?.role === "ADMIN" && (
                          <>
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(log);
                              }}
                            >
                              ✎
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(t("Haqiqatan ham ushbu yozuvni o'chirmoqchimisiz?"))) return;
                                try {
                                  setLoading(true);
                                  await auditService.remove(log.id);
                                  toast.success(t("O'chirildi"));
                                  refresh();
                                } catch {
                                  toast.error(t("Xatolik"));
                                  setLoading(false);
                                }
                              }}
                            >
                              ×
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id ? (
                      <tr>
                        <td colSpan={6} className="bg-cream-50/50 p-4">
                          <div className="rounded-2xl border border-cream-200/70 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex justify-between gap-4 border-b border-cream-100 pb-2 text-xs">
                              <div>
                                <span className="text-cocoa-500">{t("Yo'nalish")}:</span>{" "}
                                <span className="font-mono text-berry-800">{log.method} {log.path}</span>
                              </div>
                              <div>
                                <span className="text-cocoa-500">{t("Status")}:</span>{" "}
                                <Badge tone={log.meta?.statusCode < 400 ? "primary" : "neutralHighlight" as any}>
                                  {log.meta?.statusCode ?? "-"}
                                </Badge>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-cocoa-400">{t("Yuborilgan ma'lumot (Payload)")}</div>
                                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-cocoa-50 p-3 font-mono text-[10px] text-cocoa-700">
                                  {JSON.stringify(log.meta?.body ?? {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-cocoa-400">{t("Natija (Response)")}</div>
                                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-cocoa-50 p-3 font-mono text-[10px] text-cocoa-700">
                                  {JSON.stringify(log.meta?.result ?? {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-cocoa-400">
                      {t("Hech qanday harakat topilmadi.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </T>
          </Table>
        )}

        {total > take && (
          <div className="mt-4 flex items-center justify-between border-t border-cream-100 pt-4 px-4 pb-4">
            <div className="text-xs text-cocoa-500">
              {t("Jami {total} tadan {from}-{to} ko'rsatilmoqda", {
                total,
                from: (page - 1) * take + 1,
                to: Math.min(page * take, total)
              })}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="px-3 py-1 text-xs"
                disabled={page === 1 || loading}
                onClick={() => setPage(p => p - 1)}
              >
                {t("Oldingi")}
              </Button>
              <Button
                variant="ghost"
                className="px-3 py-1 text-xs"
                disabled={page * take >= total || loading}
                onClick={() => setPage(p => p + 1)}
              >
                {t("Keyingi")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t("Tahrirlash (Meta)")}>
        <form onSubmit={handleEdit} className="space-y-4">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={10}
            className="font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>{t("Bekor qilish")}</Button>
            <Button type="submit">{t("Saqlash")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function resolveEntityId(log: AuditLog) {
  if (log.entityId) return log.entityId;
  const metaId = log.meta?.result?.id ?? log.meta?.resultId;
  return typeof metaId === "string" ? metaId : "-";
}
