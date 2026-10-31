# Testing

Plannr's tests are layered so that each kind of mistake is caught by the cheapest test that can see it. Pure
logic is tested as plain functions in milliseconds, the server through real HTTP on a real Postgres, and only
what needs a browser runs in one.

## The layers

| Layer | Where | What it proves | Runs with |
| --- | --- | --- | --- |
| Logic | `tests/*.test.ts` | The plan engine, records, money, dates, intake parsing, watch rules, templates, the ripple preview, history lines and every assistant proposal give the right answer for worked examples taken from the demo plans | `bun test` |
| Properties | `tests/properties/` | Laws that hold for any input fast-check can generate, not just the examples: replaying a history is deterministic and never changes the plan it starts from; a family split always adds up and settling up evens every side; moving any date and moving it back gives the same date; anything a browser or Gemini sends gets a clean answer or a clean refusal | `bun test` |
| Server | `tests/server/` | Every route through real HTTP on an in-memory Postgres (PGlite): sign-in, roles, history and undo, shared links and what each one may see, invites, comments, the AI allowance, reminders, backups. `fuzz.test.ts` sends hundreds of random bodies to every route that takes one and fails on any 500 | `bun test` |
| AI | `tests/ai/` | The Gemini routes with Gemini stubbed at `fetch`: request checks, the size cap and allowance, retries and the fallback model, streaming, and that each answer is cleaned against its schema before use. A snapshot pins the JSON schema each route sends Gemini, and checks it uses only keywords Gemini reads. The key never reaches a response | `bun test` |
| Contract | `tests/apiClient.test.ts` | The browser's API client against the real server in one process, so the two can't drift apart | `bun test` |
| Security | `tests/security.test.ts` | Every security header and content security policy directive, that no `'unsafe-'` source or wildcard creeps in, that the headers route comes first in production, and that an API failure never leaks its internals | `bun test` |
| Interface pieces | `tests/components.test.tsx`, `tests/storeProvider.test.tsx` | Shared components rendered to HTML: their words, roles and labels, and that values from data never become a `style` attribute. The store loads saved state, and starts fresh when it can't | `bun test` |
| Browser | `e2e/` | The journeys a family, a guest and a committee take, on a desktop and a Pixel 7, against the production build, with an axe scan for WCAG 2.2 A and AA on every main page | Playwright |
| AI quality | `scripts/ai-eval.ts` | Gemini against real cases in English, Malayalam, Hindi and Tamil, each scored on properties rather than exact text | `just eval`, by hand |

## What every test can rely on

- **A fixed day.** `tests/setup.ts` pins today to the demo story's day, and the browser tests pin the clock, so
  countdowns and due dates never depend on when the tests run.
- **No network.** Gemini is stubbed at `fetch` in unit tests (`stubFetch` in `tests/support.ts`) and mocked per
  test in the browser (`mockAi` in `e2e/fixtures.ts`). No test needs a key.
- **A real database.** Server tests run on PGlite, the same Postgres the app uses locally, migrated the same way.
  The server test files share one app (`testApp()` in `tests/server/fixtures.ts`), and each test signs in its
  own people and saves its own plans, so tests never see each other's data.
- **Clean consoles.** Every browser test fails on a page error or a console error. Content security policy
  violations are console errors, so a page that breaks the policy fails too.
- **Helpers in one place.** `tests/support.ts` holds the demo plans (`demo()`) and narrowing helpers;
  `tests/server/fixtures.ts` holds a `Client` with its own cookie jar; `e2e/fixtures.ts` holds sign-in,
  the AI mocks and the accessibility check.

## Running them

```sh
bun test                         # every unit, property, server and AI test (about two minutes)
bun test tests/properties        # just the properties
bun run coverage                 # the same with coverage; fails below the floor
bun x playwright test            # the browser journeys against a fresh production build
bun x playwright test --ui       # the same, watching each step
just eval                        # Gemini against the eval cases; needs GEMINI_API_KEY
```

## The floors CI holds

- **Coverage** of the code the unit tests load: at least 99% of lines and 95% of functions
  (`scripts/coverage-gate.ts`). Screens are covered by the browser journeys instead, so the floor is on the
  total rather than per file.
- **Accessibility**: no serious or critical axe finding on any main page, at either size.
- **Size**: the JavaScript a first visit loads stays inside its budget (`scripts/size-budget.ts`).

## Writing a new test

Name a test for the behaviour a person would notice ("a helper sees and ticks only their own tasks"), not the
function it calls. Prefer a worked example from the demo plans, and add a property when the rule is a law that
should hold for any input. A test file stays under 300 lines like any other; split it by area when it grows.
