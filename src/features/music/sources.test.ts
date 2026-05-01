import { describe, expect, it } from "vitest";
import { createSilentMusicAudioService } from "./audio";
import type { PlaylistAudioElement } from "./playlist";
import { createMusicSourceRegistry, type MusicSourceProvider } from "./sources";

const createProvider = (id: MusicSourceProvider["id"]): MusicSourceProvider => ({
  id,
  label: `Provider ${id}`,
  isAvailable: () => true,
  createAudioService: createSilentMusicAudioService,
});

describe("music source registry", () => {
  it("rejects duplicate provider IDs so lookups stay deterministic", () => {
    const registry = createMusicSourceRegistry([]);
    const provider = createProvider("kuroneko-playlist");

    registry.register(provider);

    expect(() => registry.register(provider)).toThrow(/Duplicate music source provider: kuroneko-playlist/);
  });

  it("does not expose obsolete generated ambience as a provider", () => {
    const registry = createMusicSourceRegistry();

    expect(registry.getProviders().map((provider) => provider.id)).not.toContain("generated-ambience");
  });

  it("filters available providers to only the Kurone-ko playlist", () => {
    const registry = createMusicSourceRegistry();

    expect(registry.getAvailableProviders().map((provider) => provider.id)).toEqual(["kuroneko-playlist"]);
    expect(registry.getAvailableProviders().map((provider) => provider.id)).not.toContain("kuroneko-curated");
    expect(registry.getProvider("kuroneko-playlist")).toMatchObject({
      id: "kuroneko-playlist",
      label: "Kurone-ko Playlist",
    });
  });

  it("exposes unavailable external placeholders that cannot create audio services", () => {
    const registry = createMusicSourceRegistry();

    expect(registry.getPlaceholders().map((provider) => provider.id)).toEqual([
      "spotify",
      "youtube-music",
    ]);
    for (const provider of registry.getPlaceholders()) {
      expect(provider.isAvailable()).toBe(false);
      expect(() => provider.createAudioService()).toThrow(/not available yet/i);
    }
  });

  it("creates random playlist audio without requiring a category callback", async () => {
    const selectedSources: string[] = [];
    const registry = createMusicSourceRegistry(undefined, (src) => {
      selectedSources.push(src);

      return {
        currentTime: 0,
        loop: false,
        paused: true,
        pause: () => undefined,
        play: async () => undefined,
        removeAttribute: () => undefined,
        src,
        volume: 1,
      } satisfies PlaylistAudioElement;
    }, () => 0.5);

    await registry.getProvider("kuroneko-playlist").createAudioService().play();

    expect(selectedSources).toEqual(["/audio/kuroneko-playlist/07-velvet.ogg"]);
  });
});
