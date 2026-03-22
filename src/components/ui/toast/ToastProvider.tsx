"use client";

import React, { createContext, useContext, useMemo, useRef, useState } from "react";

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
  duration?: number;
};

type ToastAPI = {
  toast: (t: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string, action?: ToastAction) => void;
  error: (title: string, description?: string, action?: ToastAction) => void;
  info: (title: string, description?: string, action?: ToastAction) => void;
};

const ToastContext = createContext<ToastAPI | null>(null);

const variantStyles: Record<
  ToastVariant,
  { wrap: string; icon: string; iconText: string }
> = {
  success: {
    wrap: "border-emerald-200/70 bg-emerald-50/80 text-emerald-900",
    icon: "bg-emerald-600 text-white",
    iconText: "OK",
  },
  error: {
    wrap: "border-rose-200/70 bg-rose-50/80 text-rose-900",
    icon: "bg-rose-600 text-white",
    iconText: "!",
  },
  info: {
    wrap: "border-cream-200/70 bg-white/85 text-cocoa-900",
    icon: "bg-berry-700 text-cream-50",
    iconText: "i",
  },
};

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
      success: (title, description, action) => addToast({ title, description, action, variant: "success" }),
      error: (title, description, action) =>
        addToast({ title, description, action, variant: "error", duration: 5000 }),
      info: (title, description, action) => addToast({ title, description, action, variant: "info" }),
    }),
    []
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        className="fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-3"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {items.map((t) => {
          const styles = variantStyles[t.variant];
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 shadow-card backdrop-blur motion-safe:animate-fade-up ${styles.wrap}`}
            >
              <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${styles.icon}`}>
                {styles.iconText}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.description ? <div className="mt-1 text-xs opacity-80">{t.description}</div> : null}
              </div>

              <div className="flex items-center gap-2">
                {t.action ? (
                  <button
                    className="rounded-full border border-cream-200/70 bg-white/70 px-3 py-1 text-xs font-semibold text-cocoa-700 hover:bg-cream-100/80"
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

                <button
                  className="rounded-full px-2 py-1 text-xs font-semibold text-cocoa-500 hover:text-cocoa-800"
                  onClick={() => remove(t.id)}
                  aria-label="Close"
                >
                  X
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used inside <ToastProvider />");
  return ctx;
}
