/**
 * Every route that takes a body, sent whatever fast-check can think of: JSON of any shape, near-miss
 * plan changes, and text that isn't JSON at all. The server may say yes or refuse with a reason, but it
 * must never fail with a 500. It runs on an app of its own, so its floods don't use up the rate limits
 * the other server tests share.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import fc from "fast-check";
import { createApp } from "../../server/app";
import { createLocalDb } from "../../server/db/local";
import { ACTIONS } from "../../server/validation/actions";
import { Client, ORIGIN, wedding } from "./fixtures";

const app = createApp({ db: await createLocalDb(), env: {} });

/** Bodies a careless or hostile browser could send. */
const payload: fc.Arbitrary<string> = fc.oneof(
  fc.jsonValue().map((v) => JSON.stringify(v)),
  fc
    .array(
      fc.record({
        type: fc.constantFrom(...Object.keys(ACTIONS)),
        eventId: fc.jsonValue(),
        taskId: fc.jsonValue(),
        patch: fc.jsonValue(),
      }),
      { maxLength: 4 },
    )
    .map((actions) => JSON.stringify({ actions })),
  fc
    .dictionary(fc.constantFrom("event", "kind", "target", "text", "role", "address", "rsvp"), fc.jsonValue())
    .map((v) => JSON.stringify(v)),
  fc.string(),
);

let owner: Client;
let eventId = "";
let token = "";

beforeAll(async () => {
  owner = new Client(app);
  await owner.guest();
  const ev = wedding();
  eventId = ev.id;
  await owner.call("/api/events", { body: { event: ev } });
  const household = ev.households?.[0];
  if (!household) throw new Error("seed has households");
  const link = await owner.call(`/api/events/${ev.id}/links`, {
    body: { kind: "rsvp", target: household.id },
  });
  token = String(link.json.token);
});

/** Sends a raw body as the signed-in owner, or as a stranger, and returns the status and the body. */
async function send(method: string, path: string, body: string, signedIn: boolean) {
  const headers: Record<string, string> = { origin: ORIGIN, "content-type": "application/json" };
  if (signedIn) headers["cookie"] = [...owner.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await app.request(path, { method, headers, body });
  return { status: res.status, text: await res.text() };
}

/** A refusal is a 4xx with a reason a person can read. */
function expectNoCrash(reply: { status: number; text: string }): void {
  expect(reply.status).toBeLessThan(500);
  if (reply.status >= 400) expect(String(JSON.parse(reply.text).error).length).toBeGreaterThan(0);
}

describe("any body, on any route that takes one", () => {
  test(
    "a planner's routes refuse what they can't use, never with a 500",
    async () => {
      const routes = [
        ["POST", () => "/api/events"],
        ["POST", () => `/api/events/${eventId}/actions`],
        ["POST", () => `/api/events/${eventId}/links`],
        ["POST", () => `/api/events/${eventId}/invites`],
        ["POST", () => `/api/events/${eventId}/comments`],
        ["PUT", () => `/api/events/${eventId}/site-address`],
        ["PATCH", () => `/api/events/${eventId}/members/someone`],
      ] as const;
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...routes), payload, async ([method, path], body) => {
          expectNoCrash(await send(method, path(), body, true));
        }),
        { numRuns: 150 },
      );
    },
    { timeout: 60_000 },
  );

  test(
    "public routes refuse what they can't use, never with a 500",
    async () => {
      const routes = [
        () => `/api/p/${token}/actions`,
        () => "/api/p/not-a-token/actions",
        () => "/api/errors",
      ];
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...routes), payload, async (path, body) => {
          expectNoCrash(await send("POST", path(), body, false));
        }),
        { numRuns: 100 },
      );
    },
    { timeout: 60_000 },
  );
});
