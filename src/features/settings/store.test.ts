import { describe, expect, it } from "vitest";
import { DEFAULT_TIMER_SETTINGS } from "../timer/model";
import {
  createMemorySettingsRepository,
  createSettingsStore,
  sanitizeTimerSettings,
} from "./store";

describe("settings store", () => {
  it("hydrates persisted settings and saves updates", async () => {
    const repository = createMemorySettingsRepository({
      ...DEFAULT_TIMER_SETTINGS,
      focusDurationSeconds: 50 * 60,
    });
    const store = createSettingsStore(repository);

    await store.getState().hydrate();
    const settings = await store.getState().updateSettings({ shortBreakDurationSeconds: 10 * 60 });

    expect(settings).toMatchObject({
      focusDurationSeconds: 50 * 60,
      shortBreakDurationSeconds: 10 * 60,
    });
    await expect(repository.load()).resolves.toMatchObject(settings);
  });

  it("sanitizes invalid durations and long-break cadence", () => {
    expect(
      sanitizeTimerSettings({
        focusDurationSeconds: Number.NaN,
        shortBreakDurationSeconds: 30,
        longBreakDurationSeconds: 90,
        sessionGoal: 0,
        sessionsBeforeLongBreak: 99,
      }),
    ).toEqual({
      focusDurationSeconds: 60,
      shortBreakDurationSeconds: 60,
      longBreakDurationSeconds: 90,
      sessionGoal: 1,
      sessionsBeforeLongBreak: 12,
    });
  });

  it("persists session goal and long-break cadence in the settings shape", async () => {
    const repository = createMemorySettingsRepository();
    const store = createSettingsStore(repository);

    const settings = await store.getState().updateSettings({
      sessionGoal: 8,
      sessionsBeforeLongBreak: 4,
    });

    expect(settings).toMatchObject({
      sessionGoal: 8,
      sessionsBeforeLongBreak: 4,
    });
    await expect(repository.load()).resolves.toMatchObject({
      sessionGoal: 8,
      sessionsBeforeLongBreak: 4,
    });
  });
});
