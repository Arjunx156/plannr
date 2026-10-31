import { afterEach, describe, expect, test } from "bun:test";
import { pastEvents, seedEvents, seedNotifications } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent } from "../src/data/types";
import { reply } from "../src/lib/assistant";
import {
  dateRange,
  dayLine,
  daysUntil,
  demoShift,
  fridayOnOrBefore,
  fullDate,
  parseDate,
  STORY_DAY,
  setToday,
} from "../src/lib/dates";
import { initialState, reducer } from "../src/store/reducer";
import { migrate } from "../src/store/store";

afterEach(() => setToday(STORY_DAY));

describe("date helpers", () => {
  test("ranges collapse the shared month and year", () => {
    expect(dateRange("2027-04-22", "2027-04-25")).toBe("22–25 Apr 2027");
    expect(dateRange("2027-04-29", "2027-05-02")).toBe("29 Apr–2 May 2027");
    expect(dateRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026–2 Jan 2027");
  });

  test("a one-day range is just the day", () => {
    expect(dateRange("2027-05-30", "2027-05-30")).toBe("30 May 2027");
  });

  test("a day line keeps only the details that are known", () => {
    expect(dayLine("2027-04-25", "7 PM", undefined, "Lotus Lawns")).toBe(
      "Sun 25 Apr 2027 · 7 PM · Lotus Lawns",
    );
    expect(dayLine("2027-04-25", undefined, false)).toBe("Sun 25 Apr 2027");
  });

  test("finds the Friday on or before a date", () => {
    expect(fridayOnOrBefore("2027-04-24")).toBe("2027-04-23");
    expect(fridayOnOrBefore("2027-04-23")).toBe("2027-04-23");
    expect(fridayOnOrBefore("2027-04-22")).toBe("2027-04-16");
  });

  test("writes letter dates in full", () => {
    expect(fullDate("2026-11-07")).toBe("Saturday 7 November 2026");
  });

  test("moves the demo in whole weeks, never more than three days off", () => {
    expect(demoShift("2026-09-27")).toBe(0);
    expect(demoShift("2026-10-23")).toBe(28);
    for (let d = 0; d < 60; d++) {
      const day = new Date(2026, 8, 27 + d);
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      expect(demoShift(iso) % 7).toBe(0);
      expect(Math.abs(demoShift(iso) - d)).toBeLessThanOrEqual(3);
    }
  });
});

describe("a fresh demo", () => {
  test("starts from today with the story's countdowns and weekdays", () => {
    setToday("2026-10-23");
    const [wedding, birthday, mela] = seedEvents() as [PersonalEvent, PersonalEvent, CommunityEvent];
    expect(wedding.date).toBe("2027-05-23");
    expect(parseDate(birthday.date).getDay()).toBe(6);
    expect(parseDate(mela.date).getDay()).toBe(6);
    // 210 days in the story; the week rounding keeps it within three days.
    expect(Math.abs(daysUntil(wedding.date) - 210)).toBeLessThanOrEqual(3);
    expect(wedding.eyebrow).toBe("Wedding · Kochi · 20–23 May 2027");
    expect(birthday.countdown.line.startsWith("Sat 14 Nov 2026")).toBe(true);
  });

  test("leaves no date tokens or story dates in any text", () => {
    setToday("2027-01-10");
    const text = JSON.stringify([seedEvents(), pastEvents(), seedNotifications()]);
    expect(text).not.toMatch(/\{(long|short|dm|month|range):/);
    expect(text).not.toContain("17 Oct");
    expect(text).not.toContain("7 Nov");
  });

  test("assistant changes use the event's own dates", () => {
    setToday("2026-10-23");
    const state = initialState(seedEvents());
    const ev = state.events[0] as PersonalEvent;
    const haldi = ev.functions.find((f) => f.id === "haldi");
    const msg = reply(ev, "Move the haldi to Friday", "dashboard");
    expect(msg.preview?.rows[0]?.to).toContain("Fri");
    const next = reducer(state, { type: "applyChange", eventId: ev.id, change: "move-haldi" });
    const moved = (next.events[0] as PersonalEvent).functions.find((f) => f.id === "haldi");
    expect(moved?.date).toBe(fridayOnOrBefore(haldi?.date ?? ""));
    const mela = state.events[2] as CommunityEvent;
    expect(reply(mela, "Draft the police application", "dashboard").source).toContain(fullDate(mela.date));
  });
});

describe("saved state", () => {
  test("an older save keeps the planner's own events and reseeds the demo", () => {
    const old = initialState(seedEvents());
    const mine = { ...old.events[3], id: "my-own-event", name: "Mine" } as (typeof old.events)[number];
    const saved = { ...old, version: 1, events: [...old.events, mine] } as unknown as Parameters<
      typeof migrate
    >[0];
    setToday("2026-10-23");
    const migrated = migrate(saved);
    // The old samples are dropped and fetched afresh; the planner's own event stays meanwhile.
    expect(migrated.seed).toBe(0);
    expect(migrated.events.map((e) => e.id)).toEqual(["my-own-event"]);
    const next = reducer(migrated, { type: "seedDemo", events: seedEvents() });
    expect(next.version).toBe(2);
    expect(next.demoShift).toBe(28);
    expect(next.events.find((e) => e.id === "my-own-event")?.name).toBe("Mine");
    expect(next.events[0]?.date).toBe("2027-05-23");
  });

  test("a save from this week is kept as is", () => {
    const state = reducer(initialState(seedEvents()), { type: "signIn" });
    expect(migrate(state)).toEqual({ ...state, toasts: [] });
  });
});
