import type { Household } from "../guestTypes";

/** How a sample household answered: how many said yes, "no", or null while it's waiting. */
export type SampleAnswer = number | "no" | null;

/** The household's answer for one function, as a plan stores it. */
export function answerFor(answer: SampleAnswer): Household["rsvp"][string] {
  if (answer === "no") return { status: "no", count: 0 };
  if (answer === null) return { status: "pending", count: 0 };
  return { status: "yes", count: answer };
}
