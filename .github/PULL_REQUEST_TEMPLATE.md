## What changes

<!-- One or two sentences: what a family or a guest will notice, or what gets easier to maintain. -->

## How it was checked

- [ ] `just check` passes: lint, types, the structure checks, duplication, unit tests and the build
- [ ] `bun x playwright test` passes, if a screen or a journey changed
- [ ] A new plan change is a typed action with a schema, a reducer entry and a description (docs/adr/0001)
- [ ] Anything that calls Gemini goes through a server route with its own schema and sanitizer (docs/adr/0002)
