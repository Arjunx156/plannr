# 3. Plan writes use optimistic locking

**Status:** accepted, October 2026

## Context

Co-planners edit the same plan from different phones. A plan is stored whole, as JSON, so two writes that read
the same version and save without checking would silently lose one person's change.

## Decision

Every event row carries a `version`. `commit` in `server/plans.ts` reads the plan, applies the incoming actions
with the shared engine, and saves only if the version is still the one it read, bumping it by one. If someone
else wrote in between, it reads the plan again and applies the same actions on top of their change, up to
`MAX_RETRIES` times.

## Consequences

- No locks are held across a request, which suits serverless functions that may be frozen at any moment.
- Because changes are actions rather than whole plans, a retry merges instead of overwriting: ticking a task and
  adding a guest at the same moment both land.
- Two edits to the very same field resolve to the later one. For a family plan that is the expected outcome.
- Clients learn of other people's changes by polling the version (`GET /api/events/:id/version`) every eight
  seconds while a plan is open, and when the tab comes back into view.
