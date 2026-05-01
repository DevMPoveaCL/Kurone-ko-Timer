import { describe, expect, it } from "vitest";
import { createSilentMusicAudioService } from "./audio";

describe("music audio service test double", () => {
  it("tracks playing state for deterministic store and component tests", async () => {
    const service = createSilentMusicAudioService();

    await service.play();
    expect(service.isPlaying()).toBe(true);

    service.pause();
    expect(service.isPlaying()).toBe(false);

    await service.resume();
    expect(service.isPlaying()).toBe(true);

    service.stop();
    expect(service.isPlaying()).toBe(false);
  });
});
