"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Logo from "./Logo";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { normalizeUserRole } from "@/lib/roles";
import { ordersService } from "@/services/orders";

type NavIcon =
  | "dashboard"
  | "warehouse"
  | "products"
  | "add"
  | "categories"
  | "units"
  | "cash"
  | "expenses"
  | "transfer"
  | "return"
  | "orders"
  | "report"
  | "camera"
  | "users"
  | "settings"
  | "website"
  | "telegram"
  | "mobile"
  | "shop"
  | "branch"
  | "shift"
  | "platform"
  | "qr";

type NavLink = {
  href: string;
  label: string;
  icon: NavIcon;
};

type NavSection = {
  type: "section";
  key: string;
  label: string;
  icon: NavIcon;
  items: NavEntry[];
};

type NavEntry = NavLink | NavSection;

type NavGroup = {
  key: string;
  label: string;
  icon: NavIcon;
  items: NavEntry[];
};

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Chevron = ({ open, inverted = false }: { open: boolean; inverted?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""} ${inverted ? "text-white" : "text-slate-500"}`}
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Icon = ({ name, className = "" }: { name: NavIcon; className?: string }) => {
  const base = `h-4 w-4 ${className}`;
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M3 13h8v8H3zM13 3h8v8h-8zM13 13h8v8h-8zM3 3h8v8H3z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "warehouse":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M3 10 12 4l9 6v10H3z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 21v-6h6v6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "products":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M4 7h16v13H4zM7 4h10v3H7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "add":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "categories":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "units":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M5 7h14M7 7l-2 10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2l-2-10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "cash":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M3 7h18v10H3z" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "expenses":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M5 7h14v12H5zM8 5h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "transfer":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M7 7h10m0 0-3-3m3 3-3 3M17 17H7m0 0 3-3m-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "return":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M7 7H4v3m0-3 4 4m-4-4h9a6 6 0 1 1 0 12h-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "orders":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M7 4h10l1 3v13H6V7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 11h6M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M4 19h16M7 16v-5m5 5v-9m5 9v-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M5 8h14v11H5zM9 6h6" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="13.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M8.5 11.5a3.5 3.5 0 1 0-3.5-3.5 3.5 3.5 0 0 0 3.5 3.5Zm7 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3.5 19a5 5 0 0 1 10 0m1.5 0a4 4 0 0 1 5.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M12 8.5a3.5 3.5 0 1 0 3.5 3.5A3.5 3.5 0 0 0 12 8.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M4 12a8 8 0 0 1 .2-1.8l2.2-.4.7-1.7-1.3-1.8A8 8 0 0 1 7.8 4l1.8 1.3 1.7-.7.4-2.2A8 8 0 0 1 12 4a8 8 0 0 1 1.8.2l.4 2.2 1.7.7 1.8-1.3A8 8 0 0 1 20 7.8l-1.3 1.8.7 1.7 2.2.4A8 8 0 0 1 20 12a8 8 0 0 1-.2 1.8l-2.2.4-.7 1.7 1.3 1.8A8 8 0 0 1 16.2 20l-1.8-1.3-1.7.7-.4 2.2A8 8 0 0 1 12 20a8 8 0 0 1-1.8-.2l-.4-2.2-1.7-.7-1.8 1.3A8 8 0 0 1 4 16.2l1.3-1.8-.7-1.7-2.2-.4A8 8 0 0 1 4 12Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case "website":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 0c3 3.5 3 14 0 18m0-18c-3 3.5-3 14 0 18M3 12h18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "telegram":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M4 12 20 4l-3 16-5-4-4 3 1-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "mobile":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <rect x="7" y="3" width="10" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M11 17h2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "shop":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M4 9h16l-1-4H5l-1 4Zm1 0v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "branch":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M4 10 12 4l8 6v9a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "shift":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "platform":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M4 6h8v8H4zM12 10h8v8h-8z" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "qr":
      return (
        <svg viewBox="0 0 24 24" className={base} aria-hidden>
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M14 14h3v3h-3z" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    default:
      return null;
  }
};

function isItemActive(pathname: string, query: URLSearchParams, href: string): boolean {
  const [targetPath, targetQueryString] = href.split("?");
  if (pathname !== targetPath) return false;
  if (!targetQueryString) return true;

  const targetQuery = new URLSearchParams(targetQueryString);
  for (const [key, value] of targetQuery.entries()) {
    if (query.get(key) !== value) return false;
  }
  return true;
}

function isNavSection(entry: NavEntry): entry is NavSection {
  return "type" in entry && entry.type === "section";
}

function isEntryActive(pathname: string, query: URLSearchParams, entry: NavEntry): boolean {
  if (isNavSection(entry)) {
    return entry.items.some((child) => isEntryActive(pathname, query, child));
  }
  return isItemActive(pathname, query, entry.href);
}

function getGroupsForRole(
  role: "ADMIN" | "SALES" | "MANAGER" | "PRODUCTION",
  t: (key: string) => string
): NavGroup[] {
  const productionGroup: NavGroup = {
    key: "production",
    label: t("Ishlab chiqarish"),
    icon: "warehouse",
    items: [
      { href: "/production/entry", label: t("Ishlab chiqarish kiritish"), icon: "add" },
      { href: "/warehouse", label: t("Markaziy ombor"), icon: "warehouse" },
      { href: "/production/history", label: t("Tarix"), icon: "report" },
    ],
  };

  if (role === "SALES" || role === "MANAGER") {
    const salesAndLogistics: NavGroup[] = [
      {
        key: "sales",
        label: t("Sotuv"),
        icon: "orders",
        items: [
          { href: "/sales/sell", label: t("Kassaga kirish"), icon: "orders" },
          { href: "/sales/cashier", label: t("Kassa"), icon: "cash" },
          { href: "/sales/orders", label: t("Buyurtmalar"), icon: "orders" },
          { href: "/sales/stock", label: t("Omborxona"), icon: "warehouse" },
          { href: "/sales/receive", label: t("Qabul qilish"), icon: "transfer" },
          { href: "/sales/returns", label: t("Vazvrat"), icon: "return" },
          { href: "/sales/photos", label: t("Do'kon rasmlari"), icon: "camera" },
          { href: "/sales/shift", label: t("Smena"), icon: "shift" },
        ],
      },
      {
        key: "logistics",
        label: t("Transfer va vazvrat"),
        icon: "transfer",
        items: [
          { href: "/transfer/branches", label: t("Filiallarga transfer"), icon: "transfer" },
          { href: "/transfer/shops", label: t("Do'konlarga transfer"), icon: "transfer" },
          { href: "/returns/branches", label: t("Filial vazvrat"), icon: "return" },
          { href: "/returns/shops", label: t("Do'kon vazvrat"), icon: "return" },
        ],
      },
    ];
    return role === "MANAGER" ? [...salesAndLogistics, productionGroup] : salesAndLogistics;
  }

  if (role === "PRODUCTION") {
    return [productionGroup];
  }

  return [
    {
      key: "dashboard",
      label: t("Dashboard"),
      icon: "dashboard",
      items: [
        { href: "/", label: t("Asosiy panel"), icon: "dashboard" },
        { href: "/shifts", label: t("Smenalar va rasmlar"), icon: "shift" },
        { href: "/wages", label: t("Ish haqi"), icon: "report" },
        { href: "/reports", label: t("Batafsil hisobot"), icon: "report" },
      ],
    },
    {
      key: "catalog",
      label: t("Katalog"),
      icon: "products",
      items: [
        { href: "/products", label: t("Mahsulotlar"), icon: "products" },
        { href: "/products/formal", label: t("Formal nomlar"), icon: "platform" },
        { href: "/products?new=1", label: t("Mahsulot qo'shish"), icon: "add" },
        { href: "/products/categories", label: t("Kategoriyalar"), icon: "categories" },
        { href: "/products/units", label: t("Birliklar"), icon: "units" },
        { href: "/ikpu", label: t("IKPU"), icon: "qr" },
        { href: "/warehouse", label: t("Omborxona"), icon: "warehouse" },
        { href: "/warehouse/inventory", label: t("Inventarizatsiya"), icon: "qr" },
      ],
    },
    {
      key: "money",
      label: t("Kassa va xarajat"),
      icon: "cash",
      items: [
        { href: "/sales/journal", label: t("Kassa jurnali"), icon: "cash" },
        { href: "/cash/branches", label: t("Filiallardan olish"), icon: "branch" },
        { href: "/cash/shops", label: t("Do'konlardan olish"), icon: "shop" },
        { href: "/expenses?new=1", label: t("Xarajat kiritish"), icon: "expenses" },
        { href: "/expenses", label: t("Xarajatlar"), icon: "expenses" },
        { href: "/expenses/items", label: t("Xarajat nomlari"), icon: "categories" },
      ],
    },
    {
      key: "logistics",
      label: t("Transfer va vazvrat"),
      icon: "transfer",
      items: [
        { href: "/transfer/branches", label: t("Filiallarga transfer"), icon: "transfer" },
        { href: "/transfer/shops", label: t("Do'konlarga transfer"), icon: "transfer" },
        { href: "/returns/branches", label: t("Filial vazvrat"), icon: "return" },
        { href: "/returns/shops", label: t("Do'kon vazvrat"), icon: "return" },
      ],
    },
    {
      key: "orders",
      label: t("Platformalar"),
      icon: "platform",
      items: [
        { href: "/orders", label: t("Buyurtmalar"), icon: "orders" },
        {
          type: "section",
          key: "website",
          label: t("Website"),
          icon: "website",
          items: [
            { href: "/platforms/website/dashboard", label: t("Analitika"), icon: "report" },
            { href: "/platforms/website/customers", label: t("Mijozlar"), icon: "users" },
          ],
        },
        {
          type: "section",
          key: "telegram",
          label: t("Telegram bot"),
          icon: "telegram",
          items: [
            { href: "/platforms/telegram/dashboard", label: t("Analitika"), icon: "report" },
            { href: "/platforms/telegram/users", label: t("Cashback userlar"), icon: "users" },
            { href: "/platforms/telegram/broadcast", label: t("Broadcast"), icon: "telegram" },
          ],
        },
        {
          type: "section",
          key: "mobile",
          label: t("Mobile app"),
          icon: "mobile",
          items: [
            { href: "/platforms/mobile/customers", label: t("Mijozlar"), icon: "users" },
          ],
        },
      ],
    },
    {
      key: "management",
      label: t("Boshqaruv"),
      icon: "users",
      items: [
        { href: "/settings/branches", label: t("Filiallar"), icon: "branch" },
        { href: "/settings/shops", label: t("Do'konlar"), icon: "shop" },
        { href: "/settings/users", label: t("Ishchilar"), icon: "users" },
        { href: "/settings/permissions", label: t("Ruxsatlar"), icon: "users" },
      ],
    },
    {
      key: "settings",
      label: t("Sozlamalar"),
      icon: "settings",
      items: [
        { href: "/settings/categories", label: t("Kategoriyalar sozlamasi"), icon: "categories" },
        { href: "/settings/alerts", label: t("Alertlar"), icon: "report" },
        { href: "/settings/receipt", label: t("Chek/Barcode shabloni"), icon: "report" },
        { href: "/settings/audit", label: t("Audit log"), icon: "report" },
      ],
    },
  ];
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useI18n();

  const role = normalizeUserRole(user?.role) ?? "ADMIN";
  const groups = useMemo(() => getGroupsForRole(role, t), [role, t]);
  const [websiteIncomingCount, setWebsiteIncomingCount] = useState(0);

  const groupIsActive = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const group of groups) {
      const active = group.items.some((item) => isEntryActive(pathname, searchParams, item));
      map.set(group.key, active);
    }
    return map;
  }, [groups, pathname, searchParams]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      const ensureNestedKeys = (groupKey: string, entries: NavEntry[], parentKey = "") => {
        for (const entry of entries) {
          if (!isNavSection(entry)) continue;
          const stateKey = [groupKey, parentKey, entry.key].filter(Boolean).join(":");
          if (next[stateKey] === undefined) {
            next[stateKey] = isEntryActive(pathname, searchParams, entry);
          }
          ensureNestedKeys(groupKey, entry.items, [parentKey, entry.key].filter(Boolean).join(":"));
        }
      };

      for (const group of groups) {
        if (next[group.key] === undefined) {
          next[group.key] = groupIsActive.get(group.key) ?? false;
        }
        ensureNestedKeys(group.key, group.items);
      }
      return next;
    });
  }, [groups, groupIsActive, pathname, searchParams]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  useEffect(() => {
    if (role !== "ADMIN") {
      setWebsiteIncomingCount(0);
      return;
    }

    let active = true;
    const refreshOrders = async () => {
      try {
        const orders = await ordersService.list();
        if (!active) return;
        const count = orders.filter((order) => order.status === "NEW" && (order.source || "").toUpperCase() === "WEBSITE").length;
        setWebsiteIncomingCount(count);
      } catch {
        if (active) setWebsiteIncomingCount(0);
      }
    };

    void refreshOrders();
    const timer = window.setInterval(() => void refreshOrders(), 25000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [role]);

  const itemClass = (active: boolean, nested = false) =>
    `group flex w-full items-center gap-3 rounded-xl border px-3 font-semibold leading-tight transition ${
      nested ? "py-2 text-[12px] sm:px-3 sm:text-[13px]" : "py-2 text-[13px] sm:px-4 sm:text-sm"
    } ${
      active
        ? "border-berry-700 bg-berry-700 text-white shadow-glow-sm"
        : "border-transparent text-slate-400 hover:border-slate-700/50 hover:bg-slate-800/60 hover:text-slate-100"
    }`;

  const groupClass = (active: boolean) =>
    `group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition sm:px-4 sm:text-sm ${
      active
        ? "border-berry-700 bg-berry-700 text-white shadow-glow-sm"
        : "border-slate-700/40 bg-slate-800/50 text-slate-300 hover:border-berry-800/60 hover:bg-slate-700/60 hover:text-slate-100"
    }`;

  const sectionClass = (active: boolean, nested = false) =>
    `group flex w-full items-center gap-3 rounded-xl border px-3 font-semibold transition ${
      nested ? "py-2 text-[12px] sm:px-3 sm:text-[13px]" : "py-2 text-[13px] sm:px-4 sm:text-sm"
    } ${
      active
        ? "border-slate-700/50 bg-slate-800 text-slate-100"
        : "border-transparent text-slate-400 hover:border-slate-700/40 hover:bg-slate-800/40 hover:text-slate-200"
    }`;

  const renderEntries = (entries: NavEntry[], groupKey: string, depth = 0, parentKey = "") => (
    <div
      className={`flex flex-col gap-0.5 motion-safe:animate-fade-up ${
        depth === 0 ? "ml-1" : "ml-3 border-l border-slate-700/60 pl-3"
      }`}
    >
      {entries.map((entry) => {
        if (isNavSection(entry)) {
          const stateKey = [groupKey, parentKey, entry.key].filter(Boolean).join(":");
          const activeEntry = isEntryActive(pathname, searchParams, entry);
          const openEntry = openGroups[stateKey] ?? activeEntry;
          const nextParentKey = [parentKey, entry.key].filter(Boolean).join(":");

          return (
            <div key={stateKey} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [stateKey]: !openEntry }))}
                className={sectionClass(activeEntry, depth > 0)}
                aria-expanded={openEntry}
              >
                <Icon name={entry.icon} className="opacity-70" />
                <span className="min-w-0 flex-1 truncate text-left">{entry.label}</span>
                <Chevron open={openEntry} />
              </button>
              {openEntry ? renderEntries(entry.items, groupKey, depth + 1, nextParentKey) : null}
            </div>
          );
        }

        const activeItem = isItemActive(pathname, searchParams, entry.href);
        return (
          <Link key={entry.href} href={entry.href} prefetch={false} className={itemClass(activeItem, depth > 0)}>
            <Icon name={entry.icon} className={activeItem ? "opacity-100" : "opacity-70"} />
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            {entry.href === "/orders/receive" && websiteIncomingCount > 0 ? (
              <span className="rounded-full bg-berry-700 px-2 py-0.5 text-[11px] font-bold text-white">
                {websiteIncomingCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[300px] flex-col border-r border-slate-700/60 bg-slate-900 transition-transform lg:static lg:w-60 lg:max-w-none lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-4 lg:px-5 lg:py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-berry-700 text-white shadow-glow-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-white">RuxshonaERP</div>
                <div className="text-[11px] text-slate-400">{t("Tort do'koni")}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-slate-700/60 p-1.5 text-slate-400 hover:text-slate-200 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-6 pt-3 lg:px-4">
            <div className="flex flex-col gap-2">
              {groups.map((group) => {
                const active = groupIsActive.get(group.key) ?? false;
                const open = openGroups[group.key] ?? active;

                return (
                  <div key={group.key} className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenGroups((prev) => ({ ...prev, [group.key]: !open }));
                      }}
                      className={groupClass(active)}
                      aria-expanded={open}
                    >
                      <Icon name={group.icon} className={active ? "opacity-100" : "opacity-60"} />
                      <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                      {group.key === "orders" && websiteIncomingCount > 0 ? (
                        <span className="rounded-full bg-berry-700 px-2 py-0.5 text-[11px] font-bold text-white">
                          {websiteIncomingCount}
                        </span>
                      ) : null}
                      <Chevron open={open} inverted={active} />
                    </button>

                    {open ? renderEntries(group.items, group.key) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
