---
phase: 15-identity-continuity-membership-integrity
plan: 03
subsystem: identity-and-room-authority
tags: [svelte, typescript, localstorage, native-dialog, nostr, vitest, playwright]
requires:
  - phase: 15-02
    provides: composite room authority retirement journal and durable anonymous signer
provides:
  - anonymous-only native identity rotation and corrupt-credential recovery UI
  - durable non-secret recovery boundary with crash-safe bootstrap behavior
  - live joined and hosted session retirement before replacement signer publication
affects: [phase-16-room-recovery, identity-menu, anonymous-room-sessions]
tech-stack:
  added: []
  patterns: [prepare-retire-boundary-destroy-persist-publish transaction, recovery-required bootstrap gate, registered anonymous session lifecycle]
key-files:
  created: [src/components/IdentityRotationDialog.svelte]
  modified: [src/identity/user-profile.svelte.ts, src/identity/anonymous-identity.ts, src/components/UserProfile.svelte, src/components/ChatRoute.svelte, src/components/HostWorkspace.svelte, tests/unit/user-profile.test.ts, tests/e2e/nip07-session-restoration.spec.ts, tests/e2e/stale-local-sessions.spec.ts]
key-decisions:
  - "The versioned non-secret recovery marker is the irreversible boundary: bootstrap honors it before examining canonical identity bytes."
  - "Only matching anonymous session callbacks are retired; authenticated NIP-07 and NIP-46 selection remains outside rotation."
  - "Cached room presentation is preserved while local authority and persistence-capable sessions are discarded."
patterns-established:
  - "AnonymousSessionLifecycle registrations return an unregister callback and are composite-room restore aware."
  - "Post-boundary errors destroy the unpublished candidate and return only the recovery-required surface."
requirements-completed: [IDEN-02, IDEN-03]
coverage:
  - id: D1
    description: "Anonymous users rotate through the approved native dialog, while authenticated identity menus remain isolated."
    requirement: IDEN-02
    verification:
      - kind: unit
        ref: "tests/unit/user-profile.test.ts#rotates an anonymous identity only after creating a replacement"
        status: pass
      - kind: e2e
        ref: "tests/e2e/nip07-session-restoration.spec.ts#rotates a zero-membership local identity only after the approved confirmation"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rotation retires matching local authority and live sessions, preserves cached history, and reloads into explicit recovery after the boundary."
    requirement: IDEN-03
    verification:
      - kind: unit
        ref: "tests/unit/user-profile.test.ts#retires matching local room authority and every live session before publishing a replacement"
        status: pass
      - kind: e2e
        ref: "tests/e2e/stale-local-sessions.spec.ts#keeps a boundary-crossed local identity non-dismissably recovered after reload"
        status: pass
    human_judgment: false
metrics:
  duration: 11min
  completed: 2026-08-02
  tasks_completed: 3
  files_changed: 9
status: complete
---

# Phase 15 Plan 03: Identity rotation and recovery summary

**Anonymous identity rotation now retires matching local room authority and live sessions before atomically exposing a verified replacement, with durable recovery after interruption.**

## Performance

- **Duration:** 11 min
- **Completed:** 2026-08-02T16:24:39Z
- **Tasks:** 3/3
- **Files modified:** 9

## Accomplishments

- Added an anonymous-only native-dialog confirmation/recovery flow with approved copy, focus behavior, busy states, and a polite completion announcement.
- Enforced the ordered privacy transaction: candidate preparation, matching live-session retirement, composite local-authority retirement, durable marker, signer destruction, verified canonical replacement, journal commit, publication, and final acknowledgement.
- Registered real joined and hosted anonymous sessions for persistence-disabling retirement; recovery reloads expose no profile trigger or active signer.

## Verification

- `pnpm exec vitest run tests/unit/user-profile.test.ts tests/unit/room-navigation.test.ts` — passed (50 tests).
- `pnpm exec playwright test tests/e2e/nip07-session-restoration.spec.ts` — passed (3 tests).
- `pnpm exec playwright test tests/e2e/stale-local-sessions.spec.ts` — passed (3 tests).
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test` — passed (165 tests).
- `pnpm build` and `git diff --check` — passed.
- Full `pnpm test:e2e` was attempted; it reached an unrelated pre-existing narrow-viewport operator-shell assertion failure in `tests/e2e/phase-one.spec.ts` (topbar height 112px; expected at most 100px). Targeted Phase 15 browser suites passed.

## Task Commits

1. **Task 1: Rotate a zero-membership identity through the approved modal and recover corrupt storage explicitly** — `31fd888` (test), `72c37a0` (feat)
2. **Task 2: Make one/many membership rotation boundary-ordered, fail-safe, and cache-preserving** — `fe6210b` (test), `92d6246` (feat)
3. **Task 3: Retire real joined/hosted sessions before replacement and prove old writes cannot return** — `631eec2` (feat), `ee2e0f6` (fix)

## Files Created/Modified

- `src/components/IdentityRotationDialog.svelte` — accessible confirm and recovery dialog variants.
- `src/components/UserProfile.svelte` — sole anonymous rotation entry point, membership impact count, recovery display, and completion announcement.
- `src/identity/user-profile.svelte.ts` — recovery marker, ordered replacement transaction, and anonymous session lifecycle registry.
- `src/identity/anonymous-identity.ts` — candidate abort now destroys already-persisted but unpublished signers.
- `src/components/ChatRoute.svelte` and `src/components/HostWorkspace.svelte` — registered joined and hosted session retirement/rollback callbacks.
- `tests/unit/user-profile.test.ts`, `tests/e2e/nip07-session-restoration.spec.ts`, `tests/e2e/stale-local-sessions.spec.ts` — unit and browser evidence for rotation, rollback, cache preservation, and recovery reload.

## Decisions Made

- The marker intentionally contains only `{ version: 1 }`; no signer, candidate, or local secret is recorded outside the canonical identity store.
- Failure before the marker rolls back only exact local authority and already-retired sessions; failure after it never restores authority or exposes a signer.
- Retirement is scoped by the stable anonymous pubkey and Plan 15-02 composite room authority, never title or room ID alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract] Made the zero-membership assertion target the distinct empty-state heading.**
- **Found during:** Task 1
- **Issue:** The expected text occurs both in the scalar impact line and empty-state heading, causing Playwright strict-mode failure.
- **Fix:** Targeted the approved heading role.
- **Files modified:** `tests/e2e/nip07-session-restoration.spec.ts`
- **Verification:** Targeted Playwright suite passed.
- **Committed in:** `72c37a0`

**2. [Rule 1 - Safety] Candidate abort destroys a signer even after its canonical write succeeded.**
- **Found during:** Task 2
- **Issue:** A post-boundary acknowledgement failure could leave an unpublished candidate signer usable in memory.
- **Fix:** `abort()` always destroys the signer while retaining canonical bytes behind the recovery marker.
- **Files modified:** `src/identity/anonymous-identity.ts`
- **Verification:** Unit transaction coverage passed.
- **Committed in:** `92d6246`

**3. [Rule 1 - Quality gate] Used SvelteSet and preserved the original rollback error cause.**
- **Found during:** Final verification
- **Issue:** ESLint rejected a mutable native Set and a replacement error without its cause.
- **Fix:** Switched the session registry to `SvelteSet` and attached the caught cause.
- **Files modified:** `src/identity/user-profile.svelte.ts`
- **Verification:** `pnpm lint` passed.
- **Committed in:** `ee2e0f6`

---

**Total deviations:** 3 auto-fixed Rule 1 issues.
**Impact on plan:** All changes enforce the planned transaction and quality guarantees without expanding scope.

## Issues Encountered

- The full browser suite has an unrelated pre-existing narrow-viewport operator-shell assertion failure. It is outside this plan's owned files; focused Phase 15 suites pass.

## Known Stubs

None.

## Next Phase Readiness

- Phase 16 can rely on retired rooms remaining cache-readable but authority-free, and on recovery-required boot preventing unsafe session attachment.

## Self-Check: PASSED

- Created dialog and all eight modified implementation/test artifacts exist.
- Task commits `31fd888`, `72c37a0`, `fe6210b`, `92d6246`, `631eec2`, and `ee2e0f6` exist in git history.
