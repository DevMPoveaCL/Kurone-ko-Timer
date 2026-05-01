// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSilentMusicAudioService } from "../audio";
import { createMemoryMusicPreferenceRepository, useMusicStore } from "../store";
import { MusicToggle } from "./MusicToggle";

describe("MusicToggle", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useMusicStore.setState({
      ducked: false,
      enabled: false,
      error: null,
      hydrated: true,
      isPlaying: false,
      loading: false,
    });
    useMusicStore.getState().configure(createSilentMusicAudioService(), createMemoryMusicPreferenceRepository(false));
  });

  it("renders an inactive compact Kurone-ko Playlist toggle", () => {
    render(<MusicToggle />);

    const button = screen.getByRole("button", { name: "Play Kurone-ko Playlist" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toBe("");
  });

  it("shows on only after Kurone-ko Playlist is actually playing", async () => {
    render(<MusicToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Play Kurone-ko Playlist" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop Kurone-ko Playlist" }).getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("keeps the visual state off when enabled is stale but audio is silent", () => {
    useMusicStore.setState({ enabled: true, isPlaying: false });

    render(<MusicToggle />);

    expect(screen.getByRole("button", { name: "Play Kurone-ko Playlist" }).getAttribute("aria-pressed")).toBe("false");
  });
});
