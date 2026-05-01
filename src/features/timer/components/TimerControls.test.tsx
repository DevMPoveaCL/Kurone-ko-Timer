// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TIMER_STATUS, type TimerStatus } from "../model";
import { TimerControls } from "./TimerControls";

interface RenderControlsOptions {
  status: TimerStatus;
}

const renderControls = ({ status }: RenderControlsOptions) => {
  const onPause = vi.fn();
  const onReset = vi.fn();
  const onResume = vi.fn();
  const onStart = vi.fn();

  render(
    <TimerControls
      status={status}
      onPause={onPause}
      onReset={onReset}
      onResume={onResume}
      onStart={onStart}
    />,
  );

  return { onPause, onReset, onResume, onStart };
};

describe("TimerControls", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows only Start while idle and calls the start action", () => {
    const actions = renderControls({ status: TIMER_STATUS.IDLE });

    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    expect(screen.queryByRole("button", { name: /pause/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
    expect(actions.onStart).toHaveBeenCalledTimes(1);
    expect(actions.onPause).toHaveBeenCalledTimes(0);
  });

  it("shows Pause and Reset while running and routes each action", () => {
    const actions = renderControls({ status: TIMER_STATUS.RUNNING });

    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(screen.queryByRole("button", { name: /^start$/i })).toBeNull();
    expect(actions.onPause).toHaveBeenCalledTimes(1);
    expect(actions.onReset).toHaveBeenCalledTimes(1);
    expect(actions.onStart).toHaveBeenCalledTimes(0);
  });

  it("shows Resume and Reset while paused and routes each action", () => {
    const actions = renderControls({ status: TIMER_STATUS.PAUSED });

    fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(screen.queryByRole("button", { name: /pause/i })).toBeNull();
    expect(actions.onResume).toHaveBeenCalledTimes(1);
    expect(actions.onReset).toHaveBeenCalledTimes(1);
    expect(actions.onPause).toHaveBeenCalledTimes(0);
  });

  it("shows only Start again after a completed session", () => {
    const actions = renderControls({ status: TIMER_STATUS.SESSION_COMPLETE });

    fireEvent.click(screen.getByRole("button", { name: /start again/i }));

    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^start$/i })).toBeNull();
    expect(actions.onStart).toHaveBeenCalledTimes(1);
  });
});
