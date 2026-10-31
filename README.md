# Plannr

A GenAI planning assistant for weddings, birthdays and community events. Describe the day in one sentence,
in English, Malayalam, Hindi or Tamil, and Plannr drafts the budget, timeline, vendor checklist and ideas for
that event, then helps the family and volunteers run it.

Live: https://plannr-sepia.vercel.app (choose "Explore the demo" to skip sign-in)

## The brief, and where each part lives

> Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community
> events with budgets, timelines, vendor checklists, and personalized ideas.

| The brief asks for | In the app | What Gemini does | Code |
| --- | --- | --- | --- |
| A planning assistant | Describe the event at `/new`; ask questions or ask for changes in the assistant beside every plan | Reads the description into an event profile; answers from the live plan, word by word; proposes changes that are previewed before they apply | `server/ai.ts`, `src/components/assistant.tsx`, `src/shared/proposals.ts` |
| Weddings, birthdays and community events | Three demo events, one of each. Weddings get functions and a family cost split; community events get funds, approvals, permits, volunteers and stalls | Adapts every prompt to the kind of event | `src/data/demo/`, `src/pages/tabs/list.ts` |
| Budgets | **Budget** tab: a split by category for the city and guest count, what-if headcount, payment schedule with UPI, family split and settle-up, gift register | Drafts the first split for this family, with a reason on every line, such as why food takes the largest share; reads a photo of a bill or quote into amounts and instalments; points out where the budget is tight | `src/lib/tailor.ts`, `src/pages/tabs/MoneyTab.tsx` |
| Timelines | **Timeline** tab: tasks, unpaid payments, vendor book-by dates and the functions in one dated view, grouped from "more than three months before" to "the day", with what's late flagged | Dates the first tasks between today and the event day, each with why it falls then; adds tips and watch-outs; moves dependent tasks when a function moves | `src/lib/tailor.ts`, `src/shared/planning.ts`, `src/pages/tabs/TimelineTab.tsx` |
| Vendor checklists | **Vendors** tab: every vendor this event needs, ticked off as they're booked, each with a book-by date and why, then quotes side by side | Picks the vendors for this event and says why each one is on the list; drafts enquiry messages in the family's language | `src/lib/tailor.ts`, `src/shared/planning.ts`, `src/pages/tabs/VendorsTab.tsx` |
| Personalized ideas | **Ideas** tab: "Suggest ideas" adds four to six ideas to the board, each with the detail of this event it answers: the month, the functions, the guest count, meals, budget lines or the family's own notes ("No alcohol", "Everything nut-free"). Planning an idea adds its task and its cost to the right budget line | Writes the ideas from a brief that carries guests as counts only, never names; rules on the device answer when AI is off, the family's notes first | `src/lib/ideas.ts`, `server/prompts/ideas.ts`, `src/pages/tabs/IdeasTab.tsx` |

## Try it in two minutes

1. On the live site, type one sentence such as "Kerala wedding in Kochi, 250 guests, ₹18 lakh, December, food
   matters most" and press **Start planning**. Gemini drafts the budget split, the first dated tasks and the vendor
   list, each line with its reason; any part Gemini can't answer in time is Plannr's standard draft, and the
   screen says which. Then go back and choose **Explore the demo**.
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
| `just check` | Format, lint, types, every unit test and the production build: what CI runs first |
| `bun test` | Unit and API tests, with the clock pinned to the demo story's day |
| `bun run coverage` | The same tests with coverage; fails below 85% of lines or 80% of functions |
| `bun run e2e` | Browser journeys and accessibility checks on desktop and phone sizes; Gemini is mocked |
| `just eval` | Scores Gemini against real cases in English, Malayalam, Hindi and Tamil, including whole drafted plans checked through the same rules the browser uses (needs a key) |
| `bun run size` | Fails if the built JavaScript grows past its budget (run after a build) |
| `bun run vercel-build` | The production build: migrations, app, pre-rendered public pages, API bundle |
| `bun run brand` | Regenerates the favicon PNGs and the share image in `public/` |
| `bun scripts/restore-backup.ts --latest --out backup.json` | Opens the newest nightly backup (needs `BACKUP_KEY` and `BLOB_READ_WRITE_TOKEN`); `--into <postgres-url>` loads it into a database |

## How it's built

- **Browser**: React 19, React Router and Tailwind 4, built with Vite. Each tab and page is its own chunk.
  Plans are kept in a reducer that applies typed actions (`src/shared/engine.ts`); the same pure function runs
  on the server, which keeps the history.
- **Server**: one Hono app (`server/app.ts`, routes in `server/routes/`) on a Vercel function next to the Neon
  Postgres database, with Drizzle for queries and Better Auth for Google, email-code and guest sign-in.
- **AI**: Gemini through Plannr's own `/api/ai/*` routes. The key never reaches the browser; each route has a
  JSON response schema, a time budget, a fallback model and a daily allowance per person.
- **Shared links**: guests, helpers, vendors and volunteers open their own page without an account
  (`server/links.ts`, `src/shared/public.ts`), in the family's language.

```
src/
  shared/      pure planning logic the server runs too: the engine, records, derived numbers, watch rules,
               the ripple preview, shared-link views, templates
  lib/         pure helpers (dates, money, intake parsing, the draft plan) and browser services (API, AI, voice)
  store/       app state: the reducer, the account and sync
  components/  the shell and the pieces screens share: overlays, fields, the assistant, the scanner
  pages/       one file per route; tabs/ holds one file per event tab, public/ the shared-link pages
  data/        types for every record, and the demo events
server/        the Hono app; routes/ by who calls them, prompts/ (each prompt with its schema and sanitizer),
               validation/ (a schema for every plan change), sign-in, plans, history, links, backups
scripts/       build, structure, coverage and size checks, the AI eval, backups
tests/         unit and API tests (bun test)
e2e/           browser journeys and accessibility checks (Playwright + axe)
```

[ARCHITECTURE.md](ARCHITECTURE.md) follows one change from a tap to the database and lists the rules the
build enforces.

## Quality

| | |
| --- | --- |
| Tests | 424 unit and API tests (`tests/`), including the AI routes over HTTP, the checks on Gemini's drafted plans (`tests/tailor.test.ts`), every kind of plan change the server accepts (`tests/validate.test.ts`) and a contract test that runs the browser's API client against the real server in one process; 143 browser journeys on desktop and phone (`e2e/`), including every brief requirement above |
| Coverage | 93.7% of lines and 91.0% of functions in the code the unit tests load; CI fails below 90% of lines or 87% of functions (`scripts/coverage-gate.ts`) |
| Accessibility | axe checks for WCAG 2.2 AA and axe best practices on every main page, desktop and phone; every journey also fails on a console error. Skip links; screen changes announced, with focus moved to the new content; 24px touch targets; keyboard paths for drag and drop; reduced motion and higher contrast honoured; pages in four languages carry their `lang`. Lighthouse accessibility 100 |
| Security | See [SECURITY.md](SECURITY.md): CSP and security headers (no inline scripts or `<style>`), role checks on every write, every kind of plan change validated by schema, request bodies capped while they stream, cross-site write protection, expiring shared links, rate limits shared across servers, prompt-injection handling, encrypted backups. `bun audit` and CodeQL run in CI |
| Efficiency | The first load is 112.3 KB gzipped in 11 files, with React and the router in a chunk of their own that a returning visitor keeps across deploys; per-route code splitting with a size budget in CI; the demo's sample data loads only when the demo opens; weight-only font cuts, preloaded; pre-rendered public pages whose code loads before the first render, so the HTML is swapped for the same page with no loading screen (Lighthouse best practices and SEO 100, total blocking time around 100 ms); streamed AI answers; the server sits in the same region as the database; queries are indexed and a plan list is one join |
| Code | Biome's recommended rules plus, per function, at most 60 lines and a cognitive complexity of 15; no nested ternaries, non-null assertions, floating promises, unused code or stray console output. Strict TypeScript with unchecked index access flagged. No source file over 300 lines, no import cycles (`scripts/structure.ts`) and no copied blocks of code (jscpd). All clean, all in CI |

CI (`.github/workflows/ci.yml`) runs the dependency audit, lint, types, the structure and duplication checks, coverage, the build, the size budget,
pre-rendering and the browser journeys on every push to `main`; `.github/workflows/codeql.yml` scans the code for
security problems. Every Monday `.github/workflows/dependencies.yml` posts outdated
packages and the security audit to one issue ("Weekly dependency report"); updates are made on `main`.

## How AI is wired

The browser never sees the key. It posts to `/api/ai/*`; `server/ai.ts` builds the prompt, calls Gemini
(`server/gemini.ts`) with a JSON response schema and sanitizes the answer. Each prompt sits next to its schema
and sanitizer in `server/prompts/` (intake, plan, ideas, assistant, and documents for writing and reading),
with the shared voice and size limits in `kit.ts`. Each person has a daily allowance (`ai_usage` table). When
the main model is busy or slow, the request is retried once on the fallback model. Every call logs one line with the route,
the model that answered, the tokens used and the time taken.

| Route | What it does |
| --- | --- |
| `intake` | Reads a description into the event profile; the on-device parser runs first and Gemini fills gaps |
| `plan` | Drafts the budget split, the first dated tasks and the vendor list for this event, every line with its reason, plus tips, watch-outs and ideas; the ideas start the new event's ideas board. The browser checks each part before using it (the shares add to about 100%, dates fall between today and the event day, three to twelve vendors) and keeps Plannr's standard draft for any part that fails, labelled on screen (`src/lib/tailor.ts`) |
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
