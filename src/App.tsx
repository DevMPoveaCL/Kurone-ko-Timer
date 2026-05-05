import { useEffect } from "react";
import "./App.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { installKuroneKoE2EDriver } from "./e2e/installE2EDriver";
import { Dashboard } from "./features/dashboard/components/Dashboard";
import { TimerWidget } from "./features/timer/components/TimerWidget";
import { setupWindowPositionTracking } from "./shared/window/switcher";

installKuroneKoE2EDriver();

function App() {
  useEffect(() => {
    setupWindowPositionTracking();
  }, []);

  // Auto-focus so keyboard shortcuts work immediately
  useEffect(() => {
    void getCurrentWindow().setFocus();
  }, []);

  // Stop music when the window is closed (taskbar close or exit button)
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async () => {
      try {
        const { useMusicStore } = await import("./features/music/store");
        await useMusicStore.getState().stopForTimer();
      } catch { /* non-critical */ }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const windowLabel = getCurrentWindow().label;

  if (windowLabel === "dashboard") {
    return <Dashboard />;
  }

  if (windowLabel === "timer") {
    return (
      <main className="widget-shell">
        <TimerWidget />
      </main>
    );
  }

  return (
    <main className="widget-shell">
      <p role="alert">Unknown window: {windowLabel}</p>
    </main>
  );
}

export default App;
