---
phase: 21-first-run-coordinator-identity-profile
plan: "03"
subsystem: first-run-onboarding
tags: [svelte, playwright, nostr, nip-07, nip-46, coordinator-setup]
requires:
  - phase: 21-first-run-coordinator-identity-profile
    provides: durable setup guard and persist-first coordinator profile publication
  - phase: 17-full-viewport-startup-motion
    provides: host-chat startup-pane composition
provides:
  - blocking identity-first coordinator setup that never exposes lifecycle controls early
  - shared NIP-07/NIP-46/bunker signer controls for first-run and personal profile surfaces
  - setup-aware manual and autostart lifecycle gating that preserves encrypted-key unlock
affects: [coordinator-startup, user-profile, coordinator-settings, phase-21-plan-04]
tech-stack:
  added: []
  patterns: [setup-before-lifecycle rendering gate, shared operator signer action surface, unlock-before-onboarding routing]
key-files:
  created:
    - src/components/CoordinatorSetup.svelte
    - src/components/OperatorIdentityChoices.svelte
    - tests/e2e/first-run-coordinator-profile.spec.ts
  modified:
    - src/components/HostWorkspace.svelte
    - src/components/UserProfile.svelte
key-decisions:
  - "HostWorkspace evaluates identity readiness and durable setup completion before rendering any lifecycle, room, management, or personal-control surface."
  - "Encrypted coordinator unlock always takes precedence over the first-run UI; the setup decision is made only after the key has loaded."
  - "Operator signer choices stay in UserProfileStore and never pass a signer into coordinator completion or publication."
patterns-established:
  - "Shared signer choices accept a test-id prefix and completion callback so setup and profile keep one NIP-07/NIP-46 state-machine owner."
requirements-completed: [SETUP-01, SETUP-02, SETUP-03, PROFILE-02]
coverage:
  - id: D1
    description: Fresh installations must choose durable operator identity and a valid coordinator name before guided lifecycle start becomes available.
    requirement: SETUP-01
    verification:
      - kind: e2e
        ref: tests/e2e/first-run-coordinator-profile.spec.ts#checking and anonymous setup keep coordinator start unavailable until a valid name is saved
        status: pass
    human_judgment: false
  - id: D2
    description: Meaningful legacy configuration bypasses first-run setup while an encrypted coordinator unlocks before onboarding is evaluated.
    requirement: SETUP-03
    verification:
      - kind: e2e
        ref: tests/e2e/first-run-coordinator-profile.spec.ts#encrypted coordinator unlock resolves before setup and then honors persisted completion state
        status: pass
    human_judgment: false
  - id: D3
    description: Shared NIP-07 and NIP-46 signer choices preserve operator/coordinator identity separation and editable name suggestion behavior.
    requirement: SETUP-02
    verification:
      - kind: automated_ui
        ref: tests/e2e/nip07-session-restoration.spec.ts and tests/e2e/identity-ui-review.spec.ts
        status: unknown
    human_judgment: true
    rationale: "The existing profile suites need completed-setup fixtures before they can prove post-setup signer behavior."
metrics:
  duration: 32min
  completed: 2026-08-05
  tasks_completed: 2
  files_changed: 5
status: complete
---

# Phase 21 Plan 03: First-Run Coordinator Setup Summary

First-run setup now requires an operator identity and coordinator name before any Start path appears, while preserving separate operator and coordinator identities and encrypted coordinator unlock.

## Accomplishments

- Added an accessible checking → identity → naming setup flow with durable anonymous continuation, normalized required-name validation, guided-start handoff, publication retry feedback, and no save-triggered autostart.
- Made HostWorkspace the setup/lifecycle visibility owner: no room rail, management, profile, settings, or start/wake control renders during incomplete setup; manual and automatic start retain the runtime guard.
- Extracted NIP-07/NIP-46 QR/bunker connection behavior into a reusable operator-choice component, retaining UserProfile behavior and safely applying editable profile-name suggestions.
- Restored the encrypted coordinator unlock boundary: passphrase restoration is rendered before first-run setup, then follows the persisted completion state after successful unlock.

## Verification

- `pnpm exec tsc --noEmit` — passed.
- `pnpm lint` — passed.
- `pnpm build` — passed (upstream Rolldown annotation/chunk-size warnings only).
- `git diff --check` — passed.
- `pnpm exec playwright test tests/e2e/first-run-coordinator-profile.spec.ts --workers=1` — passed (4 tests against an isolated built preview): fresh anonymous setup, legacy migration, identity recovery, and encrypted unlock/setup ordering.

## Task Commits

No task commit was created. `HostWorkspace.svelte` and `UserProfile.svelte` already contain active shared Phase 18 and earlier Phase 21 work; staging either whole path would absorb other agents' changes. All Plan 03 changes remain deliberately unstaged for the phase integrator, matching the shared-worktree handoff used by Plans 01 and 02.

## Files Created/Modified

- `src/components/CoordinatorSetup.svelte` — first-run identity/name stages, validation, focus order, and draft-safe profile suggestions.
- `src/components/OperatorIdentityChoices.svelte` — shared NIP-07/NIP-46 QR/bunker controls with safe status and cancellation.
- `src/components/HostWorkspace.svelte` — setup ownership, lifecycle/autostart gate, post-save publication retry, and unlock precedence.
- `src/components/UserProfile.svelte` — composes the shared signer action surface without altering profile ownership.
- `tests/e2e/first-run-coordinator-profile.spec.ts` — first-run, migration, and encrypted-unlock regression coverage.

## Decisions Made

- First-run visibility is a UI defense-in-depth layer; `CoordinatorStore.start()` remains the authoritative rejection point for incomplete setup.
- Autostart only considers a setup state that existed at mount, preventing a successful Save and continue action from implicitly starting a coordinator.
- The first-run gate never precedes a coordinator passphrase prompt, so restoring an encrypted local key remains reachable even for incomplete configuration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored encrypted coordinator unlock precedence**
- **Found during:** Task 1 browser integration
- **Issue:** The setup branch was evaluated before the existing embedded `PassphrasePrompt`, intercepting `Unlock coordinator` for encrypted local keys.
- **Fix:** Rendered the locked/passphrase branch before setup, then evaluate setup completion only after the key restoration remounts the workspace.
- **Files modified:** `src/components/HostWorkspace.svelte`, `tests/e2e/first-run-coordinator-profile.spec.ts`
- **Verification:** Isolated built-preview browser proof covered both completed and incomplete post-unlock configurations.
- **Committed in:** uncommitted shared-worktree handoff.

## Known Stubs

None.

## Issues Encountered

- The pre-Phase-21 `nip07-session-restoration.spec.ts` and `identity-ui-review.spec.ts` suites still assume that the personal profile surface renders on an incomplete fresh install. They now fail at that intentionally retired assumption because first-run setup correctly hides the profile surface. Those suites need fixture migration to complete setup before exercising post-setup profile behavior; they were not edited because this plan owns only its new first-run Playwright spec and must preserve the concurrent Phase 18 test work.

## Self-Check: PASSED

- All five Plan 03 source and test artifacts exist in the working tree.
- The first-run and encrypted-unlock browser flows passed against a freshly built isolated preview.
- No placeholder, TODO, FIXME, or UI-facing empty-data stub was introduced in Plan 03 files.
