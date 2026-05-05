// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSilentMusicAudioService } from "../../music/audio";
import { createMemoryMusicPreferenceRepository, useMusicStore } from "../../music/store";
import { useSettingsStore } from "../../settings/store";
import { DEFAULT_TIMER_SETTINGS } from "../../timer/model";
import { ConfigPanel } from "./ConfigPanel";

describe("ConfigPanel", () => {
  const getInputValue = (label: string): string => {
    const input = screen.getByLabelText(label);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`${label} did not resolve to an input`);
    }

    return input.value;
  };

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useSettingsStore.setState({ settings: DEFAULT_TIMER_SETTINGS, hydrated: true, error: null });
    useMusicStore.getState().configure(createSilentMusicAudioService(), createMemoryMusicPreferenceRepository(false));
    useMusicStore.setState({
      ducked: false,
      enabled: false,
      error: null,
      hydrated: true,
      isPlaying: false,
      loading: false,
      source: "kuroneko-playlist",
    });
  });

  it("edits timer setup fields through the settings store", async () => {
    render(<ConfigPanel onBack={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Settings" }).textContent).toBe("Settings");
    expect(getInputValue("Focus minutes")).toBe("25");

    fireEvent.change(screen.getByLabelText("Focus minutes"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Short break minutes"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Long break minutes"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Daily goal sessions"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Long break after sessions"), { target: { value: "3" } });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.focusDurationSeconds).toBe(1_800);
      expect(useSettingsStore.getState().settings.shortBreakDurationSeconds).toBe(420);
      expect(useSettingsStore.getState().settings.longBreakDurationSeconds).toBe(1_200);
      expect(useSettingsStore.getState().settings.sessionGoal).toBe(6);
      expect(useSettingsStore.getState().settings.sessionsBeforeLongBreak).toBe(3);
    });
  });

  it("keeps music configuration source-only and disabled future integration slots without API setup", () => {
    render(<ConfigPanel onBack={() => undefined} />);

    expect(screen.getByLabelText("Session configuration").getAttribute("data-interactive-region")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Play Kurone-ko Playlist preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Stop Kurone-ko Playlist preview" })).toBeNull();
    expect(screen.getByRole("button", { name: "AI integration unavailable" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Brain integration unavailable" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Kanban integration unavailable" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Zettelkasten integration unavailable" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("renders an accessible music source group without generated ambience", async () => {
    useMusicStore.setState({ source: "spotify" });
    render(<ConfigPanel onBack={() => undefined} />);

    expect(screen.getByRole("group", { name: "Music source" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Generated Ambience" })).toBeNull();
    const playlist = screen.getByRole("radio", { name: "Kurone-ko Playlist" });

    fireEvent.click(playlist);

    await waitFor(() => {
      expect(playlist).toHaveProperty("checked", true);
      expect(useMusicStore.getState().source).toBe("kuroneko-playlist");
    });
  });

  it("renders external music sources as disabled coming-later options while playlist is available", () => {
    render(<ConfigPanel onBack={() => undefined} />);

    expect(screen.getByRole("radio", { name: "Kurone-ko Playlist" })).toHaveProperty("disabled", false);
    for (const name of ["Spotify Coming later", "YouTube Music Coming later"]) {
      expect(screen.getByRole("radio", { name })).toHaveProperty("disabled", true);
    }
  });

  it("does not expose category playlist buttons when Kurone-ko Playlist is selected", async () => {
    render(<ConfigPanel onBack={() => undefined} />);

    fireEvent.click(screen.getByRole("radio", { name: "Kurone-ko Playlist" }));

    await waitFor(() => {
      expect(useMusicStore.getState().source).toBe("kuroneko-playlist");
    });
    expect(screen.queryByRole("button", { name: "Deep Focus" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Nature Calm" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lo-fi Flow" })).toBeNull();
  });

  it("does not expose in-app volume presets because volume is controlled by the device", () => {
    render(<ConfigPanel onBack={() => undefined} />);

    expect(screen.queryByRole("button", { name: "Quiet" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Normal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Focus" })).toBeNull();
    expect(screen.queryByLabelText("Volume presets")).toBeNull();
  });

  it("does not expose in-app volume presets because volume is controlled by the device", () => {
    render(<ConfigPanel onBack={() => undefined} />);

    expect(screen.queryByRole("button", { name: "Quiet" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Normal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Focus" })).toBeNull();
    expect(screen.queryByLabelText("Volume presets")).toBeNull();
  });
});

