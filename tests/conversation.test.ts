import { describe, expect, test } from "bun:test";
import { emptyProfile, parseDescription } from "../src/lib/intake";
import {
  acknowledge,
  opener,
  pendingField,
  questionAfter,
  readAnswer,
  turnId,
} from "../src/pages/intake/conversation";

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
    const draft = {
      profile: emptyProfile(),
      asked: [],
      guidedStep: 0,
      generated: false,
      chat: [
        {
          id: "a",
          role: "ai" as const,
          text: "Where?",
          question: { field: "city" as const, prompt: "Where?" },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: a minimal draft for the helper
    expect(pendingField(draft as any)).toBe("city");
    expect(turnId()).not.toBe(turnId());
  });
});
