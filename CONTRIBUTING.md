# Contributing to Plannr

Thank you for helping families plan their days with less worry. This page gets you from a fresh clone to a
change that passes CI.

## Set up in three commands

```sh
bun install
bun run dev      # the app and the API on http://localhost:5173, with an in-memory database
just check       # everything CI checks, in the same order
```

You need [Bun](https://bun.sh) 1.4.2 or later and [just](https://just.systems). Gemini is optional: without
`GEMINI_API_KEY` every AI feature falls back to its on-device answer. `.env.example` lists every setting.

## How the code is organised

[ARCHITECTURE.md](ARCHITECTURE.md) explains the one rule (a plan changes only through a typed action), where
each folder sits in the layers, and how a change travels from a tap to the database. The decisions behind it
are in [docs/adr/](docs/adr/).

## Making a change

- **A new kind of plan change** is a typed action: add its type in `src/shared/`, its reducer entry, its
  zod schema in `server/validation/`, and its one-line description. The engine runs in the browser and on the
  server, so it must stay pure.
- **Anything that calls Gemini** goes through a route in `server/prompts/`, with a request check, a response
  schema and a sanitizer. Run `just eval` with a key to score the prompts before and after.
- **Screens** use the classes in `src/index.css` and Tailwind. No `style` props: values that come from data
  are set as CSS variables with `cssVars` (`src/components/cssVars.ts`), so the CSP needs no `'unsafe-inline'`.
- **Tests** sit beside the area they cover in `tests/` (unit, with Bun) and `e2e/` (browser journeys, with
  Playwright). [docs/TESTING.md](docs/TESTING.md) says what each layer proves.

## What CI holds you to

`just check` runs Biome, TypeScript at its strictest, the structure checks, the duplication check, the unit
tests and the build. The structure checks (`scripts/structure.ts`) fail the build on:

1. a file over 300 lines, tests included;
2. an import cycle;
3. an import that crosses the layers the wrong way;
4. an export without a doc comment;
5. a type assertion outside the eight files on its allowlist, or without its reason in a comment above it;
6. an inline `style` prop.

CI adds the dependency audit, coverage, pre-rendering, the browser journeys with accessibility checks,
Lighthouse on the public pages, a secret scan of the whole history and CodeQL.

## Style

Match the code around you. Name things for what they are, keep functions small, and write comments that say
why. Commit messages are short and plain: what changed, in the present tense.
