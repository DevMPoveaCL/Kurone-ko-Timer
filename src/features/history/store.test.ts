import { describe, expect, it } from "vitest";
import {
  createHistoryStore,
  createMemoryHistoryRepository,
  isFocusSessionList,
  normalizeFocusSessionList,
  SESSION_STATUS,
  SESSION_TYPE,
} from "./store";
import { getDailyFocusSummary } from "./summary";

const STARTED_AT = 1_700_000_000_000;
const COMPLETED_AT = STARTED_AT + 25 * 60 * 1_000;

describe("history store", () => {
  it("persists completed focus sessions with minimal history fields", async () => {
    const repository = createMemoryHistoryRepository();
    const store = createHistoryStore(repository);

    await store.getState().hydrate();
    await store.getState().addSession({
      completedAt: COMPLETED_AT,
      durationSeconds: 25 * 60,
      type: SESSION_TYPE.FOCUS,
    });

    await expect(repository.load()).resolves.toHaveLength(1);
    expect(store.getState().sessions[0]).toMatchObject({
      durationSeconds: 25 * 60,
      durationMinutes: 25,
      type: SESSION_TYPE.FOCUS,
      status: SESSION_STATUS.COMPLETED,
    });
  });

  it("refuses to persist zero-minute completed focus sessions", async () => {
    const repository = createMemoryHistoryRepository();
    const store = createHistoryStore(repository);

    await store.getState().hydrate();
    await store.getState().addSession({
      completedAt: COMPLETED_AT,
      durationSeconds: 0,
      type: SESSION_TYPE.FOCUS,
    });

    expect(store.getState().sessions).toEqual([]);
    await expect(repository.load()).resolves.toEqual([]);
  });

  it("rejects unknown session data", () => {
    expect(isFocusSessionList([{ id: "bad", duration: 1 }])).toBe(false);
  });

  it("normalizes legacy completed history and drops non-completed or zero-minute sessions", () => {
    const completedAt = new Date(COMPLETED_AT).toISOString();

    expect(normalizeFocusSessionList([
      {
        id: "legacy-completed",
        startedAt: new Date(STARTED_AT).toISOString(),
        completedAt,
        duration: 1_500,
        status: SESSION_STATUS.COMPLETED,
      },
      {
        id: "legacy-cancelled",
        startedAt: new Date(STARTED_AT).toISOString(),
        completedAt,
        duration: 15,
        status: "cancelled",
      },
      {
        id: "legacy-zero",
        completedAt,
        durationSeconds: 0,
        durationMinutes: 0,
        type: SESSION_TYPE.FOCUS,
        status: SESSION_STATUS.COMPLETED,
      },
    ])).toEqual([
      {
        id: "legacy-completed",
        completedAt,
        durationSeconds: 1_500,
        durationMinutes: 25,
        type: SESSION_TYPE.FOCUS,
        status: SESSION_STATUS.COMPLETED,
      },
    ]);
  });

  it("computes today's completed focus sessions and focused minutes", () => {
    const today = "2026-04-30T10:00:00.000Z";

    expect(getDailyFocusSummary([
      {
        id: "today-1",
        completedAt: "2026-04-30T09:00:00.000Z",
        durationSeconds: 1_500,
        durationMinutes: 25,
        type: SESSION_TYPE.FOCUS,
        status: SESSION_STATUS.COMPLETED,
      },
      {
        id: "today-2",
        completedAt: "2026-04-30T09:30:00.000Z",
        durationSeconds: 900,
        durationMinutes: 15,
        type: SESSION_TYPE.FOCUS,
        status: SESSION_STATUS.COMPLETED,
      },
      {
        id: "yesterday",
        completedAt: "2026-04-29T23:59:00.000Z",
        durationSeconds: 1_500,
        durationMinutes: 25,
        type: SESSION_TYPE.FOCUS,
        status: SESSION_STATUS.COMPLETED,
      },
    ], new Date(today))).toEqual({ completedSessions: 2, focusedMinutes: 40 });
  });

  it("ignores zero-minute completed-like entries in today's summary", () => {
    const today = "2026-04-30T10:00:00.000Z";

    expect(getDailyFocusSummary([
      {
        id: "today-valid",
        completedAt: "2026-04-30T09:00:00.000Z",
        durationSeconds: 1_500,
        durationMinutes: 25,
        type: SESSION_TYPE.FOCUS,
        status: SESSION_STATUS.COMPLETED,
      },
      {
        id: "today-zero",
        completedAt: "2026-04-30T09:30:00.000Z",
        durationSeconds: 0,
        durationMinutes: 0,
        type: SESSION_TYPE.FOCUS,
        status: SESSION_STATUS.COMPLETED,
      },
    ], new Date(today))).toEqual({ completedSessions: 1, focusedMinutes: 25 });
  });
});
