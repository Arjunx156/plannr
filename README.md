# Plannr

AI event planner for weddings, birthdays and community events: describe the day, get a plan you can run.

Live: https://plannr-sepia.vercel.app

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
| `bun run e2e` | Browser journeys and accessibility checks on desktop and phone sizes; Gemini is mocked |
| `bun run ai:eval` | Checks the AI against real cases in English, Malayalam, Hindi and Tamil (needs a key) |
| `bun run size` | Fails if the built JavaScript grows past its budget (run after a build) |
| `bun run vercel-build` | The production build: migrations, app, pre-rendered public pages, API bundle |
| `bun run brand` | Regenerates the favicon PNGs and the share image in `public/` |
| `bun scripts/restore-backup.ts --latest --out backup.json` | Opens the newest nightly backup (needs `BACKUP_KEY` and `BLOB_READ_WRITE_TOKEN`); `--into <postgres-url>` loads it into a database |

CI (`.github/workflows/ci.yml`) runs lint, types, tests, the build, the size budget, pre-rendering and the
browser journeys on every push to `main`. Every Monday `.github/workflows/dependencies.yml` posts outdated
packages and the security audit to one issue ("Weekly dependency report"); updates are made on `main`.

## Backups

Each night at 8:00 IST the daily job sends the morning reminders, then exports accounts, plans, members,
history, links and templates, encrypts them with AES-256-GCM under `BACKUP_KEY` and stores them in the Blob
store under `backups/`, keeping 14 days. To restore, run the restore script above with the key from Vercel's
environment variables; loading skips rows that already exist, so it can fill a fresh Neon branch.

## What's in it

- **Planning**: describe the event in one sentence (typed or spoken); Plannr drafts a budget, tasks, vendors
  and guest structure. Every change, from the assistant or a notice, is previewed with everything it moves
  before it applies, and can be undone from History.
- **Guests**: households with RSVP links per function, a duplicate finder, seating by drag and drop, rooms
  and pickups, an event website, entry QR codes.
- **Money**: what-if headcount, payment schedule with UPI links and QR codes, family split with settle-up, a
  gift register with thank-you drafts, bills and quotes read from a photo.
- **Vendors**: pipeline, quotes side by side, booking that sets the budget line and payment dates, enquiry
  drafts, call sheets by link.
- **The day**: live run sheet with a running-late shift, check-in by name or QR, checklist, helper pages,
  guest updates, shared photo album. Works offline.
- **Community**: expense claims approved by the treasurer, sponsors, permits with drafted letters, volunteer
  sign-up, stall requests, gate passes, a public fund report, templates for next year.
- **Public pages**: guides, pricing, privacy, terms and four free tools, pre-rendered for search and link
  previews.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server | Turns on the AI routes |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Server | Optional overrides; defaults `gemini-3.5-flash`, then `gemini-3.5-flash-lite` when the first is busy |
| `DATABASE_URL` | Server and build | Neon Postgres. Migrations run during `vercel-build` |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Server | Session signing and the public address for sign-in callbacks |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Server | "Continue with Google" |
| `RESEND_API_KEY`, `EMAIL_FROM` | Server | Email sign-in codes; offered only when `EMAIL_FROM` is on a verified domain |
| `BLOB_READ_WRITE_TOKEN` | Server | Album photo uploads (Vercel Blob) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Server | Morning reminders by web push |
| `CRON_SECRET` | Server | Authenticates the daily reminder job (`/api/cron/daily`, 8:00 IST) |
| `ADMIN_EMAILS` | Server | Comma-separated accounts that can open `/admin` |
| `BACKUP_KEY` | Server | 32-byte base64 key that encrypts the nightly backups. Keep a copy: without it no backup can be opened |
| `SITE_URL` | Build | Public origin for canonical links and the sitemap; on Vercel the production domain is used |

## How AI is wired

The browser never sees the key. It posts to `/api/ai/*`; `server/ai.ts` builds the prompt, calls Gemini with a
JSON response schema and sanitizes the answer (`server/prompts.ts`). Each person has a daily allowance
(`ai_usage` table). When the main model is busy or slow, the request is retried once on the fallback model.

| Route | What it does |
| --- | --- |
| `intake` | Reads a description into the event profile; the on-device parser runs first and Gemini fills gaps |
| `plan` | Adds tips, watch-outs and ideas to a first draft |
| `ideas` | Suggests ideas for one event on the Ideas tab, each naming the detail it answers (month, functions, guest count, meals, budget lines, the family's notes). Guests go as counts only. With no AI, rules on the device suggest instead (`src/lib/ideas.ts`) |
| `assistant` | Answers from the live plan with precomputed numbers, and proposes changes in a small vocabulary that the app turns into a preview (`src/shared/proposals.ts`). `/api/ai/assistant/stream` sends the answer word by word as server-sent events |
| `write` | Drafts enquiries, thank-yous, reminders, permit letters and translations in English, Malayalam, Hindi or Tamil |
| `read` | Reads a photo or PDF of a bill, quote or contract into amounts, instalments and terms |

Text written by guests and vendors is passed to the model as data, never as instructions.

## The demo

The demo story was written for Sunday 27 Sep 2026 (`STORY_DAY` in `src/lib/dates.ts`). It moves forward in
whole weeks so it always starts from today. Everything persists in `localStorage`; "Reset demo data" in the
account menu restores it.
