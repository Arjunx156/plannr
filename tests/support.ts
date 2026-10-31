import { z } from "zod";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../src/data/types";

/** The value, or a thrown error saying what was missing: narrows without a cast. */
export function present<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) throw new Error(`Expected a ${what}`);
  return value;
}

/** The event as a personal plan; throws when it's missing or laid out another way. */
export function personal(ev: PlannrEvent | undefined): PersonalEvent {
  if (ev?.layout !== "personal") throw new Error(`Expected a personal event, got ${ev?.layout}`);
  return ev;
}

/** The event as a community plan; throws when it's missing or laid out another way. */
export function community(ev: PlannrEvent | undefined): CommunityEvent {
  if (ev?.layout !== "community") throw new Error(`Expected a community event, got ${ev?.layout}`);
  return ev;
}

/** The demo, fresh on every call: a wedding, a birthday, a mela and an anniversary with no plan yet. */
export function demo(): {
  events: PlannrEvent[];
  wedding: PersonalEvent;
  birthday: PersonalEvent;
  mela: CommunityEvent;
  empty: PlannrEvent;
} {
  const events = seedEvents();
  const byId = (id: string) => events.find((e) => e.id === id);
  return {
    events,
    wedding: personal(byId("ananya-rohan")),
    birthday: personal(byId("aarav-6")),
    mela: community(byId("green-valley-mela")),
    empty: present(
      events.find((e) => e.layout === "empty"),
      "demo event with no plan",
    ),
  };
}

/** The demo wedding with one open notice, as the overview would have raised it. */
export function noticedWedding(): PersonalEvent {
  return {
    ...demo().wedding,
    notices: [
      {
        id: "guests-grew",
        tone: "warn",
        label: "18 more guests",
        text: "Catering needs 18 more plates",
        status: "open",
      },
    ],
  };
}

/** A response body, checked against the shape the test expects. */
export async function bodyOf<S extends z.ZodType>(res: Response, shape: S): Promise<z.infer<S>> {
  return shape.parse(await res.json());
}

/** A response's `error` message, checked to be there. */
export async function errorOf(res: Response): Promise<string> {
  return (await bodyOf(res, z.object({ error: z.string() }))).error;
}

/** What a stand-in for fetch receives. */
export type FetchHandler = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Swaps in a stand-in for fetch, and returns the function that puts the real one back. */
export function stubFetch(handler: FetchHandler): () => void {
  const real = globalThis.fetch;
  globalThis.fetch = Object.assign(handler, { preconnect: real.preconnect });
  return () => {
    globalThis.fetch = real;
  };
}
