// @vitest-environment happy-dom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TIMER_SETTINGS, type TimerSettings } from "../../features/timer/model";
import { resetAppHydrationForTests, useAppHydration } from "./useAppHydration";

const mockSettings: { settings: TimerSettings } = {
  settings: DEFAULT_TIMER_SETTINGS,
};

vi.mock("../../features/settings/store", () => ({
  useSettingsStore: {
    getState: () => mockSettings,
  },
}));

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
};

describe("useAppHydration", () => {
  beforeEach(() => {
    resetAppHydrationForTests();
    vi.clearAllMocks();
    mockSettings.settings = DEFAULT_TIMER_SETTINGS;
  });

  it("hydrates settings, history, and music in parallel before hydrating the timer and applying settings", async () => {
    const events: string[] = [];
    const settingsDeferred = createDeferred();
    const historyDeferred = createDeferred();
    const musicDeferred = createDeferred();
    const hydrateSettings = vi.fn(() => {
      events.push("settings:start");
      return settingsDeferred.promise.then(() => {
        events.push("settings:end");
      });
    });
    const hydrateHistory = vi.fn(() => {
      events.push("history:start");
      return historyDeferred.promise.then(() => {
        events.push("history:end");
      });
    });
    const hydrateMusic = vi.fn(() => {
      events.push("music:start");
      return musicDeferred.promise.then(() => {
        events.push("music:end");
      });
    });
    const hydrate = vi.fn(async () => {
      events.push("timer:hydrate");
    });
    const setSettings = vi.fn((settings: TimerSettings) => {
      events.push(`timer:setSettings:${settings.focusDurationSeconds}`);
    });

    renderHook(() => useAppHydration({ hydrateSettings, hydrateHistory, hydrateMusic, hydrate, setSettings }));

    await waitFor(() => {
      expect(events).toEqual(["settings:start", "history:start", "music:start"]);
    });
    settingsDeferred.resolve();
    await Promise.resolve();
    expect(events).toEqual(["settings:start", "history:start", "music:start", "settings:end"]);
    historyDeferred.resolve();
    musicDeferred.resolve();

    await waitFor(() => {
      expect(events).toEqual([
        "settings:start",
        "history:start",
        "music:start",
        "settings:end",
        "history:end",
        "music:end",
        "timer:hydrate",
        "timer:setSettings:1500",
      ]);
    });
  });

  it("returns hydrated false initially and true only after the complete sequence finishes", async () => {
    const timerDeferred = createDeferred();
    const result = renderHook(() =>
      useAppHydration({
        hydrateSettings: async () => undefined,
        hydrateHistory: async () => undefined,
        hydrateMusic: async () => undefined,
        hydrate: () => timerDeferred.promise,
        setSettings: vi.fn(),
      }),
    );

    expect(result.result.current.hydrated).toBe(false);
    await Promise.resolve();
    expect(result.result.current.hydrated).toBe(false);
    timerDeferred.resolve();

    await waitFor(() => {
      expect(result.result.current.hydrated).toBe(true);
    });
  });

  it("does not re-run hydration after a completed hook remount", async () => {
    const hydrateSettings = vi.fn(async () => undefined);
    const hydrateHistory = vi.fn(async () => undefined);
    const hydrateMusic = vi.fn(async () => undefined);
    const hydrate = vi.fn(async () => undefined);
    const setSettings = vi.fn();
    const dependencies = { hydrateSettings, hydrateHistory, hydrateMusic, hydrate, setSettings };
    const firstMount = renderHook(() => useAppHydration(dependencies));

    await waitFor(() => {
      expect(firstMount.result.current.hydrated).toBe(true);
    });
    firstMount.unmount();
    const secondMount = renderHook(() => useAppHydration(dependencies));

    await waitFor(() => {
      expect(secondMount.result.current.hydrated).toBe(true);
    });
    expect(hydrateSettings).toHaveBeenCalledTimes(1);
    expect(hydrateHistory).toHaveBeenCalledTimes(1);
    expect(hydrateMusic).toHaveBeenCalledTimes(1);
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(setSettings).toHaveBeenCalledTimes(1);
  });
});
