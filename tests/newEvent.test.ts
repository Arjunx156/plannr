/** A new event from an accepted draft: its name, its functions and where they happen, and how big the plan is. */
import { describe, expect, test } from "bun:test";
import type { Profile } from "../src/data/types";
import { emptyProfile } from "../src/lib/intake";
import { eventFromDraft, eventName } from "../src/lib/newEvent";
import { countTasks, draftPlan, planTitle } from "../src/lib/plan";

const me = { name: "Priya", initials: "PM" };
const profile = (p: Partial<Profile>): Profile => ({ ...emptyProfile(), ...p });

describe("naming a new event", () => {
  test.each<[Partial<Profile>, string, string]>([
    [{ kind: "wedding", names: "Meera & Arjun" }, "Meera & Arjun's wedding", "Meera & Arjun"],
    [{ kind: "wedding" }, "Our wedding", "your wedding"],
    [{ kind: "birthday", names: "Aarav" }, "Aarav's birthday", "Aarav's birthday"],
    [{ kind: "birthday" }, "Birthday party", "the birthday"],
    [{ kind: "community", city: "Thrissur" }, "Community event, Thrissur", "your community event"],
    [{ kind: "community" }, "Community event", "your community event"],
    [{ kind: "other", names: "Retirement lunch" }, "Retirement lunch", "your event"],
    [{}, "New event", "your event"],
  ])("%o is named %p and called %p in the plan", (p, name, title) => {
    expect(eventName(profile(p))).toBe(name);
    expect(planTitle(profile(p))).toBe(title);
  });
});

describe("a new event's functions", () => {
  test("are dated around the day, with the ceremony in the morning when the reception is that evening", () => {
    const p = profile({
      kind: "wedding",
      date: "2027-04-18",
      functions: ["Haldi", "Ceremony", "Reception"],
      venues: "Bolgatty Palace",
    });
    const place = "Bolgatty Palace";
    expect(eventFromDraft(p, draftPlan(p), me).functions).toEqual([
      { id: "haldi", label: "Haldi", date: "2027-04-17", part: undefined, place },
      { id: "ceremony", label: "Ceremony", date: "2027-04-18", part: "AM", place },
      { id: "reception", label: "Reception", date: "2027-04-18", part: "PM", place },
    ]);
  });

  test("happen in the city until one venue is chosen, and a single function needs none", () => {
    const shortlist = profile({
      kind: "wedding",
      date: "2027-04-18",
      functions: ["Ceremony", "Sangeet"],
      venues: "Le Meridien or Crowne Plaza",
      city: "Kochi",
    });
    const fns = eventFromDraft(shortlist, draftPlan(shortlist), me).functions;
    expect(fns.map((f) => [f.label, f.date, f.part, f.place])).toEqual([
      ["Ceremony", "2027-04-18", undefined, "Kochi"],
      ["Sangeet", "2027-04-16", undefined, "Kochi"],
    ]);
    const party = profile({ kind: "birthday", functions: ["Party"], venues: "Home" });
    expect(eventFromDraft(party, draftPlan(party), me).functions).toEqual([]);
  });
});

describe("how many tasks a plan needs", () => {
  test("grows with a wedding's functions and a community event's crowd", () => {
    expect(countTasks("wedding", 3, 250)).toBe(45 + 18 + 2);
    expect(countTasks("wedding", 0, 100)).toBe(51);
    expect(countTasks("birthday", 1, 40)).toBe(18);
    expect(countTasks("community", 1, 400)).toBe(46);
    expect(countTasks("community", 1, 5000)).toBe(54);
    expect(countTasks("other", 1, 50)).toBe(24);
  });
});
