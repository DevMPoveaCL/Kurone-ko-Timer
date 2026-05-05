import { useEffect, useRef, useState } from "react";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { ConfigPanel } from "../../config/components/ConfigPanel";
import { getDailyFocusSummary } from "../../history/summary";
import { useHistoryStore } from "../../history/store";
import { switchToTimer, moveWindowByDelta } from "../../../shared/window/switcher";
import { useDashboardStore } from "../store";
import { useKeyboardShortcuts } from "../../../shared/shortcuts/useKeyboardShortcuts";
import kuronekoMascot from "../../../assets/kuroneko-dashboard.png";
import "./Dashboard.css";
import { OnboardingModal } from "./OnboardingModal";
import { ShortcutsModal } from "./ShortcutsModal";

const DASHBOARD_VIEW = {
  MAIN: "main",
  CONFIG: "config",
} as const;

type DashboardView = (typeof DASHBOARD_VIEW)[keyof typeof DASHBOARD_VIEW];

export function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>(DASHBOARD_VIEW.MAIN);
  const onboardingDismissed = useDashboardStore((state) => state.onboardingDismissed);
  const showOnboarding = useDashboardStore((state) => state.showOnboarding);
  const hydrateHistory = useHistoryStore((state) => state.hydrate);
  const sessions = useHistoryStore((state) => state.sessions);
  const [onboardingOpen, setOnboardingOpen] = useState(!onboardingDismissed);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const todaySummary = getDailyFocusSummary(sessions);
  const cardRef = useRef<HTMLElement>(null);

  const isModalActive = onboardingOpen || shortcutsOpen;
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (isModalActive) {
      el.setAttribute("inert", "");
    } else {
      el.removeAttribute("inert");
    }
  }, [isModalActive]);

  useEffect(() => {
    void hydrateHistory();
  }, [hydrateHistory]);

  // Refresh summary when timer window completes a focus session
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const unlisten = await listen("history-updated", () => {
          if (!cancelled) void hydrateHistory();
        });
        return unlisten;
      } catch {
        return () => undefined;
      }
    };

    const promise = setup();
    return () => {
      cancelled = true;
      promise.then((unlisten) => unlisten());
    };
  }, [hydrateHistory]);

  useEffect(() => {
    const win = getCurrentWindow();
    const refreshHistory = () => {
      void hydrateHistory();
    };

    // Tauri's onFocusChanged is more reliable than browser window.focus
    const unlistenPromise = win.onFocusChanged((focused) => {
      if (focused) {
        refreshHistory();
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [hydrateHistory]);

  const openInstructions = () => {
    showOnboarding();
    setOnboardingOpen(true);
  };

  const handleExit = () => {
    Window.getByLabel("timer").then((w) => w?.destroy()).catch(() => {});
    getCurrentWindow().close().catch(() => {});
  };

  useKeyboardShortcuts([
    {
      key: "h",
      description: "Keyboard shortcuts",
      action: () => setShortcutsOpen(true),
    },
    {
      key: "s",
      description: "Settings",
      action: () => setActiveView(DASHBOARD_VIEW.CONFIG),
    },
    {
      key: "i",
      description: "Instructions",
      action: openInstructions,
    },
    {
      key: "Escape",
      description: "Back to dashboard",
      action: () => {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
        } else {
          setActiveView(DASHBOARD_VIEW.MAIN);
        }
      },
    },
    {
      key: "ArrowLeft",
      ctrl: true,
      description: "Move window left",
      action: () => void moveWindowByDelta("dashboard", -40, 0),
    },
    {
      key: "ArrowRight",
      ctrl: true,
      description: "Move window right",
      action: () => void moveWindowByDelta("dashboard", 40, 0),
    },
    {
      key: "ArrowUp",
      ctrl: true,
      description: "Move window up",
      action: () => void moveWindowByDelta("dashboard", 0, -40),
    },
    {
      key: "ArrowDown",
      ctrl: true,
      description: "Move window down",
      action: () => void moveWindowByDelta("dashboard", 0, 40),
    },
  ]);

  return (
    <main className="dashboard-shell" aria-label="KURONE-KO dashboard">
      <section className="dashboard-card" data-tauri-drag-region ref={cardRef}>
        {activeView === DASHBOARD_VIEW.CONFIG ? (
          <ConfigPanel onBack={() => setActiveView(DASHBOARD_VIEW.MAIN)} />
        ) : (
          <>
            <img className="dashboard-mascot" src={kuronekoMascot} alt="Kurone-ko mascot" draggable={false} />
            <div className="dashboard-grid" aria-label="Guided dashboard actions" data-interactive-region>
              <button className="dashboard-entry dashboard-entry-primary" type="button" aria-label="Start Session" onClick={() => void switchToTimer()}>
                <span className="dashboard-entry-title">Start Session</span>
                <span className="dashboard-entry-copy">Open the clean timer widget.</span>
              </button>
              <button className="dashboard-entry" type="button" aria-label="Settings" onClick={() => setActiveView(DASHBOARD_VIEW.CONFIG)}>
                <span className="dashboard-entry-title">Settings</span>
                <span className="dashboard-entry-copy">Set timer, goals, and Kurone-ko Playlist.</span>
              </button>
              <button className="dashboard-entry" type="button" aria-label="Instructions" onClick={openInstructions}>
                <span className="dashboard-entry-title">Instructions</span>
                <span className="dashboard-entry-copy">Reopen the quick onboarding guide.</span>
              </button>
            </div>
            <section className="dashboard-focus-summary" aria-label="Today's focus summary">
              <span className="dashboard-summary-mark" aria-hidden="true" />
              <div>
                <p className="dashboard-summary-label">Today's focus sessions</p>
                <p className="dashboard-summary-value">
                  {todaySummary.completedSessions} completed today · {todaySummary.focusedMinutes} min focused
                </p>
              </div>
            </section>
            <p className="dashboard-signature">Developed by DevMPoveaCL</p>
            <button
              className="shortcuts-hint"
              type="button"
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsOpen(true)}
            >
              ?
            </button>
            <button
              className="exit-button"
              type="button"
              aria-label="Exit Kurone-ko Timer"
              onClick={() => void handleExit()}
            >
              ✕
            </button>
          </>
        )}
      </section>
      {onboardingOpen && <OnboardingModal onClose={() => setOnboardingOpen(false)} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </main>
  );
}
