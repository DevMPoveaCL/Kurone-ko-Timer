import { create } from "zustand";
import { createPlaylistAudioService } from "./playlist";
import { MUSIC_VOLUME, type MusicAudioService } from "./audio";
import { createMusicSourceRegistry, MUSIC_SOURCE, OBSOLETE_MUSIC_SOURCE, type MusicSourceId, type MusicSourceRegistry } from "./sources";

export const VOLUME_PRESETS = {
  quiet: 0.05,
  normal: 0.16,
  focus: 0.3,
} as const satisfies Record<"quiet" | "normal" | "focus", number>;

export interface MusicPreferenceRepository {
  load: () => Promise<boolean>;
  loadSource: () => Promise<MusicSourceId>;
  save: (enabled: boolean) => Promise<void>;
  saveSource: (source: MusicSourceId) => Promise<void>;
}

export interface MusicStore {
  ducked: boolean;
  enabled: boolean;
  error: string | null;
  hydrated: boolean;
  isPlaying: boolean;
  loading: boolean;
  source: MusicSourceId;
  volume: number;
  configure: (audioService: MusicAudioService, repository: MusicPreferenceRepository, registry?: MusicSourceRegistry) => void;
  hydrate: () => Promise<void>;
  pauseForTimer: () => Promise<void>;
  resumeForTimerFocus: () => Promise<void>;
  resumeAfterTimerPause: () => Promise<void>;
  setDucked: (ducked: boolean) => void;
  setSource: (source: MusicSourceId) => Promise<void>;
  setVolume: (volume: number) => void;
  stopForTimerBreak: () => Promise<void>;
  stopForTimer: () => Promise<void>;
  toggle: () => Promise<void>;
}

const MUSIC_PREFERENCE_KEY = "kurone-ko.music.enabled";
const MUSIC_SOURCE_PREFERENCE_KEY = "kurone-ko.music.source";
const DEFAULT_MUSIC_SOURCE: MusicSourceId = MUSIC_SOURCE.KURONEKO_PLAYLIST;
const MUSIC_SOURCE_IDS = Object.values(MUSIC_SOURCE) satisfies readonly MusicSourceId[];

const normalizeError = (error: unknown): string =>
  error instanceof Error ? error.message : "Unexpected music playback error";

export const createMemoryMusicPreferenceRepository = (
  initialEnabled = false,
  initialSource: MusicSourceId = DEFAULT_MUSIC_SOURCE,
): MusicPreferenceRepository => {
  let enabled = initialEnabled;
  let source = initialSource;

  return {
    load: async () => enabled,
    loadSource: async () => source,
    save: async (nextEnabled) => {
      enabled = nextEnabled;
    },
    saveSource: async (nextSource) => {
      source = nextSource;
    },
  };
};

const isMusicSourceId = (value: string | null): value is MusicSourceId =>
  value !== null && MUSIC_SOURCE_IDS.includes(value as MusicSourceId);

export const createLocalStorageMusicPreferenceRepository = (): MusicPreferenceRepository => ({
  load: async () => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(MUSIC_PREFERENCE_KEY) === "true";
  },
  loadSource: async () => {
    if (typeof window === "undefined") {
      return DEFAULT_MUSIC_SOURCE;
    }

    const source = window.localStorage.getItem(MUSIC_SOURCE_PREFERENCE_KEY);

    if (source === OBSOLETE_MUSIC_SOURCE.KURONEKO_CURATED || source === OBSOLETE_MUSIC_SOURCE.GENERATED_AMBIENCE) {
      window.localStorage.setItem(MUSIC_SOURCE_PREFERENCE_KEY, DEFAULT_MUSIC_SOURCE);

      return DEFAULT_MUSIC_SOURCE;
    }

    return isMusicSourceId(source) ? source : DEFAULT_MUSIC_SOURCE;
  },
  save: async (enabled) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(MUSIC_PREFERENCE_KEY, enabled ? "true" : "false");
  },
  saveSource: async (source) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(MUSIC_SOURCE_PREFERENCE_KEY, source);
  },
});

const defaultAudioService = createPlaylistAudioService();
const defaultRepository = createLocalStorageMusicPreferenceRepository();

export const createMusicStore = (
  initialAudioService: MusicAudioService = defaultAudioService,
  initialRepository: MusicPreferenceRepository = defaultRepository,
  initialRegistry?: MusicSourceRegistry,
) => {
  let audioService = initialAudioService;
  let repository = initialRepository;
  let registry: MusicSourceRegistry | null = initialRegistry ?? null;
  let activeAudioSource: MusicSourceId = DEFAULT_MUSIC_SOURCE;

  return create<MusicStore>()((set, get) => {
    registry ??= createMusicSourceRegistry();
    let shouldResumeAfterTimerPause = false;
    let shouldResumeForTimerFocus = false;

    return {
    ducked: false,
    enabled: false,
    error: null,
    hydrated: false,
    isPlaying: false,
    loading: false,
    source: DEFAULT_MUSIC_SOURCE,
    volume: VOLUME_PRESETS.normal,

    configure: (nextAudioService, nextRepository, nextRegistry = createMusicSourceRegistry()) => {
      audioService.stop();
      audioService = nextAudioService;
      repository = nextRepository;
      registry = nextRegistry;
      activeAudioSource = DEFAULT_MUSIC_SOURCE;
      shouldResumeAfterTimerPause = false;
      shouldResumeForTimerFocus = false;
    },

    hydrate: async () => {
      try {
        const [persistedEnabled, source] = await Promise.all([
          repository.load(),
          repository.loadSource(),
        ]);
        const enabled = false;
        const activeRegistry = registry ?? createMusicSourceRegistry();
        registry = activeRegistry;
        const provider = activeRegistry.getProvider(source);

        if (provider.isAvailable() && source !== activeAudioSource) {
          audioService.stop();
          audioService = provider.createAudioService();
          audioService.setVolume(get().ducked ? MUSIC_VOLUME.DUCKED : get().volume);
          activeAudioSource = source;
        }

        if (persistedEnabled) {
          await repository.save(false);
        }

        set({ enabled, source, hydrated: true, error: null, isPlaying: false });
      } catch (error) {
        set({ hydrated: true, error: normalizeError(error), isPlaying: false });
      }
    },

    setDucked: (ducked) => {
      set({ ducked });

      if (get().isPlaying) {
        audioService.setVolume(ducked ? MUSIC_VOLUME.DUCKED : get().volume);
      }
    },

    pauseForTimer: async () => {
      const current = get();
      shouldResumeAfterTimerPause = current.isPlaying;

      if (!current.isPlaying) {
        if (current.enabled) {
          set({ ducked: false, enabled: false, isPlaying: false });
          await repository.save(false);
        }

        return;
      }

      audioService.pause();
      set({ ducked: false, enabled: false, error: null, isPlaying: false, loading: false });
      await repository.save(false);
    },

    resumeAfterTimerPause: async () => {
      if (!shouldResumeAfterTimerPause) {
        return;
      }

      shouldResumeAfterTimerPause = false;
      const current = get();
      set({ loading: true, error: null });

      try {
        audioService.setVolume(current.ducked ? MUSIC_VOLUME.DUCKED : current.volume);
        await audioService.resume();

        const nextPlaying = audioService.isPlaying();
        await repository.save(nextPlaying);
        set({
          ducked: nextPlaying ? current.ducked : false,
          enabled: nextPlaying,
          isPlaying: nextPlaying,
          loading: false,
        });
      } catch (error) {
        await repository.save(false);
        set({ ducked: false, enabled: false, error: normalizeError(error), isPlaying: false, loading: false });
      }
    },

    resumeForTimerFocus: async () => {
      if (!shouldResumeForTimerFocus) {
        return;
      }

      shouldResumeForTimerFocus = false;
      const current = get();
      set({ loading: true, error: null });

      try {
        audioService.setVolume(current.volume);
        await audioService.play();

        const nextPlaying = audioService.isPlaying();
        await repository.save(nextPlaying);
        set({
          ducked: false,
          enabled: nextPlaying,
          isPlaying: nextPlaying,
          loading: false,
        });
      } catch (error) {
        await repository.save(false);
        set({ ducked: false, enabled: false, error: normalizeError(error), isPlaying: false, loading: false });
      }
    },

    setSource: async (source) => {
      const activeRegistry = registry ?? createMusicSourceRegistry();
      registry = activeRegistry;
      const provider = activeRegistry.getProvider(source);

      if (!provider.isAvailable()) {
        set({ error: `${provider.label} is not available yet` });

        return;
      }

      const wasPlaying = get().isPlaying;
      audioService.stop();
      audioService = provider.createAudioService();
      activeAudioSource = source;
      audioService.setVolume(get().ducked ? MUSIC_VOLUME.DUCKED : get().volume);

      if (wasPlaying) {
        await audioService.play();
      }

      await repository.saveSource(source);
      set({ source, error: null, isPlaying: wasPlaying && audioService.isPlaying() });
    },

    setVolume: (volume) => {
      const nextVolume = Math.min(1, Math.max(0, volume));
      set({ volume: nextVolume });

      if (get().isPlaying && !get().ducked) {
        audioService.setVolume(nextVolume);
      }
    },

    stopForTimer: async () => {
      shouldResumeAfterTimerPause = false;
      shouldResumeForTimerFocus = false;
      const current = get();

      audioService.stop();

      set({ ducked: false, enabled: false, isPlaying: false, loading: false });

      if (current.enabled || current.isPlaying) {
        await repository.save(false);
      }
    },

    stopForTimerBreak: async () => {
      shouldResumeAfterTimerPause = false;
      const current = get();
      shouldResumeForTimerFocus = current.enabled && current.isPlaying;

      audioService.stop();
      set({ ducked: false, enabled: false, isPlaying: false, loading: false });

      if (current.enabled || current.isPlaying) {
        await repository.save(false);
      }
    },

    toggle: async () => {
      const current = get();
      const nextEnabled = !(current.enabled && current.isPlaying);
      shouldResumeAfterTimerPause = false;

      set({ loading: true, error: null });

      try {
        if (nextEnabled) {
          audioService.setVolume(current.ducked ? MUSIC_VOLUME.DUCKED : current.volume);
          await audioService.play();
        } else {
          audioService.stop();
        }

        const nextPlaying = nextEnabled && audioService.isPlaying();
        const storedEnabled = nextEnabled ? nextPlaying : false;

        await repository.save(storedEnabled);
        set({
          ducked: storedEnabled ? current.ducked : false,
          enabled: storedEnabled,
          isPlaying: nextPlaying,
          loading: false,
        });
      } catch (error) {
        set({ error: normalizeError(error), loading: false });
      }
    },
  };
  });
};

export const useMusicStore = createMusicStore();
