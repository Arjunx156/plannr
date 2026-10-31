/**
 * The store as the app first sees it: what it loads from this device, where each action goes, what it keeps
 * on the device, and the rule that it can only be read inside its provider. Rendered to HTML, so effects
 * (saving, syncing) don't run; what they do is tested through the pure functions they call.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SEED_REVISION } from "../src/data/demoMeta";
import type { EventAction } from "../src/shared/engine";
import type { Role } from "../src/shared/types";
import { initialState } from "../src/store/reducer";
import { route, StoreProvider, saved, toast, useEventById, useStore } from "../src/store/store";
import type { AppState } from "../src/store/types";
import { demo } from "./support";

/** Shows the parts of the loaded state these tests check. */
function Probe() {
  const { state } = useStore();
  return (
    <output>
      {[state.mode, state.account.status, state.sync.pending, state.events.map((e) => e.id).join("+")].join(
        "|",
      )}
    </output>
  );
}

/** The id of the event a screen finds for `id`, or "none". */
function FoundEvent({ id }: { id: string }) {
  return <output>{useEventById(id)?.id ?? "none"}</output>;
}

const loaded = (probe = <Probe />) =>
  renderToStaticMarkup(<StoreProvider>{probe}</StoreProvider>).replace(/<\/?output>/g, "");

/** A device's storage holding one saved value, or a store that refuses to be read. */
function storage(saved: string | null | Error) {
  Reflect.set(globalThis, "localStorage", {
    getItem: () => {
      if (saved instanceof Error) throw saved;
      return saved;
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("the store on a fresh load", () => {
  test("starts in the demo with nothing loaded when the device has nothing saved", () => {
    storage(null);
    expect(loaded()).toBe("demo|unknown|0|");
  });

  test("brings back the planner's saved events, with the sync queue empty and the session to be checked", () => {
    const { wedding } = demo();
    const saved = {
      ...initialState(),
      seed: SEED_REVISION,
      mode: "account",
      account: { status: "signedIn" },
      sync: { pending: 3, offline: true },
      events: [wedding],
    };
    storage(JSON.stringify(saved));
    expect(loaded()).toBe(`account|unknown|0|${wedding.id}`);
    expect(loaded(<FoundEvent id={wedding.id} />)).toBe(wedding.id);
    expect(loaded(<FoundEvent id="gone" />)).toBe("none");
  });

  test("starts fresh when what's saved is unreadable or the storage is blocked", () => {
    storage("{not json");
    expect(loaded()).toBe("demo|unknown|0|");
    storage(new Error("SecurityError: storage is disabled"));
    expect(loaded()).toBe("demo|unknown|0|");
    storage(JSON.stringify({ version: 99, events: "nope" }));
    expect(loaded()).toBe("demo|unknown|0|");
  });
});

describe("reading the store", () => {
  test("outside its provider is a mistake the app hears about at once", () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow("useStore must be used inside StoreProvider");
  });
});

describe("where an action goes", () => {
  const { wedding } = demo();
  const toggle: EventAction = { type: "toggleTask", eventId: wedding.id, taskId: "t1" };
  const chat: EventAction = {
    type: "pushMessage",
    eventId: wedding.id,
    message: { id: "m1", role: "user", text: "What's left to book?" },
  };
  const signedIn = (role: Role): AppState => ({
    ...initialState(),
    mode: "account",
    remote: { [wedding.id]: { version: 1, role, side: null } },
  });

  test("a change to a saved plan applies here and is sent to the server, for anyone who may edit", () => {
    const { apply, send } = route(signedIn("planner"), toggle);
    expect(apply).toMatchObject(toggle);
    expect(send).toMatchObject(toggle);
  });

  test("a viewer's change is refused with a note; their talk with the assistant stays on their screen", () => {
    const refused = route(signedIn("viewer"), toggle);
    expect(refused.send).toBeUndefined();
    expect(refused.apply).toMatchObject({
      type: "toast",
      toast: { text: expect.stringContaining("view this plan") },
    });
    const talk = route(signedIn("viewer"), chat);
    expect(talk.apply).toMatchObject(chat);
    expect(talk.send).toBeUndefined();
  });

  test("in the demo, and for anything that isn't a plan change, nothing goes to the server", () => {
    expect(route(initialState(), toggle).send).toBeUndefined();
    const note = toast("Saved");
    expect(route(signedIn("owner"), note)).toEqual({ apply: note });
  });
});

describe("what's kept on this device", () => {
  test("everything but the toasts, the activity feed and this tab's sync status", () => {
    const state: AppState = {
      ...initialState(),
      toasts: [{ id: "t1", text: "Saved", undo: undefined }],
      sync: { pending: 2, offline: true },
    };
    const kept: unknown = JSON.parse(saved(state));
    expect(kept).toMatchObject({ mode: state.mode, toasts: [], activity: [] });
    expect(kept).not.toHaveProperty("sync");
  });
});
