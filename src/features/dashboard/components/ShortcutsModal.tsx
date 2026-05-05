import { useEffect, useRef, type KeyboardEvent } from "react";

interface ShortcutEntry {
  key: string;
  description: string;
}

interface ShortcutsModalProps {
  onClose: () => void;
}

const GLOBAL_SHORTCUTS: ShortcutEntry[] = [
  { key: "Alt+Tab", description: "Switch to Kurone-ko Timer from any app" },
  { key: "Escape", description: "Close panels, return to main view" },
  { key: "Ctrl+\u2190\u2191\u2192\u2193", description: "Move window (40 px per press)" },
  { key: "Tab", description: "Navigate between buttons and fields" },
  { key: "Enter or Space", description: "Activate focused button" },
  { key: "\u2191 \u2193", description: "Scroll within focused panels" },
];

const TIMER_SHORTCUTS: ShortcutEntry[] = [
  { key: "S", description: "Start, pause, or resume the timer" },
  { key: "R", description: "Reset current timer" },
  { key: "M", description: "Toggle music on / off" },
  { key: "H", description: "Toggle history panel" },
];

const DASHBOARD_SHORTCUTS: ShortcutEntry[] = [
  { key: "H", description: "Show this reference" },
  { key: "S", description: "Open Settings" },
  { key: "I", description: "Open Instructions" },
];

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const firstButton = dialogRef.current?.querySelector<HTMLElement>("button");
    firstButton?.focus();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as unknown as KeyboardEvent;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="onboarding-overlay"
      aria-label="Close shortcuts reference"
      onClick={onClose}
    >
      <div
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        ref={dialogRef}
        tabIndex={0}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="onboarding-close"
          type="button"
          aria-label="Close shortcuts"
          onClick={onClose}
        >
          ✕
        </button>
        <p className="dashboard-eyebrow">Keyboard shortcuts</p>
        <h2 id="shortcuts-title">Shortcuts</h2>

        <h3>Global</h3>
        <table className="shortcuts-table">
          <tbody>
            {GLOBAL_SHORTCUTS.map((s) => (
              <tr key={s.key}>
                <td className="shortcuts-key">{s.key}</td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Timer widget</h3>
        <table className="shortcuts-table">
          <tbody>
            {TIMER_SHORTCUTS.map((s) => (
              <tr key={s.key}>
                <td className="shortcuts-key">{s.key}</td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Dashboard</h3>
        <table className="shortcuts-table">
          <tbody>
            {DASHBOARD_SHORTCUTS.map((s) => (
              <tr key={s.key}>
                <td className="shortcuts-key">{s.key}</td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
