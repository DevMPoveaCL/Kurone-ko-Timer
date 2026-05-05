// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_STATUS, SESSION_TYPE, useHistoryStore } from "../../history/store";
import { ONBOARDING_DISMISSED_STORAGE_KEY, useDashboardStore } from "../store";
import { Dashboard } from "./Dashboard";

const mockSwitchToTimer = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
const mockOnFocusChanged = vi.fn<(cb: (focused: boolean) => void) => Promise<() => void>>(
  () => Promise.resolve(() => undefined),
);

vi.mock("../../../shared/window/switcher", () => ({
  switchToTimer: () => mockSwitchToTimer(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: "dashboard",
    onFocusChanged: (cb: (focused: boolean) => void) => mockOnFocusChanged(cb),
  }),
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
    mockOnFocusChanged.mockImplementation(() => Promise.resolve(() => undefined));
  });

  it("renders the guided dashboard flow entries", () => {
    render(<Dashboard />);

    expect(screen.getByRole("button", { name: "Start Session" }).textContent).toContain("Start Session");
    expect(screen.getByRole("button", { name: "Settings" }).textContent).toContain("Settings");
    expect(screen.getByRole("button", { name: "Instructions" }).textContent).toContain("Instructions");
    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("0 completed today · 0 min focused");
    expect(screen.getByRole("dialog", { name: "Welcome to Kurone-ko Timer" }).getAttribute("aria-modal")).toBe("true");
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

    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("2 completed today · 40 min focused");
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

    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("1 completed today · 25 min focused");
  });

  it("refreshes the focus summary when dashboard gains focus after external history changes", async () => {
    const today = new Date().toISOString().slice(0, 10);
    let externalHistoryAvailable = false;
    let focusCallback: ((focused: boolean) => void) | null = null;
    mockOnFocusChanged.mockImplementation((cb: (focused: boolean) => void) => {
      focusCallback = cb;
      return Promise.resolve(() => undefined);
    });

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
    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("0 completed today · 0 min focused");

    externalHistoryAvailable = true;
    // Simulate Tauri window receiving focus
    (focusCallback as unknown as (f: boolean) => void)?.(true);

    await waitFor(() => {
    expect(screen.getByLabelText("Today's focus summary").textContent).toContain("1 completed today · 25 min focused");
    });
    expect(hydrate).toHaveBeenCalled();
  });

  it("opens the timer window when Start Session is activated", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));

    expect(mockSwitchToTimer).toHaveBeenCalledTimes(1);
  });

  it("shows settings and returns to the main flow without starting a window transition", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(mockSwitchToTimer).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Settings" }).textContent).toBe("Settings");

    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));

    expect(screen.getByRole("button", { name: "Start Session" }).textContent).toContain("Start Session");
  });

  it("shows onboarding on first launch and lets Instructions reopen it after persisted dismissal", () => {
    window.localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, "true");
    useDashboardStore.setState({ onboardingDismissed: true });

    render(<Dashboard />);

    expect(screen.queryByRole("dialog", { name: "Welcome to Kurone-ko Timer" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Instructions" }));

    expect(screen.getByRole("dialog", { name: "Welcome to Kurone-ko Timer" }).getAttribute("aria-modal")).toBe("true");
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBe("false");
  });
});
