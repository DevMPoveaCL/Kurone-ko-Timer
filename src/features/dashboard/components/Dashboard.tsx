import { useEffect, useState } from "react";
import { ConfigPanel } from "../../config/components/ConfigPanel";
import { getDailyFocusSummary } from "../../history/summary";
import { useHistoryStore } from "../../history/store";
import { switchToTimer } from "../../../shared/window/switcher";
import { useDashboardStore } from "../store";
import "./Dashboard.css";
import { OnboardingModal } from "./OnboardingModal";

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
  const todaySummary = getDailyFocusSummary(sessions);

  useEffect(() => {
    void hydrateHistory();
  }, [hydrateHistory]);

  useEffect(() => {
    const refreshHistory = () => {
      void hydrateHistory();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshHistory();
      }
    };

    window.addEventListener("focus", refreshHistory);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshHistory);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hydrateHistory]);

  const openInstructions = () => {
    showOnboarding();
    setOnboardingOpen(true);
  };

  return (
    <main className="dashboard-shell" aria-label="KURONE-KO dashboard">
      <section className="dashboard-card" data-tauri-drag-region>
        {activeView === DASHBOARD_VIEW.CONFIG ? (
          <ConfigPanel onBack={() => setActiveView(DASHBOARD_VIEW.MAIN)} />
        ) : (
          <>
            <p className="dashboard-eyebrow">KURONE-KO</p>
            <h1 className="dashboard-title">Prepare. Focus. Return.</h1>
            <div className="dashboard-grid" aria-label="Guided dashboard actions" data-interactive-region>
              <button className="dashboard-entry dashboard-entry-primary" type="button" aria-label="Start Focus" onClick={() => void switchToTimer()}>
                <span className="dashboard-entry-title">Start Focus</span>
                <span className="dashboard-entry-copy">Open the clean timer widget.</span>
              </button>
              <button className="dashboard-entry" type="button" aria-label="Configuration" onClick={() => setActiveView(DASHBOARD_VIEW.CONFIG)}>
                <span className="dashboard-entry-title">Configuration</span>
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
                <p className="dashboard-summary-label">Today’s quiet work</p>
                <p className="dashboard-summary-value">
                  {todaySummary.completedSessions} sessions · {todaySummary.focusedMinutes} min
                </p>
              </div>
            </section>
            <p className="dashboard-status">Focus setup lives here. The widget stays distraction-free.</p>
          </>
        )}
      </section>
      {onboardingOpen && <OnboardingModal onClose={() => setOnboardingOpen(false)} />}
    </main>
  );
}
