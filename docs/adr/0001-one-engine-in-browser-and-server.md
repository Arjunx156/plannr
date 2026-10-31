# 1. One plan engine runs in the browser and on the server

**Status:** accepted, October 2026

## Context

A plan is edited on phones with patchy connections, by several people at once, and every change has to show up
in a history that can be undone. If the browser and the server each had their own idea of what "book this vendor"
does, the two would drift: the screen would show one plan and the server would store another.

## Decision

A plan only changes through a typed action, applied by one pure function, `applyEventAction` in
`src/shared/engine.ts`. The browser runs it so the screen updates at once. The server parses the same action
against a schema (`server/validate.ts`) and runs the same function to store it. History is the list of actions;
undo replays the history without one (`server/history.ts`).

`src/shared` may import only the data types and the pure helpers in `src/lib` (dates, format, metrics), never
React or browser code, so it can't grow a dependency the server can't load. `scripts/structure.ts` enforces that.

## Consequences

- Offline use comes almost free: actions queue on the device and send in order when the connection returns
  (`src/store/sync.ts`).
- Every change gets a one-line description from the action itself (`src/shared/describeAction.ts`), which the
  History tab and the Inbox show.
- Adding a feature means adding an action: a type, a reducer entry, a schema and a description. That is more
  ceremony than writing to the plan directly, and it is the price of the guarantees above.
- The engine must stay deterministic. Timestamps come in on the action (`stamp`), never from `Date.now()` inside
  the reducer, so a replay always rebuilds the same plan.
