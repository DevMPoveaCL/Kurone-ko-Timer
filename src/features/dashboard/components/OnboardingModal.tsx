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
        <h2 id="onboarding-title">Welcome to KURONE-KO</h2>
        <p>Start Focus opens the minimal timer widget. Configuration is where you prepare durations, goals, and Kurone-ko Playlist before focusing.</p>
        <ul>
          <li>Use Configuration before a session.</li>
          <li>Use Instructions any time you want to reopen this guide.</li>
          <li>Keep the widget distraction-free while you work.</li>
        </ul>
        <label className="onboarding-checkbox">
          <input
            type="checkbox"
            checked={dismissPermanently}
            onChange={(event) => setDismissPermanently(event.currentTarget.checked)}
          />
          No volver a mostrar
        </label>
        <button className="dashboard-entry dashboard-entry-primary" type="button" onClick={startFocusing}>
          Start focusing
        </button>
      </div>
    </div>
  );
}
