export const MUSIC_VOLUME = {
  NORMAL: 0.16,
  DUCKED: 0.035,
} as const;

export interface MusicAudioService {
  isPlaying: () => boolean;
  pause: () => void;
  play: () => Promise<void>;
  resume: () => Promise<void>;
  setVolume: (volume: number) => void;
  stop: () => void;
}

export interface MusicDuckingController {
  setDucked: (ducked: boolean) => void;
}

export interface MusicFocusSessionController extends MusicDuckingController {
  pauseForTimer: () => Promise<void>;
  resumeForTimerFocus?: () => Promise<void>;
  resumeAfterTimerPause: () => Promise<void>;
  stopForTimerBreak?: () => Promise<void>;
  stopForTimer: () => Promise<void>;
}

export const createSilentMusicAudioService = (): MusicAudioService => {
  let playing = false;

  return {
    isPlaying: () => playing,
    pause: () => {
      playing = false;
    },
    play: async () => {
      playing = true;
    },
    resume: async () => {
      playing = true;
    },
    setVolume: () => undefined,
    stop: () => {
      playing = false;
    },
  };
};
