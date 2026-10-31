/** The small checks that read untrusted values (saved state, cached answers, request fields) and the results they give. */
import { describe, expect, test } from "bun:test";
import { fieldsOf, isNumber, isString, listOf } from "../src/shared/guards";
import { assertNever, err, ok } from "../src/shared/result";

describe("reading values that may be anything", () => {
  test("a list reads as its items, and anything else as none", () => {
    expect(listOf([1, "a"])).toEqual([1, "a"]);
    expect(listOf({ length: 2 })).toEqual([]);
    expect(listOf(undefined)).toEqual([]);
  });

  test("an object keeps only the fields that pass the check", () => {
    expect(fieldsOf({ "2027-05-30": 80, "2027-05-31": "high", bad: null }, isNumber)).toEqual({
      "2027-05-30": 80,
    });
    expect(fieldsOf({ a: "x", b: 2 }, isString)).toEqual({ a: "x" });
    expect(fieldsOf(["x"], isString)).toEqual({});
    expect(fieldsOf(null, isNumber)).toEqual({});
  });
});

describe("results", () => {
  test("carry a value or a reason, and an unhandled case fails loudly", () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
    expect(err("offline")).toEqual({ ok: false, error: "offline" });
    // A case the types say can't happen, as it would arrive from old saved data.
    expect(() => Reflect.apply(assertNever, undefined, ["surprise"])).toThrow('Unhandled case: "surprise"');
  });
});
