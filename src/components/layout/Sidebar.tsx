"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import s from "./Sidebar.module.scss";

const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/products", label: "Katalog" },
    { href: "/expenses", label: "Xarajatlar" },
    { href: "/settings/categories", label: "Kategoriyalar" },
    { href: "/settings/units", label: "O‘lchov birliklari" },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className={s.sidebar}>
            <div className={s.brand}>
                <Logo />
                <div className={s.brandText}>
                    <div className={s.title}>RuxshonaERP</div>
                    <div className={s.subtitle}>Katalog & Xarajat (UI)</div>
                </div>
            </div>

            <nav className={s.nav}>
                {nav.map((item) => {
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${s.link} ${active ? s.active : ""}`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className={s.footer}>
                <div className={s.note}>
                    Theme: <span>to‘q qizil</span> + <span>krem</span>
                </div>
            </div>
        </aside>
    );
}
