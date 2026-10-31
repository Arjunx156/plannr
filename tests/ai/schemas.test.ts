/** What Gemini is asked to return: each route's JSON schema, pinned so a refactor can't change it unnoticed. */
import { describe, expect, test } from "bun:test";
import { assistantSchema } from "../../server/prompts/assistant";
import { readSchema, writeSchema } from "../../server/prompts/documents";
import { ideasSchema } from "../../server/prompts/ideas";
import { intakeSchema } from "../../server/prompts/intake";
import { isObject } from "../../server/prompts/kit";
import { planSchema } from "../../server/prompts/plan";

const SCHEMAS: [string, unknown][] = [
  ["intake", intakeSchema],
  ["assistant", assistantSchema],
  ["plan", planSchema],
  ["ideas", ideasSchema],
  ["write", writeSchema],
  ["read", readSchema],
];

/** The keywords Plannr's schemas use; Gemini reads a subset of JSON Schema, and these are all in it. */
const KEYWORDS = new Set(["type", "properties", "required", "items", "enum", "description"]);

/**
 * The schema as Gemini reads it. Property order is kept, since it sets the order of the answer; other keys and
 * the `required` lists are sorted, since their order means nothing.
 */
function canonical(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(canonical);
  if (!isObject(node)) return node;
  return Object.fromEntries(
    Object.keys(node)
      .sort()
      .map((key) => {
        const value = node[key];
        if (key === "required" && Array.isArray(value)) return [key, value.toSorted()];
        if (key === "properties" && isObject(value))
          return [key, Object.fromEntries(Object.entries(value).map(([name, p]) => [name, canonical(p)]))];
        return [key, canonical(value)];
      }),
  );
}

/** Every keyword used anywhere in a schema, property names aside. */
function keywords(node: unknown, found = new Set<string>()): Set<string> {
  if (!isObject(node)) return found;
  for (const [key, value] of Object.entries(node)) {
    found.add(key);
    if (key === "properties" && isObject(value)) for (const p of Object.values(value)) keywords(p, found);
    else if (key === "items") keywords(value, found);
  }
  return found;
}

describe("Gemini's schemas", () => {
  test.each(SCHEMAS)("%s asks for the same answer as before", (_, schema) => {
    expect(JSON.stringify(canonical(schema), null, 2)).toMatchSnapshot();
  });

  test.each(SCHEMAS)("%s uses only keywords Gemini understands", (_, schema) => {
    expect([...keywords(schema)].filter((k) => !KEYWORDS.has(k))).toEqual([]);
  });
});
