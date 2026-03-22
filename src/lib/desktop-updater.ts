export type DesktopUpdateInfo = {
  version: string;
  currentVersion?: string;
  date?: string;
  body?: string;
  downloadAndInstall: () => Promise<void>;
};

export function isTauriDesktop() {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).__TAURI_INTERNALS__);
}

export async function getDesktopVersion() {
  if (!isTauriDesktop()) return null;

  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return null;
  }
}

export async function checkDesktopUpdate() {
  if (!isTauriDesktop()) return null;
  // Dev rejimida updater endpoint ko'pincha mavjud bo'lmaydi.
  if (process.env.NODE_ENV !== "production") return null;

  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return update as DesktopUpdateInfo;
}
