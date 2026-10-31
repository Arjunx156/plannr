# Changelog

Every notable change to Plannr, newest first. The format follows [Keep a Changelog](https://keepachangelog.com),
and versions follow [Semantic Versioning](https://semver.org).

## 1.0.0 - 2026-10-31

The first stable release. Nothing a family sees has changed; this release is about the guarantees underneath.

### Security

- The content security policy allows no `'unsafe-'` source anywhere. Inline `style` props are gone: values from
  data are set as CSS variables through the CSSOM, and fixed values map to classes.
- Trusted Types are required for scripts, with one policy that accepts only the service worker's URL.
- `Cross-Origin-Resource-Policy` is added, and `Permissions-Policy` switches off every browser feature Plannr
  doesn't use. In production the security headers are the first route, so every response carries them.
- Every GitHub Action is pinned to a commit SHA. CI scans the whole history for secrets with gitleaks and reviews
  new dependencies on pull requests, and OpenSSF Scorecard checks the repository weekly.
- SECURITY.md is now a threat model: each risk, its control, and the test that proves it.

### Testing

- Property-based tests with fast-check for the plan engine, money, dates and every boundary that reads untrusted
  input.
- A fuzz test sends random bodies to every server route that takes one and fails on any 500.
- Tests for every security header and policy directive, the shared interface pieces, the store's loading, every
  assistant proposal, and every history line.
- The large test files are split by area, with shared fixtures. Coverage is up to 95% of lines and 92% of
  functions, and CI now fails below 94% and 91%.
- The browser tests wait for the API's database to boot before the first test starts.

### Code quality

- TypeScript runs with `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`,
  `noImplicitOverride` and, in the app, `isolatedDeclarations`, from one shared base config.
- Environment variables are parsed against a schema once, at startup.
- Type assertions are down to nine, each in an allowlisted place with its reason above it.
- Every export has a doc comment, and domain numbers (timeouts, caps, windows) have names.
- `scripts/structure.ts` now checks six rules: file length, import cycles, layer boundaries, documented
  exports, allowlisted casts and no inline styles.
- Biome sorts Tailwind classes and enforces one naming convention and interfaces for object types.
- Decision records in `docs/adr/`, a testing guide in `docs/TESTING.md`, and CONTRIBUTING.md.

### Project

- MIT license, package metadata, issue and pull request templates, and CODEOWNERS.

## 2026-10-30 to 2026-10-31

- The plan engine split into reducer tables and focused modules; functions kept under 60 lines and a cognitive
  complexity of 15; a duplication gate in CI.
- Share tabs open with no way back into Plannr, and the rate limiter counts in the database too, so a flood of
  new addresses can't reset it.
- WCAG 2.2 checks in every browser journey, a route announcer, a stricter CSP and a lighter first load.
- The Ideas tab: suggestions that say why, drawn from the family's own notes; a timeline and a vendor checklist.

## 2026-10-29

- The full planning workspace: guests, budget, vendors, the day itself, and community tabs.
- Shared links for RSVPs, helpers, vendors, volunteers and the gate, in four languages, with QR passes.
- Offline use, morning reminders, account controls, and assistant answers that stream as they're written.
- Google sign-in, encrypted nightly backups, and a weekly dependency report.

## 2026-10-21 to 2026-10-23

- The first version: describe an event in one sentence and get a plan, with Gemini behind a server route.
- Real accounts, plans shared between co-planners that sync, and history with undo, all on one plan engine
  that runs in the browser and on the server.
- Deployed on Vercel, with CI and browser journey tests from the start.
