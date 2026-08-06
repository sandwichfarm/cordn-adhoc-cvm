---
status: resolved
trigger: "Production enters a recursive failure after localhost interruption: Svelte each_key_duplicate repeats while ContextVM kind 21059 publishes retry indefinitely."
created: 2026-08-06
updated: 2026-08-06
---

# Production Duplicate Each Keys

## Symptoms

- Expected: relay interruption remains bounded and repeated relay events do not corrupt rendered collections.
- Actual: production throws `each_key_duplicate`, rendering repeatedly fails, and many kind 21059 publications continue retrying.
- Environment: observed on deployed nsite build `index-CW52OBC7.js`; not yet observed locally.
- Trigger: occurs after the application has been running and the localhost WebSocket is unavailable/interrupted.

## Current Focus

- resolved: Persisted room messages and pending outbox records are normalized by stable ID during hydration, and replayed join requests are collapsed by key-package reference before keyed rendering.
- deployment_note: The reported `index-CW52OBC7.js` bundle predates the bounded relay-delivery fix in `08cb3aa`; production must deploy the current build to stop the unbounded Applesauce retry behavior shown in the trace.

## Evidence

- timestamp: 2026-08-06
  observation: Production logs show repeated kind 21059 IDs with SDK attempt counts above 60 and repeated Svelte `each_key_duplicate` failures.
- timestamp: 2026-08-06
  observation: A unit regression seeded duplicate persisted message IDs and reproduced two entries surviving hydration before the repair.
- timestamp: 2026-08-06
  observation: The deployed asset hash differs from the current local production build, and retry counts above 60 are impossible through the current two-attempt bounded delivery wrapper.

## Eliminated

## Resolution

- root_cause: Room hydration trusted structurally valid stored arrays without enforcing unique stable IDs. A replay or race could therefore persist the same message twice and crash Svelte's keyed message block on every render. The pending-invite projection likewise allowed replayed requests with the same `kp_ref`. Separately, the deployed production bundle was stale and did not contain the already-landed bounded relay retry fix.
- fix: Normalize stored messages by ID while preferring confirmed or newer records, deduplicate pending outbox records by ID, and project at most the newest current join request for each `kp_ref`.
- verification: Added unit regressions for duplicate stored messages/outbox entries and replayed join requests, plus a browser regression that reloads production-shaped duplicate local state and asserts one rendered message with no `each_key_duplicate`. `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test` (300 passed, 3 skipped), `pnpm test:e2e` (95 passed), `pnpm build`, `git diff --check`, `pnpm check:upstream`, and `pnpm test:upstream-interop` all pass.
- files_changed: `src/chat/room-store.ts`, `tests/unit/room-navigation.test.ts`, `tests/unit/cordn-conformance.test.ts`, `tests/e2e/workspace-lifecycle.spec.ts`
