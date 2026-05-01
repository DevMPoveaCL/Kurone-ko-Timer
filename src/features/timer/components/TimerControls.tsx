import { Pause, Play, RotateCcw } from "lucide-react";
import type { MouseEvent, PointerEvent } from "react";
import { TIMER_STATUS, type TimerStatus } from "../model";

interface TimerControlsProps {
  status: TimerStatus;
  onPause: () => void;
  onReset: () => void;
  onResume: () => void;
  onStart: () => void;
}

export function TimerControls({ status, onPause, onReset, onResume, onStart }: TimerControlsProps) {
  const stopControlPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleStartClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onStart();
  };

  if (status === TIMER_STATUS.IDLE || status === TIMER_STATUS.SESSION_COMPLETE) {
    const label = status === TIMER_STATUS.SESSION_COMPLETE ? "Start again" : "Start";

    return (
      <div className="timer-controls" data-interactive-region draggable={false}>
        <button
          className="control-button control-button-primary"
          type="button"
          data-interactive-region
          draggable={false}
          onClick={handleStartClick}
          onPointerDown={stopControlPointerDrag}
        >
          <Play aria-hidden="true" size={14} />
          {label}
        </button>
      </div>
    );
  }

  const primaryAction = status === TIMER_STATUS.PAUSED ? onResume : onPause;
  const PrimaryIcon = status === TIMER_STATUS.PAUSED ? Play : Pause;
  const primaryLabel = status === TIMER_STATUS.PAUSED ? "Resume" : "Pause";
  const handlePrimaryClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    primaryAction();
  };

  const handleResetClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onReset();
  };

  return (
    <div className="timer-controls" data-interactive-region draggable={false}>
      <button
        className="control-button control-button-primary"
        type="button"
        data-interactive-region
        draggable={false}
        onClick={handlePrimaryClick}
        onPointerDown={stopControlPointerDrag}
      >
        <PrimaryIcon aria-hidden="true" size={14} />
        {primaryLabel}
      </button>
      <button
        className="control-button"
        type="button"
        data-interactive-region
        draggable={false}
        onClick={handleResetClick}
        onPointerDown={stopControlPointerDrag}
      >
        <RotateCcw aria-hidden="true" size={14} />
        Reset
      </button>
    </div>
  );
}
