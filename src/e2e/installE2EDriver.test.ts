// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetByLabel = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ label: "dashboard" }),
  Window: {
    getByLabel: mockGetByLabel,
  },
}));

vi.mock("../features/history/store", () => ({
  SESSION_TYPE: { FOCUS: "focus" },
  useHistoryStore: { setState: vi.fn() },
}));

vi.mock("../features/settings/store", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({ resetSettings: vi.fn() })),
    setState: vi.fn(),
  },
}));

vi.mock("../features/music/audio", () => ({
  createSilentMusicAudioService: vi.fn(() => ({})),
}));

vi.mock("../features/music/store", () => ({
  createMemoryMusicPreferenceRepository: vi.fn(() => ({})),
  VOLUME_PRESETS: { normal: 0.16 },
  useMusicStore: {
    getState: vi.fn(() => ({
      configure: vi.fn(),
      ducked: false,
      enabled: false,
      isPlaying: false,
    })),
    setState: vi.fn(),
  },
}));

vi.mock("../features/timer/model", () => ({
  DEFAULT_TIMER_SETTINGS: {
    focusDurationSeconds: 1_500,
    longBreakDurationSeconds: 900,
    sessionGoal: 4,
    sessionsBeforeLongBreak: 4,
    shortBreakDurationSeconds: 300,
  },
  createIdleTimerState: vi.fn(() => ({ status: "idle" })),
}));

vi.mock("../features/timer/store", () => ({
  useTimerStore: { setState: vi.fn() },
}));

describe("installKuroneKoE2EDriver", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_KURONE_KO_E2E", "1");
    mockGetByLabel.mockReset();
    window.localStorage.clear();
    delete window.__KURONE_KO_E2E__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes runtime window label and visibility evidence for launch-state smoke tests", async () => {
    mockGetByLabel.mockImplementation(async (label: string) => ({
      isVisible: async () => label === "dashboard",
    }));
    const { installKuroneKoE2EDriver } = await import("./installE2EDriver");

    installKuroneKoE2EDriver();

    expect(window.__KURONE_KO_E2E__?.getWindowLabel()).toBe("dashboard");
    await expect(window.__KURONE_KO_E2E__?.isWindowVisible("dashboard")).resolves.toBe(true);
    await expect(window.__KURONE_KO_E2E__?.isWindowVisible("timer")).resolves.toBe(false);
  });

  it("reports unavailable runtime windows as not visible instead of throwing", async () => {
    mockGetByLabel.mockResolvedValue(null);
    const { installKuroneKoE2EDriver } = await import("./installE2EDriver");

    installKuroneKoE2EDriver();

    await expect(window.__KURONE_KO_E2E__?.isWindowVisible("timer")).resolves.toBe(false);
  });

  it("clears persisted source preference and resets default source and volume", async () => {
    const { useMusicStore } = await import("../features/music/store");
    const { installKuroneKoE2EDriver } = await import("./installE2EDriver");
    window.localStorage.setItem("kurone-ko.music.source", "spotify");

    installKuroneKoE2EDriver();
    await window.__KURONE_KO_E2E__?.reset();

    expect(window.localStorage.getItem("kurone-ko.music.source")).toBeNull();
    expect(useMusicStore.setState).toHaveBeenCalledWith(expect.objectContaining({
      source: "kuroneko-playlist",
      volume: 0.16,
    }));
  });
});
