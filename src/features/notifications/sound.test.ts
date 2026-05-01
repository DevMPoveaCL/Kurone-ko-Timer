import { afterEach, describe, expect, it } from "vitest";
import { createBrowserTimerSoundPlayer, TIMER_SOUND_EVENT } from "./sound";

const restoreWindow = () => {
  Reflect.deleteProperty(globalThis, "window");
};

describe("createBrowserTimerSoundPlayer", () => {
  afterEach(() => {
    restoreWindow();
  });

  it("is a safe no-op when browser audio APIs are unavailable", () => {
    const player = createBrowserTimerSoundPlayer();

    expect(() => player.prime?.()).not.toThrow();
    expect(() => player.play(TIMER_SOUND_EVENT.BREAK_START)).not.toThrow();
  });

  it("uses Web Audio to play distinct oscillator beeps by event", () => {
    let started = false;
    let stopped = false;
    let connected = false;
    const frequencies: number[] = [];
    const oscillatorTypes: OscillatorType[] = [];

    class FakeAudioContext {
      currentTime = 1;
      destination = {};
      state: AudioContextState = "running";

      createOscillator() {
        return {
          connect: () => {
            connected = true;
          },
          frequency: { setValueAtTime: (frequency: number) => frequencies.push(frequency) },
          start: () => {
            started = true;
          },
          stop: () => {
            stopped = true;
          },
          set type(value: OscillatorType) {
            oscillatorTypes.push(value);
          },
          get type() {
            return "sine" as OscillatorType;
          },
        };
      }

      createGain() {
        return {
          connect: () => undefined,
          gain: {
            exponentialRampToValueAtTime: () => undefined,
            setValueAtTime: () => undefined,
          },
        };
      }

      resume() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { AudioContext: FakeAudioContext as unknown as typeof AudioContext },
    });

    const player = createBrowserTimerSoundPlayer();
    player.play(TIMER_SOUND_EVENT.FOCUS_START);
    player.play(TIMER_SOUND_EVENT.BREAK_START);
    player.play(TIMER_SOUND_EVENT.SESSION_COMPLETE);

    expect(connected).toBe(true);
    expect(started).toBe(true);
    expect(stopped).toBe(true);
    expect(frequencies).toEqual([660, 880, 1_100]);
    expect(oscillatorTypes).toEqual(["sine", "sine", "triangle"]);
  });
});
