---
phase: 15-identity-continuity-membership-integrity
plan: 02
subsystem: identity-and-room-authority
tags: [svelte, typescript, nostr, localstorage, composite-identity, vitest, playwright]
requires:
  - phase: 15-01
    provides: durable UserProfileStore-owned anonymous signer
provides:
  - signer-verified room creation and attachment paths
  - composite coordinator-plus-room reconciliation helpers
  - reversible anonymous membership-retirement journal
affects: [15-03-rotation-recovery, room-navigation, cached-room-ui]
tech-stack:
  added: []
  patterns: [required signer injection, verified storage read-back, composite room identity]
key-files:
  created: []
  modified:
    - src/chat/room-store.ts
    - src/components/ChatRoute.svelte
    - src/components/HostWorkspace.svelte
    - src/components/InvitePanel.svelte
    - src/components/WorkspaceNav.svelte
    - tests/unit/room-navigation.test.ts
    - tests/e2e/stale-local-sessions.spec.ts
key-decisions:
  - "New rooms receive an explicit active signer and never persist a room-local anonymous secret."
  - "A coordinator pubkey plus room id is the sole authority key for storage and UI replacement."
  - "Anonymous retirement removes usable authority but journals exact raw storage for pre-publication rollback."
patterns-established:
  - "Call requireRoomSigner before every ChatRoomSession construction."
  - "Only remove a room alias after the composite v2 target re-parses and verifies."
requirements-completed: [IDEN-01, IDEN-03, IDEN-04]
coverage:
  - id: D1
    description: "Anonymous host, join, and resume paths use the durable signer, while a mismatched signer remains cache-only."
    requirement: IDEN-01
    verification:
      - kind: unit
        ref: "tests/unit/room-navigation.test.ts#room signer authority"
        status: pass
      - kind: e2e
        ref: "tests/e2e/stale-local-sessions.spec.ts#keeps a stale remote room readable without granting a mismatched signer session"
        status: pass
    human_judgment: false
  - id: D2
    description: "Room storage and workspace navigation preserve same-id rooms at separate coordinators."
    requirement: IDEN-04
    verification:
      - kind: unit
        ref: "tests/unit/room-navigation.test.ts#room navigation persistence"
        status: pass
      - kind: e2e
        ref: "tests/e2e/stale-local-sessions.spec.ts#keeps a foreign host record as a leaveable previous local session after reload"
        status: pass
    human_judgment: false
  - id: D3
    description: "Anonymous membership retirement preserves cache and supports lossless rollback before commit."
    requirement: IDEN-03
    verification:
      - kind: unit
        ref: "tests/unit/room-navigation.test.ts#composite room authority retirement"
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-08-02
status: complete
---

# Phase 15 Plan 02: Durable signer and composite room authority summary

**Durable signer-gated room sessions, coordinator-safe reconciliation, and reversible cache-preserving anonymous membership retirement.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-02T17:01:00Z
- **Completed:** 2026-08-02T17:11:17Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Required `UserProfileStore.activeSigner` for new host, join, and resume attachment paths; legacy room secrets are parsed only for controlled authority checks.
- Added a central signer-to-immutable-pubkey gate, leaving mismatched room data readable but never session- or send-capable.
- Made composite `(coordinatorPubkey, roomId)` identity explicit across room storage and workspace keyed updates.
- Added cache-preserving anonymous membership retirement with verified write/read-back alias cleanup and a lossless rollback journal.

## Task Commits

1. **Task 1: Carry the durable signer through anonymous host, join, and resume paths** — `a566255` (test), `6fe0e32` (feat)
2. **Task 2: Make composite reconciliation idempotent, interruption-safe, and cache-preserving** — `7a975c0` (test), `f353dfb` (feat)

## Files Created/Modified

- `src/chat/room-store.ts` — signer guard, composite helpers, verified alias handling, and retirement journal.
- `src/components/ChatRoute.svelte` — active-signer-only guest creation and cache-safe resume.
- `src/components/HostWorkspace.svelte` — active-signer host creation/resume and composite keyed room updates.
- `src/components/InvitePanel.svelte` — secondary host creation uses the same active signer.
- `src/components/WorkspaceNav.svelte` — coordinator-safe invite dedupe and keyed rendering.
- `tests/unit/room-navigation.test.ts` — durable signer, composite identity, and retirement rollback coverage.
- `tests/e2e/stale-local-sessions.spec.ts` — browser proof that signer-mismatched cache stays readable but cannot send.

## Decisions Made

- New room authority is always derived from an explicit selected signer; anonymous room secrets are not a second identity channel.
- Retired records retain messages and presentation, but blank signing/MLS material and remove invite/pending authority.
- Storage aliases remain in place unless their v2 composite target has been read back and verified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract] Corrected the new cached-message fixture to match `StoredMessage`.**
- **Found during:** Task 1
- **Issue:** The initial test fixture included event-only fields that the stored cache type does not permit.
- **Fix:** Kept the cache-preservation assertion while using the exact stored-message shape.
- **Files modified:** `tests/unit/room-navigation.test.ts`
- **Verification:** `pnpm exec tsc --noEmit` and the focused Vitest suite passed.
- **Committed in:** `6fe0e32`

**2. [Plan consistency] Added required unit coverage in Task 1.**
- **Found during:** Task 1
- **Issue:** Task 1's action required failing unit coverage, but its `<files>` list named only the browser test.
- **Fix:** Added the required unit test alongside its stated behavior before production changes.
- **Files modified:** `tests/unit/room-navigation.test.ts`
- **Verification:** RED failed as expected in `a566255`; GREEN passed in `6fe0e32`.

---

**Total deviations:** 1 auto-fixed issue and 1 plan-file-list consistency adjustment.
**Impact on plan:** Both were limited to the plan's explicit test requirements; no product scope changed.

## Issues Encountered

- The stale cached-room browser test originally expected an offline transport state. With signer verification, a mismatched identity deliberately creates no transport session, so the assertion now proves the stronger cache-only state.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 15-03 can consume `anonymousMembershipImpact` and `retireAnonymousMemberships` to coordinate active-session teardown with durable identity rotation.
- No execution blockers remain.

## Self-Check: PASSED

- Task commits `a566255`, `6fe0e32`, `7a975c0`, and `f353dfb` exist.
- All seven planned implementation and test files exist.

---
*Phase: 15-identity-continuity-membership-integrity*
*Completed: 2026-08-02*
