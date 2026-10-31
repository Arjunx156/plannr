# 6. Public pages are pre-rendered

**Status:** accepted, October 2026

## Context

Plannr's public pages (the landing page, the planning guides and the free tools) are how families find it from a
search. A single-page app serves an empty `<div>` until its JavaScript runs, which search engines and link
previews read poorly, and which leaves a phone on a slow connection staring at a blank screen.

## Decision

`scripts/prerender.ts` renders each route in `PUBLIC_ROUTES` (`server/seo.ts`) to static HTML at build time,
with its own title, description and canonical link from `src/components/pageMeta.ts`. The page's code is
preloaded, so when React starts it renders the same page in place, with no loading screen in between.
Private routes (plans, accounts, shared links) are never pre-rendered, and `robots.txt` keeps them out of search.

## Consequences

- Search engines and link previews see real content and metadata on every public page.
- The first paint of a public page doesn't wait for JavaScript, which keeps total blocking time low.
- A public page can't depend on anything only known in the browser at render time; such parts render after
  hydration.
- The build has one more step, and CI runs it on every push, so a page that fails to render fails the build.
