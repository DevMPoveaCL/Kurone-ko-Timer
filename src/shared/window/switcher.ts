import { currentMonitor, getCurrentWindow, Window } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition } from "@tauri-apps/api/dpi";

const WINDOW_LABEL = {
  DASHBOARD: "dashboard",
  TIMER: "timer",
} as const;

type WindowLabel = (typeof WINDOW_LABEL)[keyof typeof WINDOW_LABEL];

const LOGICAL_SIZE: Record<WindowLabel, { width: number; height: number }> = {
  [WINDOW_LABEL.DASHBOARD]: { width: 360, height: 640 },
  [WINDOW_LABEL.TIMER]: { width: 300, height: 150 },
};

const POSITION_KEY = "window-position";
const CLAMP_DEBOUNCE_MS = 80;

interface SavedPosition {
  x: number;
  y: number;
}

const setSavedPosition = (label: string, pos: SavedPosition): void => {
  try {
    localStorage.setItem(`${POSITION_KEY}-${label}`, JSON.stringify(pos));
  } catch {
    // localStorage unavailable
  }
};

/**
 * Clamp a window position to keep it fully visible within its monitor.
 * Works for any resolution/DPI — queries live monitor dimensions at runtime.
 */
const clampToMonitor = async (
  win: Window,
  desiredX: number,
  desiredY: number,
  logicalLabel: WindowLabel,
): Promise<{ x: number; y: number }> => {
  try {
    const [size, monitor] = await Promise.all([
      win.outerSize(),
      currentMonitor(),
    ]);
    if (!monitor) return { x: desiredX, y: desiredY };

    const logical = LOGICAL_SIZE[logicalLabel];
    const scale = size.width / logical.width;
    const physicalW = Math.round(logical.width * scale);
    const physicalH = Math.round(logical.height * scale);

    return {
      x: Math.max(monitor.position.x, Math.min(desiredX, monitor.position.x + monitor.size.width - physicalW)),
      y: Math.max(monitor.position.y, Math.min(desiredY, monitor.position.y + monitor.size.height - physicalH)),
    };
  } catch {
    return { x: desiredX, y: desiredY };
  }
};

const switchToWindow = async (targetLabel: WindowLabel): Promise<boolean> => {
  try {
    const currentWindow = getCurrentWindow();
    const currentLabel = currentWindow.label;
    const targetWindow = await Window.getByLabel(targetLabel);

    if (targetWindow === null) return false;

    // 1. Capture current window dimensions BEFORE hiding anything
    let targetPos: PhysicalPosition | null = null;
    try {
      const [currentPos, currentSize] = await Promise.all([
        currentWindow.outerPosition(),
        currentWindow.outerSize(),
      ]);

      setSavedPosition(currentLabel, { x: currentPos.x, y: currentPos.y });

      const currentLogical =
        LOGICAL_SIZE[currentLabel as WindowLabel] ?? LOGICAL_SIZE[WINDOW_LABEL.DASHBOARD];
      const scale = currentSize.width / currentLogical.width;

      const cx = currentPos.x + currentSize.width / 2;
      const cy = currentPos.y + currentSize.height / 2;

      const targetLogical = LOGICAL_SIZE[targetLabel];
      const tx = Math.round(cx - (targetLogical.width * scale) / 2);
      const ty = Math.round(cy - (targetLogical.height * scale) / 2);

      const clamped = await clampToMonitor(targetWindow, tx, ty, targetLabel);
      targetPos = new PhysicalPosition(clamped.x, clamped.y);
    } catch {
      // fallback: window opens at OS default
    }

    // 2. Hide current first (no flicker)
    await currentWindow.hide();

    // 3. Position hidden target
    if (targetPos) {
      try {
        await invoke("position_window", {
          label: targetLabel,
          x: targetPos.x,
          y: targetPos.y,
        });
      } catch {
        // non-critical
      }
    }

    // 4. Show target
    await targetWindow.show();
    void targetWindow.setFocus();

    return true;
  } catch {
    return false;
  }
};

export const setupWindowPositionTracking = (): void => {
  const win = getCurrentWindow();
  const winLabel = win.label as WindowLabel;
  let clampTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingClamp: { x: number; y: number } | null = null;

  void win.onMoved(async (event) => {
    const rawPos = event.payload;

    // Windows sends garbage coords (-32000) on minimize — skip
    try {
      const minimised = await win.isMinimized();
      if (minimised) return;
    } catch {
      // fall through if API unavailable
    }

    // Only save valid positions (ignore OS minimize artifacts)
    if (rawPos.x < -10000 || rawPos.y < -10000) return;

    // Always save position immediately (for switching persistence)
    setSavedPosition(winLabel, { x: rawPos.x, y: rawPos.y });

    // Debounced clamp: only snap back after dragging pauses
    // This prevents epileptic flicker when forcing against screen edge
    if (clampTimer !== null) {
      clearTimeout(clampTimer);
    }

    // Check if we need to clamp (async, but fire-and-forget)
    pendingClamp = { x: rawPos.x, y: rawPos.y };
    clampTimer = setTimeout(async () => {
      clampTimer = null;
      const pos = pendingClamp;
      pendingClamp = null;
      if (!pos) return;

      const clamped = await clampToMonitor(win, pos.x, pos.y, winLabel);
      if (clamped.x !== pos.x || clamped.y !== pos.y) {
        try {
          await invoke("position_window", {
            label: winLabel,
            x: clamped.x,
            y: clamped.y,
          });
        } catch {
          // non-critical
        }
      }
    }, CLAMP_DEBOUNCE_MS);
  });
};

export const switchToTimer = async (): Promise<boolean> =>
  switchToWindow(WINDOW_LABEL.TIMER);

export const switchToDashboard = async (): Promise<boolean> =>
  switchToWindow(WINDOW_LABEL.DASHBOARD);

export const moveWindowByDelta = async (
  label: WindowLabel,
  dx: number,
  dy: number,
): Promise<void> => {
  try {
    const win = await Window.getByLabel(label);
    if (!win) return;

    const [pos, size] = await Promise.all([
      win.outerPosition(),
      win.outerSize(),
    ]);
    const monitor = await currentMonitor();

    const logical = LOGICAL_SIZE[label];
    const scale = size.width / logical.width;
    const physicalW = Math.round(logical.width * scale);
    const physicalH = Math.round(logical.height * scale);

    let nx = pos.x + dx;
    let ny = pos.y + dy;

    if (monitor) {
      nx = Math.max(monitor.position.x, Math.min(nx, monitor.position.x + monitor.size.width - physicalW));
      ny = Math.max(monitor.position.y, Math.min(ny, monitor.position.y + monitor.size.height - physicalH));
    }

    await invoke("position_window", { label, x: nx, y: ny });
  } catch {
    // non-critical
  }
};
