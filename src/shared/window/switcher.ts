import { getCurrentWindow, Window } from "@tauri-apps/api/window";

export interface SwitchableWindow {
  hide: () => Promise<void>;
  show: () => Promise<void>;
}

const WINDOW_LABEL = {
  DASHBOARD: "dashboard",
  TIMER: "timer",
} as const;

type WindowLabel = (typeof WINDOW_LABEL)[keyof typeof WINDOW_LABEL];

const switchToWindow = async (targetLabel: WindowLabel): Promise<boolean> => {
  try {
    const currentWindow: SwitchableWindow = getCurrentWindow();
    const targetWindow = await Window.getByLabel(targetLabel);

    if (targetWindow === null) {
      return false;
    }

    await targetWindow.show();
    await currentWindow.hide();

    return true;
  } catch {
    return false;
  }
};

export const switchToTimer = async (): Promise<boolean> => switchToWindow(WINDOW_LABEL.TIMER);

export const switchToDashboard = async (): Promise<boolean> => switchToWindow(WINDOW_LABEL.DASHBOARD);
