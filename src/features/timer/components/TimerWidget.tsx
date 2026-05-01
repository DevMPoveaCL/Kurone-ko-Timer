import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState, type PointerEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { isCompletedPositiveFocusSession, useHistoryStore } from "../../history/store";
import { getDailyFocusSummary } from "../../history/summary";
import { useSettingsStore } from "../../settings/store";
import { useMusicStore } from "../../music/store";
import { useAppHydration } from "../../../shared/hydration/useAppHydration";
import { TIMER_STATUS, type TimerStatus } from "../model";
import { useTimerStore } from "../store";
import { TimerControls } from "./TimerControls";
import { TimerDisplay } from "./TimerDisplay";
import { WIDGET_PANEL, WidgetToolbar, type WidgetPanel } from "./WidgetToolbar";

const INTERACTIVE_DRAG_TARGET = "button,input,label,select,textarea,a,[role='button'],[data-interactive-region]";
const isE2EMode = import.meta.env.DEV && import.meta.env.VITE_KURONE_KO_E2E === "1";

const isInteractiveDragTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(INTERACTIVE_DRAG_TARGET) !== null;

interface TimerTickerProps {
  status: TimerStatus;
  tick: () => void;
}

function TimerTicker({ status, tick }: TimerTickerProps) {
  useEffect(() => {
    if (status !== TIMER_STATUS.RUNNING) {
      return;
    }

    tick();
    const intervalId = window.setInterval(() => {
      tick();
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [status, tick]);

  return null;
}

export function TimerWidget() {
  const [activePanel, setActivePanel] = useState<WidgetPanel>(WIDGET_PANEL.TIMER);
  const { completedFocusSessions, hydrate, pause, phase, remainingSeconds, reset, resume, setSettings, start, status, tick } =
    useTimerStore(
      useShallow((state) => ({
        completedFocusSessions: state.completedFocusSessions,
        hydrate: state.hydrate,
        pause: state.pause,
        phase: state.phase,
        remainingSeconds: state.remainingSeconds,
        reset: state.reset,
        resume: state.resume,
        setSettings: state.setSettings,
        start: state.start,
        status: state.status,
        tick: state.tick,
      })),
    );
  const { hydrate: hydrateHistory, sessions } = useHistoryStore(
    useShallow((state) => ({
      hydrate: state.hydrate,
      sessions: state.sessions,
    })),
  );
  const { hydrate: hydrateSettings, settings } = useSettingsStore(
    useShallow((state) => ({
      hydrate: state.hydrate,
      settings: state.settings,
    })),
  );
  const hydrateMusic = useMusicStore((state) => state.hydrate);

  const { hydrated } = useAppHydration({ hydrateSettings, hydrateHistory, hydrateMusic, hydrate, setSettings });

  const syncLatestSettings = async () => {
    if (isE2EMode) {
      setSettings(useSettingsStore.getState().settings);
      return;
    }

    await hydrateSettings();
    setSettings(useSettingsStore.getState().settings);
  };

  const startWithLatestSettings = async () => {
    await syncLatestSettings();
    start();
  };

  const resetWithLatestSettings = async () => {
    await syncLatestSettings();
    reset();
  };

  useEffect(() => {
    if (hydrated) {
      setSettings(settings);
    }
  }, [hydrated, setSettings, settings]);

  useEffect(() => {
    const syncSettingsFromRepository = () => {
      void hydrateSettings().then(() => {
        setSettings(useSettingsStore.getState().settings);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncSettingsFromRepository();
      }
    };

    window.addEventListener("focus", syncSettingsFromRepository);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncSettingsFromRepository);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hydrateSettings, setSettings]);

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todaysCompletedSessions = sessions.filter(
    (session) =>
      isCompletedPositiveFocusSession(session) &&
      session.completedAt.startsWith(todayPrefix),
  );
  const todaysFocusSummary = getDailyFocusSummary(sessions);
  const completedFocusMinutes = Math.round(settings.focusDurationSeconds / 60);

  const showPanel = (panel: WidgetPanel) => {
    setActivePanel((currentPanel) => (currentPanel === panel ? WIDGET_PANEL.TIMER : panel));
  };

  const handleWidgetPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || isInteractiveDragTarget(event.target)) {
      return;
    }

    void getCurrentWindow().startDragging().catch(() => undefined);
  };

  return (
    <section className="timer-card" aria-label="KURONE-KO focus timer; drag empty areas to move" onPointerDown={handleWidgetPointerDown}>
      <TimerTicker status={status} tick={tick} />
      <div className="widget-drag-bar" aria-label="Move widget" data-tauri-drag-region="" />
      <WidgetToolbar activePanel={activePanel} onPanelChange={showPanel} />

      {activePanel === WIDGET_PANEL.TIMER && status === TIMER_STATUS.SESSION_COMPLETE && (
        <div className="session-complete-panel" role="status" aria-label="Pomodoro session complete">
          <p className="eyebrow">KURONE-KO · Session complete</p>
          <h1 className="complete-title">Goal done</h1>
          <p className="complete-next-step">{completedFocusMinutes} focused minutes saved</p>
          <p className="complete-summary">{completedFocusSessions}/{settings.sessionGoal} focus blocks</p>
          <div className="timer-controls" data-interactive-region draggable={false}>
            <button className="control-button control-button-primary" type="button" onClick={() => void startWithLatestSettings()}>Start again</button>
            <button className="control-button" type="button" onClick={() => setActivePanel(WIDGET_PANEL.HISTORY)}>History</button>
          </div>
        </div>
      )}

      {activePanel === WIDGET_PANEL.TIMER && status !== TIMER_STATUS.SESSION_COMPLETE && (
        <>
          <TimerDisplay phase={phase} remainingSeconds={remainingSeconds} status={status} />
          <TimerControls status={status} onPause={pause} onReset={() => void resetWithLatestSettings()} onResume={resume} onStart={() => void startWithLatestSettings()} />
        </>
      )}

      {activePanel === WIDGET_PANEL.HISTORY && (
        <div className="compact-panel history-panel" aria-label="Today history">
          <p className="summary-line">Today: {todaysFocusSummary.completedSessions} sessions · {todaysFocusSummary.focusedMinutes} min</p>
          {todaysCompletedSessions.length > 0 && <p className="summary-note">All {todaysCompletedSessions.length} shown · scroll if needed</p>}
          <ol>
            {todaysCompletedSessions.map((session) => (
              <li key={session.id}>{session.durationMinutes} min focus</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
