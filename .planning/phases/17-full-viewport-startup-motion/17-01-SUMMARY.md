---
phase: 17-full-viewport-startup-motion
plan: "01"
subsystem: ui
tags: [svelte, gsap, playwright, vitest, startup-recovery]
requires:
  - phase: 16-resilient-rooms-recovery
    provides: coordinator recovery truth and actionable session handoff states
provides:
  - Pure, typed projection of startup coordinator state for visual consumers
  - Pointer-inert ASCII startup field scoped to the host-chat content pane
  - Desktop pane-boundary and shell-usability regression coverage
affects: [17-02, startup-motion, workspace-shell]
tech-stack:
  added: []
  patterns: [typed pure UI projector, absolute pane-scoped transient stage]
key-files:
  created:
    - src/components/startup-signal-presentation.ts
    - tests/unit/startup-signal-presentation.test.ts
  modified:
    - src/components/StartupSignalField.svelte
    - src/components/HostWorkspace.svelte
    - tests/e2e/workspace-lifecycle.spec.ts
key-decisions:
  - Startup fills only the positioned host-chat pane; the global header and rail remain usable.
  - The visual field consumes a typed read-only projection while the coordinator remains authoritative for progress and recovery.
requirements-completed: [MOTION-01, MOTION-03]
metrics:
  duration: 54m 21s
  completed: 2026-08-02
  tasks_completed: 2
  files_changed: 5
status: complete
---

# Phase 17 Plan 01: Content-Pane Startup Motion Summary

Coordinator startup now projects recovery progress into a pointer-inert ASCII field that fills only the workspace content pane while the surrounding shell stays usable.

## Accomplishments

- Added a pure `projectStartupSignal` mapper that passes through coordinator transport and recovery truth while mapping room progress to the field's 85–100% forward range.
- Reworked the startup stage so its absolute geometry belongs to `host-chat`, rather than to the browser viewport; header, rail, keyboard focus, and settings actions remain available.
- Added focused unit and browser coverage for progress projection, all supported desktop pane dimensions, non-interactive field masking, truthful recovery states, and action reachability through handoff.

## Task Commits

1. `155b877` — `feat(17-01): scope startup signal to workspace pane`
2. `bfb5b6c` — `test(17-01): cover startup pane recovery edges`

## Verification

- `pnpm test -- tests/unit/startup-signal-presentation.test.ts` — passed (22 files, 202 tests)
- `pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g 'startup fills the workspace content pane and keeps shell controls usable' --reporter=line` — passed
- `pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g 'startup covers every supported content pane|startup recovery states stay truthful|startup handoff keeps actions reachable' --reporter=line` — passed (4 tests)
- `pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g 'startup' --reporter=line` — passed (7 tests)
- `pnpm lint && pnpm exec tsc --noEmit && git diff --check` — passed

## Decisions Made

- Scope the transient startup overlay to the positioned `host-chat` content pane using `position: absolute; inset: 0; width: 100%; height: 100%`.
- Keep animation presentation read-only: it receives a typed signal projection and never owns coordinator state or recovery decisions.

## Deviations from Plan

None — the plan was executed as corrected. The interrupted viewport-owned implementation was adapted to the required content-pane boundary.

## Next Phase Readiness

Plan 17-02 can add motion detail on top of the established pane geometry and typed startup signal without changing shell accessibility or recovery ownership.

## Self-Check: PASSED

- Summary exists at the required phase path.
- Task commits `155b877` and `bfb5b6c` exist in repository history.
