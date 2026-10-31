# How Plannr is put together

Plannr is one TypeScript code base that runs in two places: a React app in the browser and a Hono API on a
Vercel function. Both run the same plan engine, so a change means the same thing on a phone, on the server
and in the history.

## One rule

A plan only changes through a typed action (`addRecord`, `bookVendor`, `rsvp` and 31 more), applied by
one pure function: `applyEventAction` in `src/shared/engine.ts`. The browser runs it so the screen updates at
once, and the server runs it again to store the change. Because every change is data:

- the history is the list of actions, and undo rebuilds the plan without one (`server/history.ts`);
- the app keeps working offline: actions queue up and send when the connection is back (`src/store/sync.ts`);
- the server checks each action against a schema before it touches the plan (`server/validation/`).

## A change, end to end

1. A screen dispatches an action, for example ticking a task: `{ type: "toggleTask", eventId, taskId }`.
2. The store's reducer (`src/store/reducer.ts`) hands plan actions to the engine, and the screen updates.
3. With an account, `src/store/sync.ts` sends the actions in order, up to 50 at a time, to
   `POST /api/events/:id/actions`.
4. The server parses each one against its schema (`server/validate.ts`), checks the person's role, and applies
   them with the same engine under an optimistic lock (`commit` in `server/plans.ts`). If someone else wrote in
   between, it reads the plan again and applies the actions on top of their change.
5. Each change is stored with a one-line description (`src/shared/describeAction.ts`), which the History tab
   and the Inbox show.
6. Co-planners with the plan open pick up the new version within eight seconds, or as soon as they come back
   to the tab (`src/store/account.tsx`).

Shared links (RSVP, helper, vendor, volunteer, gate and the rest) take the same path with a shorter list of
allowed actions (`server/linkActions.ts`), and each link sees only its own slice of the plan
(`src/shared/publicViews.ts`).

## Where things live

| Folder | What it holds | What it imports |
| --- | --- | --- |
| `src/data` | Types for every record, and the demo events | `lib/dates`, so the demo's dates move with today, and `shared/guards` to walk the demo when it does |
| `src/shared` | Pure planning logic the server runs too: the engine, records, derived numbers, watch rules, the ripple preview, shared-link views, templates | `data` and the pure helpers in `lib` (dates, format, metrics) |
| `src/lib` | Pure helpers (dates, money, CSV, calendar files, intake parsing, the draft plan) and browser services (API and AI clients, voice, device, weather) | `data`, `shared` |
| `src/store` | App state: the reducer, the account and sync | `data`, `lib`, `shared` |
| `src/components` | The shell and the pieces screens share: overlays, fields, the assistant, the scanner, task rows | the folders above |
| `src/pages` | One file per route. `tabs/` holds one file per event tab, with a folder for each larger tab; `public/` holds the shared-link pages | the folders above |
| `server` | The Hono app (`app.ts`), routes grouped by who calls them (`routes/`), each AI prompt with its schema and sanitizer (`prompts/`), action schemas (`validation/`), sign-in, plans, history, links, backups | `src/shared`, `src/data`, `src/lib/dates` |

`scripts/structure.ts` holds these layers as rules and fails the build when an import crosses one the wrong way:

- `data`, `lib` and `shared` never import `store`, `components` or `pages`;
- `store` never imports `components` or `pages`, and `components` never imports `pages`;
- `shared` uses only the pure helpers in `lib` (dates, format, metrics) and never React, because the server runs it;
- the server never loads React, the router, `store`, `components`, `pages` or any of `lib` but dates.

## Rules the build enforces

- **Lint** (`biome.json`): Biome's recommended rules, plus at most 15 cognitive complexity and 60 lines per
  function, no nested ternaries, no non-null assertions, no floating promises, sorted Tailwind classes, one
  naming convention, interfaces for object types, readonly class fields where they can be, no unused imports,
  variables or parameters, and no stray console output.
- **Types** (`tsconfig.base.json`, shared by the app, server, scripts and tests): `strict`, plus
  `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`,
  `noImplicitReturns`, `noImplicitOverride` and `verbatimModuleSyntax`. The app also turns on
  `isolatedDeclarations`, so every export states its type.
- **Structure** (`scripts/structure.ts`), over `src`, `server`, `scripts`, `tests` and `e2e`, prints one line
  per check:
  1. no file over 300 lines, tests included (demo seed data is exempt);
  2. no import cycles;
  3. no import that crosses a layer the wrong way (above);
  4. a doc comment on every export;
  5. no type assertion outside the nine on its allowlist, each with its reason in a comment above it;
  6. no inline `style` prop, so the content security policy needs no `'unsafe-inline'`.
- **Duplication** (jscpd, `.jscpd.json`): no block of 5 lines and 50 tokens or more appears twice. Shared pieces
  live in one place instead: `bindText` for form fields, `CardPage` for single-card pages, `FunctionFacts` for
  a function's day and place on the shared-link pages.
- **Tests**: unit coverage of at least 94% of lines and 91% of functions (`scripts/coverage-gate.ts`), and a
  budget on the JavaScript a first visit loads (`scripts/size-budget.ts`).

`just check` runs lint, types, structure, duplication, tests and the build. CI adds the dependency audit, coverage,
pre-rendering, the browser journeys, a secret scan of the whole history, and dependency review on pull requests.

## Habits

- **File names.** A PascalCase file exports one component of the same name (`RsvpPage.tsx`). A camelCase file
  is a module with several exports (`householdFields.tsx`, `dates.ts`).
- **Screens.** State and effects sit in a named hook at the top of the file (`useConversation`, `useSignIn`,
  `useJoin`), and the markup is split into small components below it.
- **Logic outside components.** Anything that can be tested without a browser is a plain function:
  `patchFor`, `groupsFor`, `nextDate`, `stallRequest`, `toTemplate`.
- **Records.** Lists are read with `list(ev, coll)` and changed with `addRecord`, `updateRecord` and
  `removeRecord`, so a new kind of record gets history, undo, validation and sync with no extra code.
- **Styles from data.** A value that comes from data, like a bar's width or a family's colour, is set as a CSS
  variable by the `cssVars` ref (`src/components/cssVars.ts`) and read by a class in `src/index.css`. A fixed
  set of values maps to classes instead (`SWATCH_BG`). Either way there is no `style` attribute for the policy
  to allow.
- **Comments** say why, or what a name can't: the reason a date moves by 364 days, or why signing out of a
  guest account asks first.

## Tests

- `tests/` (bun test): the engine, records, derived numbers, watch rules, templates, intake parsing,
  validation of every action, the AI routes over HTTP with Gemini stubbed, the server's routes on a real
  in-memory Postgres (`tests/server/`), every security header, and a contract test that runs the browser's API
  client against the real server in one process.
- `tests/properties/` (fast-check): laws that must hold for any input, such as replaying a history being
  deterministic, settling up evening out every side, and every boundary refusing bad input cleanly.
- `e2e/` (Playwright with axe): the journeys a family, a guest and a committee take, on desktop and phone,
  with an accessibility scan of every main page.
- `just eval`: Gemini against real cases in four languages. It needs a key, so it runs by hand.

[docs/TESTING.md](docs/TESTING.md) says what each layer proves and how to run it.

## Decisions

The reasons behind the shape of the code are written down in [docs/adr/](docs/adr/):

1. [One plan engine runs in the browser and on the server](docs/adr/0001-one-engine-in-browser-and-server.md)
2. [Gemini sits behind server routes, one schema per prompt](docs/adr/0002-ai-behind-server-routes.md)
3. [Plan writes use optimistic locking](docs/adr/0003-optimistic-locking.md)
4. [PGlite in development and tests, Neon in production](docs/adr/0004-pglite-locally-neon-in-production.md)
5. [A strict content security policy, with Trusted Types](docs/adr/0005-strict-csp-and-trusted-types.md)
6. [Public pages are pre-rendered](docs/adr/0006-prerendered-public-pages.md)
