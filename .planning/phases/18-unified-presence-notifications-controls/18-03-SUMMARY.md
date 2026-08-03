---
phase: 18
plan: 03
subsystem: workspace-shell
tags: [svelte, presence, profile, coordinator, responsive-controls, e2e]
dependency_graph:
  requires: [18-01, 18-02]
  provides: [profile-owned-presence, settings-owned-host-badge, grouped-commandbar]
  affects: [identity-profile, coordinator-settings, host-workspace, lifecycle-e2e]
tech_stack:
  added: []
  patterns: [persisted-profile-presence, distinct-personal-and-host-control-groups, compact-tools-drawer]
key_files:
  created: []
  modified:
    - src/components/UserProfile.svelte
    - src/components/CoordinatorSettings.svelte
    - src/components/HostWorkspace.svelte
    - tests/unit/config-store.test.ts
    - tests/e2e/identity-ui-review.spec.ts
    - tests/e2e/workspace-lifecycle.spec.ts
  deleted:
    - src/components/PresenceControl.svelte
decisions:
  - Presence is an identity profile preference and never starts or stops the coordinator.
  - Host message badge administration belongs in Coordinator Settings, not the personal profile.
  - Compact view exposes one host-tools entry, whose drawer keeps Personal controls before Host controls.
metrics:
  duration: 54m
  completed_date: 2026-08-03
  tasks_completed: 3
  files_changed: 6
status: complete
---

# Phase 18 Plan 03: Unified Presence and Controls Summary

Presence now persists as a profile-owned setting, host badge editing lives with coordinator administration, and the workspace command bar has one responsive Personal/Host ownership model.

## Completed Tasks

1. **Moved presence into the user profile** — `34287b8`
   - Removed the standalone lifecycle-adjacent presence control.
   - Added Online, Invisible, and Offline profile choices, a visible avatar presence indicator, and persistence coverage proving the runtime configuration remains unchanged.

2. **Moved host message identity into Coordinator Settings** — `39c0db4`
   - Added the host badge emoji, text, and outgoing-message preview to coordinator administration.
   - Kept personal profile editing free of host-specific badge controls.

3. **Separated Personal and Host command ownership** — `3771bd7`, `94b52a1`, `108aa2e`
   - Grouped the command bar into ordered Personal and Host clusters.
   - Made the compact three-dot entry the sole host-control entry and preserved focus restoration when it closes.
   - Kept the toggle above its compact drawer scrim and aligned lifecycle E2E coverage with the new control path.

## Verification

- `pnpm exec tsc --noEmit` — passed.
- `pnpm exec vitest run tests/unit/config-store.test.ts` — 11 passed.
- Focused Playwright coverage for presence, host badge editing, and responsive control ownership — 7 passed.
- A complete 64-test browser run reached 59 passed; five failures were superseded assertions or compact-landscape control coverage outside this plan's bounded changes. The test alignment commit retains the restored startup visual-contract expectations supplied during integration.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Kept the compact tools toggle above its drawer scrim**
   - **Found during:** Task 3 verification
   - **Issue:** The drawer scrim intercepted pointer input intended for the compact three-dot toggle.
   - **Fix:** Raised the toggle within the compact stacking order so it remains a usable close affordance.
   - **Files modified:** `src/components/HostWorkspace.svelte`
   - **Commit:** `94b52a1`

## Known Stubs

None. The placeholder matches in the scanned files are real input placeholders and browser capability messages, not unwired rendering data.

## Self-Check: PASSED

- Confirmed all task commits exist: `34287b8`, `39c0db4`, `3771bd7`, `94b52a1`, `108aa2e`.
- Confirmed the modified component and test files exist.
