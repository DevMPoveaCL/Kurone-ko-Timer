import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupWindowPositionTracking, switchToTimer } from "./switcher";

interface MockWindow {
  label: string;
  hide: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
  setFocus: ReturnType<typeof vi.fn>;
  outerPosition: ReturnType<typeof vi.fn>;
  outerSize: ReturnType<typeof vi.fn>;
  onMoved: ReturnType<typeof vi.fn>;
}

const createMockWindow = (label: string, ox: number, oy: number, ow: number, oh: number): MockWindow => ({
  label,
  hide: vi.fn(() => Promise.resolve()),
  show: vi.fn(() => Promise.resolve()),
  setFocus: vi.fn(() => Promise.resolve()),
  outerPosition: vi.fn(() => Promise.resolve({ x: ox, y: oy })),
  outerSize: vi.fn(() => Promise.resolve({ width: ow, height: oh })),
  onMoved: vi.fn(() => () => undefined),
});

const MONITOR_1080P = { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 } };
const MONITOR_768P = { position: { x: 0, y: 0 }, size: { width: 1366, height: 768 } };
const MONITOR_4K = { position: { x: 0, y: 0 }, size: { width: 3840, height: 2160 } };
const MONITOR_SECONDARY = { position: { x: 1920, y: 0 }, size: { width: 1920, height: 1080 } };

let dashboardWindow: MockWindow;
let timerWindow: MockWindow;
const mockGetByLabel = vi.fn();
const mockGetCurrentWindow = vi.fn();
const mockInvoke = vi.fn();
const mockCurrentMonitor = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => mockGetCurrentWindow(),
  currentMonitor: () => mockCurrentMonitor(),
  Window: { getByLabel: (label: string) => mockGetByLabel(label) },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  PhysicalPosition: class {
    constructor(public x: number, public y: number) {}
  },
}));

const localStorageStore: Record<string, string> = {};

describe("window switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    for (const k of Object.keys(localStorageStore)) delete localStorageStore[k];

    dashboardWindow = createMockWindow("dashboard", 100, 200, 360, 640);
    timerWindow = createMockWindow("timer", 500, 300, 300, 150);

    mockGetByLabel.mockImplementation((label: string) => {
      if (label === "dashboard") return Promise.resolve(dashboardWindow);
      if (label === "timer") return Promise.resolve(timerWindow);
      return Promise.resolve(null);
    });
    mockGetCurrentWindow.mockReturnValue(dashboardWindow);
    mockInvoke.mockResolvedValue(undefined);
    mockCurrentMonitor.mockResolvedValue(MONITOR_1080P);

    vi.stubGlobal("localStorage", {
      getItem(k: string) { return localStorageStore[k] ?? null; },
      setItem(k: string, v: string) { localStorageStore[k] = v; },
      removeItem(k: string) { delete localStorageStore[k]; },
      clear() { for (const k of Object.keys(localStorageStore)) delete localStorageStore[k]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // ── switching ──

  it("hides current → positions target → shows target", async () => {
    await switchToTimer();
    const h = dashboardWindow.hide.mock.invocationCallOrder[0];
    const i = mockInvoke.mock.invocationCallOrder[0];
    const s = timerWindow.show.mock.invocationCallOrder[0];
    expect(h).toBeLessThan(i);
    expect(i).toBeLessThan(s);
  });

  it("centers timer on dashboard", async () => {
    await switchToTimer();
    expect(mockInvoke).toHaveBeenCalledWith("position_window", { label: "timer", x: 130, y: 445 });
  });

  // ── multi-resolution clamping during switch ──

  it.each([
    // 1366×768: dash at (1106,300), center (1286,620), timer (1136,545) → clamp x to 1066, y within bounds
    ["1366×768", MONITOR_768P, 1106, 300, 1066, 545],
    // 1920×1080: dash at (1900,900), center (2080,1220), timer (1930,1145) → clamp to (1620,930)
    ["1920×1080", MONITOR_1080P, 1900, 900, 1620, 930],
    // 2560×1440: dash at (2400,1300), center (2580,1620), timer (2430,1545) → clamp x to 2260, y to 1290
    ["2560×1440", { position: { x: 0, y: 0 }, size: { width: 2560, height: 1440 } }, 2400, 1300, 2260, 1290],
    // 3840×2160: dash at (3700,2100), center (3880,2420), timer (3730,2345) → clamp to (3540,2010)
    ["3840×2160", MONITOR_4K, 3700, 2100, 3540, 2010],
  ])("clamps timer within monitor bounds at %s", async (_name, monitor, dashX, dashY, expX, expY) => {
    mockCurrentMonitor.mockResolvedValue(monitor);
    dashboardWindow = createMockWindow("dashboard", dashX, dashY, 360, 640);
    mockGetCurrentWindow.mockReturnValue(dashboardWindow);
    mockGetByLabel.mockImplementation((label: string) => {
      if (label === "dashboard") return Promise.resolve(dashboardWindow);
      if (label === "timer") return Promise.resolve(timerWindow);
      return Promise.resolve(null);
    });

    await switchToTimer();
    expect(mockInvoke).toHaveBeenCalledWith("position_window", { label: "timer", x: expX, y: expY });
  });

  it("clamps on secondary monitor (x offset = 1920)", async () => {
    mockCurrentMonitor.mockResolvedValue(MONITOR_SECONDARY);
    // Dashboard at (3800, 400) on secondary monitor → timer at right edge
    dashboardWindow = createMockWindow("dashboard", 3800, 400, 360, 640);
    mockGetCurrentWindow.mockReturnValue(dashboardWindow);
    mockGetByLabel.mockImplementation((label: string) => {
      if (label === "dashboard") return Promise.resolve(dashboardWindow);
      if (label === "timer") return Promise.resolve(timerWindow);
      return Promise.resolve(null);
    });

    await switchToTimer();
    // Center: (3800+180, 400+320) = (3980, 720)
    // Timer 300×150 → (3980-150, 720-75) = (3830, 645)
    // Clamp: x ≤ 1920+1920-300 = 3540, so x = 3540
    expect(mockInvoke).toHaveBeenCalledWith("position_window", { label: "timer", x: 3540, y: 645 });
  });

  // ── debounced drag clamping ──

  it("saves position immediately on drag but defers clamp via debounce", () => {
    mockGetCurrentWindow.mockReturnValue(dashboardWindow);
    setupWindowPositionTracking();
    const handler = dashboardWindow.onMoved.mock.calls[0][0];

    // Drag past right edge — invoke should NOT be called immediately
    handler({ payload: { x: 1600, y: 200 } });

    expect(JSON.parse(localStorageStore["window-position-dashboard"])).toEqual({ x: 1600, y: 200 });
    expect(mockInvoke).not.toHaveBeenCalled(); // debounced!
  });

  it("invokes clamp after debounce timer fires", async () => {
    mockGetCurrentWindow.mockReturnValue(dashboardWindow);
    setupWindowPositionTracking();
    const handler = dashboardWindow.onMoved.mock.calls[0][0];

    handler({ payload: { x: 1600, y: 200 } });
    expect(mockInvoke).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(80);
    expect(mockInvoke).toHaveBeenCalledWith("position_window", { label: "dashboard", x: 1560, y: 200 });
  });

  it("uses only the last position when multiple drag events fire rapidly", async () => {
    mockGetCurrentWindow.mockReturnValue(dashboardWindow);
    setupWindowPositionTracking();
    const handler = dashboardWindow.onMoved.mock.calls[0][0];

    handler({ payload: { x: 1600, y: 200 } });
    handler({ payload: { x: 1620, y: 210 } }); // second event resets timer
    handler({ payload: { x: 1650, y: 220 } }); // third event resets timer

    await vi.advanceTimersByTimeAsync(80);
    // Only the LAST position should be used for clamping
    // 1650 clamped → max 1560 for dashboard (360 wide) on 1920 monitor
    expect(mockInvoke).toHaveBeenCalledWith("position_window", { label: "dashboard", x: 1560, y: 220 });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("does not invoke clamp when drag stays within monitor bounds", async () => {
    mockGetCurrentWindow.mockReturnValue(dashboardWindow);
    setupWindowPositionTracking();
    const handler = dashboardWindow.onMoved.mock.calls[0][0];

    handler({ payload: { x: 350, y: 120 } });
    await vi.advanceTimersByTimeAsync(80);

    // Within bounds → no invoke needed
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(JSON.parse(localStorageStore["window-position-dashboard"])).toEqual({ x: 350, y: 120 });
  });

  // ── robustness ──

  it("switches fine when monitor is null", async () => {
    mockCurrentMonitor.mockResolvedValue(null);
    await expect(switchToTimer()).resolves.toBe(true);
  });

  it("returns false when target not found", async () => {
    mockGetByLabel.mockResolvedValue(null);
    await expect(switchToTimer()).resolves.toBe(false);
  });
});
