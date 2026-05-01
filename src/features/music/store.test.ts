// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MUSIC_VOLUME, type MusicAudioService } from "./audio";
import { createMusicSourceRegistry, type MusicSourceId, type MusicSourceProvider } from "./sources";
import { createLocalStorageMusicPreferenceRepository, createMemoryMusicPreferenceRepository, createMusicStore, VOLUME_PRESETS } from "./store";

const createAudioService = (): MusicAudioService & {
  played: number;
  paused: number;
  volumes: number[];
} => {
  let playing = false;

  return {
    played: 0,
    paused: 0,
    volumes: [],
    isPlaying: () => playing,
    pause() {
      this.paused += 1;
      playing = false;
    },
    async play() {
      this.played += 1;
      playing = true;
    },
    async resume() {
      this.played += 1;
      playing = true;
    },
    setVolume(volume) {
      this.volumes.push(volume);
    },
    stop() {
      this.paused += 1;
      playing = false;
    },
  };
};

const createTrackedProvider = (
  id: MusicSourceId,
  audioService: MusicAudioService,
  createCalls: string[],
): MusicSourceProvider => ({
  id,
  label: id,
  isAvailable: () => true,
  createAudioService: () => {
    createCalls.push(id);

    return audioService;
  },
});

describe("music store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("hydrates a persisted enabled preference as off so the toggle cannot show on while silent", async () => {
    const audioService = createAudioService();
    const repository = createMemoryMusicPreferenceRepository(true);
    const store = createMusicStore(audioService, repository);

    await store.getState().hydrate();

    expect(store.getState()).toMatchObject({ enabled: false, isPlaying: false, hydrated: true });
    expect(audioService.played).toBe(0);
    await expect(repository.load()).resolves.toBe(false);
  });

  it("does not persist enabled on when play returns without active audio", async () => {
    const silentFailingAudio: MusicAudioService = {
      isPlaying: () => false,
      pause: () => undefined,
      play: async () => undefined,
      resume: async () => undefined,
      setVolume: () => undefined,
      stop: () => undefined,
    };
    const repository = createMemoryMusicPreferenceRepository(false);
    const store = createMusicStore(silentFailingAudio, repository);

    await store.getState().toggle();

    expect(store.getState()).toMatchObject({ enabled: false, isPlaying: false });
    await expect(repository.load()).resolves.toBe(false);
  });

  it("treats a stale enabled flag with silent audio as off when toggling playback", async () => {
    const audioService = createAudioService();
    const repository = createMemoryMusicPreferenceRepository(false);
    const store = createMusicStore(audioService, repository);
    store.setState({ enabled: true, isPlaying: false });

    await store.getState().toggle();

    expect(store.getState()).toMatchObject({ enabled: true, isPlaying: true });
    expect(audioService.played).toBe(1);
    await expect(repository.load()).resolves.toBe(true);
  });

  it("toggles ambience on and persists the enabled preference after a user click", async () => {
    const audioService = createAudioService();
    const repository = createMemoryMusicPreferenceRepository(false);
    const store = createMusicStore(audioService, repository);

    await store.getState().toggle();

    expect(store.getState()).toMatchObject({ enabled: true, isPlaying: true, ducked: false });
    expect(audioService.played).toBe(1);
    await expect(repository.load()).resolves.toBe(true);
  });

  it("toggles ambience off and persists the disabled preference", async () => {
    const audioService = createAudioService();
    const repository = createMemoryMusicPreferenceRepository(true);
    const store = createMusicStore(audioService, repository);

    await store.getState().toggle();
    await store.getState().toggle();

    expect(store.getState()).toMatchObject({ enabled: false, isPlaying: false, ducked: false });
    expect(audioService.paused).toBe(1);
    await expect(repository.load()).resolves.toBe(false);
  });

  it("pauses Kurone-ko Playlist for a timer pause and resumes only the captured playback", async () => {
    const audioService = createAudioService();
    const repository = createMemoryMusicPreferenceRepository(false);
    const store = createMusicStore(audioService, repository);

    await store.getState().toggle();
    await store.getState().pauseForTimer();

    expect(store.getState()).toMatchObject({ enabled: false, isPlaying: false, ducked: false });
    expect(audioService.paused).toBe(1);
    await expect(repository.load()).resolves.toBe(false);

    await store.getState().resumeAfterTimerPause();

    expect(store.getState()).toMatchObject({ enabled: true, isPlaying: true });
    expect(audioService.played).toBe(2);
    await expect(repository.load()).resolves.toBe(true);
  });

  it("does not start Kurone-ko Playlist on resume when music was off before the timer pause", async () => {
    const audioService = createAudioService();
    const store = createMusicStore(audioService, createMemoryMusicPreferenceRepository(false));

    await store.getState().pauseForTimer();
    await store.getState().resumeAfterTimerPause();

    expect(store.getState()).toMatchObject({ enabled: false, isPlaying: false });
    expect(audioService.played).toBe(0);
  });

  it("stops Kurone-ko Playlist when the timer completes or resets", async () => {
    const audioService = createAudioService();
    const repository = createMemoryMusicPreferenceRepository(false);
    const store = createMusicStore(audioService, repository);

    await store.getState().toggle();
    await store.getState().stopForTimer();

    expect(store.getState()).toMatchObject({ enabled: false, isPlaying: false, ducked: false });
    expect(audioService.paused).toBe(1);
    await expect(repository.load()).resolves.toBe(false);
  });

  it("stops focus music during break and restarts it for the next focus block", async () => {
    const audioService = createAudioService();
    const repository = createMemoryMusicPreferenceRepository(false);
    const store = createMusicStore(audioService, repository);

    await store.getState().toggle();
    await store.getState().stopForTimerBreak();

    expect(store.getState()).toMatchObject({ enabled: false, isPlaying: false, ducked: false });
    expect(audioService.paused).toBe(1);
    await expect(repository.load()).resolves.toBe(false);

    await store.getState().resumeForTimerFocus();

    expect(store.getState()).toMatchObject({ enabled: true, isPlaying: true, ducked: false });
    expect(audioService.played).toBe(2);
    await expect(repository.load()).resolves.toBe(true);
  });

  it("does not restart focus music after timer reset clears the captured playback", async () => {
    const audioService = createAudioService();
    const store = createMusicStore(audioService, createMemoryMusicPreferenceRepository(false));

    await store.getState().toggle();
    await store.getState().stopForTimer();
    await store.getState().resumeForTimerFocus();

    expect(store.getState()).toMatchObject({ enabled: false, isPlaying: false });
    expect(audioService.played).toBe(1);
  });

  it("ducks active ambience volume and restores normal volume when alerts finish", async () => {
    const audioService = createAudioService();
    const store = createMusicStore(audioService, createMemoryMusicPreferenceRepository(false));

    await store.getState().toggle();
    store.getState().setDucked(true);
    store.getState().setDucked(false);

    expect(store.getState().ducked).toBe(false);
    expect(audioService.volumes).toEqual([MUSIC_VOLUME.NORMAL, MUSIC_VOLUME.DUCKED, MUSIC_VOLUME.NORMAL]);
  });

  it("swaps source providers, applies stored volume, and persists selected source", async () => {
    const spotifyAudio = createAudioService();
    const playlistAudio = createAudioService();
    const createCalls: string[] = [];
    const repository = createMemoryMusicPreferenceRepository(false);
    const registry = createMusicSourceRegistry([
      createTrackedProvider("spotify", spotifyAudio, createCalls),
      createTrackedProvider("kuroneko-playlist", playlistAudio, createCalls),
    ]);
    const store = createMusicStore(playlistAudio, repository, registry);

    store.getState().setVolume(VOLUME_PRESETS.focus);
    await store.getState().setSource("spotify");

    expect(store.getState().source).toBe("spotify");
    expect(playlistAudio.paused).toBe(1);
    expect(spotifyAudio.volumes).toEqual([VOLUME_PRESETS.focus]);
    expect(createCalls).toEqual(["spotify"]);
    await expect(repository.loadSource()).resolves.toBe("spotify");
  });

  it("pauses the previous active source before playing a newly selected source", async () => {
    const spotifyAudio = createAudioService();
    const playlistAudio = createAudioService();
    const createCalls: string[] = [];
    const repository = createMemoryMusicPreferenceRepository(false);
    const registry = createMusicSourceRegistry([
      createTrackedProvider("spotify", spotifyAudio, createCalls),
      createTrackedProvider("kuroneko-playlist", playlistAudio, createCalls),
    ]);
    const store = createMusicStore(playlistAudio, repository, registry);

    await store.getState().toggle();
    await store.getState().setSource("spotify");

    expect(playlistAudio.paused).toBe(1);
    expect(spotifyAudio.played).toBe(1);
    expect(store.getState()).toMatchObject({ source: "spotify", enabled: true, isPlaying: true });
  });

  it("hydrates the persisted playlist source into the active audio service before preview", async () => {
    const spotifyAudio = createAudioService();
    const playlistAudio = createAudioService();
    const createCalls: string[] = [];
    const repository = createMemoryMusicPreferenceRepository(false, "kuroneko-playlist");
    const registry = createMusicSourceRegistry([
      createTrackedProvider("spotify", spotifyAudio, createCalls),
      createTrackedProvider("kuroneko-playlist", playlistAudio, createCalls),
    ]);
    const store = createMusicStore(playlistAudio, repository, registry);

    await store.getState().hydrate();
    await store.getState().toggle();

    expect(store.getState()).toMatchObject({ source: "kuroneko-playlist", enabled: true, isPlaying: true });
    expect(spotifyAudio.paused).toBe(0);
    expect(spotifyAudio.played).toBe(0);
    expect(playlistAudio.volumes).toEqual([VOLUME_PRESETS.normal]);
    expect(playlistAudio.played).toBe(1);
    expect(createCalls).toEqual([]);
  });

  it("hydrates source from preferences and defaults to Kurone-ko playlist when missing", async () => {
    const storedRepository = createMemoryMusicPreferenceRepository(false, "spotify");
    const defaultRepository = createMemoryMusicPreferenceRepository(false);
    const storedStore = createMusicStore(createAudioService(), storedRepository);
    const defaultStore = createMusicStore(createAudioService(), defaultRepository);

    await storedStore.getState().hydrate();
    await defaultStore.getState().hydrate();

    expect(storedStore.getState().source).toBe("spotify");
    expect(defaultStore.getState().source).toBe("kuroneko-playlist");
  });

  it("migrates obsolete generated ambience source preferences to the Kurone-ko playlist source", async () => {
    window.localStorage.setItem("kurone-ko.music.source", "generated-ambience");
    const repository = createLocalStorageMusicPreferenceRepository();
    const store = createMusicStore(createAudioService(), repository);

    await store.getState().hydrate();

    expect(store.getState().source).toBe("kuroneko-playlist");
    expect(window.localStorage.getItem("kurone-ko.music.source")).toBe("kuroneko-playlist");
  });

  it("migrates legacy curated source preferences to the Kurone-ko playlist source", async () => {
    window.localStorage.setItem("kurone-ko.music.source", "kuroneko-curated");
    window.localStorage.setItem("kurone-ko.music.curatedPlaylist", "nature-calm");
    const repository = createLocalStorageMusicPreferenceRepository();
    const store = createMusicStore(createAudioService(), repository);

    await store.getState().hydrate();

    expect(store.getState().source).toBe("kuroneko-playlist");
    expect(window.localStorage.getItem("kurone-ko.music.curatedPlaylist")).toBe("nature-calm");
  });

  it("stores volume while stopped and applies it on next play", async () => {
    const audioService = createAudioService();
    const store = createMusicStore(audioService, createMemoryMusicPreferenceRepository(false));

    store.getState().setVolume(VOLUME_PRESETS.quiet);
    await store.getState().toggle();

    expect(store.getState()).toMatchObject({ enabled: true, isPlaying: true, volume: VOLUME_PRESETS.quiet });
    expect(audioService.volumes).toEqual([VOLUME_PRESETS.quiet]);
  });
});
