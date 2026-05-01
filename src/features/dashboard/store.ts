import { create } from "zustand";

export const ONBOARDING_DISMISSED_STORAGE_KEY = "kurone-ko.onboarding.dismissed";

export interface DashboardState {
  onboardingDismissed: boolean;
  setOnboardingDismissed: (dismissed: boolean) => void;
  showOnboarding: () => void;
}

const readOnboardingDismissed = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY) === "true";
};

const persistOnboardingDismissed = (dismissed: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, dismissed ? "true" : "false");
};

export const createDashboardStore = () =>
  create<DashboardState>()((set) => ({
    onboardingDismissed: readOnboardingDismissed(),
    setOnboardingDismissed: (dismissed) => {
      persistOnboardingDismissed(dismissed);
      set({ onboardingDismissed: dismissed });
    },
    showOnboarding: () => {
      persistOnboardingDismissed(false);
      set({ onboardingDismissed: false });
    },
  }));

export const useDashboardStore = createDashboardStore();
