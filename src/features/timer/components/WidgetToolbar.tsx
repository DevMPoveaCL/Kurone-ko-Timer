import { Clock3, History, LayoutGrid, Minus } from "lucide-react";
import { MusicToggle } from "../../music/components/MusicToggle";
import { minimizeCurrentWindow } from "../../../shared/window/minimize";
import { switchToDashboard } from "../../../shared/window/switcher";

export const WIDGET_PANEL = {
  TIMER: "timer",
  HISTORY: "history",
} as const;

export type WidgetPanel = (typeof WIDGET_PANEL)[keyof typeof WIDGET_PANEL];

export interface WidgetToolbarProps {
  activePanel: WidgetPanel;
  onPanelChange: (panel: WidgetPanel) => void;
}

export function WidgetToolbar({ activePanel, onPanelChange }: WidgetToolbarProps) {
  return (
    <div className="widget-toolbar">
      <div className="toolbar-leading">
        <button className="icon-button" type="button" aria-label="Return to dashboard" onClick={() => void switchToDashboard()}>
          <LayoutGrid aria-hidden="true" size={13} />
        </button>
        <button className="icon-button" type="button" aria-label="Show timer" aria-pressed={activePanel === WIDGET_PANEL.TIMER} onClick={() => onPanelChange(WIDGET_PANEL.TIMER)}>
          <Clock3 aria-hidden="true" size={13} />
        </button>
      </div>
      <div className="panel-toggle" aria-label="Widget views" data-interactive-region>
        <button className="icon-button" type="button" aria-label="Show history" aria-pressed={activePanel === WIDGET_PANEL.HISTORY} onClick={() => onPanelChange(WIDGET_PANEL.HISTORY)}>
          <History aria-hidden="true" size={13} />
        </button>
        <MusicToggle />
        <button className="icon-button" type="button" aria-label="Minimize widget" onClick={() => void minimizeCurrentWindow()}>
          <Minus aria-hidden="true" size={13} />
        </button>
      </div>
    </div>
  );
}
