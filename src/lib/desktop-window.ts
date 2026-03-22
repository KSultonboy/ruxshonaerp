import { isTauriDesktop } from "@/lib/desktop-updater";

export async function setDesktopFullscreen(enabled: boolean) {
  if (!isTauriDesktop()) return false;

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const currentWindow = getCurrentWindow();
    const isFullscreen = await currentWindow.isFullscreen();

    if (isFullscreen === enabled) {
      return true;
    }

    await currentWindow.setFullscreen(enabled);
    return true;
  } catch {
    return false;
  }
}
