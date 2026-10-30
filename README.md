# Plannr

A GenAI planning assistant for weddings, birthdays and community events. Describe the day in one sentence,
in English, Malayalam, Hindi or Tamil, and Plannr drafts the budget, timeline, vendor checklist and ideas for
that event, then helps the family and volunteers run it.

Live: https://plannr-sepia.vercel.app (choose "Explore the demo" to skip sign-in)

Demo: a captioned walkthrough of every feature and 51 screenshots are in [`demo/`](demo/README.md).

## The brief, and where each part lives

> Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community
> events with budgets, timelines, vendor checklists, and personalized ideas.

| The brief asks for | In the app | What Gemini does | Code |
| --- | --- | --- | --- |
| A planning assistant | Describe the event at `/new`; ask questions or ask for changes in the assistant beside every plan | Reads the description into an event profile; answers from the live plan, word by word; proposes changes that are previewed before they apply | `server/ai.ts`, `src/components/assistant.tsx`, `src/shared/proposals.ts` |
| Weddings, birthdays and community events | Three demo events, one of each. Weddings get functions and a family cost split; community events get funds, approvals, permits, volunteers and stalls | Adapts every prompt to the kind of event | `src/data/demo/`, `src/pages/tabs/list.ts` |
| Budgets | **Budget** tab: a split by category for the city and guest count, what-if headcount, payment schedule with UPI, family split and settle-up, gift register | Reads a photo of a bill or quote into amounts and instalments; points out where the budget is tight | `src/pages/tabs/MoneyTab.tsx`, `src/lib/plan.ts` |
| Timelines | **Timeline** tab: tasks, unpaid payments, vendor book-by dates and the functions in one dated view, grouped from "more than three months before" to "the day", with what's late flagged | Adds tips and watch-outs to the first draft; moves dependent tasks when a function moves | `src/shared/planning.ts`, `src/pages/tabs/TimelineTab.tsx` |
| Vendor checklists | **Vendors** tab: every vendor this kind of event needs, ticked off as they're booked, each with a book-by date and why, then quotes side by side | Drafts enquiry messages in the family's language | `src/shared/planning.ts`, `src/pages/tabs/VendorsTab.tsx` |
| Personalized ideas | **Ideas** tab: "Suggest ideas" adds four to six ideas to the board, each with the detail of this event it answers: the month, the functions, the guest count, meals, budget lines or the family's own notes ("No alcohol", "Everything nut-free"). Planning an idea adds its task and its cost to the right budget line | Writes the ideas from a brief that carries guests as counts only, never names; rules on the device answer when AI is off, the family's notes first | `src/lib/ideas.ts`, `server/ideaPrompts.ts`, `src/pages/tabs/IdeasTab.tsx` |

## Try it in two minutes

1. Open the live site and choose **Explore the demo**.
2. Open **Aarav's 6th birthday** and go to **Timeline**: today falls in "the final month", and booking an
   entertainer is already late.
3. Go to **Vendors**: the checklist shows 2 of 7 booked, with a book-by date for each.
4. Go to **Ideas** and press **Suggest ideas**: the first one answers the family's nut-allergy note, and says so.
   **Plan it**, and its task appears on the timeline.
5. Back on **Overview**, ask the assistant "Where are we over?" or "Move the haldi to Friday" on the wedding.
   Every change is previewed, line by line, before anything moves.

## Run it

```sh
bun install
cp .env.example .env.local   # then paste your Gemini API key
bun run dev                  # http://localhost:5173
```

Without a key everything still works on the on-device logic; the AI features simply don't appear.
In development the API runs inside Vite with an in-memory database (PGlite), so accounts, shared links and
history all work locally.

| Command | What it does |
| --- | --- |
| `bun run dev` | App and API on http://localhost:5173 |
| `bun test` | Unit and API tests, with the clock pinned to the demo story's day |
| `bun run coverage` | The same tests with coverage; fails below 85% of lines or 80% of functions |
| `bun run e2e` | Browser journeys and accessibility checks on desktop and phone sizes; Gemini is mocked |
| `bun run ai:eval` | Checks the AI against real cases in English, Malayalam, Hindi and Tamil (needs a key) |
| `bun run size` | Fails if the built JavaScript grows past its budget (run after a build) |
| `bun run vercel-build` | The production build: migrations, app, pre-rendered public pages, API bundle |
| `bun run brand` | Regenerates the favicon PNGs and the share image in `public/` |
| `bun scripts/restore-backup.ts --latest --out backup.json` | Opens the newest nightly backup (needs `BACKUP_KEY` and `BLOB_READ_WRITE_TOKEN`); `--into <postgres-url>` loads it into a database |

## How it's built

- **Browser**: React 19, React Router and Tailwind 4, built with Vite. Each tab and page is its own chunk.
  Plans are kept in a reducer that applies typed actions (`src/shared/engine.ts`); the same pure function runs
  on the server, which keeps the history.
- **Server**: one Hono app (`server/app.ts`, routes in `server/routes/`) on a Vercel function next to the Neon
  Postgres database, with
  Drizzle for queries and Better Auth for Google and guest sign-in.
- **AI**: Gemini through Plannr's own `/api/ai/*` routes. The key never reaches the browser; each route has a
  JSON response schema, a time budget, a fallback model and a daily allowance per person.
- **Shared links**: guests, helpers, vendors and volunteers open their own page without an account
  (`server/links.ts`, `src/shared/public.ts`), in the family's language.

```
src/
  shared/     pure planning logic used by browser and server: engine, records, planning, ripple
  pages/      screens; tabs/ holds one file per event tab, with sub-folders for larger tabs
  components/ shell, assistant, scanner, shared UI
  lib/        dates, money, intake parsing, ideas, CSV, the AI client
  data/       types and the demo events
server/       API (routes/ by audience: public, AI, account, events), prompts and sanitizers, auth, links, backups
tests/        unit and API tests (bun test)
e2e/          browser journeys and accessibility checks (Playwright + axe)
```

## Quality

| | |
| --- | --- |
| Tests | 195 unit and API tests (`tests/`); 142 browser journeys on desktop and phone (`e2e/`), including every brief requirement above |
| Coverage | 90% of lines and 86% of functions in the code the unit tests load; CI fails below 85% of lines or 80% of functions (`scripts/coverage-gate.ts`) |
| Accessibility | axe checks for WCAG 2.2 AA and axe best practices on every main page, desktop and phone; every journey also fails on a console error. Skip links; screen changes announced, with focus moved to the new content; 24px touch targets; keyboard paths for drag and drop; reduced motion and higher contrast honoured; pages in four languages carry their `lang`. Lighthouse accessibility 100 |
| Security | See [SECURITY.md](SECURITY.md): CSP and security headers (no inline scripts or `<style>`), role checks on every write, cross-site write protection, expiring shared links, sign-in rate limits shared across servers, prompt-injection handling, encrypted backups. `bun audit` and CodeQL run in CI |
| Efficiency | Per-route code splitting with a size budget in CI; the demo's sample data loads only when the demo opens; weight-only font cuts, preloaded; pre-rendered public pages (Lighthouse best practices and SEO 100, total blocking time around 100 ms); streamed AI answers; the server sits in the same region as the database; queries are indexed and a plan list is one join |
| Lint and types | Biome and strict TypeScript, both clean, both in CI |

CI (`.github/workflows/ci.yml`) runs the dependency audit, lint, types, coverage, the build, the size budget,
pre-rendering and the browser journeys on every push to `main`; `.github/workflows/codeql.yml` scans the code for
security problems. Every Monday `.github/workflows/dependencies.yml` posts outdated
packages and the security audit to one issue ("Weekly dependency report"); updates are made on `main`.

## How AI is wired

The browser never sees the key. It posts to `/api/ai/*`; `server/ai.ts` builds the prompt, calls Gemini with a
JSON response schema and sanitizes the answer (`server/prompts.ts`, `server/ideaPrompts.ts`,
`server/documentPrompts.ts`). Each person has a daily allowance (`ai_usage` table). When the main model is
busy or slow, the request is retried once on the fallback model.

| Route | What it does |
| --- | --- |
| `intake` | Reads a description into the event profile; the on-device parser runs first and Gemini fills gaps |
| `plan` | Adds tips, watch-outs and ideas to a first draft; the ideas start the new event's ideas board |
| `ideas` | Ideas for one event on the Ideas tab, each naming the detail it answers (month, functions, guest count, meals, budget lines, the family's notes). Guests go as counts only. With no AI, rules on the device suggest instead (`src/lib/ideas.ts`) |
| `assistant` | Answers from the live plan with precomputed numbers, and proposes changes in a small vocabulary that the app turns into a preview (`src/shared/proposals.ts`). `/api/ai/assistant/stream` sends the answer word by word as server-sent events |
| `write` | Drafts enquiries, thank-yous, reminders, permit letters and translations in English, Malayalam, Hindi or Tamil |
| `read` | Reads a photo or PDF of a bill, quote or contract into amounts, instalments and terms |

Text written by guests, vendors and the family is passed to the model as data, never as instructions.

## Backups

Each night at 8:00 IST the daily job sends the morning reminders, then exports accounts, plans, members,
history, links and templates, encrypts them with AES-256-GCM under `BACKUP_KEY` and stores them in the Blob
store under `backups/`, keeping 14 days. To restore, run the restore script above with the key from Vercel's
environment variables; loading skips rows that already exist, so it can fill a fresh Neon branch.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server | Turns on the AI routes |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Server | Optional overrides; defaults `gemini-3.5-flash`, then `gemini-3.5-flash-lite` when the first is busy |
| `DATABASE_URL` | Server and build | Neon Postgres. Migrations run during `vercel-build` |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Server | Session signing and the public address for sign-in callbacks |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Server | "Continue with Google" |
| `RESEND_API_KEY`, `EMAIL_FROM` | Server | Email sign-in codes; offered only when `EMAIL_FROM` is on a verified domain |
| `BLOB_READ_WRITE_TOKEN` | Server | Album photo uploads and backups (Vercel Blob) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Server | Morning reminders by web push |
| `CRON_SECRET` | Server | Authenticates the daily job (`/api/cron/daily`, 8:00 IST) |
| `ADMIN_EMAILS` | Server | Comma-separated accounts that can open `/admin` |
| `BACKUP_KEY` | Server | 32-byte base64 key that encrypts the nightly backups. Keep a copy: without it no backup can be opened |
| `SITE_URL` | Build | Public origin for canonical links and the sitemap; on Vercel the production domain is used |

## The demo

The demo story was written for Sunday 27 Sep 2026 (`STORY_DAY` in `src/lib/dates.ts`). It moves forward in
whole weeks so it always starts from today. Everything persists in `localStorage`; "Reset demo data" in the
account menu restores it.
