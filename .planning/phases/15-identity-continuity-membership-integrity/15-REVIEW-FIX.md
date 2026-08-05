---
phase: 15
fixed_at: 2026-08-02T17:02:13Z
review_path: /Users/sandwich/Develop/cordn-adhoc-cvm/.planning/phases/15-identity-continuity-membership-integrity/15-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-08-02T17:02:13Z
**Source review:** `/Users/sandwich/Develop/cordn-adhoc-cvm/.planning/phases/15-identity-continuity-membership-integrity/15-REVIEW.md`
**Iteration:** 3

**Summary:**

- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### CR-01: Rotation has a crash window after room authority is destroyed

**Files modified:** `src/identity/user-profile.svelte.ts`, `tests/unit/user-profile.test.ts`, `tests/e2e/stale-local-sessions.spec.ts`
**Commit:** f0c678c
**Applied fix:** Persists and verifies the recovery marker before retiring sessions or room authority, and only clears it after a successful pre-boundary rollback. Corrupt-record recovery follows the same ordering. Added unit write-order coverage and browser reload coverage for a persisted marker before retirement.

### WR-01: Recovery can become permanently busy when candidate generation fails

**Files modified:** `src/identity/user-profile.svelte.ts`, `tests/unit/user-profile.test.ts`
**Commit:** d1bcaad
**Applied fix:** Moved replacement candidate generation inside the protected `try` block, made the candidate nullable, and made cleanup optional so `rotationInProgress` always clears in `finally`. Added a retry regression for a candidate-generation failure.

---

_Fixed: 2026-08-02T17:02:13Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
