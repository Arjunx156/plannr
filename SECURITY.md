# Security

Plannr holds family plans: guest lists with phone numbers, budgets, payments and photos. This page says what
could go wrong, what stops it, and which test proves the guard holds. It ends with how to report a problem.

## Reporting a problem

Email 4rjunkrishnan@gmail.com with what you found and how to reproduce it. Please don't open a public issue
for anything that exposes someone's data. You'll get a reply within three days.

## Threat model

Every row names a risk, the control that stops it, where the control lives, and the test that fails if it
breaks. Tests under `tests/` run with `bun test`; those under `e2e/` run in a real browser with Playwright.

| Risk | Control | Where | Proved by |
| --- | --- | --- | --- |
| Someone else's site makes changes with a family's session | Writes are refused unless `Origin` is Plannr's own. A request without `Origin` is refused when `Sec-Fetch-Site` says another site sent it. Session cookies are `HttpOnly`, `Secure` and `SameSite=Lax` | `server/app.ts`, `server/auth.ts` | `tests/server/accounts.test.ts` |
| A member does more than their role allows | Every write checks the member's role (owner, co-planner, viewer) on the server. Viewers can't write or make links. Once a treasurer is named, only they or the owner approve expenses | `server/plans.ts`, `server/members.ts` | `tests/server/links.test.ts`, `tests/server/together.test.ts` |
| A crafted change corrupts a plan | Each of the 34 kinds of plan change has its own zod schema, and any other kind is refused. A whole plan is checked for shape, depth, text length and item count, then row by row. Unknown fields are dropped, and a batch over 50 changes is refused | `server/validate.ts`, `server/validation/` | `tests/validate.test.ts`, `tests/server/plans.test.ts`, `tests/properties/boundaries.test.ts` (any JSON at all), `tests/server/fuzz.test.ts` (any body, never a 500) |
| Two people overwrite each other's work | Every plan carries a version, and a write saves only if the version is still the one it read; otherwise the server applies the same changes again on top of the newer plan. An undo of a change that is already undone gets a 409 | `server/plans.ts`, `server/history.ts` | `tests/server/plans.test.ts`, `tests/apiClient.test.ts` |
| A shared link shows more than it should | Tokens are 96 random bits. Each link shows one household, helper or vendor only what they need. Links can be revoked, stop when the event is archived, and expire 30 days after the event (180 for the album and fund report) | `server/links.ts`, `src/shared/public.ts` | `tests/server/links.test.ts`, `tests/public.test.ts` |
| Injected script runs in Plannr's pages | A content security policy with no `'unsafe-'` source anywhere: scripts and styles from Plannr only, no inline scripts, no `style` attributes, no `eval`. Values that come from data are set as CSS variables through the CSSOM, which the policy allows. Trusted Types are required, and the one policy (`plannr`) accepts only the service worker's URL | `server/security.ts`, `src/components/cssVars.ts`, `src/lib/device.ts` | `tests/security.test.ts`; every browser journey in `e2e/` fails on a console error, so a policy violation fails CI |
| Plannr is framed, or another site's window reaches into it | `frame-ancestors 'none'` and `X-Frame-Options: DENY`; `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` both `same-origin` | `server/security.ts`, `scripts/vercelOutput.ts` | `tests/security.test.ts` |
| A response goes out without its headers | The security headers are the first route in Vercel's output, before anything can answer, so pages, the API, assets and errors all carry them. HSTS for two years with subdomains. `Permissions-Policy` switches off every browser feature except the camera and microphone on Plannr's own pages | `scripts/vercelOutput.ts`, `server/security.ts` | `tests/security.test.ts` |
| An error leaks how the server works | A failure inside the API answers with a plain message; the stack and the database error stay in the server log | `server/app.ts` | `tests/security.test.ts` |
| The Gemini key leaks, or a guest's text steers the model | The key stays on the server, and the browser can only call Plannr's fixed routes. Text from guests and vendors goes to the model as data, never as instructions. Every request and every answer is parsed by its own zod schema; the answer's schema also generates the JSON schema Gemini answers in. The ideas brief carries guests as counts, never names or phone numbers | `server/ai.ts`, `server/prompts/`, `src/lib/ideas.ts` | `tests/ai/http.test.ts`, `tests/ai/intake.test.ts`, `tests/ideas.test.ts`, `tests/properties/boundaries.test.ts` |
| Floods run up cost or lock people out | Per-IP rate limits on AI, public pages and uploads, counted in memory first and then in the database, so every server instance enforces the same limit and a flood of new addresses can't reset it. A daily AI allowance per account (60 calls for visitors). Request bodies are capped per route while they stream, so a body that lies about its length is cut off. Guest sign-in is rate-limited the same way | `server/limits.ts`, `server/app.ts`, `server/ai.ts` | `tests/limits.test.ts`, `tests/ai/http.test.ts`, `tests/server/together.test.ts`, `tests/server/accounts.test.ts` |
| An album takes images from anywhere | Only images on Plannr's own Blob store, under the event's own folder, are accepted | `server/photos.ts` | `tests/server/links.test.ts` |
| An exported spreadsheet runs a formula | Every cell is quoted, and a cell that would start a formula (`=`, `+`, `-`, `@`, tab, return) opens as text | `src/lib/csv.ts` | `tests/ideas.test.ts`, `tests/properties/boundaries.test.ts` |
| Backups are read by whoever finds them | Nightly, encrypted with AES-256-GCM under `BACKUP_KEY`, kept 14 days | `server/backup.ts` | `tests/server/operations.test.ts` |
| People can't see or remove what Plannr holds about them | Anyone can export everything Plannr holds about them, or delete their account; shared plans pass to a co-planner | `server/account.ts` | `tests/server/accounts.test.ts` |

## The supply chain

| Risk | Control | Where |
| --- | --- | --- |
| A dependency with a known advisory | CI fails on any advisory of moderate severity or worse (`bun audit`). A pull request that adds a vulnerable package is refused by dependency review. A weekly report goes to one issue. Transitive packages with known problems are pinned in `package.json` `overrides` | `.github/workflows/ci.yml`, `.github/workflows/dependencies.yml` |
| A GitHub Action is swapped under its tag | Every action is pinned to a full commit SHA, with its version in a comment | `.github/workflows/` |
| A workflow does more than it should | Workflows run with read-only tokens plus the one write each needs: the dependency report may write issues, and CodeQL and Scorecard may upload code-scanning results | `.github/workflows/` |
| A secret is committed | Keys live only in Vercel's environment variables and a git-ignored `.env.local`. Gitleaks scans the whole history on every push | `.gitignore`, `.github/workflows/ci.yml` |
| A weakness in the code itself | CodeQL's extended security queries run on every push and weekly; OpenSSF Scorecard checks the repository's practices weekly | `.github/workflows/codeql.yml`, `.github/workflows/scorecard.yml` |
