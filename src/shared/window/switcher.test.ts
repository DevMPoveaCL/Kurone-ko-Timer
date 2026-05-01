import { beforeEach, describe, expect, it, vi } from "vitest";
import { switchToDashboard, switchToTimer } from "./switcher";

interface MockWindowHandle {
  hide: ReturnType<typeof vi.fn<() => Promise<void>>>;
  show: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

const dashboardWindow: MockWindowHandle = {
  hide: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  show: vi.fn<() => Promise<void>>(() => Promise.resolve()),
};

const timerWindow: MockWindowHandle = {
  hide: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  show: vi.fn<() => Promise<void>>(() => Promise.resolve()),
};

const mockGetByLabel = vi.fn<(label: string) => Promise<MockWindowHandle | null>>((label) => {
  if (label === "dashboard") {
    return Promise.resolve(dashboardWindow);
  }

  if (label === "timer") {
    return Promise.resolve(timerWindow);
  }

  return Promise.resolve(null);
});

const mockGetCurrentWindow = vi.fn<() => MockWindowHandle>(() => dashboardWindow);

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => mockGetCurrentWindow(),
  Window: {
    getByLabel: (label: string) => mockGetByLabel(label),
  },
}));

describe("window switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardWindow.hide.mockResolvedValue(undefined);
    dashboardWindow.show.mockResolvedValue(undefined);
    timerWindow.hide.mockResolvedValue(undefined);
    timerWindow.show.mockResolvedValue(undefined);
    mockGetCurrentWindow.mockReturnValue(dashboardWindow);
    mockGetByLabel.mockImplementation((label) => {
      if (label === "dashboard") {
        return Promise.resolve(dashboardWindow);
      }

      if (label === "timer") {
        return Promise.resolve(timerWindow);
      }

      return Promise.resolve(null);
    });
  });

  it("shows the timer window and hides the current dashboard window", async () => {
    await expect(switchToTimer()).resolves.toBe(true);

    expect(mockGetByLabel).toHaveBeenCalledWith("timer");
    expect(timerWindow.show).toHaveBeenCalledTimes(1);
    expect(dashboardWindow.hide).toHaveBeenCalledTimes(1);
  });

  it("shows the dashboard window and hides the current timer window", async () => {
    mockGetCurrentWindow.mockReturnValue(timerWindow);

    await expect(switchToDashboard()).resolves.toBe(true);

    expect(mockGetByLabel).toHaveBeenCalledWith("dashboard");
    expect(dashboardWindow.show).toHaveBeenCalledTimes(1);
    expect(timerWindow.hide).toHaveBeenCalledTimes(1);
  });

  it("returns false without hiding the current window when target lookup fails", async () => {
    mockGetByLabel.mockRejectedValue(new Error("window unavailable"));

    await expect(switchToTimer()).resolves.toBe(false);
    await expect(switchToDashboard()).resolves.toBe(false);

    expect(dashboardWindow.hide).not.toHaveBeenCalled();
    expect(timerWindow.hide).not.toHaveBeenCalled();
  });
});
