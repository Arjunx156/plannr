import { describe, expect, test } from "bun:test";
import { emptyProfile, MAX_PRIORITIES, parseDescription, togglePick } from "../src/lib/intake";
import {
  acknowledge,
  askedAfter,
  DONE,
  greetingFor,
  leadFor,
  opener,
  pendingField,
  questionAfter,
  readAnswer,
  turnId,
} from "../src/pages/intake/conversation";
import type { Draft } from "../src/store/store";

describe("the intake conversation", () => {
  test("opens with what it understood, for each kind of event", () => {
    expect(opener(emptyProfile())).toContain("one step at a time");
    const wedding = { ...emptyProfile(), kind: "wedding" as const, names: "Meera & Arjun" };
    expect(opener(wedding)).toContain("Congratulations to Meera and Arjun");
    expect(opener({ ...emptyProfile(), kind: "birthday", style: "Space theme" })).toContain("space party");
    expect(opener({ ...emptyProfile(), kind: "community" })).toContain("mela");
  });

  test("acknowledges new needs in plain words", () => {
    const before = emptyProfile();
    const after = parseDescription(
      "Grandma uses a wheelchair, vegetarian food, two kids have nut allergies",
      before,
    );
    const said = acknowledge(before, after);
    expect(said).toContain("step-free access");
    expect(said).toContain("vegetarian menu");
    expect(said).toContain("allergy notes");
    expect(acknowledge(before, before)).toBe("Noted.");
  });

  test("short answers fill the field that was asked", () => {
    const p = emptyProfile();
    expect(readAnswer("Thrissur", p, "city").city).toBe("Thrissur");
    expect(readAnswer("about 180", p, "guests").guests).toBe(180);
    // A bare number to the budget question means lakhs.
    expect(readAnswer("18", p, "budget").budget).toBe(1_800_000);
    expect(readAnswer("250000", p, "budget").budget).toBe(250_000);
    expect(readAnswer("not sure", p, "kind").kind).toBe("other");
    expect(readAnswer("see pinterest.com/board/1", p, undefined).inspiration).toEqual([
      "pinterest.com/board/1",
    ]);
  });

  test("asks about venues in the light of what was just said", () => {
    const p = { ...parseDescription("Kerala wedding in Kochi, 250 guests, ₹18 lakh, April", emptyProfile()) };
    const shortlisted = questionAfter(
      { ...p, venueStatus: "Shortlisted" },
      ["kind", "city", "date", "guests", "budget", "venue"],
      "venue",
    );
    if (shortlisted?.field === "extras") expect(shortlisted.prompt).toContain("choosing between");
  });

  test("knows which question is waiting for an answer, and gives every turn its own id", () => {
    const draft: Draft = {
      profile: emptyProfile(),
      asked: [],
      guidedStep: 0,
      generated: false,
      chat: [
        {
          id: "a",
          role: "ai",
          text: "Where?",
          question: { field: "city", prompt: "Where?" },
        },
      ],
    };
    expect(pendingField(draft)).toBe("city");
    expect(turnId()).not.toBe(turnId());
  });
});

describe("how the chat opens and replies", () => {
  test("the greeting fits what's already known", () => {
    expect(greetingFor(undefined, undefined)).toStartWith("Describe the event");
    expect(greetingFor("wedding", undefined)).toStartWith("Tell me about the wedding");
    expect(greetingFor("other", "Amma's 60th")).toStartWith("Let's plan Amma's 60th");
  });

  test("venue, extras and priorities are asked once; other questions until answered", () => {
    expect(askedAfter([], "venue")).toEqual(["venue"]);
    expect(askedAfter(["venue"], "venue")).toEqual(["venue"]);
    expect(askedAfter([], "city")).toEqual([]);
    expect(askedAfter(["extras"], undefined)).toEqual(["extras"]);
  });

  const p = parseDescription("Kerala wedding in Kochi, 250 guests, 18 lakh, December", emptyProfile());
  const turn = { field: undefined, isFirst: true, aiReply: undefined, prev: emptyProfile(), next: p };

  test("the first reply sums up what was understood, or uses Gemini's words when there are some", () => {
    const question = questionAfter(p, []);
    expect(leadFor({ ...turn, question })).toBe(opener(p));
    expect(leadFor({ ...turn, aiReply: "Lovely, a Kochi wedding!", question })).toBe(
      "Lovely, a Kochi wedding!",
    );
  });

  test("an unreadable date gets a nudge, and the last question is introduced", () => {
    const noDate = { ...p, date: undefined };
    const question = questionAfter(noDate, []);
    expect(leadFor({ ...turn, isFirst: false, field: "date", next: noDate, question })).toContain(
      "couldn't place that date",
    );
    const last = { field: "priorities" as const, prompt: "What matters most?" };
    expect(leadFor({ ...turn, aiReply: "Noted.", question: last })).toBe("Noted. Last one:");
  });

  test("with nothing left to ask, the reply says the plan can be drafted", () => {
    expect(leadFor({ ...turn, isFirst: false, question: null })).toBe(DONE);
    expect(leadFor({ ...turn, aiReply: "Got it.", question: null })).toBe(`Got it. ${DONE}`);
  });
});

describe("short answers to a question", () => {
  const base = emptyProfile();

  test.each([
    ["city", "thrissur", { city: "Thrissur" }],
    ["guests", "about 250", { guests: 250 }],
    ["guests", "2,000", { guests: 2000 }],
    ["budget", "18", { budget: 1800000 }],
    ["budget", "450000", { budget: 450000 }],
  ] as const)("%s: %p", (field, text, expected) => {
    expect(readAnswer(text, base, field)).toMatchObject(expected);
  });

  test("an answer the parser already understood isn't second-guessed", () => {
    expect(readAnswer("18 lakh", base, "budget").budget).toBe(1800000);
    expect(readAnswer("250 guests", base, "guests").guests).toBe(250);
  });

  test("a kind that can't be read becomes 'other', and a long sentence isn't a city", () => {
    expect(readAnswer("a get-together", base, "kind").kind).toBe("other");
    expect(readAnswer("x".repeat(50), base, "city").city).toBeUndefined();
  });

  test("a link anywhere in an answer is kept as inspiration, once", () => {
    const once = readAnswer("like pinterest.com/ananya/wedding", base, undefined);
    expect(once.inspiration).toEqual(["pinterest.com/ananya/wedding"]);
    expect(readAnswer("pinterest.com/ananya/wedding", once, undefined).inspiration).toHaveLength(1);
  });
});

describe("priorities and cuts", () => {
  test("toggle on and off; a fourth priority is refused but cuts have no limit", () => {
    const three = ["Food", "Photos", "Décor"];
    expect(three).toHaveLength(MAX_PRIORITIES);
    expect(togglePick(three, "Music", "priorities")).toEqual(three);
    expect(togglePick(three, "Food", "priorities")).toEqual(["Photos", "Décor"]);
    expect(togglePick(three, "Favours", "cuts")).toEqual([...three, "Favours"]);
  });
});
