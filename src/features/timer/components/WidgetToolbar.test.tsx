// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WIDGET_PANEL, WidgetToolbar } from "./WidgetToolbar";

const mockMinimizeCurrentWindow = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
const mockSwitchToDashboard = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));

vi.mock("../../../shared/window/minimize", () => ({
  minimizeCurrentWindow: () => mockMinimizeCurrentWindow(),
}));

vi.mock("../../../shared/window/switcher", () => ({
  switchToDashboard: () => mockSwitchToDashboard(),
}));

vi.mock("../../music/components/MusicToggle", () => ({
  MusicToggle: () => (
    <button className="icon-button" type="button" aria-label="Play Kurone-ko Playlist" aria-pressed="false">
      <span aria-hidden="true" />
    </button>
  ),
}));

describe("WidgetToolbar", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the extracted toolbar buttons with the same accessible names and pressed states", () => {
    render(<WidgetToolbar activePanel={WIDGET_PANEL.TIMER} onPanelChange={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Return to dashboard" }).textContent).toBe("");
    expect(screen.getByRole("button", { name: "Show timer" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Show settings" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show history" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Play Kurone-ko Playlist" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Minimize widget" }).textContent).toBe("");
  });

  it("marks the history button as pressed when its panel is active", () => {
    render(<WidgetToolbar activePanel={WIDGET_PANEL.HISTORY} onPanelChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Show history" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Show timer" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("does not expose a settings panel constant", () => {
    expect("SETTINGS" in WIDGET_PANEL).toBe(false);
  });

  it("delegates panel changes and minimize clicks to the provided handlers", () => {
    const onPanelChange = vi.fn();
    render(<WidgetToolbar activePanel={WIDGET_PANEL.TIMER} onPanelChange={onPanelChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Show history" }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize widget" }));

    expect(onPanelChange).toHaveBeenCalledWith(WIDGET_PANEL.HISTORY);
    expect(mockMinimizeCurrentWindow).toHaveBeenCalledTimes(1);
  });

  it("returns to the dashboard without breaking the minimize control", () => {
    render(<WidgetToolbar activePanel={WIDGET_PANEL.TIMER} onPanelChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Return to dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize widget" }));

    expect(mockSwitchToDashboard).toHaveBeenCalledTimes(1);
    expect(mockMinimizeCurrentWindow).toHaveBeenCalledTimes(1);
  });
});
