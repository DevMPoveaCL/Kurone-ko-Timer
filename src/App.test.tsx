// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

let currentWindowLabel = "dashboard";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ label: currentWindowLabel }),
}));

vi.mock("./e2e/installE2EDriver", () => ({
  installKuroneKoE2EDriver: vi.fn(),
}));

vi.mock("./features/dashboard/components/Dashboard", () => ({
  Dashboard: () => <section aria-label="Dashboard hub">Dashboard</section>,
}));

vi.mock("./features/timer/components/TimerWidget", () => ({
  TimerWidget: () => <section aria-label="Timer widget">Timer Widget</section>,
}));

describe("App window routing", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    currentWindowLabel = "dashboard";
  });

  it("renders the dashboard root in the dashboard window", () => {
    currentWindowLabel = "dashboard";

    render(<App />);

    expect(screen.getByRole("region", { name: "Dashboard hub" }).textContent).toBe("Dashboard");
    expect(screen.queryByRole("region", { name: "Timer widget" })).toBeNull();
  });

  it("renders the timer widget root in the timer window", () => {
    currentWindowLabel = "timer";

    render(<App />);

    expect(screen.getByRole("region", { name: "Timer widget" }).textContent).toBe("Timer Widget");
    expect(screen.queryByRole("region", { name: "Dashboard hub" })).toBeNull();
  });

  it("renders an explicit fallback for unknown window labels", () => {
    currentWindowLabel = "unexpected";

    render(<App />);

    expect(screen.getByRole("alert").textContent).toBe("Unknown window: unexpected");
    expect(screen.queryByRole("region", { name: "Dashboard hub" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Timer widget" })).toBeNull();
  });
});
