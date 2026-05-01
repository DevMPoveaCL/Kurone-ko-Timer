import { describe, expect, it } from "vitest";
import {
  calculateRemainingTime,
  createIdleTimerState,
  DEFAULT_TIMER_SETTINGS,
  getNextState,
  TIMER_ACTION,
  TIMER_PHASE,
  TIMER_STATUS,
  type TimerSettings,
} from "./model";

const NOW = 1_700_000_000_000;

const TEST_SETTINGS: TimerSettings = {
  ...DEFAULT_TIMER_SETTINGS,
  focusDurationSeconds: 1_500,
  shortBreakDurationSeconds: 300,
  longBreakDurationSeconds: 900,
  sessionGoal: 4,
  sessionsBeforeLongBreak: 4,
};

const EIGHT_BLOCK_SETTINGS: TimerSettings = {
  ...TEST_SETTINGS,
  sessionGoal: 8,
};

describe("timer model", () => {
  it("starts a focus session from idle", () => {
    const next = getNextState(
      createIdleTimerState(TEST_SETTINGS),
      TIMER_ACTION.START,
      TEST_SETTINGS,
      NOW,
    );

    expect(next).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: TEST_SETTINGS.focusDurationSeconds,
      targetEndTime: NOW + TEST_SETTINGS.focusDurationSeconds * 1_000,
    });
  });

  it("blocks invalid pause transitions from idle", () => {
    const current = createIdleTimerState(TEST_SETTINGS);

    expect(getNextState(current, TIMER_ACTION.PAUSE, TEST_SETTINGS, NOW)).toEqual(current);
  });

  it("pauses running state using absolute target time to calculate remaining time", () => {
    const running = getNextState(
      createIdleTimerState(TEST_SETTINGS),
      TIMER_ACTION.START,
      TEST_SETTINGS,
      NOW,
    );

    const paused = getNextState(running, TIMER_ACTION.PAUSE, TEST_SETTINGS, NOW + 12_100);

    expect(paused.status).toBe(TIMER_STATUS.PAUSED);
    expect(paused.remainingSeconds).toBe(1_488);
    expect(paused.targetEndTime).toBeNull();
  });

  it("pauses to a finite remaining time when persisted runtime values are invalid", () => {
    const running = {
      ...createIdleTimerState(TEST_SETTINGS),
      status: TIMER_STATUS.RUNNING,
      remainingSeconds: Number.NaN,
      targetEndTime: Number.NaN,
    };

    const paused = getNextState(running, TIMER_ACTION.PAUSE, TEST_SETTINGS, NOW + 12_100);

    expect(paused.status).toBe(TIMER_STATUS.PAUSED);
    expect(Number.isFinite(paused.remainingSeconds)).toBe(true);
    expect(paused.remainingSeconds).toBe(TEST_SETTINGS.focusDurationSeconds);
    expect(paused.targetEndTime).toBeNull();
  });

  it("resumes from paused by creating a new target end time", () => {
    const paused = {
      ...createIdleTimerState(TEST_SETTINGS),
      status: TIMER_STATUS.PAUSED,
      remainingSeconds: 60,
    };

    const resumed = getNextState(paused, TIMER_ACTION.RESUME, TEST_SETTINGS, NOW);

    expect(resumed.status).toBe(TIMER_STATUS.RUNNING);
    expect(resumed.targetEndTime).toBe(NOW + 60_000);
  });

  it("resumes with a valid target end time when paused remaining time is invalid", () => {
    const paused = {
      ...createIdleTimerState(TEST_SETTINGS),
      status: TIMER_STATUS.PAUSED,
      remainingSeconds: Number.NaN,
    };

    const resumed = getNextState(paused, TIMER_ACTION.RESUME, TEST_SETTINGS, NOW);

    expect(resumed.status).toBe(TIMER_STATUS.RUNNING);
    expect(Number.isFinite(resumed.remainingSeconds)).toBe(true);
    expect(resumed.targetEndTime).toBe(NOW + TEST_SETTINGS.focusDurationSeconds * 1_000);
  });

  it("transitions from completed focus to short break", () => {
    const running = getNextState(
      createIdleTimerState(TEST_SETTINGS),
      TIMER_ACTION.START,
      TEST_SETTINGS,
      NOW,
    );

    const breakState = getNextState(running, TIMER_ACTION.COMPLETE_FOCUS, TEST_SETTINGS, NOW);

    expect(breakState).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      phase: TIMER_PHASE.SHORT_BREAK,
      remainingSeconds: TEST_SETTINGS.shortBreakDurationSeconds,
      completedFocusSessions: 1,
    });
  });

  it("uses long break after configured focus session count", () => {
    const running = {
      ...createIdleTimerState(TEST_SETTINGS),
      status: TIMER_STATUS.RUNNING,
      completedFocusSessions: 3,
      targetEndTime: NOW,
    };

    const breakState = getNextState(running, TIMER_ACTION.COMPLETE_FOCUS, EIGHT_BLOCK_SETTINGS, NOW);

    expect(breakState.phase).toBe(TIMER_PHASE.LONG_BREAK);
    expect(breakState.remainingSeconds).toBe(TEST_SETTINGS.longBreakDurationSeconds);
    expect(breakState.completedFocusSessions).toBe(4);
  });

  it("completes the session instead of starting a break when the goal is reached", () => {
    const running = {
      ...createIdleTimerState(TEST_SETTINGS),
      status: TIMER_STATUS.RUNNING,
      completedFocusSessions: 3,
      targetEndTime: NOW,
    };

    const complete = getNextState(running, TIMER_ACTION.COMPLETE_FOCUS, TEST_SETTINGS, NOW);

    expect(complete).toMatchObject({
      status: TIMER_STATUS.SESSION_COMPLETE,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 0,
      targetEndTime: null,
      completedFocusSessions: 4,
      focusStartedAt: null,
    });
  });

  it("matches the goal 8 long-break cadence without counting breaks as focus", () => {
    let state = getNextState(createIdleTimerState(EIGHT_BLOCK_SETTINGS), TIMER_ACTION.START, EIGHT_BLOCK_SETTINGS, NOW);

    for (let block = 1; block <= 8; block += 1) {
      state = getNextState(state, TIMER_ACTION.COMPLETE_FOCUS, EIGHT_BLOCK_SETTINGS, NOW + block);

      if (block === 8) {
        expect(state.status).toBe(TIMER_STATUS.SESSION_COMPLETE);
        expect(state.completedFocusSessions).toBe(8);
        continue;
      }

      expect(state.completedFocusSessions).toBe(block);
      expect(state.phase).toBe(block === 4 ? TIMER_PHASE.LONG_BREAK : TIMER_PHASE.SHORT_BREAK);

      state = getNextState(state, TIMER_ACTION.COMPLETE_BREAK, EIGHT_BLOCK_SETTINGS, NOW + block + 100);
      expect(state.phase).toBe(TIMER_PHASE.FOCUS);
      expect(state.completedFocusSessions).toBe(block);
    }
  });

  it("continues into the next focus after a break completes", () => {
    const breakState = {
      ...createIdleTimerState(TEST_SETTINGS),
      status: TIMER_STATUS.RUNNING,
      phase: TIMER_PHASE.SHORT_BREAK,
      remainingSeconds: 0,
      targetEndTime: NOW,
    };

    const focus = getNextState(breakState, TIMER_ACTION.COMPLETE_BREAK, TEST_SETTINGS, NOW);

    expect(focus.status).toBe(TIMER_STATUS.RUNNING);
    expect(focus.phase).toBe(TIMER_PHASE.FOCUS);
    expect(focus.remainingSeconds).toBe(TEST_SETTINGS.focusDurationSeconds);
    expect(focus.targetEndTime).toBe(NOW + TEST_SETTINGS.focusDurationSeconds * 1_000);
    expect(focus.focusStartedAt).toBe(NOW);
  });

  it("resets active timer state and starts a fresh session count", () => {
    const running = {
      ...createIdleTimerState(TEST_SETTINGS),
      status: TIMER_STATUS.RUNNING,
      completedFocusSessions: 2,
      targetEndTime: NOW + 100_000,
    };

    const reset = getNextState(running, TIMER_ACTION.RESET, TEST_SETTINGS, NOW);

    expect(reset.status).toBe(TIMER_STATUS.IDLE);
    expect(reset.completedFocusSessions).toBe(0);
  });

  it("calculates remaining time from target end time and clamps at zero", () => {
    expect(calculateRemainingTime(NOW + 10_500, NOW)).toBe(11);
    expect(calculateRemainingTime(NOW - 1_000, NOW)).toBe(0);
    expect(calculateRemainingTime(Number.NaN, NOW)).toBe(0);
  });
});
