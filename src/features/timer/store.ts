import { create } from "zustand";
import type { MusicFocusSessionController } from "../music/audio";
import { useMusicStore } from "../music/store";
import {
  createBrowserTimerSoundPlayer,
  TIMER_SOUND_EVENT,
  type TimerSoundPlayer,
} from "../notifications/sound";
import { SESSION_TYPE, useHistoryStore, type SessionInput } from "../history/store";
import {
  calculateRemainingTime,
  createIdleTimerState,
  DEFAULT_TIMER_SETTINGS,
  getNextState,
  normalizeTimerSettings,
  normalizeTimerState,
  TIMER_ACTION,
  TIMER_PHASE,
  TIMER_STATUS,
  type TimerSettings,
  type TimerState,
} from "./model";
import {
  createTauriTimerPersistenceRepository,
  type TimerPersistenceRepository,
  type TimerSnapshot,
} from "./persistence";

export interface TimerStore extends TimerState {
  settings: TimerSettings;
  hydrated: boolean;
  hydrate: (now?: number) => Promise<void>;
  setSettings: (settings: TimerSettings, now?: number) => void;
  start: (now?: number) => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  reset: (now?: number) => void;
  tick: (now?: number) => void;
}

const defaultRepository = createTauriTimerPersistenceRepository();
const defaultTimerSoundPlayer = createBrowserTimerSoundPlayer();
const defaultMusicFocusSessionController: MusicFocusSessionController = {
  pauseForTimer: () => useMusicStore.getState().pauseForTimer(),
  resumeForTimerFocus: () => useMusicStore.getState().resumeForTimerFocus(),
  resumeAfterTimerPause: () => useMusicStore.getState().resumeAfterTimerPause(),
  setDucked: (ducked) => useMusicStore.getState().setDucked(ducked),
  stopForTimerBreak: () => useMusicStore.getState().stopForTimerBreak(),
  stopForTimer: () => useMusicStore.getState().stopForTimer(),
};

interface SessionLogger {
  addSession: (session: SessionInput) => Promise<void>;
}

const defaultSessionLogger = useHistoryStore.getState();

const createSnapshot = (state: TimerStore, savedAt: number): TimerSnapshot => {
  const settings = normalizeTimerSettings(state.settings);
  const timerState = normalizeTimerState({
    status: state.status,
    phase: state.phase,
    remainingSeconds: state.remainingSeconds,
    targetEndTime: state.targetEndTime,
    completedFocusSessions: state.completedFocusSessions,
    focusStartedAt: state.focusStartedAt,
  }, settings);

  return {
    state: timerState,
    settings,
    savedAt,
  };
};

const persistSnapshot = (repository: TimerPersistenceRepository, state: TimerStore, savedAt: number) => {
  void repository.save(createSnapshot(state, savedAt));
};

const logFocusSession = (logger: SessionLogger, session: SessionInput) => {
  if (session.durationSeconds <= 0) {
    return;
  }

  void logger.addSession(session);
};

const createCompletedFocusSession = (
  completedAt: number,
  settings: TimerSettings,
): SessionInput => ({
  completedAt,
  durationSeconds: normalizeTimerSettings(settings).focusDurationSeconds,
  type: SESSION_TYPE.FOCUS,
});

export const createTimerStore = (
  repository: TimerPersistenceRepository = defaultRepository,
  initialSettings: TimerSettings = DEFAULT_TIMER_SETTINGS,
  sessionLogger: SessionLogger = defaultSessionLogger,
  timerSoundPlayer: TimerSoundPlayer = defaultTimerSoundPlayer,
  musicFocusSessionController: MusicFocusSessionController = defaultMusicFocusSessionController,
) =>
  create<TimerStore>()((set, get) => ({
    ...createIdleTimerState(normalizeTimerSettings(initialSettings)),
    settings: normalizeTimerSettings(initialSettings),
    hydrated: false,

    hydrate: async (now = Date.now()) => {
      let snapshot: TimerSnapshot | null;

      try {
        snapshot = await repository.load();
      } catch {
        set({ hydrated: true });
        return;
      }

      if (snapshot === null) {
        set({ hydrated: true });
        return;
      }

      const settings = normalizeTimerSettings(get().settings);
      set({ ...createIdleTimerState(settings), settings, hydrated: true });
      persistSnapshot(repository, get(), now);
    },

    setSettings: (settings, now = Date.now()) => {
      const safeSettings = normalizeTimerSettings(settings);
      const current = get();

      if (current.status === TIMER_STATUS.IDLE) {
        set({ settings: safeSettings, remainingSeconds: safeSettings.focusDurationSeconds });
      } else {
        set({ settings: safeSettings });
      }

      persistSnapshot(repository, get(), now);
    },

    start: (now = Date.now()) => {
      timerSoundPlayer.prime?.();
      musicFocusSessionController.setDucked(false);
      const current = get();
      const next = getNextState(current, TIMER_ACTION.START, normalizeTimerSettings(current.settings), now);

      set(next);
      if (next.status === TIMER_STATUS.RUNNING && next.phase === TIMER_PHASE.FOCUS) {
        timerSoundPlayer.play(TIMER_SOUND_EVENT.FOCUS_START);
      }
      persistSnapshot(repository, get(), now);
    },

    pause: (now = Date.now()) => {
      timerSoundPlayer.prime?.();
      const current = get();
      const next = getNextState(current, TIMER_ACTION.PAUSE, normalizeTimerSettings(current.settings), now);

      if (next.status === TIMER_STATUS.PAUSED && current.status === TIMER_STATUS.RUNNING) {
        void musicFocusSessionController.pauseForTimer();
      }
      set(next);
      persistSnapshot(repository, get(), now);
    },

    resume: (now = Date.now()) => {
      timerSoundPlayer.prime?.();
      const current = get();
      const next = getNextState(current, TIMER_ACTION.RESUME, normalizeTimerSettings(current.settings), now);

      if (next.status === TIMER_STATUS.RUNNING && current.status === TIMER_STATUS.PAUSED) {
        musicFocusSessionController.setDucked(false);
        void musicFocusSessionController.resumeAfterTimerPause();
      }
      set(next);
      persistSnapshot(repository, get(), now);
    },

    reset: (now = Date.now()) => {
      timerSoundPlayer.prime?.();
      void musicFocusSessionController.stopForTimer();
      const current = get();
      const next = getNextState(current, TIMER_ACTION.RESET, normalizeTimerSettings(current.settings), now);

      set(next);
      persistSnapshot(repository, get(), now);
    },

    tick: (now = Date.now()) => {
      const current = get();
      const safeCurrent = normalizeTimerState(current, current.settings);

      if (safeCurrent.status !== TIMER_STATUS.RUNNING || safeCurrent.targetEndTime === null) {
        return;
      }

      const remainingSeconds = calculateRemainingTime(safeCurrent.targetEndTime, now);

      if (remainingSeconds > 0) {
        set({ remainingSeconds });
        persistSnapshot(repository, get(), now);
        return;
      }

      const action =
        safeCurrent.phase === TIMER_PHASE.FOCUS ? TIMER_ACTION.COMPLETE_FOCUS : TIMER_ACTION.COMPLETE_BREAK;
      if (action === TIMER_ACTION.COMPLETE_FOCUS) {
        const next = getNextState(
          { ...safeCurrent, remainingSeconds: 0 },
          action,
          current.settings,
          now,
        );
        timerSoundPlayer.play(
          next.status === TIMER_STATUS.SESSION_COMPLETE
            ? TIMER_SOUND_EVENT.SESSION_COMPLETE
            : TIMER_SOUND_EVENT.BREAK_START,
        );
        if (next.status === TIMER_STATUS.SESSION_COMPLETE) {
          void musicFocusSessionController.stopForTimer();
        } else {
          void (musicFocusSessionController.stopForTimerBreak?.() ?? musicFocusSessionController.stopForTimer());
        }
        logFocusSession(sessionLogger, createCompletedFocusSession(safeCurrent.targetEndTime, current.settings));
        set(next);
        persistSnapshot(repository, get(), now);
        return;
      }
      timerSoundPlayer.play(TIMER_SOUND_EVENT.FOCUS_START);
      void musicFocusSessionController.resumeForTimerFocus?.();
      const next = getNextState(
        { ...safeCurrent, remainingSeconds: 0 },
        action,
        current.settings,
        now,
      );

      set(next);
      persistSnapshot(repository, get(), now);
    },
  }));

export const useTimerStore = createTimerStore();
