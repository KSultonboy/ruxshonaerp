"use client";

import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import s from "./ToastProvider.module.scss";

type ToastVariant = "success" | "error" | "info";

type ToastAction = {
    label: string;
    onClick: () => void | Promise<void>;
};

type ToastItem = {
    id: string;
    title: string;
    description?: string;
    variant: ToastVariant;
    action?: ToastAction;
    duration?: number; // ms
};

type ToastAPI = {
    toast: (t: Omit<ToastItem, "id">) => void;
    success: (title: string, description?: string, action?: ToastAction) => void;
    error: (title: string, description?: string, action?: ToastAction) => void;
    info: (title: string, description?: string, action?: ToastAction) => void;
};

const ToastContext = createContext<ToastAPI | null>(null);

function uid() {
    return `t_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const timers = useRef<Map<string, number>>(new Map());

    function remove(id: string) {
        const t = timers.current.get(id);
        if (t) window.clearTimeout(t);
        timers.current.delete(id);
        setItems((prev) => prev.filter((x) => x.id !== id));
    }

    function addToast(t: Omit<ToastItem, "id">) {
        const id = uid();
        const toast: ToastItem = {
            id,
            duration: 3500,
            ...t,
        };

        setItems((prev) => [toast, ...prev].slice(0, 5));

        const timeout = window.setTimeout(() => remove(id), toast.duration);
        timers.current.set(id, timeout);
    }

    const api = useMemo<ToastAPI>(
        () => ({
            toast: addToast,
            success: (title, description, action) =>
                addToast({ title, description, action, variant: "success" }),
            error: (title, description, action) =>
                addToast({ title, description, action, variant: "error", duration: 5000 }),
            info: (title, description, action) =>
                addToast({ title, description, action, variant: "info" }),
        }),
        []
    );

    return (
        <ToastContext.Provider value={api}>
            {children}

            <div className={s.viewport} aria-live="polite" aria-relevant="additions removals">
                {items.map((t) => (
                    <div key={t.id} className={`${s.toast} ${s[t.variant]}`}>
                        <div className={s.icon}>
                            {t.variant === "success" ? "✅" : t.variant === "error" ? "❌" : "ℹ️"}
                        </div>

                        <div className={s.content}>
                            <div className={s.title}>{t.title}</div>
                            {t.description ? <div className={s.desc}>{t.description}</div> : null}
                        </div>

                        <div className={s.actions}>
                            {t.action ? (
                                <button
                                    className={s.actionBtn}
                                    onClick={async () => {
                                        try {
                                            await t.action?.onClick();
                                        } finally {
                                            remove(t.id);
                                        }
                                    }}
                                >
                                    {t.action.label}
                                </button>
                            ) : null}

                            <button className={s.closeBtn} onClick={() => remove(t.id)} aria-label="Close">
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast() must be used inside <ToastProvider />");
    return ctx;
}
