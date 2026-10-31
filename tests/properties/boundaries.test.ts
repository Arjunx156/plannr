/**
 * Everything that reads untrusted input (changes from browsers, answers from Gemini, cells for a
 * spreadsheet) gives a clean answer or a clean refusal for any input, and never throws.
 */
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { sanitizeAssistant } from "../../server/prompts/assistant";
import { sanitizeRead, sanitizeWrite } from "../../server/prompts/documents";
import { sanitizeIdeas } from "../../server/prompts/ideas";
import { sanitizeIntake } from "../../server/prompts/intake";
import { sanitizePlan } from "../../server/prompts/plan";
import { checkPlan, parseAction } from "../../server/validate";
import { toCsv } from "../../src/lib/csv";

/** Any JSON at all, and objects that look a little like what the code expects. */
const json = fc.oneof(
  fc.jsonValue(),
  fc.record({ type: fc.string(), taskId: fc.jsonValue(), eventId: fc.jsonValue() }),
  fc.dictionary(
    fc.constantFrom("ideas", "text", "summary", "items", "kind", "type", "budget"),
    fc.jsonValue(),
  ),
);

describe("changes from a browser", () => {
  test("are accepted or refused with a reason, whatever they hold", () => {
    fc.assert(
      fc.property(json, (raw) => {
        const out = parseAction(raw);
        if (!out.ok) expect(out.error.length).toBeGreaterThan(0);
      }),
    );
  });

  test("a whole plan that isn't one is refused, never half-accepted", () => {
    fc.assert(
      fc.property(json, (raw) => {
        expect(checkPlan(raw).ok).toBe(false);
      }),
    );
  });
});

/**
 * A cleaned answer, or a refusal: a plain Error the route answers with a 502. A TypeError or any other
 * crash would mean the cleanup trusted something it shouldn't have.
 */
function cleanOrRefused(clean: () => unknown, shape: (out: unknown) => boolean): void {
  let out: unknown;
  try {
    out = clean();
  } catch (e) {
    expect(e instanceof Error && e.constructor === Error && e.message.length > 0).toBe(true);
    return;
  }
  expect(shape(out)).toBe(true);
}

const isObject = (out: unknown) => typeof out === "object" && out !== null;
const hasText = (out: unknown) => isObject(out) && typeof Reflect.get(Object(out), "text") === "string";

describe("answers from Gemini", () => {
  test("each route's cleanup returns its own shape for any answer, or refuses it cleanly", () => {
    fc.assert(
      fc.property(json, (raw) => {
        cleanOrRefused(
          () => sanitizeIdeas(raw),
          (out) => isObject(out) && Array.isArray(Reflect.get(Object(out), "ideas")),
        );
        cleanOrRefused(() => sanitizeWrite(raw), hasText);
        cleanOrRefused(() => sanitizeAssistant(raw), hasText);
        cleanOrRefused(() => sanitizePlan(raw), isObject);
        cleanOrRefused(() => sanitizeRead(raw), isObject);
        cleanOrRefused(() => sanitizeIntake(raw, "2026-09-27"), isObject);
      }),
    );
  });
});

describe("spreadsheet exports", () => {
  test("no cell can start a formula, whatever a guest typed", () => {
    fc.assert(
      fc.property(fc.array(fc.array(fc.string(), { maxLength: 5 }), { maxLength: 5 }), (rows) => {
        for (const line of toCsv(rows).split("\n"))
          for (const cell of line.match(/"(?:[^"]|"")*"/g) ?? [])
            expect(cell.slice(1)).not.toMatch(/^[=+\-@\t\r]/);
      }),
    );
  });
});
