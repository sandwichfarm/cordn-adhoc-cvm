---
phase: 21-first-run-coordinator-identity-profile
plan: "02"
subsystem: coordinator-profile-publication
tags: [nostr, nostr-tools, svelte, typescript, vitest]
requires:
  - phase: 21-first-run-coordinator-identity-profile
    provides: normalized setup completion, validated coordinator name, and shareable relay targets
provides:
  - coordinator-key-signed kind-0 metadata publication with defensive metadata preservation
  - persist-first setup/rename publication state and retry orchestration
affects: [first-run-onboarding, coordinator-settings, canonical-cordn-client-resolution]
tech-stack:
  added: []
  patterns: [injected browser relay pool, coordinator-only profile signer, one-acknowledgement relay threshold, generic publication failure state]
key-files:
  created:
    - src/coordinator/coordinator-profile.ts
    - tests/unit/coordinator-profile.test.ts
  modified:
    - src/coordinator/coordinator.svelte.ts
    - tests/unit/state-machine.test.ts
decisions:
  - Profile publication takes only a coordinator pubkey and short-lived coordinator-key copy; it accepts no operator signer.
  - Local setup/name persistence precedes publication, and all publication causes collapse to one retryable safe state.
  - One successful acknowledgement across every configured shareable relay is sufficient for a published result.
requirements-completed: [SETUP-04, PROFILE-01, PROFILE-02]
coverage:
  - id: D1
    description: Coordinator-key signed kind-0 publication preserves the newest usable metadata, attempts every configured relay, and zeroizes the copied key.
    requirement: PROFILE-01
    verification:
      - kind: unit
        ref: tests/unit/coordinator-profile.test.ts#publishCoordinatorProfile
        status: pass
    human_judgment: false
  - id: D2
    description: Persist-first setup/rename publication retains local state on failure and retries with current shareable relays without lifecycle or identity mutation.
    requirement: PROFILE-02
    verification:
      - kind: unit
        ref: tests/unit/state-machine.test.ts#coordinator recovery policy
        status: pass
    human_judgment: false
metrics:
  duration: 6min
  completed: 2026-08-05
  tasks_completed: 2
  files_changed: 4
status: complete
---

# Phase 21 Plan 02: Coordinator Profile Publication Summary

Coordinator-owned kind-0 publication now preserves safe public metadata, requires one shareable-relay acknowledgement, and exposes persist-first retry state without altering the running coordinator.

## Accomplishments

- Added a browser-safe, injected-pool publisher that queries only the supplied shareable relays, signs only with coordinator key bytes, verifies the result, and zeroizes the copied secret.
- Preserved the newest usable bounded kind-0 JSON object while replacing only `name`; malformed metadata and query errors fall back to a new name-only profile.
- Added `CoordinatorStore` setup, rename, and retry APIs with serialized `idle | publishing | published | failed` state and fixed safe failure logging.

## Verification

- `pnpm exec vitest run tests/unit/coordinator-profile.test.ts` — passed (5 tests).
- `pnpm exec vitest run tests/unit/state-machine.test.ts tests/unit/coordinator-profile.test.ts -t "profile|setup|rename|retry|secret-safe"` — passed (8 selected tests).
- `pnpm exec vitest run tests/unit/state-machine.test.ts tests/unit/coordinator-profile.test.ts` — passed (32 tests).
- `pnpm exec tsc --noEmit` — passed.
- `pnpm lint` — passed.
- `git diff --check` — passed.

## Task Commits

1. **Task 1: Publish one preserved coordinator profile end to end through the relay seam** — `dc4f2ce` (`feat`), `682e9a3` (`fix`), `e5e3ed9` (`fix`)
2. **Task 2: Persist setup or rename before best-effort publication and retry safely** — uncommitted; see execution constraint below.

## Files Created/Modified

- `src/coordinator/coordinator-profile.ts` — defensive kind-0 construction, signing, relay fanout, acknowledgement threshold, and cleanup.
- `tests/unit/coordinator-profile.test.ts` — metadata, signature, relay, failure, and cleanup coverage.
- `src/coordinator/coordinator.svelte.ts` — persist-first profile save/retry orchestration.
- `tests/unit/state-machine.test.ts` — save, failure, retry, serialization, and runtime-invariant coverage.

## Decisions Made

- Preserve the existing Plan 01 setup guard; publication is a separate best-effort operation and never starts, stops, replaces, or otherwise mutates the coordinator runtime.
- Consume the current `configStore.inviteRelayUrls` on each publish/retry so only public `wss:` targets are used.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Ignore metadata from a non-coordinator relay event**
- **Found during:** Task 1 post-verification
- **Issue:** A relay response that did not match the queried coordinator pubkey could otherwise become the selected metadata source.
- **Fix:** Filtered every returned kind-0 event by coordinator pubkey before defensive parsing and added a foreign-event regression case.
- **Files modified:** `src/coordinator/coordinator-profile.ts`, `tests/unit/coordinator-profile.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/coordinator-profile.test.ts`, `pnpm exec tsc --noEmit`
- **Commit:** `682e9a3`

Task 2 could not be committed atomically because it directly depends on Plan 01’s still-uncommitted config and state-machine hunks in the same shared files. Staging either target whole-file would absorb shared Phase 01/18 work, so its verified hunks remain unstaged for the phase integrator as explicitly required by the shared-worktree contract.

**2. [Rule 1 - Bug] Reject fulfilled relay connection-failure strings**
- **Found during:** Plan 04 RED regression
- **Issue:** `nostr-tools` `SimplePool.publish()` fulfills a per-relay promise with `connection failure: ...` when it cannot connect, which the original acknowledgement threshold incorrectly counted as publication success.
- **Fix:** Count only fulfilled results that are not the library's connection-failure sentinel; added a total-failure regression case.
- **Files modified:** `src/coordinator/coordinator-profile.ts`, `tests/unit/coordinator-profile.test.ts`
- **Verification:** focused publisher tests, `pnpm exec tsc --noEmit`, `pnpm lint`, and `git diff --check`
- **Commit:** `e5e3ed9`

## Known Stubs

None.

## Self-Check: PASSED

- Task 1 commits `dc4f2ce`, `682e9a3`, and `e5e3ed9` exist and include publisher implementation, foreign-event hardening, and relay-acknowledgement hardening.
- All four Plan 02 source/test files exist in the working tree.
- No placeholder, TODO, FIXME, or UI-facing empty-data stub was found in Plan 02 files.
