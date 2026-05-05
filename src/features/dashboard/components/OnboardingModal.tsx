import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useDashboardStore } from "../store";

interface OnboardingModalProps {
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = "button,input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])";

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [dismissPermanently, setDismissPermanently] = useState(false);
  const setOnboardingDismissed = useDashboardStore((state) => state.setOnboardingDismissed);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();
  }, []);

  const closeTemporarily = () => {
    onClose();
  };

  const startFocusing = () => {
    if (dismissPermanently) {
      setOnboardingDismissed(true);
    }

    onClose();
  };

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeTemporarily();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className="onboarding-overlay" aria-label="Close onboarding overlay" onClick={closeTemporarily}>
      <div
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <p className="dashboard-eyebrow">Guided setup</p>
        <h2 id="onboarding-title">Welcome to Kurone-ko Timer</h2>
        <p>Start Session opens the minimal timer widget. In Settings you can adjust your focus and break durations, daily goals, and long-break cadence.</p>
        <ul>
          <li>Kurone-ko Playlist comes built-in — music starts automatically with each focus session.</li>
          <li>Use Settings before a session to prepare your timer.</li>
          <li>More integrations (Spotify, Zettelkasten, AI tools) are coming in future updates.</li>
        </ul>
        <label className="onboarding-checkbox">
          <input
            type="checkbox"
            checked={dismissPermanently}
            onChange={(event) => setDismissPermanently(event.currentTarget.checked)}
          />
          No volver a mostrar
        </label>
        <button className="dashboard-action-button dashboard-action-button-primary" type="button" onClick={startFocusing}>
          Got it
        </button>
        <button className="onboarding-close" type="button" aria-label="Close instructions" onClick={closeTemporarily}>
          ✕
        </button>
      </div>
    </div>
  );
}
