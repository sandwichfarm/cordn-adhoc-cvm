---
phase: 17-full-viewport-startup-motion
reviewed: 2026-08-02T23:31:26Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - src/components/HostWorkspace.svelte
  - src/components/StartupSignalField.svelte
  - src/components/startup-signal-presentation.ts
  - tests/e2e/workspace-lifecycle.spec.ts
  - tests/unit/startup-signal-presentation.test.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-08-02T23:31:26Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The pane-stage geometry is correctly contained by `host-chat`; the checked startup suite passes its full-pane, shell-usability, ASCII-mask, and initial reduced-motion cases. The presentation projection remains read-only and the reviewed source introduces no direct injection or secret-exposure issue.

However, normal-motion terminal states do not satisfy the approved stable-composition behavior, retry leaks the reserved amber treatment from the progress value into the decorative field, and the browser suite retains a misleading viewport-ownership helper that the plan explicitly required removing. These gaps leave visual state behavior and future regression coverage unreliable.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Exhausted, stopping, and handoff fields continue an infinite ambient animation

**File:** `src/components/StartupSignalField.svelte:44-46, 97, 114-122`
**Issue:** `signalEnergy()` returns `0.32` for both `exhausted` and `resting`, and `updateTargets()` sets the infinite `ambient` timeline to that nonzero `timeScale`. The timeline created with `repeat: -1` therefore keeps transforming the bed and rings after exhaustion and while stopping/handoff is supposed to settle. This contradicts the required stable low-energy composition and can keep signaling recovery activity after recovery has terminally failed.

**Fix:** Explicitly pause or kill the ambient timeline for `nextSignal.recoveryState === "exhausted"` and `nextSignal.mode === "resting"`, then use `gsap.set()`/a one-off settling tween for final values. Resume or recreate the ambient timeline only when returning to an active non-terminal state. Add an E2E assertion that transforms remain unchanged over time in exhausted and stopping states, not only under reduced motion.

### WR-02: Retry state applies the reserved amber color to the ASCII field

**File:** `src/components/StartupSignalField.svelte:49-52, 71-77, 226-239`
**Issue:** In `retrying`, `signalColor()` returns `#e4e78d`, which is assigned to `--signal-phase-color` and colors the outer ASCII ring. The UI contract reserves that amber modulation for the progress value only; the field should remain a quiet decorative layer. This makes the recovery surface look like a broader warning/error treatment instead of the specified automatic-retry state.

**Fix:** Keep the field's phase color on its normal green palette during retry and apply the retry color solely through the existing `.startup-progress-value.retrying` rule in `HostWorkspace.svelte`. Add a computed-color browser assertion for a retrying field texture.

### WR-03: The obsolete viewport-ownership test was retained under its old semantic name

**File:** `tests/e2e/workspace-lifecycle.spec.ts:81-100, 2151`
**Issue:** `expectViewportOwned()` remains and is still invoked, although it only verifies that the document has no overflow. Its name asserts the opposite of the pane-scoped ownership contract and the Phase 17 plan explicitly required replacing the stale viewport-owned assertion. The actual pane-bounds helper is present, but this misleading helper makes future changes more likely to reintroduce a viewport takeover or misread document-scroll evidence as ownership evidence.

**Fix:** Rename it to `expectNoDocumentOverflow()` (or fold it into `expectStartupFillsHostPane()`), describe the no-scroll invariant accurately, and retain the pane-vs-stage bounds assertion as the ownership proof.

---

_Reviewed: 2026-08-02T23:31:26Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
