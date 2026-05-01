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

    const dialog = screen.getByRole("dialog", { name: "Welcome to KURONE-KO" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { name: "Welcome to KURONE-KO" }).textContent).toBe("Welcome to KURONE-KO");

    const dismissCheckbox = screen.getByLabelText("No volver a mostrar");
    const dismissButton = screen.getByRole("button", { name: "Start focusing" });
    dismissButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });

    expect(document.activeElement).toBe(dismissCheckbox);

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(dismissButton);
  });

  it("dismisses permanently only when the checkbox is checked", () => {
    render(<OnboardingModal onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("No volver a mostrar"));
    fireEvent.click(screen.getByRole("button", { name: "Start focusing" }));

    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBe("true");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape or overlay click without persisting the dismissed flag", () => {
    const { rerender } = render(<OnboardingModal onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Welcome to KURONE-KO" }), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBeNull();

    rerender(<OnboardingModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close onboarding overlay"));

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBeNull();
  });
});
