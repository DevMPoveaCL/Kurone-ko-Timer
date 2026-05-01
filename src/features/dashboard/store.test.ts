// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { createDashboardStore, ONBOARDING_DISMISSED_STORAGE_KEY } from "./store";

describe("dashboard store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("treats a missing onboarding flag as not dismissed and persists dismissal", () => {
    const store = createDashboardStore();

    expect(store.getState().onboardingDismissed).toBe(false);

    store.getState().setOnboardingDismissed(true);

    expect(store.getState().onboardingDismissed).toBe(true);
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBe("true");
  });

  it("hydrates true from localStorage and showOnboarding resets the persisted flag", () => {
    window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, "true");
    const store = createDashboardStore();

    expect(store.getState().onboardingDismissed).toBe(true);

    store.getState().showOnboarding();

    expect(store.getState().onboardingDismissed).toBe(false);
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBe("false");
  });
});
