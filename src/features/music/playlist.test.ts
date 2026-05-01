import { describe, expect, it, vi } from "vitest";
import { MUSIC_VOLUME } from "./audio";
import {
  KURONEKO_PLAYLIST_TRACKS,
  createPlaylistAudioService,
  selectRandomPlaylistTrack,
  type PlaylistAudioElement,
} from "./playlist";

interface MockPlaylistAudioElement extends PlaylistAudioElement {
  pauseCalls: number;
  playCalls: number;
  removedAttributes: string[];
}

const createMockAudioElement = (src: string): MockPlaylistAudioElement => {
  const audio: MockPlaylistAudioElement = {
    currentTime: 12,
    loop: false,
    pauseCalls: 0,
    paused: true,
    play: vi.fn(async () => {
      audio.paused = false;
      audio.playCalls += 1;
    }),
    playCalls: 0,
    pause: vi.fn(() => {
      audio.paused = true;
      audio.pauseCalls += 1;
    }),
    removedAttributes: [],
    removeAttribute: vi.fn((attribute) => {
      audio.removedAttributes.push(attribute);
    }),
    src,
    volume: 1,
  };

  return audio;
};

describe("Kurone-ko playlist", () => {
  it("registers the thirteen public ogg tracks served by Vite from the public root", () => {
    expect(KURONEKO_PLAYLIST_TRACKS.map((track) => track.src)).toEqual([
      "/audio/kuroneko-playlist/01-brass-silence.ogg",
      "/audio/kuroneko-playlist/02-silt-prisms.ogg",
      "/audio/kuroneko-playlist/03-silt-prisms.ogg",
      "/audio/kuroneko-playlist/04-chords.ogg",
      "/audio/kuroneko-playlist/05-cobblestone.ogg",
      "/audio/kuroneko-playlist/06-creeper.ogg",
      "/audio/kuroneko-playlist/07-velvet.ogg",
      "/audio/kuroneko-playlist/08-bloom.ogg",
      "/audio/kuroneko-playlist/09-stone-wind.ogg",
      "/audio/kuroneko-playlist/10-stone-lullaby.ogg",
      "/audio/kuroneko-playlist/11-sky.ogg",
      "/audio/kuroneko-playlist/12-desert.ogg",
      "/audio/kuroneko-playlist/13-violet.ogg",
    ]);
  });

  it.each([
    { expectedSrc: "/audio/kuroneko-playlist/01-brass-silence.ogg", randomValue: 0 },
    { expectedSrc: "/audio/kuroneko-playlist/07-velvet.ogg", randomValue: 0.5 },
    { expectedSrc: "/audio/kuroneko-playlist/13-violet.ogg", randomValue: 0.99 },
  ] as const)("selects a deterministic track from injected random value $randomValue", ({ expectedSrc, randomValue }) => {
    expect(selectRandomPlaylistTrack(() => randomValue).src).toBe(expectedSrc);
  });

  it("creates and plays audio with the selected track path", async () => {
    const createdAudioElements: MockPlaylistAudioElement[] = [];
    const service = createPlaylistAudioService((src) => {
      const audio = createMockAudioElement(src);
      createdAudioElements.push(audio);

      return audio;
    }, () => 0.5);

    await service.play();

    expect(createdAudioElements.map((audio) => audio.src)).toEqual(["/audio/kuroneko-playlist/07-velvet.ogg"]);
    expect(createdAudioElements[0].loop).toBe(true);
    expect(createdAudioElements[0].volume).toBe(MUSIC_VOLUME.NORMAL);
    expect(createdAudioElements[0].playCalls).toBe(1);
    expect(service.isPlaying()).toBe(true);
  });

  it("pauses the active audio element without clearing track state", async () => {
    const audio = createMockAudioElement("");
    const service = createPlaylistAudioService(() => audio, () => 0);

    await service.play();
    audio.currentTime = 42;
    service.setVolume(MUSIC_VOLUME.DUCKED);
    service.pause();

    expect(audio.volume).toBe(MUSIC_VOLUME.DUCKED);
    expect(audio.pauseCalls).toBe(1);
    expect(audio.currentTime).toBe(42);
    expect(audio.removedAttributes).toEqual([]);
    expect(service.isPlaying()).toBe(false);
  });

  it("resumes a paused playlist track without creating a new audio element or selecting a new random track", async () => {
    const randomFn = vi.fn(() => 0.5);
    const createdAudioElements: MockPlaylistAudioElement[] = [];
    const service = createPlaylistAudioService((src) => {
      const audio = createMockAudioElement(src);
      createdAudioElements.push(audio);

      return audio;
    }, randomFn);

    await service.play();
    const currentAudio = createdAudioElements[0];
    currentAudio.currentTime = 37;
    service.pause();
    await service.resume();

    expect(createdAudioElements).toHaveLength(1);
    expect(randomFn).toHaveBeenCalledTimes(1);
    expect(currentAudio.src).toBe("/audio/kuroneko-playlist/07-velvet.ogg");
    expect(currentAudio.currentTime).toBe(37);
    expect(currentAudio.playCalls).toBe(2);
    expect(service.isPlaying()).toBe(true);
  });

  it("stops and clears active audio so the next fresh play selects a fresh track", async () => {
    const randomValues = [0, 0.99];
    const randomFn = vi.fn(() => randomValues.shift() ?? 0);
    const createdAudioElements: MockPlaylistAudioElement[] = [];
    const service = createPlaylistAudioService((src) => {
      const audio = createMockAudioElement(src);
      createdAudioElements.push(audio);

      return audio;
    }, randomFn);

    await service.play();
    createdAudioElements[0].currentTime = 44;
    service.stop();
    await service.play();

    expect(createdAudioElements.map((audio) => audio.src)).toEqual([
      "/audio/kuroneko-playlist/01-brass-silence.ogg",
      "/audio/kuroneko-playlist/13-violet.ogg",
    ]);
    expect(randomFn).toHaveBeenCalledTimes(2);
    expect(createdAudioElements[0].currentTime).toBe(0);
    expect(createdAudioElements[0].removedAttributes).toEqual(["src"]);
    expect(createdAudioElements[1].playCalls).toBe(1);
  });

  it("repeated play starts a newly selected track and cleans up the previous audio", async () => {
    const randomValues = [0, 0.99];
    const createdAudioElements: MockPlaylistAudioElement[] = [];
    const service = createPlaylistAudioService((src) => {
      const audio = createMockAudioElement(src);
      createdAudioElements.push(audio);

      return audio;
    }, () => randomValues.shift() ?? 0);

    await service.play();
    await service.play();

    expect(createdAudioElements.map((audio) => audio.src)).toEqual([
      "/audio/kuroneko-playlist/01-brass-silence.ogg",
      "/audio/kuroneko-playlist/13-violet.ogg",
    ]);
    expect(createdAudioElements[0].pauseCalls).toBe(1);
    expect(createdAudioElements[0].removedAttributes).toEqual(["src"]);
    expect(createdAudioElements[1].playCalls).toBe(1);
    expect(service.isPlaying()).toBe(true);
  });
});
