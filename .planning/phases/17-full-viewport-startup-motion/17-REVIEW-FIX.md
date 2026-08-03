---
phase: 17-full-viewport-startup-motion
fixed_at: 2026-08-02T23:49:23Z
updated_at: 2026-08-03T01:04:32Z
review_path: .planning/phases/17-full-viewport-startup-motion/17-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-08-02T23:49:23Z
**Source review:** `.planning/phases/17-full-viewport-startup-motion/17-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Exhausted, stopping, and handoff fields continue an infinite ambient animation

**Files modified:** `src/components/StartupSignalField.svelte`, `src/components/startup-signal-presentation.ts`, `tests/unit/startup-signal-presentation.test.ts`, `tests/e2e/workspace-lifecycle.spec.ts`
**Commits:** `9f3f7bd`, `a2839ee`
**Applied fix:** Terminal recovery, stopping, and running-room-handoff signals now destroy the field-scoped ambient animation, settle through one-off GSAP targets, and resume a fresh ambient timeline only for active work. Browser coverage confirms exhausted transforms remain static; unit coverage identifies the resting coordinator states. **Requires human verification** of the final motion feel.

### WR-02: Retry state applies the reserved amber color to the ASCII field

**Files modified:** `src/components/StartupSignalField.svelte`, `tests/e2e/workspace-lifecycle.spec.ts`
**Commits:** `9f3f7bd`, `f88d6c2`
**Applied fix:** Retry leaves all three masked ASCII rings on their green palette. The browser test asserts their computed colors while retrying; amber remains restricted to the existing progress value rule.

### WR-03: The obsolete viewport-ownership test was retained under its old semantic name

**Files modified:** `tests/e2e/workspace-lifecycle.spec.ts`
**Commit:** `6ae3948`
**Applied fix:** Renamed `expectViewportOwned` and every call site to `expectNoDocumentOverflow`, preserving its strict document-dimension assertions alongside the existing content-pane bounds helper.

---

_Fixed: 2026-08-02T23:49:23Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_

## Iteration 2: Verification-Gap Closure

**Source diagnosis:** `.planning/debug/phase17-verification-gaps.md`
**Files modified:** `src/components/StartupSignalField.svelte`, `tests/e2e/workspace-lifecycle.spec.ts`
**Commit:** `11cba11`
**Applied fix:** Initialized the GSAP context binding before `matchMedia` callbacks can synchronously invoke a settled update, while explicitly destroying any ambient timeline before terminal settling. Reduced motion now applies a canonical ring-plane transform and immutable decorative energy, colour, and mask values; coordinator-owned status and progress remain outside the field.
**Regression proof:** The reduced-motion assertion now samples transform plus decorative variables. The normal-motion repeated-cycle test asserts that the first room mount is page-error-free before it exercises Stop/retry cleanup. Focused unit and four blocked Playwright scenarios passed, as did lint, strict TypeScript, and `git diff --check`.
