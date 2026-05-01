// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_STATUS, SESSION_TYPE, useHistoryStore } from "../../history/store";
import { ONBOARDING_DISMISSED_STORAGE_KEY, useDashboardStore } from "../store";
import { Dashboard } from "./Dashboard";

const mockSwitchToTimer = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));

vi.mock("../../../shared/window/switcher", () => ({
  switchToTimer: () => mockSwitchToTimer(),
}));

describe("Dashboard", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    useDashboardStore.setState({ onboardingDismissed: false });
    useHistoryStore.setState({ sessions: [], hydrated: true, error: null, hydrate: async () => undefined });
    vi.clearAllMocks();
  });

  it("renders the guided dashboard flow entries", () => {
    render(<Dashboard />);

    expect(screen.getByRole("button", { name: "Start Focus" }).textContent).toContain("Start Focus");
    expect(screen.getByRole("button", { name: "Configuration" }).textContent).toContain("Configuration");
    expect(screen.getByRole("button", { name: "Instructions" }).textContent).toContain("Instructions");
    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("0 sessions · 0 min");
    expect(screen.getByRole("dialog", { name: "Welcome to KURONE-KO" }).getAttribute("aria-modal")).toBe("true");
  });

  it("shows today's completed focus sessions and focused minutes", () => {
    const today = new Date().toISOString().slice(0, 10);
    useHistoryStore.setState({
      sessions: [
        {
          id: "today-1",
          completedAt: `${today}T09:00:00.000Z`,
          durationSeconds: 1_500,
          durationMinutes: 25,
          type: SESSION_TYPE.FOCUS,
          status: SESSION_STATUS.COMPLETED,
        },
        {
          id: "today-2",
          completedAt: `${today}T10:00:00.000Z`,
          durationSeconds: 900,
          durationMinutes: 15,
          type: SESSION_TYPE.FOCUS,
          status: SESSION_STATUS.COMPLETED,
        },
      ],
    });

    render(<Dashboard />);

    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("2 sessions · 40 min");
  });

  it("does not count zero-minute completed-like entries in today's focus summary", () => {
    const today = new Date().toISOString().slice(0, 10);
    useHistoryStore.setState({
      sessions: [
        {
          id: "today-1",
          completedAt: `${today}T09:00:00.000Z`,
          durationSeconds: 1_500,
          durationMinutes: 25,
          type: SESSION_TYPE.FOCUS,
          status: SESSION_STATUS.COMPLETED,
        },
        {
          id: "future-placeholder",
          completedAt: `${today}T09:30:00.000Z`,
          durationSeconds: 0,
          durationMinutes: 0,
          type: SESSION_TYPE.FOCUS,
          status: SESSION_STATUS.COMPLETED,
        },
      ],
    });

    render(<Dashboard />);

    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("1 sessions · 25 min");
  });

  it("refreshes the focus summary when dashboard focus returns after external history changes", async () => {
    const today = new Date().toISOString().slice(0, 10);
    let externalHistoryAvailable = false;
    const hydrate = vi.fn<() => Promise<void>>(async () => {
      if (!externalHistoryAvailable) {
        return;
      }

      useHistoryStore.setState({
        sessions: [
          {
            id: "external-today-1",
            completedAt: `${today}T11:00:00.000Z`,
            durationSeconds: 1_500,
            durationMinutes: 25,
            type: SESSION_TYPE.FOCUS,
            status: SESSION_STATUS.COMPLETED,
          },
        ],
      });
    });
    useHistoryStore.setState({ sessions: [], hydrated: true, error: null, hydrate });

    render(<Dashboard />);
    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("0 sessions · 0 min");

    externalHistoryAvailable = true;
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(screen.getByLabelText("Today's focus summary").textContent).toContain("1 sessions · 25 min");
    });
    expect(hydrate).toHaveBeenCalled();
  });

  it("opens the timer window when Start Focus is activated", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Start Focus" }));

    expect(mockSwitchToTimer).toHaveBeenCalledTimes(1);
  });

  it("shows configuration and returns to the main flow without starting a window transition", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Configuration" }));

    expect(mockSwitchToTimer).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Configuration" }).textContent).toBe("Configuration");

    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));

    expect(screen.getByRole("button", { name: "Start Focus" }).textContent).toContain("Start Focus");
  });

  it("shows onboarding on first launch and lets Instructions reopen it after persisted dismissal", () => {
    window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, "true");
    useDashboardStore.setState({ onboardingDismissed: true });

    render(<Dashboard />);

    expect(screen.queryByRole("dialog", { name: "Welcome to KURONE-KO" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Instructions" }));

    expect(screen.getByRole("dialog", { name: "Welcome to KURONE-KO" }).getAttribute("aria-modal")).toBe("true");
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBe("false");
  });
});
