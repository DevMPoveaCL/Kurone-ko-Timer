import "./App.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { installKuroneKoE2EDriver } from "./e2e/installE2EDriver";
import { Dashboard } from "./features/dashboard/components/Dashboard";
import { TimerWidget } from "./features/timer/components/TimerWidget";

installKuroneKoE2EDriver();

function App() {
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
