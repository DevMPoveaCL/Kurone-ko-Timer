import { describe, expect, it } from "vitest";
import { MUSIC_VOLUME, type MusicFocusSessionController } from "../music/audio";
import { createPlaylistAudioService, type PlaylistAudioElement } from "../music/playlist";
import { createMemoryMusicPreferenceRepository, createMusicStore, useMusicStore } from "../music/store";
import { TIMER_SOUND_EVENT, type TimerSoundEvent } from "../notifications/sound";
import { SESSION_TYPE, type SessionInput } from "../history/store";
import { DEFAULT_TIMER_SETTINGS, TIMER_PHASE, TIMER_STATUS, createIdleTimerState, type TimerSettings } from "./model";
import { createMemoryTimerPersistenceRepository, type TimerPersistenceRepository } from "./persistence";
import { createTimerStore } from "./store";

const NOW = 1_700_000_000_000;

const TEST_SETTINGS: TimerSettings = {
  ...DEFAULT_TIMER_SETTINGS,
  focusDurationSeconds: 10,
  shortBreakDurationSeconds: 5,
  longBreakDurationSeconds: 15,
  sessionGoal: 4,
  sessionsBeforeLongBreak: 2,
};

interface MockPlaylistAudioElement extends PlaylistAudioElement {
  playCalls: number;
}

const createMockPlaylistAudioElement = (src: string): MockPlaylistAudioElement => {
  const audio: MockPlaylistAudioElement = {
    currentTime: 0,
    loop: false,
    paused: true,
    play: async () => {
      audio.paused = false;
      audio.playCalls += 1;
    },
    playCalls: 0,
    pause: () => {
      audio.paused = true;
    },
    removeAttribute: () => undefined,
    src,
    volume: 1,
  };

  return audio;
};

const createTestStore = () => {
  const repository = createMemoryTimerPersistenceRepository();
  const loggedSessions: SessionInput[] = [];
  const playbackEvents: string[] = [];
  const soundEvents: TimerSoundEvent[] = [];
  const duckingEvents: boolean[] = [];
  const musicFocusSessionController: MusicFocusSessionController = {
    pauseForTimer: async () => {
      playbackEvents.push("pause-for-timer");
    },
    resumeAfterTimerPause: async () => {
      playbackEvents.push("resume-after-timer-pause");
    },
    setDucked: (ducked) => {
      duckingEvents.push(ducked);
    },
    stopForTimer: async () => {
      playbackEvents.push("stop-for-timer");
    },
  };
  const store = createTimerStore(repository, TEST_SETTINGS, {
    addSession: async (session) => {
      loggedSessions.push(session);
    },
  }, {
    play: (event) => {
      soundEvents.push(event);
    },
  }, musicFocusSessionController);

  return { duckingEvents, loggedSessions, playbackEvents, repository, soundEvents, store };
};

describe("timer store", () => {
  it("starts, pauses, and resumes using drift-safe target times", () => {
    const { playbackEvents, store } = createTestStore();

    store.getState().start(NOW);
    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 10,
      targetEndTime: NOW + 10_000,
    });

    store.getState().pause(NOW + 3_100);
    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.PAUSED,
      remainingSeconds: 7,
      targetEndTime: null,
    });

    store.getState().resume(NOW + 5_000);
    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      targetEndTime: NOW + 12_000,
    });
    expect(playbackEvents).toEqual(["pause-for-timer", "resume-after-timer-pause"]);
  });

  it("preserves the current playlist track across timer pause and resume", async () => {
    const createdAudioElements: MockPlaylistAudioElement[] = [];
    const musicStore = createMusicStore(
      createPlaylistAudioService((src) => {
        const audio = createMockPlaylistAudioElement(src);
        createdAudioElements.push(audio);

        return audio;
      }, () => 0.5),
      createMemoryMusicPreferenceRepository(false),
    );
    const musicFocusSessionController: MusicFocusSessionController = {
      pauseForTimer: () => musicStore.getState().pauseForTimer(),
      resumeAfterTimerPause: () => musicStore.getState().resumeAfterTimerPause(),
      setDucked: (ducked) => musicStore.getState().setDucked(ducked),
      stopForTimer: () => musicStore.getState().stopForTimer(),
    };
    const store = createTimerStore(
      createMemoryTimerPersistenceRepository(),
      TEST_SETTINGS,
      { addSession: async () => undefined },
      { play: () => undefined },
      musicFocusSessionController,
    );

    await musicStore.getState().toggle();
    const currentAudio = createdAudioElements[0];
    currentAudio.currentTime = 32;

    store.getState().start(NOW);
    store.getState().pause(NOW + 3_000);
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.getState().resume(NOW + 4_000);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createdAudioElements).toHaveLength(1);
    expect(currentAudio.src).toBe("/audio/kuroneko-playlist/07-velvet.ogg");
    expect(currentAudio.currentTime).toBe(32);
    expect(currentAudio.playCalls).toBe(2);
    expect(musicStore.getState()).toMatchObject({ enabled: true, isPlaying: true });
  });

  it("keeps start finite after an invalid incomplete snapshot is discarded", async () => {
    const repository = createMemoryTimerPersistenceRepository({
      state: {
        status: TIMER_STATUS.PAUSED,
        phase: TIMER_PHASE.FOCUS,
        remainingSeconds: Number.NaN,
        targetEndTime: null,
        completedFocusSessions: 0,
        focusStartedAt: NOW,
      },
      settings: TEST_SETTINGS,
      savedAt: NOW,
    });
    const store = createTimerStore(repository, TEST_SETTINGS);

    await store.getState().hydrate(NOW);
    store.getState().start(NOW + 1_000);

    expect(Number.isFinite(store.getState().remainingSeconds)).toBe(true);
    expect(store.getState().targetEndTime).toBe(NOW + 11_000);
  });

  it("ticks remaining time without relying on interval accuracy", () => {
    const { store } = createTestStore();

    store.getState().start(NOW);
    store.getState().tick(NOW + 4_400);

    expect(store.getState().remainingSeconds).toBe(6);
  });

  it("decrements a one-minute focus timer after start", () => {
    const repository = createMemoryTimerPersistenceRepository();
    const store = createTimerStore(repository, {
      ...TEST_SETTINGS,
      focusDurationSeconds: 60,
    });

    store.getState().start(NOW);
    store.getState().tick(NOW + 1_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 59,
      targetEndTime: NOW + 60_000,
      focusStartedAt: NOW,
    });
    expect(Number.isFinite(store.getState().remainingSeconds)).toBe(true);
    expect(Number.isFinite(store.getState().targetEndTime)).toBe(true);
    expect(Number.isFinite(store.getState().focusStartedAt)).toBe(true);
  });

  it("allows start and tick even when timer hydration fails", async () => {
    const failingRepository: TimerPersistenceRepository = {
      load: async () => {
        throw new Error("timer persistence unavailable");
      },
      save: async () => undefined,
    };
    const store = createTimerStore(failingRepository, {
      ...TEST_SETTINGS,
      focusDurationSeconds: 60,
    });

    await store.getState().hydrate(NOW);
    store.getState().start(NOW);
    store.getState().tick(NOW + 1_000);

    expect(store.getState()).toMatchObject({
      hydrated: true,
      status: TIMER_STATUS.RUNNING,
      remainingSeconds: 59,
      targetEndTime: NOW + 60_000,
    });
  });

  it("keeps absolute-time accuracy when ticks are delayed under load", () => {
    const { store } = createTestStore();

    store.getState().start(NOW);
    store.getState().tick(NOW + 1_200);
    store.getState().tick(NOW + 8_900);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 2,
      targetEndTime: NOW + 10_000,
    });
  });

  it("auto-transitions from focus to break when ticking reaches zero", () => {
    const { playbackEvents, soundEvents, store } = createTestStore();

    store.getState().start(NOW);
    store.getState().tick(NOW + 10_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      phase: TIMER_PHASE.SHORT_BREAK,
      remainingSeconds: 5,
      completedFocusSessions: 1,
      targetEndTime: NOW + 15_000,
    });
    expect(soundEvents).toEqual([TIMER_SOUND_EVENT.FOCUS_START, TIMER_SOUND_EVENT.BREAK_START]);
    expect(playbackEvents).toEqual(["stop-for-timer"]);
  });

  it("auto-transitions from break into the next focus session", () => {
    const { soundEvents, store } = createTestStore();

    store.getState().start(NOW);
    store.getState().tick(NOW + 10_000);
    store.getState().tick(NOW + 15_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 10,
      targetEndTime: NOW + 25_000,
      focusStartedAt: NOW + 15_000,
    });
    expect(soundEvents).toEqual([
      TIMER_SOUND_EVENT.FOCUS_START,
      TIMER_SOUND_EVENT.BREAK_START,
      TIMER_SOUND_EVENT.FOCUS_START,
    ]);
  });

  it("ends the Pomodoro session without starting a break after the final focus block", () => {
    const { loggedSessions, playbackEvents, soundEvents, store } = createTestStore();

    store.getState().start(NOW);
    store.getState().tick(NOW + 10_000);
    store.getState().tick(NOW + 15_000);
    store.getState().tick(NOW + 25_000);
    store.getState().tick(NOW + 40_000);
    store.getState().tick(NOW + 50_000);
    store.getState().tick(NOW + 55_000);
    store.getState().tick(NOW + 65_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.SESSION_COMPLETE,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 0,
      targetEndTime: null,
      completedFocusSessions: 4,
      focusStartedAt: null,
    });
    expect(loggedSessions).toHaveLength(4);
    expect(soundEvents[soundEvents.length - 1]).toBe(TIMER_SOUND_EVENT.SESSION_COMPLETE);
    expect(playbackEvents[playbackEvents.length - 1]).toBe("stop-for-timer");
  });

  it("settles playlist playback on completion and clears ducking when starting again", () => {
    const { duckingEvents, playbackEvents, store } = createTestStore();

    store.getState().start(NOW);
    store.getState().tick(NOW + 10_000);
    store.getState().tick(NOW + 15_000);
    store.getState().tick(NOW + 25_000);
    store.getState().tick(NOW + 40_000);
    store.getState().tick(NOW + 50_000);
    store.getState().tick(NOW + 55_000);
    store.getState().tick(NOW + 65_000);
    store.getState().start(NOW + 66_000);

    expect(playbackEvents).toContain("stop-for-timer");
    expect(duckingEvents[duckingEvents.length - 1]).toBe(false);
    expect(MUSIC_VOLUME.NORMAL).toBeGreaterThan(MUSIC_VOLUME.DUCKED);
  });

  it("uses the current music ducking controller from the music store when starting", () => {
    const originalSetDucked = useMusicStore.getState().setDucked;
    const duckingEvents: boolean[] = [];

    useMusicStore.setState({
      setDucked: (ducked) => {
        duckingEvents.push(ducked);
      },
    });
    const store = createTimerStore(createMemoryTimerPersistenceRepository(), TEST_SETTINGS);

    store.getState().start(NOW);

    expect(duckingEvents).toEqual([false]);
    useMusicStore.setState({ setDucked: originalSetDucked });
  });

  it("resets to idle with a fresh session count", () => {
    const { store } = createTestStore();

    store.getState().start(NOW);
    store.getState().tick(NOW + 10_000);
    store.getState().reset(NOW + 11_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.IDLE,
      completedFocusSessions: 0,
    });
  });

  it("uses changed timer configuration for the next start and reset", () => {
    const { store } = createTestStore();
    const changedSettings: TimerSettings = {
      ...TEST_SETTINGS,
      focusDurationSeconds: 90,
      shortBreakDurationSeconds: 30,
      sessionGoal: 2,
    };

    store.getState().setSettings(changedSettings, NOW);
    store.getState().start(NOW + 1_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      remainingSeconds: 90,
      targetEndTime: NOW + 91_000,
      settings: changedSettings,
    });

    store.getState().reset(NOW + 2_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.IDLE,
      remainingSeconds: 90,
      settings: changedSettings,
    });
  });

  it("ignores stale idle snapshot settings so default start cannot reuse old dev focus minutes", async () => {
    const staleOneMinuteSettings: TimerSettings = {
      ...TEST_SETTINGS,
      focusDurationSeconds: 60,
    };
    const repository = createMemoryTimerPersistenceRepository({
      state: createIdleTimerState(staleOneMinuteSettings),
      settings: staleOneMinuteSettings,
      savedAt: NOW,
    });
    const store = createTimerStore(repository, DEFAULT_TIMER_SETTINGS);

    await store.getState().hydrate(NOW);
    store.getState().start(NOW + 1_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      remainingSeconds: DEFAULT_TIMER_SETTINGS.focusDurationSeconds,
      targetEndTime: NOW + 1_000 + DEFAULT_TIMER_SETTINGS.focusDurationSeconds * 1_000,
      settings: DEFAULT_TIMER_SETTINGS,
    });
  });

  it("keeps an explicitly injected one-minute config when it is the current settings source", async () => {
    const explicitOneMinuteSettings: TimerSettings = {
      ...TEST_SETTINGS,
      focusDurationSeconds: 60,
    };
    const repository = createMemoryTimerPersistenceRepository({
      state: createIdleTimerState(explicitOneMinuteSettings),
      settings: explicitOneMinuteSettings,
      savedAt: NOW,
    });
    const store = createTimerStore(repository, explicitOneMinuteSettings);

    await store.getState().hydrate(NOW);
    store.getState().start(NOW + 1_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.RUNNING,
      remainingSeconds: 60,
      targetEndTime: NOW + 61_000,
      settings: explicitOneMinuteSettings,
    });
  });

  it("hydrates a paused persistence snapshot to a fresh idle timer", async () => {
    const repository = createMemoryTimerPersistenceRepository({
      state: {
        status: TIMER_STATUS.PAUSED,
        phase: TIMER_PHASE.FOCUS,
        remainingSeconds: 4,
        targetEndTime: null,
        completedFocusSessions: 3,
        focusStartedAt: NOW - 6_000,
      },
      settings: TEST_SETTINGS,
      savedAt: NOW,
    });
    const store = createTimerStore(repository, TEST_SETTINGS);

    await store.getState().hydrate();

    expect(store.getState()).toMatchObject({
      hydrated: true,
      status: TIMER_STATUS.IDLE,
      remainingSeconds: TEST_SETTINGS.focusDurationSeconds,
      completedFocusSessions: 0,
      settings: TEST_SETTINGS,
    });
  });

  it("hydrates an incomplete running timer snapshot to idle with current settings", async () => {
    const currentSettings: TimerSettings = {
      ...TEST_SETTINGS,
      focusDurationSeconds: 90,
    };
    const repository = createMemoryTimerPersistenceRepository({
      state: {
        status: TIMER_STATUS.RUNNING,
        phase: TIMER_PHASE.FOCUS,
        remainingSeconds: 10,
        targetEndTime: NOW + 10_000,
        completedFocusSessions: 0,
        focusStartedAt: NOW,
      },
      settings: TEST_SETTINGS,
      savedAt: NOW,
    });
    const store = createTimerStore(repository, currentSettings);

    await store.getState().hydrate(NOW + 3_100);

    expect(store.getState()).toMatchObject({
      hydrated: true,
      status: TIMER_STATUS.IDLE,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 90,
      targetEndTime: null,
      completedFocusSessions: 0,
      focusStartedAt: null,
      settings: currentSettings,
    });
  });

  it("does not auto-complete an expired persisted focus timer during hydration", async () => {
    const repository = createMemoryTimerPersistenceRepository({
      state: {
        status: TIMER_STATUS.RUNNING,
        phase: TIMER_PHASE.FOCUS,
        remainingSeconds: 10,
        targetEndTime: NOW + 10_000,
        completedFocusSessions: 0,
        focusStartedAt: NOW,
      },
      settings: TEST_SETTINGS,
      savedAt: NOW,
    });
    const store = createTimerStore(repository, TEST_SETTINGS);

    await store.getState().hydrate(NOW + 10_000);

    expect(store.getState()).toMatchObject({
      hydrated: true,
      status: TIMER_STATUS.IDLE,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 10,
      targetEndTime: null,
    });
  });

  it("does not play phase-end sound or stop music when hydration discards an expired focus timer", async () => {
    const repository = createMemoryTimerPersistenceRepository({
      state: {
        status: TIMER_STATUS.RUNNING,
        phase: TIMER_PHASE.FOCUS,
        remainingSeconds: 10,
        targetEndTime: NOW + 10_000,
        completedFocusSessions: 0,
        focusStartedAt: NOW,
      },
      settings: TEST_SETTINGS,
      savedAt: NOW,
    });
    const soundEvents: TimerSoundEvent[] = [];
    const playbackEvents: string[] = [];
    const store = createTimerStore(repository, TEST_SETTINGS, {
      addSession: async () => undefined,
    }, {
      play: (event) => {
        soundEvents.push(event);
      },
    }, {
      pauseForTimer: async () => undefined,
      resumeAfterTimerPause: async () => undefined,
      setDucked: () => undefined,
      stopForTimer: async () => {
        playbackEvents.push("stop-for-timer");
      },
    });

    await store.getState().hydrate(NOW + 10_000);

    expect(soundEvents).toEqual([]);
    expect(playbackEvents).toEqual([]);
  });

  it("does not auto-resume an expired persisted break timer during hydration", async () => {
    const repository = createMemoryTimerPersistenceRepository({
      state: {
        status: TIMER_STATUS.RUNNING,
        phase: TIMER_PHASE.SHORT_BREAK,
        remainingSeconds: 5,
        targetEndTime: NOW + 5_000,
        completedFocusSessions: 1,
        focusStartedAt: null,
      },
      settings: TEST_SETTINGS,
      savedAt: NOW,
    });
    const soundEvents: TimerSoundEvent[] = [];
    const store = createTimerStore(repository, TEST_SETTINGS, {
      addSession: async () => undefined,
    }, {
      play: (event) => {
        soundEvents.push(event);
      },
    });

    await store.getState().hydrate(NOW + 5_000);

    expect(store.getState()).toMatchObject({
      status: TIMER_STATUS.IDLE,
      phase: TIMER_PHASE.FOCUS,
      remainingSeconds: 10,
      targetEndTime: null,
    });
    expect(soundEvents).toEqual([]);
  });

  it("stops focus music for break and restarts it when break transitions back to focus", () => {
    const playbackEvents: string[] = [];
    const store = createTimerStore(createMemoryTimerPersistenceRepository(), TEST_SETTINGS, {
      addSession: async () => undefined,
    }, {
      play: () => undefined,
    }, {
      pauseForTimer: async () => undefined,
      resumeAfterTimerPause: async () => undefined,
      resumeForTimerFocus: async () => {
        playbackEvents.push("resume-for-timer-focus");
      },
      setDucked: () => undefined,
      stopForTimer: async () => {
        playbackEvents.push("stop-for-timer");
      },
      stopForTimerBreak: async () => {
        playbackEvents.push("stop-for-timer-break");
      },
    });

    store.getState().start(NOW);
    store.getState().tick(NOW + 10_000);
    store.getState().tick(NOW + 15_000);

    expect(playbackEvents).toEqual(["stop-for-timer-break", "resume-for-timer-focus"]);
  });

  it("logs a completed focus session when focus transitions to break", () => {
    const { loggedSessions, store } = createTestStore();

    store.getState().start(NOW);
    store.getState().tick(NOW + 10_000);

    expect(loggedSessions).toEqual([
      {
        completedAt: NOW + 10_000,
        durationSeconds: 10,
        type: SESSION_TYPE.FOCUS,
      },
    ]);
  });

  it("does not log history when resetting before completion", () => {
    const { loggedSessions, store } = createTestStore();

    store.getState().start(NOW);
    store.getState().reset(NOW + 4_000);

    expect(loggedSessions).toEqual([]);
  });

  it("does not log history when pausing before completion", () => {
    const { loggedSessions, store } = createTestStore();

    store.getState().start(NOW);
    store.getState().pause(NOW + 4_000);

    expect(loggedSessions).toEqual([]);
  });
});
