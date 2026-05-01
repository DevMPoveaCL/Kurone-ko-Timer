import { getCurrentWindow } from "@tauri-apps/api/window";

export interface MinimizableWindow {
  minimize: () => Promise<void>;
}

export const minimizeCurrentWindow = async (windowHandle?: MinimizableWindow): Promise<boolean> => {
  try {
    const currentWindow = windowHandle ?? getCurrentWindow();
    await currentWindow.minimize();
    return true;
  } catch {
    return false;
  }
};
