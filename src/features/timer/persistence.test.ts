import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleTimerState, DEFAULT_TIMER_SETTINGS } from "./model";
import {
  createTauriTimerPersistenceRepository,
  isTimerSnapshot,
  type TimerSnapshot,
} from "./persistence";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const NOW = 1_700_000_000_000;

const createSnapshot = (): TimerSnapshot => ({
  state: createIdleTimerState(DEFAULT_TIMER_SETTINGS),
  settings: DEFAULT_TIMER_SETTINGS,
  savedAt: NOW,
});

describe("timer persistence", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("validates snapshots from unknown data", () => {
    expect(isTimerSnapshot(createSnapshot())).toBe(true);
    expect(isTimerSnapshot({ state: null, settings: DEFAULT_TIMER_SETTINGS, savedAt: NOW })).toBe(
      false,
    );
  });

  it("loads valid snapshots from the Tauri command", async () => {
    const snapshot = createSnapshot();
    vi.mocked(invoke).mockResolvedValue(snapshot);

    await expect(createTauriTimerPersistenceRepository().load()).resolves.toEqual(snapshot);
    expect(invoke).toHaveBeenCalledWith("load_timer_snapshot");
  });

  it("ignores invalid snapshots from the Tauri command", async () => {
    vi.mocked(invoke).mockResolvedValue({ invalid: true });

    await expect(createTauriTimerPersistenceRepository().load()).resolves.toBeNull();
  });

  it("saves snapshots through the Tauri command", async () => {
    const snapshot = createSnapshot();
    vi.mocked(invoke).mockResolvedValue(undefined);

    await createTauriTimerPersistenceRepository().save(snapshot);

    expect(invoke).toHaveBeenCalledWith("save_timer_snapshot", { snapshot });
  });
});
