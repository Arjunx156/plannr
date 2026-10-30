import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent } from "../src/data/types";
import { addDays } from "../src/lib/dates";
import {
  basics,
  entryCode,
  isHelper,
  linkExpiry,
  PUBLIC_PATH,
  passCode,
  projectView,
  readEntryCode,
  readPassCode,
} from "../src/shared/public";
import { functionsOf, list, vendorsOf } from "../src/shared/records";

/**
 * What each shared link shows. Links are opened without an account, so every view must carry
 * only what its holder needs: one household, one helper's jobs, one vendor's call sheet.
 */

const events = seedEvents();
const wedding = events.find((e) => e.id === "ananya-rohan") as PersonalEvent;
const mela = events.find((e) => e.id === "green-valley-mela") as CommunityEvent;

describe("link lifetimes", () => {
  test("a link works for a month after the last function; the album and fund report for six", () => {
    const last = functionsOf(wedding)
      .map((f) => f.date)
      .sort()
      .at(-1) as string;
    expect(linkExpiry(wedding, "rsvp")).toBe(addDays(last, 30));
    expect(linkExpiry(wedding, "album")).toBe(addDays(last, 180));
    expect(linkExpiry(mela, "fund")).toBe(addDays(mela.date, 180));
  });

  test("every kind of link has its own short path", () => {
    expect(new Set(Object.values(PUBLIC_PATH)).size).toBe(Object.keys(PUBLIC_PATH).length);
  });
});

describe("QR codes", () => {
  test("entry and pass codes round-trip, and nothing else reads as one", () => {
    expect(readEntryCode(entryCode("h_42"))).toBe("h_42");
    expect(readPassCode(passCode("p-7"))).toBe("p-7");
    expect(readEntryCode(passCode("p-7"))).toBeUndefined();
    expect(readPassCode("https://evil.example/plannr:p:1")).toBeUndefined();
    expect(readEntryCode(`plannr:h:${"x".repeat(81)}`)).toBeUndefined();
  });
});

describe("helpers", () => {
  test("a helper is anyone named in a task's who, however it's written", () => {
    expect(isHelper("Ananya, Rohan", "Rohan")).toBe(true);
    expect(isHelper("Rekha & Thomas", "thomas")).toBe(true);
    expect(isHelper("Vivek (uncle) and Meera", "Vivek")).toBe(true);
    expect(isHelper("Rohan", "Ro")).toBe(false);
    expect(isHelper(undefined, "Rohan")).toBe(false);
  });
});

describe("what each link shows", () => {
  test("basics hide private functions unless the household is invited to them", () => {
    const shown = basics(wedding).functions.map((f) => f.id);
    const hidden = functionsOf(wedding).filter((f) => f.private);
    for (const f of hidden) expect(shown).not.toContain(f.id);
    const one = functionsOf(wedding)[0];
    if (one) expect(basics(wedding, [one.id]).functions.map((f) => f.id)).toEqual([one.id]);
  });

  test("an RSVP shows one household, and its entry QR only once they've said yes", () => {
    const [h, other] = list(wedding, "households");
    if (!h || !other) throw new Error("the demo wedding has households");
    const view = projectView(wedding, "rsvp", h.id);
    expect(view?.kind).toBe("rsvp");
    if (view?.kind !== "rsvp") return;
    expect(view.household.name).toBe(h.name);
    expect(JSON.stringify(view)).not.toContain(other.name);
    expect(JSON.stringify(view)).not.toContain("phone");
    const saidYes = Object.values(h.rsvp).some((a) => a.status === "yes");
    expect(view.entry).toBe(saidYes ? entryCode(h.id) : undefined);
    expect(projectView(wedding, "rsvp", "nobody")).toBeUndefined();
  });

  test("a helper sees only their own tasks, oldest first", () => {
    const task = wedding.tasks.list.find((t) => t.who && t.who !== "You");
    if (!task) throw new Error("the demo wedding has a helper task");
    const name = task.who.split(/,|&/)[0]?.trim() ?? task.who;
    const view = projectView(wedding, "helper", name);
    if (view?.kind !== "helper") throw new Error("expected a helper view");
    expect(view.tasks.length).toBeGreaterThan(0);
    expect(
      view.tasks.every((t) => wedding.tasks.list.some((x) => x.id === t.id && isHelper(x.who, name))),
    ).toBe(true);
    expect(view.tasks.map((t) => t.due)).toEqual([...view.tasks.map((t) => t.due)].sort());
  });

  test("a vendor sees their arrivals and payments, never another vendor's", () => {
    const [v, other] = vendorsOf(wedding).filter((x) => x.name);
    if (!v || !other) throw new Error("the demo wedding has named vendors");
    const view = projectView(wedding, "vendor", v.id);
    if (view?.kind !== "vendor") throw new Error("expected a vendor view");
    expect(view.vendor.name).toBe(v.name);
    const theirs = list(wedding, "payments").filter((p) => p.vendorId === v.id);
    expect(view.payments).toHaveLength(theirs.length);
    expect(JSON.stringify(view.payments)).not.toContain(other.name);
  });

  test("the volunteer sheet shows first names only", () => {
    const view = projectView(mela, "shifts", "");
    if (view?.kind !== "shifts") throw new Error("expected a shifts view");
    const names = view.roles.flatMap((r) => r.slots.flatMap((s) => s.names));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).not.toContain(" ");
    expect(view.roles.flatMap((r) => r.slots).every((s) => s.filled <= s.need || s.need === 0)).toBe(true);
  });

  test("the fund report counts approved spending and pending claims, and names paying sponsors only", () => {
    const view = projectView(mela, "fund", "");
    if (view?.kind !== "fund") throw new Error("expected a fund view");
    const pending = mela.funds.approvals.filter((a) => a.status === "pending");
    expect(view.pending.count).toBe(pending.length);
    expect(view.expenses.every((e) => mela.funds.approvals.some((a) => a.label === e.label))).toBe(true);
    for (const s of view.sponsors)
      expect((mela.sponsors ?? []).find((x) => x.name === s.name)?.received).toBeGreaterThan(0);
  });

  test("stall booking shows the fee and the places still open", () => {
    const view = projectView(mela, "stalls", "");
    if (view?.kind !== "stalls") throw new Error("expected a stalls view");
    expect(view.open).toBeGreaterThanOrEqual(0);
    expect(view.open).toBeLessThanOrEqual(view.total);
    expect(view.fee).toBe(Math.max(...(mela.stallList ?? []).map((s) => s.fee)));
  });

  test("the gate lists passes with how many are already inside", () => {
    const view = projectView(mela, "gate", "");
    if (view?.kind !== "gate") throw new Error("expected a gate view");
    expect(view.passes.length).toBe((mela.passList ?? []).length);
    expect(view.passes.every((p) => p.checkedIn >= 0)).toBe(true);
  });

  test("community pages don't exist for a wedding, and an unpublished site isn't shown", () => {
    for (const kind of ["shifts", "fund", "stalls", "gate"] as const)
      expect(projectView(wedding, kind, "")).toBeUndefined();
    const unpublished = { ...wedding, site: wedding.site && { ...wedding.site, published: false } };
    expect(projectView(unpublished, "site", "")).toBeUndefined();
  });

  test("the album shows the newest photos first", () => {
    const view = projectView(wedding, "album", "");
    if (view?.kind !== "album") throw new Error("expected an album view");
    expect(view.photos).toEqual(list(wedding, "album").slice().reverse());
  });
});
