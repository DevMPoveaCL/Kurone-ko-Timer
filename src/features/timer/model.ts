export const TIMER_STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  SESSION_COMPLETE: "session-complete",
} as const;

export type TimerStatus = (typeof TIMER_STATUS)[keyof typeof TIMER_STATUS];

export const TIMER_PHASE = {
  FOCUS: "focus",
  SHORT_BREAK: "short-break",
  LONG_BREAK: "long-break",
} as const;

export type TimerPhase = (typeof TIMER_PHASE)[keyof typeof TIMER_PHASE];

export const TIMER_ACTION = {
  START: "start",
  PAUSE: "pause",
  RESUME: "resume",
  COMPLETE_FOCUS: "complete-focus",
  COMPLETE_BREAK: "complete-break",
  COMPLETE_SESSION: "complete-session",
  RESET: "reset",
} as const;

export type TimerAction = (typeof TIMER_ACTION)[keyof typeof TIMER_ACTION];

export interface TimerSettings {
  focusDurationSeconds: number;
  shortBreakDurationSeconds: number;
  longBreakDurationSeconds: number;
  sessionGoal: number;
  sessionsBeforeLongBreak: number;
}

export interface TimerState {
  status: TimerStatus;
  phase: TimerPhase;
  remainingSeconds: number;
  targetEndTime: number | null;
  completedFocusSessions: number;
  focusStartedAt: number | null;
}

const MIN_DURATION_SECONDS = 1;
const MIN_SESSION_GOAL = 1;
const MIN_SESSIONS_BEFORE_LONG_BREAK = 1;

export const normalizeTimerDuration = (seconds: number, fallbackSeconds: number): number => {
  if (!Number.isFinite(seconds)) {
    return fallbackSeconds;
  }

  return Math.max(MIN_DURATION_SECONDS, Math.round(seconds));
};

const normalizeNonNegativeInteger = (value: number, fallbackValue: number): number => {
  if (!Number.isFinite(value)) {
    return fallbackValue;
  }

  return Math.max(0, Math.round(value));
};

export const normalizeTimerSettings = (settings: TimerSettings): TimerSettings => ({
  focusDurationSeconds: normalizeTimerDuration(
    settings.focusDurationSeconds,
    DEFAULT_TIMER_SETTINGS.focusDurationSeconds,
  ),
  shortBreakDurationSeconds: normalizeTimerDuration(
    settings.shortBreakDurationSeconds,
    DEFAULT_TIMER_SETTINGS.shortBreakDurationSeconds,
  ),
  longBreakDurationSeconds: normalizeTimerDuration(
    settings.longBreakDurationSeconds,
    DEFAULT_TIMER_SETTINGS.longBreakDurationSeconds,
  ),
  sessionGoal: Math.max(
    MIN_SESSION_GOAL,
    normalizeTimerDuration(settings.sessionGoal, DEFAULT_TIMER_SETTINGS.sessionGoal),
  ),
  sessionsBeforeLongBreak: Math.max(
    MIN_SESSIONS_BEFORE_LONG_BREAK,
    normalizeTimerDuration(
      settings.sessionsBeforeLongBreak,
      DEFAULT_TIMER_SETTINGS.sessionsBeforeLongBreak,
    ),
  ),
});

export const normalizeTimerState = (
  state: TimerState,
  settings: TimerSettings = DEFAULT_TIMER_SETTINGS,
): TimerState => {
  const safeSettings = normalizeTimerSettings(settings);
  const fallbackRemainingSeconds =
    state.phase === TIMER_PHASE.SHORT_BREAK
      ? safeSettings.shortBreakDurationSeconds
      : state.phase === TIMER_PHASE.LONG_BREAK
        ? safeSettings.longBreakDurationSeconds
        : safeSettings.focusDurationSeconds;

  return {
    ...state,
    remainingSeconds: normalizeTimerDuration(state.remainingSeconds, fallbackRemainingSeconds),
    targetEndTime: state.targetEndTime !== null && Number.isFinite(state.targetEndTime) ? state.targetEndTime : null,
    completedFocusSessions: normalizeNonNegativeInteger(state.completedFocusSessions, 0),
    focusStartedAt: state.focusStartedAt !== null && Number.isFinite(state.focusStartedAt) ? state.focusStartedAt : null,
  };
};

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusDurationSeconds: 25 * 60,
  shortBreakDurationSeconds: 5 * 60,
  longBreakDurationSeconds: 15 * 60,
  sessionGoal: 4,
  sessionsBeforeLongBreak: 4,
};

export const createIdleTimerState = (
  settings: TimerSettings = DEFAULT_TIMER_SETTINGS,
): TimerState => {
  const safeSettings = normalizeTimerSettings(settings);

  return {
    status: TIMER_STATUS.IDLE,
    phase: TIMER_PHASE.FOCUS,
    remainingSeconds: safeSettings.focusDurationSeconds,
    targetEndTime: null,
    completedFocusSessions: 0,
    focusStartedAt: null,
  };
};

export const calculateRemainingTime = (targetEndTime: number, now: number): number => {
  if (!Number.isFinite(targetEndTime) || !Number.isFinite(now)) {
    return 0;
  }

  return Math.max(0, Math.ceil((targetEndTime - now) / 1_000));
};

export const getNextState = (
  current: TimerState,
  action: TimerAction,
  settings: TimerSettings = DEFAULT_TIMER_SETTINGS,
  now: number = Date.now(),
): TimerState => {
  const safeSettings = normalizeTimerSettings(settings);
  const safeCurrent = normalizeTimerState(current, safeSettings);

  switch (action) {
    case TIMER_ACTION.START:
      if (
        safeCurrent.status !== TIMER_STATUS.IDLE &&
        safeCurrent.status !== TIMER_STATUS.SESSION_COMPLETE
      ) {
        return safeCurrent;
      }

      return {
        ...createIdleTimerState(safeSettings),
        status: TIMER_STATUS.RUNNING,
        phase: TIMER_PHASE.FOCUS,
        remainingSeconds: safeSettings.focusDurationSeconds,
        targetEndTime: now + safeSettings.focusDurationSeconds * 1_000,
        focusStartedAt: now,
      };

    case TIMER_ACTION.PAUSE:
      if (safeCurrent.status !== TIMER_STATUS.RUNNING) {
        return safeCurrent;
      }

      return {
        ...safeCurrent,
        status: TIMER_STATUS.PAUSED,
        remainingSeconds:
          safeCurrent.targetEndTime === null
            ? safeCurrent.remainingSeconds
            : calculateRemainingTime(safeCurrent.targetEndTime, now),
        targetEndTime: null,
      };

    case TIMER_ACTION.RESUME:
      if (safeCurrent.status !== TIMER_STATUS.PAUSED) {
        return safeCurrent;
      }

      return {
        ...safeCurrent,
        status: TIMER_STATUS.RUNNING,
        targetEndTime: now + safeCurrent.remainingSeconds * 1_000,
      };

    case TIMER_ACTION.COMPLETE_FOCUS: {
      if (safeCurrent.status !== TIMER_STATUS.RUNNING || safeCurrent.phase !== TIMER_PHASE.FOCUS) {
        return safeCurrent;
      }

      const completedFocusSessions = safeCurrent.completedFocusSessions + 1;
      if (completedFocusSessions >= safeSettings.sessionGoal) {
        return {
          ...safeCurrent,
          status: TIMER_STATUS.SESSION_COMPLETE,
          phase: TIMER_PHASE.FOCUS,
          remainingSeconds: 0,
          targetEndTime: null,
          completedFocusSessions,
          focusStartedAt: null,
        };
      }

      const phase =
        completedFocusSessions % safeSettings.sessionsBeforeLongBreak === 0
          ? TIMER_PHASE.LONG_BREAK
          : TIMER_PHASE.SHORT_BREAK;
      const breakDurationSeconds =
        phase === TIMER_PHASE.LONG_BREAK
          ? safeSettings.longBreakDurationSeconds
          : safeSettings.shortBreakDurationSeconds;

      return {
        ...safeCurrent,
        status: TIMER_STATUS.RUNNING,
        phase,
        remainingSeconds: breakDurationSeconds,
        targetEndTime: now + breakDurationSeconds * 1_000,
        completedFocusSessions,
        focusStartedAt: null,
      };
    }

    case TIMER_ACTION.COMPLETE_BREAK:
      if (
        safeCurrent.status !== TIMER_STATUS.RUNNING ||
        (safeCurrent.phase !== TIMER_PHASE.SHORT_BREAK && safeCurrent.phase !== TIMER_PHASE.LONG_BREAK)
      ) {
        return safeCurrent;
      }

      return {
        ...safeCurrent,
        status: TIMER_STATUS.RUNNING,
        phase: TIMER_PHASE.FOCUS,
        remainingSeconds: safeSettings.focusDurationSeconds,
        targetEndTime: now + safeSettings.focusDurationSeconds * 1_000,
        focusStartedAt: now,
      };

    case TIMER_ACTION.RESET:
      return createIdleTimerState(safeSettings);

    default:
      return safeCurrent;
  }
};
