"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-cocoa-900/40 px-4 py-4 backdrop-blur-sm motion-safe:animate-fade-in sm:px-6 sm:py-8"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="my-auto flex w-full max-w-2xl animate-fade-up flex-col overflow-hidden rounded-3xl border border-cream-200/80 bg-cream-50/95 p-5 shadow-card max-h-[calc(100vh-2rem)] sm:max-h-[85vh]">
        <div className="flex items-center justify-between gap-4 border-b border-cream-200/80 pb-3">
          <div className="font-display text-lg font-semibold text-cocoa-900">{title}</div>
          <Button variant="ghost" onClick={onClose} className="px-3 py-1.5 text-xs">
            X
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4 pr-1">{children}</div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
