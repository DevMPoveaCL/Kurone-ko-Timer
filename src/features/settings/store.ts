import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { DEFAULT_TIMER_SETTINGS, type TimerSettings } from "../timer/model";
import { isTimerSettings } from "../timer/persistence";

export interface SettingsRepository {
  load: () => Promise<TimerSettings | null>;
  save: (settings: TimerSettings) => Promise<void>;
}

interface SettingsStoreState {
  settings: TimerSettings;
  hydrated: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  updateSettings: (settings: Partial<TimerSettings>) => Promise<TimerSettings>;
  resetSettings: () => Promise<TimerSettings>;
}

const SETTINGS_COMMAND = {
  LOAD: "load_settings",
  SAVE: "save_settings",
} as const;

const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 24 * 60 * 60;
const MIN_SESSION_GOAL = 1;
const MAX_SESSION_GOAL = 24;
const MIN_SESSIONS_BEFORE_LONG_BREAK = 1;
const MAX_SESSIONS_BEFORE_LONG_BREAK = 12;

const normalizeError = (error: unknown): string =>
  error instanceof Error ? error.message : "Unexpected settings persistence error";

const clampInteger = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;

export const sanitizeTimerSettings = (settings: TimerSettings): TimerSettings => ({
  focusDurationSeconds: clampInteger(settings.focusDurationSeconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS),
  shortBreakDurationSeconds: clampInteger(settings.shortBreakDurationSeconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS),
  longBreakDurationSeconds: clampInteger(settings.longBreakDurationSeconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS),
  sessionGoal: clampInteger(settings.sessionGoal, MIN_SESSION_GOAL, MAX_SESSION_GOAL),
  sessionsBeforeLongBreak: clampInteger(
    settings.sessionsBeforeLongBreak,
    MIN_SESSIONS_BEFORE_LONG_BREAK,
    MAX_SESSIONS_BEFORE_LONG_BREAK,
  ),
});

export const createMemorySettingsRepository = (
  initialSettings: TimerSettings | null = null,
): SettingsRepository => {
  let settings = initialSettings;

  return {
    load: async () => settings,
    save: async (nextSettings) => {
      settings = nextSettings;
    },
  };
};

export const createTauriSettingsRepository = (): SettingsRepository => ({
  load: async () => {
    const settings = await invoke<unknown>(SETTINGS_COMMAND.LOAD);

    return isTimerSettings(settings) ? sanitizeTimerSettings(settings) : null;
  },
  save: async (settings) => {
    await invoke<void>(SETTINGS_COMMAND.SAVE, { settings });
  },
});

const defaultRepository = createTauriSettingsRepository();

export const createSettingsStore = (repository: SettingsRepository = defaultRepository) =>
  create<SettingsStoreState>()((set, get) => ({
    settings: DEFAULT_TIMER_SETTINGS,
    hydrated: false,
    error: null,

    hydrate: async () => {
      try {
        const settings = await repository.load();
        set({
          settings: settings ?? DEFAULT_TIMER_SETTINGS,
          hydrated: true,
          error: null,
        });
      } catch (error) {
        set({ hydrated: true, error: normalizeError(error) });
      }
    },

    updateSettings: async (settings) => {
      const nextSettings = sanitizeTimerSettings({ ...get().settings, ...settings });
      set({ settings: nextSettings, error: null });

      try {
        await repository.save(nextSettings);
      } catch (error) {
        set({ error: normalizeError(error) });
      }

      return nextSettings;
    },

    resetSettings: async () => {
      const nextSettings = DEFAULT_TIMER_SETTINGS;
      set({ settings: nextSettings, error: null });

      try {
        await repository.save(nextSettings);
      } catch (error) {
        set({ error: normalizeError(error) });
      }

      return nextSettings;
    },
  }));

export const useSettingsStore = createSettingsStore();
