import { TIMER_PHASE, TIMER_STATUS, type TimerPhase, type TimerStatus } from "../model";

interface TimerDisplayProps {
  phase: TimerPhase;
  remainingSeconds: number;
  status: TimerStatus;
}

const phaseLabel: Record<TimerPhase, string> = {
  [TIMER_PHASE.FOCUS]: "Focus",
  [TIMER_PHASE.SHORT_BREAK]: "Short break",
  [TIMER_PHASE.LONG_BREAK]: "Long break",
};

const formatTime = (totalSeconds: number): string => {
  const safeTotalSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const minutes = Math.floor(safeTotalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeTotalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
};

const getStatusLabel = (status: TimerStatus, phase: TimerPhase): string => {
  if (status === TIMER_STATUS.SESSION_COMPLETE) {
    return "Session complete";
  }

  if (status === TIMER_STATUS.IDLE) {
    return "Ready to focus";
  }

  if (status === TIMER_STATUS.PAUSED) {
    return `${phaseLabel[phase]} paused`;
  }

  return phaseLabel[phase];
};

export function TimerDisplay({ phase, remainingSeconds, status }: TimerDisplayProps) {
  return (
    <div className="timer-display">
      <p className="eyebrow">
        KURONE-KO · {getStatusLabel(status, phase)}
      </p>
      <h1 className="time">
        {formatTime(remainingSeconds)}
      </h1>
    </div>
  );
}
