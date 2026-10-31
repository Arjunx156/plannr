/** The server's settings: read once at start-up, blank ones taken as unset, malformed ones named. */
import { describe, expect, test } from "bun:test";
import { EnvError, readEnv } from "../../server/env";

describe("the server's settings", () => {
  test("blank values count as unset, numbers are read as numbers, and unknown keys are dropped", () => {
    const env = readEnv({ GEMINI_API_KEY: " key ", RESEND_API_KEY: "", PORT: "8080", PATH: "/usr/bin" });
    expect(env).toEqual({ GEMINI_API_KEY: "key", PORT: 8080 });
  });

  test("a value that can't be used stops the server with a message naming each setting", () => {
    const read = () => readEnv({ BETTER_AUTH_URL: "plannr.in", PORT: "99999" });
    expect(read).toThrow(EnvError);
    expect(read).toThrow(/BETTER_AUTH_URL: .*\n\s+PORT: /);
  });
});
