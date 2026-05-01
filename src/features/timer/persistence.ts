import {
  DEFAULT_TIMER_SETTINGS,
  TIMER_PHASE,
  TIMER_STATUS,
  type TimerSettings,
  type TimerState,
} from "./model";
import { invoke } from "@tauri-apps/api/core";

export interface TimerSnapshot {
  state: TimerState;
  settings: TimerSettings;
  savedAt: number;
}

export interface TimerPersistenceRepository {
  load: () => Promise<TimerSnapshot | null>;
  save: (snapshot: TimerSnapshot) => Promise<void>;
}

const TIMER_SNAPSHOT_COMMAND = {
  LOAD: "load_timer_snapshot",
  SAVE: "save_timer_snapshot",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isTimerStatus = (value: unknown): value is TimerState["status"] =>
  value === TIMER_STATUS.IDLE ||
  value === TIMER_STATUS.RUNNING ||
  value === TIMER_STATUS.PAUSED ||
  value === TIMER_STATUS.SESSION_COMPLETE;

const isTimerPhase = (value: unknown): value is TimerState["phase"] =>
  value === TIMER_PHASE.FOCUS || value === TIMER_PHASE.SHORT_BREAK || value === TIMER_PHASE.LONG_BREAK;

export const isTimerSettings = (value: unknown): value is TimerSettings => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNumber(value.focusDurationSeconds) &&
    isNumber(value.shortBreakDurationSeconds) &&
    isNumber(value.longBreakDurationSeconds) &&
    isNumber(value.sessionGoal) &&
    isNumber(value.sessionsBeforeLongBreak)
  );
};

export const isTimerState = (value: unknown): value is TimerState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isTimerStatus(value.status) &&
    isTimerPhase(value.phase) &&
    isNumber(value.remainingSeconds) &&
    (value.targetEndTime === null || isNumber(value.targetEndTime)) &&
    isNumber(value.completedFocusSessions) &&
    (value.focusStartedAt === null || isNumber(value.focusStartedAt))
  );
};

export const isTimerSnapshot = (value: unknown): value is TimerSnapshot => {
  if (!isRecord(value)) {
    return false;
  }

  return isTimerState(value.state) && isTimerSettings(value.settings) && isNumber(value.savedAt);
};

export const createMemoryTimerPersistenceRepository = (
  initialSnapshot: TimerSnapshot | null = null,
): TimerPersistenceRepository => {
  let snapshot = initialSnapshot;

  return {
    load: async () => snapshot,
    save: async (nextSnapshot) => {
      snapshot = nextSnapshot;
    },
  };
};

export const createTauriTimerPersistenceRepository = (): TimerPersistenceRepository => ({
  load: async () => {
    const snapshot = await invoke<unknown>(TIMER_SNAPSHOT_COMMAND.LOAD);

    if (snapshot === null) {
      return null;
    }

    return isTimerSnapshot(snapshot) ? snapshot : null;
  },
  save: async (snapshot) => {
    await invoke<void>(TIMER_SNAPSHOT_COMMAND.SAVE, { snapshot });
  },
});

export const createDefaultTimerSnapshot = (state: TimerState): TimerSnapshot => ({
  state,
  settings: DEFAULT_TIMER_SETTINGS,
  savedAt: Date.now(),
});
