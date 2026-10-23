# Plannr

AI event planner for weddings, birthdays and community events: describe the day, get a plan you can run.

## Run it

```sh
bun install
cp .env.example .env.local   # then paste your Gemini API key
bun run dev                  # http://localhost:5173
```

Without a key everything still works on the on-device logic; the assistant badge reads "On-device"
instead of "Gemini · live plan".

Production: `bun run build && bun run start` serves `dist/` and the AI routes on one port (`PORT`, default 3000).
Set `GEMINI_API_KEY` in the server's environment.

`just check` runs format, lint, types, tests and the production build.

## How AI is wired

The browser never sees the key. It posts to `/api/ai/*` on Plannr's own origin; `server/ai.ts` builds the
prompt, calls Gemini with a JSON response schema and sanitizes the answer (`server/prompts.ts`). The same
handler runs inside `vite`/`vite preview` (`server/vitePlugin.ts`) and the production server
(`server/serve.ts`), with a body-size cap and a per-IP rate limit.

| Route | Used by | What Gemini does |
| --- | --- | --- |
| `intake` | Describe-it chat | Reads free text into the event profile and writes the acknowledgement. The regex parser in `src/lib/intake.ts` runs first and instantly; Gemini only fills what it missed (`mergeAiProfile`). |
| `plan` | `/new/generating` | Adds "Plannr's notes": tips, watch-outs and ideas for this city, month and set of priorities. |
| `assistant` | Event dashboard | Answers questions from the live plan. Numbers come precomputed (`eventFacts`) so the model quotes, never calculates. Requests that change the plan still go through the on-device intents, which return a preview the planner approves. |

Every client call (`src/lib/ai.ts`) has a timeout and falls back to local behaviour, so AI being slow, down
or unconfigured never blocks the app.

Model: `gemini-flash-lite-latest` by default; override with `GEMINI_MODEL`.

## Screens

`/` landing · `/new` intake (chat or guided form) · `/new/generating` plan summary · `/signin`, `/signup`,
`/onboarding` · `/events` my events · `/events/:id` dashboard with tasks, budget, vendors, notices, funds,
volunteer shifts and the assistant.

Demo data is set on Sunday 27 Sep 2026 (`src/lib/dates.ts`) and persists in `localStorage`; "Reset demo data"
in the account menu restores it.
