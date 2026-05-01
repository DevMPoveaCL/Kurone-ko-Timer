import { useEffect, useState } from "react";
import { useSettingsStore } from "../../features/settings/store";
import type { TimerSettings } from "../../features/timer/model";

export interface AppHydrationDependencies {
  hydrateSettings: () => Promise<void>;
  hydrateHistory: () => Promise<void>;
  hydrateMusic: () => Promise<void>;
  hydrate: () => Promise<void>;
  setSettings: (settings: TimerSettings) => void;
}

export interface AppHydrationResult {
  hydrated: boolean;
}

let hydrationPromise: Promise<void> | null = null;
let hydrationComplete = false;

export const resetAppHydrationForTests = () => {
  hydrationPromise = null;
  hydrationComplete = false;
};

export function useAppHydration({
  hydrateSettings,
  hydrateHistory,
  hydrateMusic,
  hydrate,
  setSettings,
}: AppHydrationDependencies): AppHydrationResult {
  const [hydrated, setHydrated] = useState(hydrationComplete);

  useEffect(() => {
    let cancelled = false;

    if (hydrationComplete) {
      setHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    hydrationPromise ??= Promise.all([hydrateSettings(), hydrateHistory(), hydrateMusic()])
      .then(async () => {
        await hydrate();
        setSettings(useSettingsStore.getState().settings);
        hydrationComplete = true;
      });

    void hydrationPromise.then(() => {
      if (!cancelled) {
        setHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hydrate, hydrateHistory, hydrateMusic, hydrateSettings, setSettings]);

  return { hydrated };
}
