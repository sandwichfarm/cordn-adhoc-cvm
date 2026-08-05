---
phase: 21-first-run-coordinator-identity-profile
plan: "04"
subsystem: coordinator-profile-settings
tags: [svelte, nostr, playwright, accessibility, privacy]
requires:
  - phase: 21-01
    provides: durable coordinator naming and constructor-static MCP identity
  - phase: 21-02
    provides: coordinator-key profile publication and retry APIs
provides:
  - explicit draft/save/retry coordinator-name settings flow
  - observable multi-relay kind-0 browser evidence with acknowledgement controls
  - safe publication failure and responsive accessibility assertions
affects: [coordinator-settings, coordinator-profile-publication, first-run-onboarding]
tech-stack:
  added: []
  patterns: [explicit draft persistence, public-event-only relay observation, routed synthetic relay targets]
key-files:
  created:
    - tests/e2e/coordinator-profile-settings.spec.ts
  modified:
    - src/components/CoordinatorSettings.svelte
    - tests/e2e/mock-relay.ts
decisions:
  - Coordinator name is a local draft until explicit save; name publication never mutates the operator profile.
  - Browser evidence routes normalized synthetic wss targets to local test relays and observes only public Nostr event fields.
metrics:
  duration: 25min
  completed: 2026-08-05
  tasks_completed: 2
  files_changed: 3
status: complete
---

# Phase 21 Plan 04: Coordinator Profile Settings Summary

Coordinator settings now saves a validated name explicitly, immediately publishes a coordinator-key kind-0 across every shareable relay, and clearly separates public publication from the next-restart MCP label.

## Accomplishments

- Replaced per-keystroke name persistence with a 48-code-point draft, explicit `Save coordinator name`, validation alert, permanent operator-profile distinction, publication state, retry action, and restart explanation.
- Added safe mock-relay acknowledgement/delay controls plus an event observation API restricted to public Nostr fields.
- Added six browser scenarios proving mixed acknowledgement, valid coordinator-key signatures, no-op invalid input, identity-preserving restart, total rejection and retry, duplicate suppression, and responsive secret-safe failure copy.

## Verification

- `E2E_BASE_URL=http://127.0.0.1:4174/ pnpm exec playwright test tests/e2e/coordinator-profile-settings.spec.ts --workers=1` — passed (6 tests, isolated built preview).
- `pnpm exec vitest run tests/unit/coordinator-profile.test.ts tests/unit/config-store.test.ts tests/unit/state-machine.test.ts tests/unit/contextvm-roundtrip.test.ts` — passed (57 tests).
- `pnpm lint` — passed.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm build` — passed (upstream Rolldown annotation/chunk-size warnings only).
- `git diff --check` — passed.

## Task Commits

1. **Task 1 RED gate: explicit coordinator-name save browser contract** — `8d7ee29` (`test`).

The GREEN UI and browser-test hunks remain unstaged. `tests/e2e/mock-relay.ts` already contained active Phase 18 delayed-broadcast changes before Plan 04; staging the complete file would absorb unrelated work. The Plan 04 relay controls are interleaved with that hunk, so the phase integrator must commit the final three-file implementation atomically after preserving both contracts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reject fulfilled relay connection-failure results**
- **Found during:** Task 2 browser relay evidence.
- **Issue:** `nostr-tools` resolves a failed relay connection to a fulfilled `connection failure:` value; treating every fulfilled result as an acknowledgement falsely reported publication success.
- **Fix:** The Plan 02 owner hardened `publishCoordinatorProfile` to reject these values and added focused unit coverage.
- **Files modified:** `src/coordinator/coordinator-profile.ts`, `tests/unit/coordinator-profile.test.ts`.
- **Commit:** `e5e3ed9`.

## Integration Note

The prescribed post-setup suites `tests/e2e/nip07-session-restoration.spec.ts` and `tests/e2e/identity-ui-review.spec.ts` still require the Plan 03 completed-setup fixture migration described in `21-03-SUMMARY.md`. They are outside Plan 04 ownership. The attempted combined command also hit an unrelated pre-existing Python listener on port 4173 rather than the isolated preview; Plan 04's own spec uses `E2E_BASE_URL` to provide deterministic evidence without altering shared Playwright configuration.

## Known Stubs

None.

## Self-Check: PASSED

- The three Plan 04 files exist and the RED commit `8d7ee29` is present.
- No TODO/FIXME or UI-facing placeholder stub was introduced by Plan 04.
- All Plan 04 focused browser and static checks passed.
