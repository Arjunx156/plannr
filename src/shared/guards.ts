/** Small checks that turn untyped values into typed ones without asserting. */

/** What to tell a person when something failed: the error's own message, or a calm fallback. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Try again."): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** The value if it's one of the allowed strings, else undefined: for `<select>` values, query params and JSON. */
export function oneOf<T extends string>(v: unknown, list: readonly T[]): T | undefined {
  return list.find((x) => x === v);
}

/** A table's keys, typed as its keys. */
export function keysOf<K extends string>(table: { readonly [P in K]: unknown }): K[] {
  // Object.keys widens to string[]; the tables passed here are literals typed by their keys.
  return Object.keys(table) as K[];
}

/** Rewrites every string inside a JSON-like value and keeps its shape: how dates move through a whole plan. */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  // The walk rebuilds exactly the shape it was given; TypeScript can't follow that through unknown.
  return walkStrings(value, fn) as T;
}

function walkStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => walkStrings(v, fn));
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walkStrings(v, fn)]));
  return value;
}

/** A plain object, so its fields can be read and checked one by one. */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The items of an array, unchecked; anything else reads as no items. */
export function listOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** The fields of an object that pass a check, e.g. a cached `{ date: chance }` map; anything else reads as empty. */
export function fieldsOf<T>(v: unknown, is: (x: unknown) => x is T): Record<string, T> {
  if (!isRecord(v)) return {};
  return Object.fromEntries(Object.entries(v).filter((entry): entry is [string, T] => is(entry[1])));
}

/** Whether a value is a number, as a type guard. */
export function isNumber(x: unknown): x is number {
  return typeof x === "number";
}

/** Whether a value is a string, as a type guard. */
export function isString(x: unknown): x is string {
  return typeof x === "string";
}
