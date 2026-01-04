"use client";

import { useEffect } from "react";
import s from "./Modal.module.scss";
import Button from "./Button";

export default function Modal({
    title,
    open,
    onClose,
    children,
}: {
    title: string;
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className={s.backdrop}
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                // faqat fon bosilganda yopilsin
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={s.modal}>
                <div className={s.head}>
                    <div className={s.title}>{title}</div>
                    <Button variant="ghost" onClick={onClose}>
                        ✕
                    </Button>
                </div>
                <div className={s.body}>{children}</div>
            </div>
        </div>
    );
}
