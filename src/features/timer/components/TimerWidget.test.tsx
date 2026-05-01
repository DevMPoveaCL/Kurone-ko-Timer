// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_STATUS, SESSION_TYPE, useHistoryStore, type FocusSession } from "../../history/store";
import { useSettingsStore } from "../../settings/store";
import { createSilentMusicAudioService } from "../../music/audio";
import { createMemoryMusicPreferenceRepository, useMusicStore } from "../../music/store";
import { resetAppHydrationForTests } from "../../../shared/hydration/useAppHydration";
import { DEFAULT_TIMER_SETTINGS, createIdleTimerState, TIMER_STATUS } from "../model";
import { useTimerStore } from "../store";
import { TimerWidget } from "./TimerWidget";

const mockStartDragging = vi.fn<() => Promise<void>>(() => Promise.resolve());
const mockMinimize = vi.fn<() => Promise<void>>(() => Promise.resolve());

let mockHistorySessions: FocusSession[] = [];
let mockSettings = DEFAULT_TIMER_SETTINGS;

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    startDragging: mockStartDragging,
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((command: string) => {
    if (command === "load_history") {
      return Promise.resolve(mockHistorySessions);
    }

    if (command === "load_settings") {
      return Promise.resolve(mockSettings);
    }

    if (command === "load_timer_snapshot") {
      return Promise.resolve(null);
    }

    return Promise.resolve(undefined);
  }),
}));

const createCompletedSession = (id: string, completedAt: string, duration: number): FocusSession => ({
  id,
  completedAt,
  durationSeconds: duration,
  durationMinutes: Math.round(duration / 60),
  type: SESSION_TYPE.FOCUS,
  status: SESSION_STATUS.COMPLETED,
});

const resetStores = () => {
  useTimerStore.setState({
    ...createIdleTimerState(mockSettings),
    settings: mockSettings,
    hydrated: true,
  });
  useSettingsStore.setState({
    settings: mockSettings,
    hydrated: true,
    error: null,
  });
  useHistoryStore.setState({
    sessions: mockHistorySessions,
    hydrated: true,
    error: null,
  });
  useMusicStore.setState({
    ducked: false,
    enabled: false,
    error: null,
    hydrated: true,
    isPlaying: false,
    loading: false,
  });
  useMusicStore.getState().configure(createSilentMusicAudioService(), createMemoryMusicPreferenceRepository(false));
};

describe("TimerWidget", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    resetAppHydrationForTests();
    vi.clearAllMocks();
    mockSettings = DEFAULT_TIMER_SETTINGS;
    mockHistorySessions = [];
    resetStores();
  });

  it("navigates between timer and history panels with no settings panel available", async () => {
    const completedAt = new Date().toISOString();
    mockHistorySessions = [
      createCompletedSession("session-1", completedAt, 1_500),
      createCompletedSession("session-2", completedAt, 1_500),
    ];
    resetStores();

    render(<TimerWidget />);

    expect(screen.queryByText(/drag/i)).toBeNull();
    expect(screen.getByLabelText("Move widget").getAttribute("data-tauri-drag-region")).toBe("");
    expect(screen.getByRole("button", { name: /show timer/i }).textContent).toBe("");
    expect(screen.queryByRole("button", { name: /show settings/i })).toBeNull();
    expect(screen.getByRole("button", { name: /show history/i }).textContent).toBe("");
    expect(screen.getByRole("button", { name: /play kurone-ko playlist/i }).textContent).toBe("");
    expect(screen.getByText(/ready to focus/i).textContent).toContain("Ready to focus");
    expect(screen.queryByLabelText("Timer settings")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /show history/i }));
    expect(await screen.findByLabelText("Today history")).toBeTruthy();
    expect(screen.getByText(/today: 2 sessions · 50 min/i).textContent).toBe("Today: 2 sessions · 50 min");

    fireEvent.click(screen.getByRole("button", { name: /show timer/i }));
    expect(screen.getByText(/ready to focus/i).textContent).toContain("Ready to focus");
    expect(screen.queryByLabelText("Today history")).toBeNull();
  });

  it("starts native dragging from non-interactive card surfaces while controls stay clickable", async () => {
    render(<TimerWidget />);

    fireEvent.pointerDown(screen.getByLabelText("KURONE-KO focus timer; drag empty areas to move"), { button: 0 });

    expect(mockStartDragging).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByRole("button", { name: /show history/i }), { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: /show history/i }));

    expect(mockStartDragging).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("Today history")).toBeTruthy();
  });

  it("keeps settings controls out of the focus widget while preserving hydrated settings state", () => {
    mockSettings = { ...DEFAULT_TIMER_SETTINGS, focusDurationSeconds: 1_800, sessionGoal: 7 };
    resetStores();

    render(<TimerWidget />);

    expect(screen.queryByLabelText("Timer settings")).toBeNull();
    expect(screen.queryByLabelText("Focus minutes")).toBeNull();
    expect(screen.queryByLabelText("Daily goal sessions")).toBeNull();
    expect(screen.getByText("30:00").textContent).toBe("30:00");
    expect(useSettingsStore.getState().settings.sessionGoal).toBe(7);
  });

  it("refreshes persisted configuration when the hidden timer window is focused again", async () => {
    render(<TimerWidget />);

    expect(screen.getByText("25:00").textContent).toBe("25:00");
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.focusDurationSeconds).toBe(DEFAULT_TIMER_SETTINGS.focusDurationSeconds);
    });
    await Promise.resolve();
    await Promise.resolve();

    mockSettings = { ...DEFAULT_TIMER_SETTINGS, focusDurationSeconds: 1_800, sessionGoal: 7 };
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(screen.getByText("30:00").textContent).toBe("30:00");
    });
    expect(useTimerStore.getState().settings.sessionGoal).toBe(7);
  });

  it("refreshes latest persisted configuration immediately before starting a hidden mounted timer", async () => {
    const staleSettings = { ...DEFAULT_TIMER_SETTINGS, focusDurationSeconds: 60 };
    mockSettings = staleSettings;
    resetStores();
    render(<TimerWidget />);

    await waitFor(() => {
      expect(screen.getByText("01:00").textContent).toBe("01:00");
    });

    mockSettings = { ...DEFAULT_TIMER_SETTINGS, focusDurationSeconds: 1_800, sessionGoal: 7 };
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    await waitFor(() => {
      expect(useTimerStore.getState().targetEndTime).toBeGreaterThan(Date.now() + 1_700_000);
    });
    expect(useTimerStore.getState().settings.focusDurationSeconds).toBe(1_800);
    expect(useTimerStore.getState().remainingSeconds).toBe(1_800);
  });

  it("refreshes latest persisted configuration immediately before resetting a hidden mounted timer", async () => {
    const staleSettings = { ...DEFAULT_TIMER_SETTINGS, focusDurationSeconds: 60 };
    mockSettings = staleSettings;
    resetStores();
    useTimerStore.setState({
      ...createIdleTimerState(staleSettings),
      status: TIMER_STATUS.RUNNING,
      remainingSeconds: 45,
      targetEndTime: Date.now() + 45_000,
      focusStartedAt: Date.now() - 15_000,
      settings: staleSettings,
    });
    render(<TimerWidget />);

    mockSettings = { ...DEFAULT_TIMER_SETTINGS, focusDurationSeconds: 1_800, sessionGoal: 7 };
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    await waitFor(() => {
      expect(screen.getByText("30:00").textContent).toBe("30:00");
    });
    expect(useTimerStore.getState().settings.focusDurationSeconds).toBe(1_800);
    expect(useTimerStore.getState().remainingSeconds).toBe(1_800);
  });

  it("keeps the compact Kurone-ko Playlist toggle in the toolbar and responds to clicks", async () => {
    render(<TimerWidget />);

    fireEvent.click(screen.getByRole("button", { name: /play kurone-ko playlist/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop kurone-ko playlist/i }).getAttribute("aria-pressed")).toBe("true");
    });
    expect(screen.queryByText(/drag/i)).toBeNull();
  });

  it("renders completed-session copy and lets History switch to the history panel", async () => {
    const completedAt = new Date().toISOString();
    mockSettings = { ...DEFAULT_TIMER_SETTINGS, sessionGoal: 2 };
    mockHistorySessions = [createCompletedSession("session-1", completedAt, 1_500)];
    resetStores();
    useTimerStore.setState({
      status: TIMER_STATUS.SESSION_COMPLETE,
      remainingSeconds: 0,
      completedFocusSessions: 2,
      settings: mockSettings,
    });

    render(<TimerWidget />);

    expect(screen.getByRole("status", { name: "Pomodoro session complete" }).textContent).toContain("Goal done");
    expect(screen.getByText("25 focused minutes saved").textContent).toBe("25 focused minutes saved");
    expect(screen.getByText("2/2 focus blocks").textContent).toBe("2/2 focus blocks");
    expect(screen.getByRole("button", { name: /start again/i }).textContent).toBe("Start again");

    fireEvent.click(screen.getByRole("button", { name: /^history$/i }));

    expect(await screen.findByLabelText("Today history")).toBeTruthy();
    expect(screen.getByText(/today: 1 sessions · 25 min/i).textContent).toBe("Today: 1 sessions · 25 min");
  });

  it("shows every completed history item with a clear scroll disclosure", async () => {
    const completedAt = new Date().toISOString();
    mockHistorySessions = [
      createCompletedSession("session-1", completedAt, 1_500),
      createCompletedSession("session-2", completedAt, 1_200),
      createCompletedSession("session-3", completedAt, 900),
      createCompletedSession("session-4", completedAt, 600),
      createCompletedSession("session-5", completedAt, 300),
    ];
    resetStores();

    render(<TimerWidget />);

    fireEvent.click(screen.getByRole("button", { name: /show history/i }));

    expect(await screen.findByText("Today: 5 sessions · 75 min")).toBeTruthy();
    expect(screen.getByText("All 5 shown · scroll if needed").textContent).toBe("All 5 shown · scroll if needed");
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("25 min focus").textContent).toBe("25 min focus");
    expect(screen.getByText("5 min focus").textContent).toBe("5 min focus");
  });

  it("does not render a future placeholder zero-minute history row", async () => {
    const completedAt = new Date().toISOString();
    mockHistorySessions = [
      createCompletedSession("session-1", completedAt, 1_500),
      createCompletedSession("future-placeholder", completedAt, 0),
    ];
    resetStores();

    render(<TimerWidget />);

    fireEvent.click(screen.getByRole("button", { name: /show history/i }));

    expect(await screen.findByText("Today: 1 sessions · 25 min")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("0 min focus")).toBeNull();
  });

  it("starts a fresh focus block from the completed-session panel", async () => {
    mockSettings = { ...DEFAULT_TIMER_SETTINGS, sessionGoal: 1 };
    resetStores();
    useTimerStore.setState({
      status: TIMER_STATUS.SESSION_COMPLETE,
      remainingSeconds: 0,
      completedFocusSessions: 1,
      settings: mockSettings,
    });

    render(<TimerWidget />);

    fireEvent.click(screen.getByRole("button", { name: /start again/i }));

    await waitFor(() => {
      expect(screen.getByText(/KURONE-KO · Focus/i).textContent).toBe("KURONE-KO · Focus");
    });
    expect(screen.getByRole("button", { name: /pause/i }).textContent).toContain("Pause");
  });
});
