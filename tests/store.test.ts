import { describe, expect, test } from "bun:test";
import type { ActivityEntry } from "../src/shared/types";
import { initialState, migrate, reducer } from "../src/store/store";

const change = (at: string): ActivityEntry => ({
  id: at,
  eventId: "e1",
  eventName: "Wedding",
  kind: "action",
  summary: "Ticked off a task",
  at,
  by: "Rohan",
  mine: false,
});

describe("inbox", () => {
  test("opening it marks changes seen by the server's clock, not the device's", () => {
    const start = {
      ...initialState(),
      activity: [change("2031-01-02T10:00:00.000Z"), change("2031-01-01T10:00:00.000Z")],
    };
    const read = reducer(start, { type: "readNotifications" });
    expect(read.inboxSeen).toBe("2031-01-02T10:00:00.000Z");
    // Nothing loaded yet: the last seen point stays put rather than jumping to the device's time.
    const empty = reducer({ ...read, activity: [] }, { type: "readNotifications" });
    expect(empty.inboxSeen).toBe("2031-01-02T10:00:00.000Z");
  });
});

describe("saved state", () => {
  test("an account's saved plans are never mixed with the demo seed", () => {
    const saved = { ...initialState(), mode: "account" as const, events: [], demoShift: -999 };
    const loaded = migrate(saved);
    expect(loaded.events).toEqual([]);
    expect(loaded.mode).toBe("account");
  });
});
