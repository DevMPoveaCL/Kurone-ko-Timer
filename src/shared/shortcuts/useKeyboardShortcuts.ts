import { useEffect, type KeyboardEvent } from "react";

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

const isModalOpen = (): boolean =>
  document.querySelector('[role="dialog"][aria-modal="true"]') !== null;

/**
 * Registers keyboard shortcuts with guardrails:
 * - Blocked when typing in inputs (except Escape)
 * - Blocked when a button is focused (prevents Tab+Space conflict)
 * - Blocked when a modal dialog is open
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as unknown as KeyboardEvent;
      const active = document.activeElement as HTMLElement | null;
      const isEscape = e.key === "Escape";

      // Guard 1: modal open → skip non-Escape, non-modifier shortcuts
      // (Ctrl+Arrow for window movement must still work)
      if (!isEscape && !(e.ctrlKey || e.metaKey) && isModalOpen()) return;

      if (!isEscape) {
        // Guard 2: typing in inputs → skip, unless Ctrl is held (window commands)
        if (
          !(e.ctrlKey || e.metaKey) &&
          (active?.tagName === "INPUT" ||
            active?.tagName === "TEXTAREA" ||
            active?.tagName === "SELECT" ||
            active?.isContentEditable)
        ) {
          return;
        }
      }

      for (const s of shortcuts) {
        const keyMatch =
          e.key === s.key || e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = s.ctrl
          ? e.ctrlKey || e.metaKey
          : !e.ctrlKey && !e.metaKey;
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;

        if (keyMatch && ctrlMatch && shiftMatch) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
