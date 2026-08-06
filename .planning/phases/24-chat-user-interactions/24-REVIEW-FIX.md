---
phase: 24-chat-user-interactions
fixed_at: 2026-08-06T20:37:05Z
review_path: .planning/phases/24-chat-user-interactions/24-REVIEW.md
iteration: 4
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-08-06T20:37:05Z
**Source review:** `.planning/phases/24-chat-user-interactions/24-REVIEW.md`
**Iteration:** 4

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Forced “above” placement defeats the required vertical flip

**Files modified:** `src/components/MessageGroup.svelte`, `src/lib/viewport-overlay.ts`, `tests/e2e/chat-user-interactions.spec.ts`
**Commit:** `0bd7f15`
**Applied fix:** Removed the force-preferred-side option so participant surfaces use the normal vertical flip algorithm again. The unit test explicitly proves below-side selection when above space is insufficient; browser coverage verifies containment and keyboard movement between participant controls without asserting a viewport-dependent side.

### WR-02: Successful invite dispatch no longer returns focus to its author trigger

**Files modified:** `src/components/MessageGroup.svelte`
**Commit:** `0bd7f15`
**Applied fix:** Successful invites now use the normal surface close path, which restores focus to the originating author trigger after the chooser unmounts.

### WR-03: Expanded browser suite still does not prove successful targeted dispatch or authenticated follow UI

**Files modified:** `src/App.svelte`, `src/components/MessageGroupTestHarness.svelte`, `tests/e2e/chat-user-interactions.spec.ts`
**Commits:** `91c1b5f`, `24e8650`
**Applied fix:** Added a controllable browser harness that injects invite and authenticated-follow callbacks only in `VITE_E2E=1` builds. The Playwright preview build enables that flag; ordinary production builds tree-shake the harness (verified by checking that its markers are absent from `dist`). The fixture runs in both host and guest modes, records the exact one-recipient invite callback argument, holds pending UI until explicit settlement, then proves invite success/focus restoration, invite error, follow success, and the generic retry error.

---

_Fixed: 2026-08-06T20:37:05Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 4_
