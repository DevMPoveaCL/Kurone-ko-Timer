import { useEffect } from "react";
import { MUSIC_SOURCE, musicSourceRegistry, type MusicSourceId, type MusicSourceProvider } from "../../music/sources";
import { useMusicStore } from "../../music/store";
import { useSettingsStore } from "../../settings/store";
import type { TimerSettings } from "../../timer/model";

export interface ConfigPanelProps {
  onBack: () => void;
}

const FUTURE_SLOTS = ["AI", "Brain", "Kanban", "Methods"] as const;
const SOURCE_STATUS_LABELS = {
  [MUSIC_SOURCE.KURONEKO_PLAYLIST]: "Kurone-ko Playlist",
  [MUSIC_SOURCE.SPOTIFY]: "Spotify",
  [MUSIC_SOURCE.YOUTUBE_MUSIC]: "YouTube Music",
} as const;

const resolveMusicStatus = (source: MusicSourceId): string =>
  `${SOURCE_STATUS_LABELS[source]} configured for focus sessions`;

const renderSourceOption = (provider: MusicSourceProvider, selectedSource: MusicSourceProvider["id"], setSource: (source: MusicSourceProvider["id"]) => Promise<void>) => {
  const available = provider.isAvailable();

  return (
    <label key={provider.id}>
      <input
        type="radio"
        name="music-source"
        value={provider.id}
        checked={selectedSource === provider.id}
        disabled={!available}
        onClick={() => {
          if (available) {
            void setSource(provider.id);
          }
        }}
        onChange={() => undefined}
      />
      {provider.label}
      {!available ? <span> Coming later</span> : null}
    </label>
  );
};

export function ConfigPanel({ onBack }: ConfigPanelProps) {
  const settings = useSettingsStore((state) => state.settings);
  const settingsHydrated = useSettingsStore((state) => state.hydrated);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const musicSource = useMusicStore((state) => state.source);
  const musicHydrated = useMusicStore((state) => state.hydrated);
  const hydrateMusic = useMusicStore((state) => state.hydrate);
  const setMusicSource = useMusicStore((state) => state.setSource);

  useEffect(() => {
    if (!settingsHydrated) {
      void hydrateSettings();
    }

    if (!musicHydrated) {
      void hydrateMusic();
    }
  }, [hydrateMusic, hydrateSettings, musicHydrated, settingsHydrated]);

  const updateDuration = (key: keyof Pick<TimerSettings, "focusDurationSeconds" | "shortBreakDurationSeconds" | "longBreakDurationSeconds">, minutes: number) => {
    void updateSettings({ [key]: minutes * 60 });
  };

  const updateIntegerSetting = (key: keyof Pick<TimerSettings, "sessionGoal" | "sessionsBeforeLongBreak">, value: number) => {
    void updateSettings({ [key]: value });
  };

  return (
    <section className="config-shell" aria-label="Session configuration" data-interactive-region>
      <button className="dashboard-link-button" type="button" onClick={onBack}>Back to dashboard</button>
      <p className="dashboard-eyebrow">Pre-focus setup</p>
      <h2>Configuration</h2>

      <div className="config-section" aria-label="Timer setup">
        <h3>Timer</h3>
        <label>
          Focus minutes
          <input type="number" min={1} value={settings.focusDurationSeconds / 60} onChange={(event) => updateDuration("focusDurationSeconds", event.currentTarget.valueAsNumber)} />
        </label>
        <label>
          Short break minutes
          <input type="number" min={1} value={settings.shortBreakDurationSeconds / 60} onChange={(event) => updateDuration("shortBreakDurationSeconds", event.currentTarget.valueAsNumber)} />
        </label>
        <label>
          Long break minutes
          <input type="number" min={1} value={settings.longBreakDurationSeconds / 60} onChange={(event) => updateDuration("longBreakDurationSeconds", event.currentTarget.valueAsNumber)} />
        </label>
        <label>
          Daily goal sessions
          <input type="number" min={1} value={settings.sessionGoal} onChange={(event) => updateIntegerSetting("sessionGoal", event.currentTarget.valueAsNumber)} />
        </label>
        <label>
          Long break after sessions
          <input type="number" min={1} value={settings.sessionsBeforeLongBreak} onChange={(event) => updateIntegerSetting("sessionsBeforeLongBreak", event.currentTarget.valueAsNumber)} />
        </label>
      </div>

      <div className="config-section config-music" aria-label="Music setup">
        <h3>Music</h3>
        <fieldset>
          <legend>Music source</legend>
          {musicSourceRegistry.getProviders().map((provider) => renderSourceOption(provider, musicSource, setMusicSource))}
        </fieldset>
        <div aria-live="polite">
          <output>{resolveMusicStatus(musicSource)}</output>
        </div>
      </div>

      <div className="config-placeholders" aria-label="Future setup slots">
        {FUTURE_SLOTS.map((slot) => (
          <button className="config-placeholder" type="button" aria-label={`${slot} integration unavailable`} aria-disabled="true" disabled key={slot}>
            {slot}
            <span>Coming later</span>
          </button>
        ))}
      </div>
    </section>
  );
}
