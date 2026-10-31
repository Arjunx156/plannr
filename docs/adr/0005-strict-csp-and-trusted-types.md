# 5. A strict content security policy, with Trusted Types

**Status:** accepted, October 2026

## Context

Plannr shows text that other people typed: guest names, vendor notes, comments, RSVP replies, and answers
written by Gemini. React escapes it, but one missed escape, or one compromised dependency, would let a stranger's
script run with a planner's session and read every phone number on a guest list. The policy should make that
impossible even after a mistake, not just unlikely.

The usual escape hatches stood in the way. Thirty-four places set inline `style={{ ... }}` for bar widths,
hue swatches and animation delays, which a policy can only allow with `style-src-attr 'unsafe-inline'`. And
nothing stopped a string from reaching a script sink.

## Decision

The policy in `server/security.ts` allows no `'unsafe-'` source anywhere. Scripts and stylesheets come from
Plannr only; there are no inline scripts, `<style>` blocks, `style` attributes or `eval`. Outside hosts are
named one by one (Plannr's Blob store for photos, Open-Meteo for the weather), never as a bare wildcard or a whole scheme.

- **Styles from data go through the CSSOM.** A policy governs markup, not `element.style.setProperty`. So
  values that come from data, like a bar's width or a family's colour, are set as CSS custom properties by the
  `cssVars` ref (`src/components/cssVars.ts`), and named utilities in `src/index.css` read them. A fixed set of
  values, such as the hue swatches, maps to classes instead (`SWATCH_BG` in `src/components/ui.tsx`).
- **Trusted Types are required for scripts.** `require-trusted-types-for 'script'` makes every script sink
  refuse a plain string. The bundle has one such sink, registering the service worker, and its URL passes
  through Plannr's one policy, `plannr` (`src/lib/device.ts`), which accepts `/sw.js` and throws on anything
  else. `trusted-types plannr` stops any other code from creating a policy of its own.
- **Every response carries the headers.** In production they are the first route in Vercel's output config
  (`scripts/vercelOutput.ts`), so pages, the API, static assets and errors all get them. Built pages also carry
  the policy as a meta tag, so `vite preview` runs under the same rules as production.

## Consequences

- An injected `<script>`, inline handler, `style` attribute or `javascript:` URL is refused by the browser
  even if it reaches the page.
- `tests/security.test.ts` fails if a directive is loosened, an `'unsafe-'` source or a wildcard appears, or
  the headers route stops coming first. Every browser journey fails on a console error, and a policy
  violation is one, so a component that breaks the policy fails CI.
- A component can't take the quick route of a `style` prop. `scripts/structure.ts` refuses one, and the
  `cssVars` ref is the way to pass a value from data.
- The Vite dev server injects its own inline scripts, so it runs without the policy. The journeys therefore run
  against the production build.
- A browser without Trusted Types still gets the rest of the policy, and registers the service worker with its
  plain URL.
