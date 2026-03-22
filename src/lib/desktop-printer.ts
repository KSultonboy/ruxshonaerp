"use client";

export type PrinterMode = "LABEL" | "RECEIPT";

function storageKey(mode: PrinterMode) {
  return `PRINTER_${mode}`;
}

export function saveStoredPrinter(mode: PrinterMode, printerName: string) {
  try {
    localStorage.setItem(storageKey(mode), printerName);
  } catch {
    // ignore storage errors
  }
}

export function loadStoredPrinter(mode: PrinterMode) {
  try {
    return localStorage.getItem(storageKey(mode)) || "";
  } catch {
    return "";
  }
}

async function invokeTauri<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke<T>(cmd, args);
}

function isTauriRuntime() {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

function isolateElementForPrint(target: HTMLElement): () => void {
  const restoreSteps: Array<() => void> = [];
  let current: HTMLElement | null = target;

  while (current && current !== document.body) {
    const parent = current.parentElement;
    if (!parent) break;

    for (const sibling of Array.from(parent.children)) {
      if (sibling === current || !(sibling instanceof HTMLElement)) continue;
      const prevDisplay = sibling.style.display;
      sibling.style.display = "none";
      restoreSteps.push(() => {
        sibling.style.display = prevDisplay;
      });
    }

    const prevParentPosition = parent.style.position;
    const prevParentHeight = parent.style.height;
    const prevParentMinHeight = parent.style.minHeight;
    const prevParentMaxHeight = parent.style.maxHeight;
    const prevParentOverflow = parent.style.overflow;
    const prevParentTransform = parent.style.transform;
    const prevParentPadding = parent.style.padding;

    parent.style.position = "static";
    parent.style.height = "auto";
    parent.style.minHeight = "0";
    parent.style.maxHeight = "none";
    parent.style.overflow = "visible";
    parent.style.transform = "none";
    parent.style.padding = "0";

    restoreSteps.push(() => {
      parent.style.position = prevParentPosition;
      parent.style.height = prevParentHeight;
      parent.style.minHeight = prevParentMinHeight;
      parent.style.maxHeight = prevParentMaxHeight;
      parent.style.overflow = prevParentOverflow;
      parent.style.transform = prevParentTransform;
      parent.style.padding = prevParentPadding;
    });

    current = parent as HTMLElement;
  }

  const prevPosition = target.style.position;
  const prevLeft = target.style.left;
  const prevTop = target.style.top;
  const prevZIndex = target.style.zIndex;
  const prevBackground = target.style.background;
  const prevMargin = target.style.margin;
  const prevTransform = target.style.transform;

  target.style.position = "static";
  target.style.left = "0";
  target.style.top = "0";
  target.style.zIndex = "1";
  target.style.background = "#fff";
  target.style.margin = "0";
  target.style.transform = "none";

  restoreSteps.push(() => {
    target.style.position = prevPosition;
    target.style.left = prevLeft;
    target.style.top = prevTop;
    target.style.zIndex = prevZIndex;
    target.style.background = prevBackground;
    target.style.margin = prevMargin;
    target.style.transform = prevTransform;
  });

  return () => {
    for (let i = restoreSteps.length - 1; i >= 0; i -= 1) {
      restoreSteps[i]();
    }
  };
}

export function getSuggestedPrinterForMode(mode: PrinterMode, printers: string[]) {
  const normalized = printers.map((printer) => ({ raw: printer, low: printer.toLowerCase() }));

  if (mode === "LABEL") {
    return (
      normalized.find((item) => item.low.includes("rux_label"))?.raw ||
      normalized.find((item) => item.low.includes("xp-245"))?.raw ||
      normalized.find((item) => item.low.includes("xp245"))?.raw ||
      normalized.find((item) => item.low.includes("label"))?.raw ||
      normalized.find((item) => item.low.includes("sticker"))?.raw ||
      ""
    );
  }

  return (
    normalized.find((item) => item.low.includes("rux_receipt"))?.raw ||
    normalized.find((item) => item.low.includes("pos80"))?.raw ||
    normalized.find((item) => item.low.includes("xp-80"))?.raw ||
    normalized.find((item) => item.low.includes("xp80"))?.raw ||
    normalized.find((item) => item.low.includes("pos"))?.raw ||
    normalized.find((item) => item.low.includes("receipt"))?.raw ||
    normalized.find((item) => item.low.includes("thermal"))?.raw ||
    ""
  );
}

export async function listDesktopPrinters(): Promise<string[]> {
  try {
    const list = await invokeTauri<string[]>("list_printers");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Default printer switching is intentionally disabled.
 * Kept for backward compatibility with existing imports.
 */
export async function getDesktopDefaultPrinter(): Promise<string> {
  return "";
}

/**
 * Default printer switching is intentionally disabled.
 * Kept for backward compatibility with existing imports.
 */
export async function setDesktopDefaultPrinter(_printerName: string): Promise<void> {
  return;
}

/**
 * Print without changing OS default printer.
 * For receipt pages we toggle a data-attribute used by receipt print CSS isolation.
 */
export async function printCurrentWindowByMode(mode: PrinterMode, preferredPrinter?: string): Promise<boolean> {
  void preferredPrinter;

  const body = typeof document !== "undefined" ? document.body : null;
  let restoreIsolation: (() => void) | null = null;
  let restoreBodyStyles: (() => void) | null = null;

  if (mode === "RECEIPT" && body) {
    const prevBodyMargin = body.style.margin;
    const prevBodyPadding = body.style.padding;
    const prevBodyHeight = body.style.height;
    const prevBodyMinHeight = body.style.minHeight;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyDisplay = body.style.display;
    const prevBodyWidth = body.style.width;
    const prevBodyMaxWidth = body.style.maxWidth;
    const prevBodyTransform = body.style.transform;

    body.style.margin = "0";
    body.style.padding = "0";
    body.style.height = "auto";
    body.style.minHeight = "0";
    body.style.overflow = "visible";
    body.style.display = "block";
    body.style.width = "auto";
    body.style.maxWidth = "none";
    body.style.transform = "none";

    restoreBodyStyles = () => {
      body.style.margin = prevBodyMargin;
      body.style.padding = prevBodyPadding;
      body.style.height = prevBodyHeight;
      body.style.minHeight = prevBodyMinHeight;
      body.style.overflow = prevBodyOverflow;
      body.style.display = prevBodyDisplay;
      body.style.width = prevBodyWidth;
      body.style.maxWidth = prevBodyMaxWidth;
      body.style.transform = prevBodyTransform;
    };

    const receiptNode = document.querySelector(".receipt-print");
    if (receiptNode instanceof HTMLElement) {
      restoreIsolation = isolateElementForPrint(receiptNode);
    }
    body.setAttribute("data-receipt-print", "1");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  }

  let receiptAfterPrintFired = mode !== "RECEIPT";
  let afterPrintPromise: Promise<boolean> | null = null;

  if (mode === "RECEIPT" && body) {
    afterPrintPromise = new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (printed: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        window.removeEventListener("afterprint", onAfterPrint);
        resolve(printed);
      };
      const onAfterPrint = () => finish(true);
      const timeout = window.setTimeout(() => finish(false), 700);

      window.addEventListener("afterprint", onAfterPrint);
    });
  }

  try {
    window.print();
    if (afterPrintPromise) {
      receiptAfterPrintFired = await afterPrintPromise;
    }
  } finally {
    if (typeof restoreIsolation === "function") {
      restoreIsolation();
    }
    if (mode === "RECEIPT" && body) {
      body.removeAttribute("data-receipt-print");
    }
    if (typeof restoreBodyStyles === "function") {
      restoreBodyStyles();
    }
  }

  return receiptAfterPrintFired;
}

export async function printReceiptText(receiptText: string, preferredPrinter?: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  if (!receiptText.trim()) return false;

  try {
    await invokeTauri<void>("print_receipt_text", {
      receipt_text: receiptText,
      printer_name: preferredPrinter || undefined,
    });
    return true;
  } catch {
    return false;
  }
}

export async function printCurrentWindowWithPrinter(printerName?: string) {
  await printCurrentWindowByMode("RECEIPT", printerName);
}

/**
 * No-op: default printer switching was removed to avoid UI freeze/hanging.
 */
export async function ensureDefaultPrinterForMode(mode: PrinterMode, preferredPrinter?: string) {
  void mode;
  void preferredPrinter;
}
