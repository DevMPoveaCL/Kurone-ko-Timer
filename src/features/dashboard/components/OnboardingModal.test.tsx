// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_DISMISSED_STORAGE_KEY } from "../store";
import { OnboardingModal } from "./OnboardingModal";

describe("OnboardingModal", () => {
  const onClose = vi.fn<() => void>();

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders as an accessible modal and traps Tab focus inside dialog actions", () => {
    render(<OnboardingModal onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Welcome to Kurone-ko Timer" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { name: "Welcome to Kurone-ko Timer" }).textContent).toBe("Welcome to Kurone-ko Timer");

    const dismissCheckbox = screen.getByLabelText("No volver a mostrar");
    const closeButton = screen.getByRole("button", { name: "Close instructions" });

    // Tab wraps from last element back to first
    closeButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(dismissCheckbox);

    // Shift+Tab wraps from first element back to last
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeButton);
  });

  it("dismisses permanently only when the checkbox is checked", () => {
    render(<OnboardingModal onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("No volver a mostrar"));
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBe("true");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape or overlay click without persisting the dismissed flag", () => {
    const { rerender } = render(<OnboardingModal onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Welcome to Kurone-ko Timer" }), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBeNull();

    rerender(<OnboardingModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close onboarding overlay"));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBeNull();
  });
});
