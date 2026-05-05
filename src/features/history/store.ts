import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export const SESSION_STATUS = {
  COMPLETED: "completed",
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const SESSION_TYPE = {
  FOCUS: "focus",
} as const;

export type SessionType = (typeof SESSION_TYPE)[keyof typeof SESSION_TYPE];

export interface FocusSession {
  id: string;
  completedAt: string;
  durationSeconds: number;
  durationMinutes: number;
  type: SessionType;
  status: SessionStatus;
}

export interface SessionInput {
  completedAt: number;
  durationSeconds: number;
  type: SessionType;
}

export interface HistoryRepository {
  load: () => Promise<FocusSession[]>;
  save: (sessions: FocusSession[]) => Promise<void>;
}

interface HistoryStoreState {
  sessions: FocusSession[];
  hydrated: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  addSession: (session: SessionInput) => Promise<void>;
}

const HISTORY_COMMAND = {
  LOAD: "load_history",
  SAVE: "save_history",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSessionStatus = (value: unknown): value is SessionStatus =>
  value === SESSION_STATUS.COMPLETED;

const isSessionType = (value: unknown): value is SessionType =>
  value === SESSION_TYPE.FOCUS;

const getFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const hasPositiveDisplayDuration = (durationSeconds: number): boolean =>
  durationSeconds > 0 && Math.round(durationSeconds / 60) > 0;

const normalizeFocusSession = (value: unknown): FocusSession | null => {
  if (!isRecord(value)) {
    return null;
  }

  const durationSeconds = getFiniteNumber(value.durationSeconds) ?? getFiniteNumber(value.duration);
  const completedAt = typeof value.completedAt === "string" ? value.completedAt : null;
  const status = isSessionStatus(value.status) ? value.status : null;
  const type = isSessionType(value.type) ? value.type : SESSION_TYPE.FOCUS;

  if (
    typeof value.id !== "string" ||
    completedAt === null ||
    durationSeconds === null ||
    status === null
  ) {
    return null;
  }

  const safeDurationSeconds = Math.max(0, Math.round(durationSeconds));

  if (!hasPositiveDisplayDuration(safeDurationSeconds)) {
    return null;
  }

  return {
    id: value.id,
    completedAt,
    durationSeconds: safeDurationSeconds,
    durationMinutes: Math.round(safeDurationSeconds / 60),
    type,
    status,
  };
};

const isFocusSession = (value: unknown): value is FocusSession => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.durationSeconds === "number" &&
    Number.isFinite(value.durationSeconds) &&
    typeof value.durationMinutes === "number" &&
    Number.isFinite(value.durationMinutes) &&
    isSessionType(value.type) &&
    isSessionStatus(value.status)
  );
};

export const isFocusSessionList = (value: unknown): value is FocusSession[] =>
  Array.isArray(value) && value.every(isFocusSession);

export const isCompletedPositiveFocusSession = (session: FocusSession): boolean =>
  session.status === SESSION_STATUS.COMPLETED &&
  session.type === SESSION_TYPE.FOCUS &&
  hasPositiveDisplayDuration(session.durationSeconds) &&
  session.durationMinutes > 0;

export const normalizeFocusSessionList = (value: unknown): FocusSession[] =>
  Array.isArray(value)
    ? value.flatMap((session) => {
        const normalizedSession = normalizeFocusSession(session);

        return normalizedSession === null ? [] : [normalizedSession];
      })
    : [];

const createSessionId = ({ completedAt, type }: SessionInput): string =>
  `${type}-${completedAt}`;

const normalizeError = (error: unknown): string =>
  error instanceof Error ? error.message : "Unexpected history persistence error";

export const createMemoryHistoryRepository = (
  initialSessions: FocusSession[] = [],
): HistoryRepository => {
  let sessions = initialSessions;

  return {
    load: async () => normalizeFocusSessionList(sessions),
    save: async (nextSessions) => {
      sessions = normalizeFocusSessionList(nextSessions);
    },
  };
};

export const createTauriHistoryRepository = (): HistoryRepository => ({
  load: async () => {
    const history = await invoke<unknown>(HISTORY_COMMAND.LOAD);

    return normalizeFocusSessionList(history);
  },
  save: async (history) => {
    await invoke<void>(HISTORY_COMMAND.SAVE, { history });
  },
});

const defaultRepository = createTauriHistoryRepository();

export const createHistoryStore = (repository: HistoryRepository = defaultRepository) =>
  create<HistoryStoreState>()((set, get) => ({
    sessions: [],
    hydrated: false,
    error: null,

    hydrate: async () => {
      try {
        const sessions = await repository.load();
        set({ sessions, hydrated: true, error: null });
      } catch (error) {
        set({ hydrated: true, error: normalizeError(error) });
      }
    },

    addSession: async (session) => {
      const durationSeconds = Math.max(0, Math.round(session.durationSeconds));

      if (!hasPositiveDisplayDuration(durationSeconds)) {
        return;
      }

      const nextSession: FocusSession = {
        id: createSessionId(session),
        completedAt: new Date(session.completedAt).toISOString(),
        durationSeconds,
        durationMinutes: Math.round(durationSeconds / 60),
        type: session.type,
        status: SESSION_STATUS.COMPLETED,
      };
      const sessions = [nextSession, ...get().sessions];

      set({ sessions, error: null });

      try {
        await repository.save(sessions);
        try {
          const { emit } = await import("@tauri-apps/api/event");
          emit("history-updated", { count: sessions.length }).catch(() => {});
        } catch {
          // Tauri event API not available
        }
      } catch (error) {
        set({ error: normalizeError(error) });
      }
    },
  }));

export const useHistoryStore = createHistoryStore();
