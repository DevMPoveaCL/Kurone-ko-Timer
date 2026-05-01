import { isCompletedPositiveFocusSession, type FocusSession } from "./store";

export interface DailyFocusSummary {
  completedSessions: number;
  focusedMinutes: number;
}

const getIsoDatePrefix = (now: Date): string => now.toISOString().slice(0, 10);

export const getDailyFocusSummary = (
  sessions: FocusSession[],
  now: Date = new Date(),
): DailyFocusSummary => {
  const todayPrefix = getIsoDatePrefix(now);
  const todaysFocusSessions = sessions.filter(
    (session) =>
      isCompletedPositiveFocusSession(session) &&
      session.completedAt.startsWith(todayPrefix),
  );
  const focusedMinutes = Math.round(
    todaysFocusSessions.reduce((totalSeconds, session) => totalSeconds + session.durationSeconds, 0) / 60,
  );

  return {
    completedSessions: todaysFocusSessions.length,
    focusedMinutes,
  };
};
