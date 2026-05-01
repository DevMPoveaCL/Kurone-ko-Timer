export const TIMER_SOUND_EVENT = {
  FOCUS_START: "focus-start",
  BREAK_START: "break-start",
  SESSION_COMPLETE: "session-complete",
} as const;

export type TimerSoundEvent = (typeof TIMER_SOUND_EVENT)[keyof typeof TIMER_SOUND_EVENT];

export interface TimerSoundPlayer {
  prime?: () => void;
  play: (event: TimerSoundEvent) => void;
}

interface BeepPreset {
  frequencyHz: number;
  durationSeconds: number;
  volume: number;
  type: OscillatorType;
}

const BEEP_PRESET: Record<TimerSoundEvent, BeepPreset> = {
  [TIMER_SOUND_EVENT.FOCUS_START]: {
    frequencyHz: 660,
    durationSeconds: 0.08,
    volume: 0.055,
    type: "sine",
  },
  [TIMER_SOUND_EVENT.BREAK_START]: {
    frequencyHz: 880,
    durationSeconds: 0.12,
    volume: 0.08,
    type: "sine",
  },
  [TIMER_SOUND_EVENT.SESSION_COMPLETE]: {
    frequencyHz: 1_100,
    durationSeconds: 0.22,
    volume: 0.11,
    type: "triangle",
  },
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const getAudioContextConstructor = (): typeof AudioContext | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.AudioContext ?? window.webkitAudioContext ?? null;
};

const createAudioContext = (): AudioContext | null => {
  const AudioContextConstructor = getAudioContextConstructor();

  if (AudioContextConstructor === null) {
    return null;
  }

  return new AudioContextConstructor();
};

const resumeAudioContext = (audioContext: AudioContext) => {
  if (audioContext.state !== "suspended") {
    return;
  }

  void audioContext.resume().catch(() => {
    // Some WebViews deny audio until a user gesture. The next normal control click
    // will try to unlock the context again; timer state must never depend on audio.
  });
};

const playOscillatorBeep = (audioContext: AudioContext, preset: BeepPreset) => {
  const startAt = audioContext.currentTime;
  const stopAt = startAt + preset.durationSeconds;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = preset.type;
  oscillator.frequency.setValueAtTime(preset.frequencyHz, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(preset.volume, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(stopAt);
};

export const createBrowserTimerSoundPlayer = (): TimerSoundPlayer => {
  let audioContext: AudioContext | null = null;

  const getAudioContext = () => {
    audioContext ??= createAudioContext();
    return audioContext;
  };

  return {
    prime: () => {
      const context = getAudioContext();

      if (context === null) {
        return;
      }

      resumeAudioContext(context);
    },
    play: (event) => {
      const context = getAudioContext();

      if (context === null) {
        return;
      }

      try {
        resumeAudioContext(context);
        playOscillatorBeep(context, BEEP_PRESET[event]);
      } catch {
        // Audio output is best-effort. Never break phase transitions because of
        // a WebView/browser audio failure.
      }
    },
  };
};

export const createBrowserPhaseEndSoundPlayer = createBrowserTimerSoundPlayer;

export const createSilentTimerSoundPlayer = (): TimerSoundPlayer => ({
  prime: () => undefined,
  play: () => undefined,
});

export const createSilentPhaseEndSoundPlayer = createSilentTimerSoundPlayer;
