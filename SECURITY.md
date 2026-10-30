# Security

Plannr holds family plans: guest lists with phone numbers, budgets, payments and photos. This page says how
that data is protected and how to report a problem.

## Reporting a problem

Email 4rjunkrishnan@gmail.com with what you found and how to reproduce it. Please don't open a public issue
for anything that exposes someone's data. You'll get a reply within three days.

## What protects what

| Area | Protection | Where |
| --- | --- | --- |
| Sign-in | Better Auth sessions in `HttpOnly`, `Secure`, `SameSite=Lax` cookies; Google sign-in and guest accounts; 60-day sessions renewed daily. Sign-in is rate-limited with counters in the database, so every server instance enforces the same limit | `server/auth.ts` |
| Who can change a plan | Every write checks the member's role (owner, co-planner, viewer) on the server; viewers can't write | `server/plans.ts` |
| Cross-site requests | Writes are refused unless `Origin` is Plannr's own; a request without `Origin` is refused when `Sec-Fetch-Site` says it came from another site | `server/app.ts` |
| Input | Every change is validated against a zod schema before it reaches the plan; unknown fields and oversized batches are refused | `server/validate.ts` |
| Shared links | Tokens are 96 random bits; each link shows one household, helper or vendor only what they need; links can be revoked, stop when the event is archived, and expire 30 days after the event (180 for the album and fund report) | `server/links.ts`, `src/shared/public.ts` |
| Photos | Only images on Plannr's own Blob store are accepted into an album | `server/photos.ts` |
| Exports | Guest lists and reports export as CSV with every cell quoted; a cell that would start a spreadsheet formula (`=`, `+`, `-`, `@`) is opened as text | `src/lib/csv.ts` |
| Browser | A content security policy sent as a header refuses scripts and stylesheets from anywhere but Plannr (no inline scripts, no `<style>` blocks), refuses framing and upgrades to HTTPS; also `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, HSTS and a narrow `Permissions-Policy` | `scripts/vercel-build.ts`, `server/security.ts` |
| AI | The Gemini key stays on the server; the browser can only call Plannr's fixed routes. Text from guests and vendors is passed to the model as data, never as instructions, and every answer is checked against a schema and cleaned before use. The ideas brief carries guests as counts, never names or phone numbers | `server/ai.ts`, `server/prompts.ts`, `src/lib/ideas.ts` |
| Cost and abuse | Per-IP rate limits on AI, public pages and uploads; a daily AI allowance per account (60 calls for visitors); unknown AI routes are refused before they count | `server/app.ts` |
| Secrets | Keys live only in Vercel's environment variables; `.env.local` is git-ignored | `.gitignore` |
| Backups | Nightly, encrypted with AES-256-GCM under `BACKUP_KEY`, kept 14 days | `server/backup.ts` |
| People's control | Anyone can export everything Plannr holds about them, or delete their account and its plans | `server/account.ts` |
| Dependencies | CI fails on any known advisory of moderate severity or worse (`bun audit`); a weekly report goes to one issue; transitive packages with known problems are pinned to fixed versions in `package.json` `overrides` | `.github/workflows/ci.yml`, `.github/workflows/dependencies.yml` |
| Code scanning | CodeQL's extended security queries run on every push and weekly | `.github/workflows/codeql.yml` |
| CI itself | Workflows run with read-only repository tokens, except the dependency report, which may only write issues | `.github/workflows/` |

## Tests that guard these

`tests/server.test.ts` covers refused cross-site writes, role checks, link scoping, expired links, oversized
requests, photo URLs and the sign-in rate limit. `tests/ideas.test.ts` checks that the ideas brief carries no guest names and that CSV
cells can't run as formulas. Every browser journey fails on a console error, so a page breaking its own content
security policy fails CI. `tests/ai.test.ts` checks that the key never reaches a response, that model output
is sanitized, and that unknown routes are refused.
