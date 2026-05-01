import type { MusicAudioService } from "./audio";
import { createPlaylistAudioService, type PlaylistAudioElementFactory, type PlaylistRandomFn } from "./playlist";

export const MUSIC_SOURCE = {
  KURONEKO_PLAYLIST: "kuroneko-playlist",
  SPOTIFY: "spotify",
  YOUTUBE_MUSIC: "youtube-music",
} as const;

export type MusicSourceId = (typeof MUSIC_SOURCE)[keyof typeof MUSIC_SOURCE];

export const OBSOLETE_MUSIC_SOURCE = {
  GENERATED_AMBIENCE: "generated-ambience",
  KURONEKO_CURATED: "kuroneko-curated",
} as const;

export interface MusicSourceProvider {
  readonly id: MusicSourceId;
  readonly label: string;
  readonly isAvailable: () => boolean;
  readonly createAudioService: () => MusicAudioService;
}

export interface MusicSourceRegistry {
  readonly register: (provider: MusicSourceProvider) => void;
  readonly getProvider: (id: MusicSourceId) => MusicSourceProvider;
  readonly getAvailableProviders: () => MusicSourceProvider[];
  readonly getPlaceholders: () => MusicSourceProvider[];
  readonly getProviders: () => MusicSourceProvider[];
}

const createUnavailableProvider = (id: MusicSourceId, label: string): MusicSourceProvider => ({
  id,
  label,
  isAvailable: () => false,
  createAudioService: () => {
    throw new Error(`${label} is not available yet`);
  },
});

const createDefaultProviders = (
  createPlaylistAudioElement?: PlaylistAudioElementFactory,
  playlistRandomFn?: PlaylistRandomFn,
): readonly MusicSourceProvider[] => [
    {
      id: MUSIC_SOURCE.KURONEKO_PLAYLIST,
      label: "Kurone-ko Playlist",
      isAvailable: () => true,
      createAudioService: () => createPlaylistAudioService(createPlaylistAudioElement, playlistRandomFn),
    },
    createUnavailableProvider(MUSIC_SOURCE.SPOTIFY, "Spotify"),
    createUnavailableProvider(MUSIC_SOURCE.YOUTUBE_MUSIC, "YouTube Music"),
  ];

export const createMusicSourceRegistry = (
  providers: readonly MusicSourceProvider[] | undefined = undefined,
  createPlaylistAudioElement?: PlaylistAudioElementFactory,
  playlistRandomFn?: PlaylistRandomFn,
): MusicSourceRegistry => {
  const sourceProviders = providers ?? createDefaultProviders(createPlaylistAudioElement, playlistRandomFn);
  const providersById = new Map<MusicSourceId, MusicSourceProvider>();

  const register = (provider: MusicSourceProvider): void => {
    if (providersById.has(provider.id)) {
      throw new Error(`Duplicate music source provider: ${provider.id}`);
    }

    providersById.set(provider.id, provider);
  };

  sourceProviders.forEach(register);

  return {
    register,
    getProvider: (id) => {
      const provider = providersById.get(id);

      if (provider === undefined) {
        throw new Error(`Unknown music source provider: ${id}`);
      }

      return provider;
    },
    getAvailableProviders: () => Array.from(providersById.values()).filter((provider) => provider.isAvailable()),
    getPlaceholders: () => Array.from(providersById.values()).filter((provider) => !provider.isAvailable()),
    getProviders: () => Array.from(providersById.values()),
  };
};

export const musicSourceRegistry = createMusicSourceRegistry();
