/**
 * The assistant that answers on the device when AI is off: the questions it knows, in the order it checks
 * them, and what it says when it can't help.
 */
import { describe, expect, test } from "bun:test";
import { introFor, reply } from "../src/lib/assistant";
import { fridayOnOrBefore } from "../src/lib/dates";
import { DECOR_AFTER_CUT } from "../src/shared/suggestions";
import { demo } from "./support";

const { wedding, birthday, mela, empty } = demo();
const ask = (ev: typeof wedding, text: string) => reply(ev, text, "dashboard");

describe("moving the haldi", () => {
  test("previews the move, in Malayalam when asked in Malayalam", () => {
    const english = ask(wedding, "Can we move the haldi to Friday?");
    expect(english.preview).toBeDefined();
    expect(english.text).toContain("Nothing is applied until you confirm");
    const malayalam = ask(wedding, "ഹൽദി വെള്ളിയാഴ്ചയിലേക്ക് മാറ്റാമോ?");
    expect(malayalam).toMatchObject({ lang: "ml", translation: expect.stringContaining("confirm") });
  });

  test("says so when the haldi is already on a Friday, or there's no haldi", () => {
    const functions = wedding.functions.map((f) =>
      f.id === "haldi" ? { ...f, date: fridayOnOrBefore(f.date) } : f,
    );
    expect(ask({ ...wedding, functions }, "Move the haldi to Friday").text).toContain("already on");
    expect(ask(birthday, "Move the haldi to Friday").text).toContain("doesn't have a haldi");
  });
});

describe("the wedding budget", () => {
  test("cuts décor only on a wedding, and not twice", () => {
    expect(ask(birthday, "Cut the décor").text).toContain("only propose décor cuts on the wedding");
    const categories = wedding.budget.categories.map((c) =>
      c.id === "decor" ? { ...c, planned: DECOR_AFTER_CUT } : c,
    );
    expect(ask({ ...wedding, budget: { ...wedding.budget, categories } }, "Cut the décor").text).toContain(
      "already down to",
    );
  });

  test("drafts the décor brief", () => {
    expect(ask(wedding, "Write the brief for Mangalya").text).toContain("Mangalya Décor");
  });
});

describe("a child's birthday", () => {
  test("answers on allergies and snacks", () => {
    expect(ask(birthday, "Any allergies?").text).toContain("nut allergies");
    expect(ask(birthday, "What snacks should we serve?").text).toContain("mini dosas");
  });
});

describe("what's next", () => {
  test("lists open tasks, and says when there are none", () => {
    expect(ask(wedding, "What's due this week?").text).toStartWith("Next up:");
    const list = wedding.tasks.list.map((t) => ({ ...t, done: true }));
    expect(ask({ ...wedding, tasks: { ...wedding.tasks, list } }, "What's due this week?").text).toBe(
      "Everything on the list is done. Enjoy the day.",
    );
  });
});

describe("questions it can't answer", () => {
  test("point to what it can do, on the budget page, the dashboard, a committee's event and an empty one", () => {
    expect(reply(wedding, "Hello", "budget").text).toContain("cut a category");
    expect(ask(wedding, "Hello").text).toContain("explain readiness");
    expect(reply(mela, "Hello", "dashboard").text).toStartWith("Readiness is");
    expect(reply(empty, "Hello", "dashboard").text).toContain("Once this event has a plan");
  });
});

describe("the panel's first line", () => {
  test("names what the assistant can see", () => {
    expect(introFor(wedding, "budget")).toBe(`On the budget planner · ${wedding.name}`);
    expect(introFor(mela, "dashboard")).toContain("volunteers");
    expect(introFor(empty, "dashboard")).toBe(`Working on ${empty.name}.`);
  });
});
