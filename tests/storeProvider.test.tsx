/**
 * The store as the app first sees it: what it loads from this device, and the rule that it can only be
 * read inside its provider. Rendered to HTML, so effects (saving, syncing) don't run.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SEED_REVISION } from "../src/data/demoMeta";
import { initialState } from "../src/store/reducer";
import { StoreProvider, useStore } from "../src/store/store";
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

const loaded = () =>
  renderToStaticMarkup(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  ).replace(/<\/?output>/g, "");

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
