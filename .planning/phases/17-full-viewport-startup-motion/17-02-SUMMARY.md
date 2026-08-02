---
phase: 17-full-viewport-startup-motion
plan: "02"
subsystem: ui
tags: [svelte, gsap, css-masking, playwright, vitest, accessibility]
requires:
  - phase: 17-full-viewport-startup-motion
    provides: pane-scoped startup stage, typed presentation projection, and shell-accessibility boundary
provides:
  - Exactly one full-pane ASCII bed and three GSAP-driven true mask reveals
  - Recovery-state targets that retain completed work through retry and settle on exhaustion
  - Static reduced-motion output with scoped cleanup across repeated startup cycles
affects: [startup-motion, workspace-shell, phase-18]
tech-stack:
  added: []
  patterns: [field-scoped GSAP context, matchMedia cleanup, immutable recovery projection, rendered ASCII content-extent checks]
key-files:
  created: []
  modified:
    - src/components/StartupSignalField.svelte
    - src/components/HostWorkspace.svelte
    - tests/unit/startup-signal-presentation.test.ts
    - tests/e2e/workspace-lifecycle.spec.ts
key-decisions:
  - "Use a single field-scoped GSAP context and media owner so progress targets cannot own recovery state or leak across remounts."
  - "Keep only masked ASCII rings; remove the independent circular glow so no visual ring can be mistaken for a border-based fallback."
  - "Use a 512x256 deterministic texture and rendered line/height assertions so content, not merely wrappers, reaches wide-pane edges."
patterns-established:
  - "Decorative startup motion exposes data attributes for state and media preference while semantic progress remains in HostWorkspace."
  - "Reduced motion may update truthful stable targets immediately, but its transforms remain static."
requirements-completed: [MOTION-02, MOTION-03]
coverage:
  - id: D1
    description: "One deterministic ASCII bed and exactly three standard/WebKit radial-mask ASCII reveals without border, outline, SVG, or circle substitutes."
    requirement: MOTION-02
    verification:
      - kind: e2e
        ref: "tests/e2e/workspace-lifecycle.spec.ts#startup uses exactly three masked ASCII reveals"
        status: pass
    human_judgment: false
  - id: D2
    description: "Progress-aware GSAP motion preserves retry/exhaustion truth, is static under reduced motion, and cleans up across repeated cycles."
    requirement: MOTION-03
    verification:
      - kind: unit
        ref: "tests/unit/startup-signal-presentation.test.ts#keeps transport and restored-room targets forward-only across an interrupted sequence"
        status: pass
      - kind: e2e
        ref: "tests/e2e/workspace-lifecycle.spec.ts#startup signal follows retry and exhaustion truth"
        status: pass
      - kind: e2e
        ref: "tests/e2e/workspace-lifecycle.spec.ts#startup reduced motion stays static and readable"
        status: pass
      - kind: e2e
        ref: "tests/e2e/workspace-lifecycle.spec.ts#startup motion cleans up across repeated recovery cycles"
        status: pass
    human_judgment: false
metrics:
  duration: 12min
  completed: 2026-08-02
  tasks_completed: 2
  files_changed: 4
status: complete
---

# Phase 17 Plan 02: Full-Viewport Startup Motion Summary

**Pane-scoped recovery motion now combines one full ASCII bed with three true GSAP-driven masks, retaining truthful retry/exhaustion semantics and a static reduced-motion composition.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-02T23:13:58Z
- **Completed:** 2026-08-02T23:25:27Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Kept a single deterministic edge-to-edge ASCII bed and exactly three radial-gradient mask layers, with both standard and WebKit mask verification.
- Drove field energy, mask position, phase color, transforms, and ambient speed from immutable recovery presentation truth; retry retains progress and exhaustion settles without false completion.
- Added media-aware cleanup and static reduced motion while retaining the semantic panel, recovery actions, immediate handoff, and usable global shell.

## Task Commits

1. **Task 1: Drive exactly three true ASCII masks from monotonic recovery truth** — `d6019d0` (RED tests), `3c850e8` (implementation)
2. **Task 2: Keep reduced motion static and clean up every repeated startup cycle** — `d842136` (RED tests), `8a81fde` (implementation)
3. **Additional motion evidence** — `0921682` (normal-motion compositor drift assertion)

## Files Created/Modified

- `src/components/StartupSignalField.svelte` — owns the three masked ASCII planes, state-responsive GSAP targets, media preference branch, and cleanup.
- `src/components/HostWorkspace.svelte` — keeps the progress value amber only during automatic retry without moving semantic authority.
- `tests/unit/startup-signal-presentation.test.ts` — proves forward-only interrupted transport/recovery projection.
- `tests/e2e/workspace-lifecycle.spec.ts` — proves masks, rendered texture extent, recovery truth, reduced-motion stability, normal drift, and repeated cleanup.

## Decisions Made

- Keep animation presentation field-local and immutable; Phase 16 remains the sole recovery, retry, deletion, and readiness owner.
- Use explicit media preference and motion-state attributes for browser evidence without creating animation-owned UI semantics.
- Preserve the content-pane-only stage boundary; header and rail remain visible, interactive, and outside animation ownership.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended deterministic ASCII content across wide panes**
- **Found during:** Task 1
- **Issue:** The field wrapper reached the pane right edge, but finite 210-column preformatted rows visibly ended early on wide content panes.
- **Fix:** Increased the deterministic texture to 512x256 and added rendered first-line extent plus height coverage in the pane helper.
- **Files modified:** `src/components/StartupSignalField.svelte`, `tests/e2e/workspace-lifecycle.spec.ts`
- **Verification:** `startup covers every supported content pane` passed within the nine-test startup browser suite.
- **Committed in:** `8438b1d`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Necessary visual-content correction; pane geometry, shell access, and recovery ownership stayed unchanged.

## Issues Encountered

- A stale Playwright preview process initially served an old build and occupied the mock relay port. After stopping only that orphaned process, all focused and full startup checks passed on a fresh build.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 17 now has complete automated evidence for its pane-scoped startup composition. Phase 18 may build on the preserved shell without altering startup recovery ownership.

## Self-Check: PASSED

- Required source and test files exist.
- Commits `8438b1d`, `d6019d0`, `3c850e8`, `d842136`, `8a81fde`, and `0921682` exist in repository history.

---
*Phase: 17-full-viewport-startup-motion*
*Completed: 2026-08-02*
