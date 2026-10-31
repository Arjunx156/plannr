# 2. Gemini sits behind server routes, one schema per prompt

**Status:** accepted, October 2026

## Context

Plannr uses Gemini to read a family's description in any of four languages, tailor a plan, suggest ideas, write
invitations and read bills. A key in the browser would be stolen within a day, a free-tier quota is easy to
drain, and a model's answer is prose that may not match what the app expects.

## Decision

The browser never calls Gemini. It calls `/api/ai/:route`, and the server holds the key (`server/ai.ts`).

- Each prompt lives in its own module in `server/prompts/`, with two zod schemas: one for the request, and one
  for the answer. The answer's schema is written once and does both jobs: Gemini is sent the JSON schema generated
  from it (`responseJsonSchema`), and the answer is parsed by it before the app sees it. Each field runs a small
  cleaning step from `kit.ts` first, so unknown kinds, out-of-range amounts and impossible dates are dropped there,
  not in the UI, and a row missing a field it needs is dropped rather than the whole answer. A snapshot test
  (`tests/ai/schemas.test.ts`) pins what Gemini is asked for, so a refactor can't change it unnoticed.
- Requests are capped in size, limited in bursts, and drawn from a daily allowance per person
  (`DAILY_AI` in `server/routes/ai.ts`), stored in the database so every server instance shares it.
- Each route has its own time budget (`BUDGET_MS`), and the browser waits a little longer
  (`AI_TIMEOUT_MS` in `src/lib/ai.ts`), so the server's timeout answers first with a message a person can read.
- What the family wrote is passed as data, never as instructions, and each prompt says so.

## Consequences

- The app works with AI off. The plan draft is built on the device from Plannr's own rules (`src/lib/plan.ts`),
  and Gemini only tailors it. The intake, the ideas and the assistant each have an on-device answer to fall back
  on (`parseDescription`, `deviceIdeas`, `reply`).
- A failed call says why: the client returns `Result<T, AiFailure>` (`off`, `offline`, `timeout`, `busy` or
  `failed`), and each reason has its own words on screen.
- `just eval` scores the prompts against real cases in four languages, so a prompt change is measured, not
  guessed.
