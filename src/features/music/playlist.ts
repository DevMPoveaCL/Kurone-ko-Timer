import { MUSIC_VOLUME, type MusicAudioService } from "./audio";

export interface PlaylistTrack {
  readonly id: string;
  readonly src: string;
}

export interface PlaylistAudioElement {
  currentTime: number;
  loop: boolean;
  paused: boolean;
  src: string;
  volume: number;
  pause: () => void;
  play: () => Promise<void>;
  removeAttribute: (qualifiedName: string) => void;
}

export type PlaylistAudioElementFactory = (src: string) => PlaylistAudioElement;
export type PlaylistRandomFn = () => number;
export type KuronekoPlaylistTrack = (typeof KURONEKO_PLAYLIST_TRACKS)[number];

export const KURONEKO_PLAYLIST_TRACKS = [
  { id: "brass-silence", src: "/audio/kuroneko-playlist/01-brass-silence.ogg" },
  { id: "silt-prisms-02", src: "/audio/kuroneko-playlist/02-silt-prisms.ogg" },
  { id: "silt-prisms-03", src: "/audio/kuroneko-playlist/03-silt-prisms.ogg" },
  { id: "chords", src: "/audio/kuroneko-playlist/04-chords.ogg" },
  { id: "cobblestone", src: "/audio/kuroneko-playlist/05-cobblestone.ogg" },
  { id: "creeper", src: "/audio/kuroneko-playlist/06-creeper.ogg" },
  { id: "velvet", src: "/audio/kuroneko-playlist/07-velvet.ogg" },
  { id: "bloom", src: "/audio/kuroneko-playlist/08-bloom.ogg" },
  { id: "stone-wind", src: "/audio/kuroneko-playlist/09-stone-wind.ogg" },
  { id: "stone-lullaby", src: "/audio/kuroneko-playlist/10-stone-lullaby.ogg" },
  { id: "sky", src: "/audio/kuroneko-playlist/11-sky.ogg" },
  { id: "desert", src: "/audio/kuroneko-playlist/12-desert.ogg" },
  { id: "violet", src: "/audio/kuroneko-playlist/13-violet.ogg" },
] as const satisfies readonly PlaylistTrack[];

export const selectRandomPlaylistTrack = (randomFn: PlaylistRandomFn): KuronekoPlaylistTrack => {
  const randomValue = Math.min(0.999_999, Math.max(0, randomFn()));
  const trackIndex = Math.floor(randomValue * KURONEKO_PLAYLIST_TRACKS.length);

  return KURONEKO_PLAYLIST_TRACKS[trackIndex];
};

const createBrowserAudioElement = (src: string): PlaylistAudioElement => new Audio(src);

const safelyPauseAudio = (audioElement: PlaylistAudioElement): void => {
  try {
    audioElement.pause();
  } catch {
    // Audio shutdown is best-effort; browser implementations may throw during teardown.
  }
};

export const createPlaylistAudioService = (
  createAudioElement: PlaylistAudioElementFactory = createBrowserAudioElement,
  randomFn: PlaylistRandomFn = Math.random,
): MusicAudioService => {
  let activeAudioElement: PlaylistAudioElement | null = null;
  let volume: number = MUSIC_VOLUME.NORMAL;

  const cleanupActiveAudio = (): void => {
    if (activeAudioElement === null) {
      return;
    }

    safelyPauseAudio(activeAudioElement);
    activeAudioElement.currentTime = 0;
    activeAudioElement.removeAttribute("src");
    activeAudioElement = null;
  };

  const pauseActiveAudio = (): void => {
    if (activeAudioElement === null) {
      return;
    }

    safelyPauseAudio(activeAudioElement);
  };

  const applyVolume = (nextVolume: number): void => {
    volume = Math.min(1, Math.max(0, nextVolume));

    if (activeAudioElement !== null) {
      activeAudioElement.volume = volume;
    }
  };

  const playFreshTrack = async (): Promise<void> => {
    cleanupActiveAudio();

    const track = selectRandomPlaylistTrack(randomFn);
    const audioElement = createAudioElement(track.src);
    audioElement.loop = true;
    audioElement.volume = volume;
    activeAudioElement = audioElement;

    try {
      await audioElement.play();
    } catch (error) {
      cleanupActiveAudio();

      throw error;
    }
  };

  return {
    isPlaying: () => activeAudioElement !== null && !activeAudioElement.paused,

    pause: pauseActiveAudio,

    play: playFreshTrack,

    resume: async () => {
      if (activeAudioElement === null) {
        await playFreshTrack();

        return;
      }

      await activeAudioElement.play();
    },

    setVolume: applyVolume,

    stop: cleanupActiveAudio,
  };
};
