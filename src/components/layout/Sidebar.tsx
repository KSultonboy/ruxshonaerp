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

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

type NavGroup = {
  key: string;
  label: string;
  icon: NavIcon;
  items: NavItem[];
};

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Chevron = ({ open, active }: { open: boolean; active: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-4 w-4 transition ${open ? "rotate-180" : ""} ${active ? "text-cream-50" : "text-cocoa-400"}`}
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

function getGroupsForRole(role: "ADMIN" | "SALES" | "PRODUCTION", t: (key: string) => string): NavGroup[] {
  if (role === "SALES") {
    return [
      {
        key: "sales",
        label: t("Sotuv"),
        icon: "orders",
        items: [
          { href: "/sales/sell", label: t("Kassaga kirish"), icon: "orders" },
          { href: "/sales/cashier", label: t("Kassa"), icon: "cash" },
          { href: "/sales/stock", label: t("Omborxona"), icon: "warehouse" },
          { href: "/sales/receive", label: t("Qabul qilish"), icon: "transfer" },
          { href: "/sales/returns", label: t("Vazvrat"), icon: "return" },
          { href: "/sales/photos", label: t("Do'kon rasmlari"), icon: "camera" },
          { href: "/sales/shift", label: t("Smena"), icon: "shift" },
        ],
      },
    ];
  }

  if (role === "PRODUCTION") {
    return [
      {
        key: "production",
        label: t("Ishlab chiqarish"),
        icon: "warehouse",
        items: [
          { href: "/warehouse", label: t("Markaziy ombor"), icon: "warehouse" },
          { href: "/production/entry", label: t("Ishlab chiqarilgan mahsulot kiritish"), icon: "add" },
          { href: "/production/history", label: t("Tarix"), icon: "report" },
          { href: "/transfer/branches", label: t("Filiallarga transfer"), icon: "transfer" },
          { href: "/transfer/shops", label: t("Do'konlarga transfer"), icon: "transfer" },
        ],
      },
    ];
  }

  return [
    {
      key: "dashboard",
      label: t("Dashboard"),
      icon: "dashboard",
      items: [
        { href: "/", label: t("Asosiy panel"), icon: "dashboard" },
        { href: "/dashboard/branches", label: t("Filiallar"), icon: "branch" },
        { href: "/dashboard/shops", label: t("Do'konlar"), icon: "shop" },
        { href: "/dashboard/branches/photos", label: t("Filial rasmlari"), icon: "camera" },
        { href: "/reports", label: t("Hisobotlar"), icon: "report" },
        { href: "/wages", label: t("Ish haqi"), icon: "report" },
      ],
    },
    {
      key: "catalog",
      label: t("Katalog"),
      icon: "products",
      items: [
        { href: "/products", label: t("Mahsulotlar"), icon: "products" },
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
        { href: "/cash/branches", label: t("Filiallardan olish"), icon: "branch" },
        { href: "/cash/shops", label: t("Do'konlardan olish"), icon: "shop" },
        { href: "/expenses?new=1", label: t("Xarajat kiritish"), icon: "expenses" },
        { href: "/expenses", label: t("Xarajatlar"), icon: "expenses" },
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
      label: t("Buyurtmalar"),
      icon: "orders",
      items: [
        { href: "/orders/receive", label: t("Buyurtmani qabul qilish"), icon: "orders" },
        { href: "/orders/delivery", label: t("Yetkazib berish"), icon: "orders" },
      ],
    },
    {
      key: "website",
      label: t("Website"),
      icon: "website",
      items: [
        { href: "/platforms/website/dashboard", label: t("Statistika"), icon: "report" },
        { href: "/platforms/website/customers", label: t("Mijozlar"), icon: "users" },
        { href: "/platforms/website/custom-requests", label: t("Maxsus so'rovlar"), icon: "add" },
        { href: "/platforms/website/coupons", label: t("Kuponlar"), icon: "categories" },
        { href: "/platforms/website", label: t("Sozlamalar"), icon: "settings" },
      ],
    },
    {
      key: "platforms",
      label: t("Platformalar"),
      icon: "platform",
      items: [
        { href: "/platforms/telegram", label: t("Telegram bot"), icon: "telegram" },
        { href: "/platforms/mobile", label: t("Mobile app"), icon: "mobile" },
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
      const active = group.items.some((item) => isItemActive(pathname, searchParams, item.href));
      map.set(group.key, active);
    }
    return map;
  }, [groups, pathname, searchParams]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const group of groups) {
        if (next[group.key] === undefined) {
          next[group.key] = groupIsActive.get(group.key) ?? false;
        }
      }
      return next;
    });
  }, [groups, groupIsActive]);

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

  const itemClass = (active: boolean) =>
    `group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-[13px] font-semibold leading-tight transition sm:px-4 sm:text-sm ${
      active
        ? "border-berry-600 bg-berry-700 text-cream-50 shadow-glow"
        : "border-transparent text-cocoa-600 hover:border-cream-200 hover:bg-cream-100/70 hover:text-cocoa-800"
    }`;

  const groupClass = (active: boolean) =>
    `group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-[13px] font-semibold transition sm:px-4 sm:text-sm ${
      active
        ? "border-berry-600 bg-berry-700 text-cream-50 shadow-glow"
        : "border-cream-200 bg-cream-100 text-cocoa-700 hover:border-berry-200 hover:bg-cream-200/80"
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-cocoa-900/40 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col border-r border-cream-200/70 bg-cream-50/95 backdrop-blur transition-transform lg:static lg:w-64 lg:max-w-none lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-4 lg:px-6 lg:py-6">
            <div className="flex items-center gap-3">
              <Logo />
              <div>
                <div className="font-display text-base font-semibold text-cocoa-900 sm:text-lg">RuxshonaERP</div>
                <div className="text-xs text-cocoa-600">{t("Tort do'koni")}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl border border-cream-200 p-2 text-cocoa-500 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 lg:px-6">
            <div className="flex flex-col gap-3">
              {groups.map((group) => {
                const active = groupIsActive.get(group.key) ?? false;
                const open = openGroups[group.key] ?? active;

                return (
                  <div key={group.key} className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !open }))}
                      className={groupClass(active)}
                      aria-expanded={open}
                    >
                      <Icon name={group.icon} className={active ? "opacity-100" : "opacity-70"} />
                      <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                      {group.key === "orders" && websiteIncomingCount > 0 ? (
                        <span className="rounded-full bg-cream-50 px-2 py-0.5 text-[11px] font-bold text-berry-700">
                          {websiteIncomingCount}
                        </span>
                      ) : null}
                      <Chevron open={open} active={active} />
                    </button>

                    {open && (
                      <div className="ml-2 flex flex-col gap-1 motion-safe:animate-fade-up">
                        {group.items.map((item) => {
                          const activeItem = isItemActive(pathname, searchParams, item.href);
                          return (
                            <Link key={item.href} href={item.href} prefetch={false} className={itemClass(activeItem)}>
                              <Icon name={item.icon} className={activeItem ? "opacity-100" : "opacity-70"} />
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              {item.href === "/orders/receive" && websiteIncomingCount > 0 ? (
                                <span className="rounded-full bg-cream-50 px-2 py-0.5 text-[11px] font-bold text-berry-700">
                                  {websiteIncomingCount}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    )}
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
