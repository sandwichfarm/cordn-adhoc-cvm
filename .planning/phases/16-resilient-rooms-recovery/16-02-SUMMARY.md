---
phase: 16-resilient-rooms-recovery
plan: 02
subsystem: ui
tags: [svelte, typescript, vitest, playwright, localstorage, unread-state]
requires:
  - phase: 16-01
    provides: composite room targets and exact sidebar action controls
provides:
  - validated composite-room unread ledger and receive-time classification
  - visible-room acknowledgement plus accessible room/coordinator badges
affects: [16-03, room-navigation, chat-recovery]
tech-stack:
  added: []
  patterns: [versioned optional localStorage metadata, metadata-only unread events, saturating unread aggregation]
key-files:
  created: []
  modified: [src/chat/room-store.ts, src/components/WorkspaceNav.svelte, src/components/HostWorkspace.svelte, src/components/ChatRoute.svelte, tests/unit/room-navigation.test.ts, tests/unit/room-session-concurrency.test.ts, tests/e2e/phase-one.spec.ts]
key-decisions:
  - "Unread state is keyed and cleared by the exact coordinator-public-key plus room-ID identity."
  - "Initial synchronization establishes a zero persisted baseline; only authenticated, new remote messages after it increment state."
  - "Announcement history is plain bookkeeping rather than Svelte render state to avoid reactive effect loops."
patterns-established:
  - "Use roomUnreadCount and coordinatorUnreadTotal for every badge projection; never derive unread from the DOM."
requirements-completed: [ROOM-03]
coverage:
  - id: D1
    description: Durable exact-room unread parsing, saturation, classification, and acknowledgement.
    requirement: ROOM-03
    verification:
      - kind: unit
        ref: tests/unit/room-navigation.test.ts and tests/unit/room-session-concurrency.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Accessible room and coordinator badge lifecycle without reload page errors.
    requirement: ROOM-03
    verification:
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep 'unread badge lifecycle|same-id sidebar removal' --workers=1"
        status: pass
    human_judgment: false
duration: 36min
completed: 2026-08-02
status: complete
---

# Phase 16 Plan 02: Durable Unread State and Accessible Badges Summary

**Versioned composite-room unread accounting counts only qualifying remote receives and projects safe, accessible room and coordinator totals.**

## Performance

- **Duration:** 36 min
- **Completed:** 2026-08-02
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Added validated optional `RoomReadState`, exact acknowledgement, safe saturation, and metadata-only unread events to the existing persisted room/session path.
- Counted only authenticated, deduplicated remote messages after initial hydration; own sends, pending echoes, reactions, aliases, and duplicates leave unread unchanged.
- Added nonzero-only 1–99/99+ badges and exact accessible totals across host and room-switcher surfaces, with bounded zero-to-unread announcements.
- Cleared only the exact visible readable conversation, including standalone and embedded chat routes.

## Task Commits

1. **Task 1 RED: unread state coverage** — `24b74dc` (test)
2. **Task 1: durable receive-time unread state** — `f3f117a` (feat)
3. **Task 2: badges, totals, announcements, and route acknowledgement** — `dcd8fd2` (feat)
4. **Task 2 lint correction** — `9d005cf` (fix)
5. **Task 2 reactive announcement correction and E2E proof** — `b1de3eb` (fix)

## Files Created/Modified

- `src/chat/room-store.ts` — validated read ledger, safe arithmetic, unread event, and exact read methods.
- `src/components/HostWorkspace.svelte` — primary rail badges, totals, live announcement, and visible host acknowledgement.
- `src/components/WorkspaceNav.svelte` — switcher badge projection, aggregation, and one-shot announcement state.
- `src/components/ChatRoute.svelte` — exact visible standalone/embedded acknowledgement.
- `tests/unit/room-navigation.test.ts` and `tests/unit/room-session-concurrency.test.ts` — persistence, identity, receive, duplicate, and saturation coverage.
- `tests/e2e/phase-one.spec.ts` — unread badge totals, page-error guard, and same-ID sidebar reload coverage.

## Decisions Made

- Kept read state optional and strictly discarded malformed metadata so legacy cached rooms remain readable.
- Reused the existing authenticated append/dedup gate rather than adding a parallel delivery index.
- Used non-reactive previous-count bookkeeping for live announcements so render reactivity cannot loop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed reactive announcement bookkeeping loop**
- **Found during:** Task 2 browser verification
- **Issue:** Assigning a `$state` map inside the effect that read it caused `effect_update_depth_exceeded` after persisted rooms loaded.
- **Fix:** Retained the previous count map as plain local bookkeeping and added a browser `pageerror` assertion.
- **Files modified:** `src/components/WorkspaceNav.svelte`, `tests/e2e/phase-one.spec.ts`
- **Verification:** focused one-worker browser suite passed 2/2.
- **Committed in:** `b1de3eb`

**Total deviations:** 1 auto-fixed (Rule 1)

## Verification

- `pnpm lint` — passed
- `pnpm exec tsc --noEmit` — passed
- `pnpm test` — passed (21 files, 183 tests)
- Focused Playwright unread/same-ID suite — passed (2 tests)
- `pnpm build` — passed
- `git diff --check` — passed

## Issues Encountered

- `state.advance-plan` could not parse the legacy Current Plan/Total Plans format in `STATE.md`. The remaining SDK state updates, roadmap progress, requirement completion, metrics, decisions, and session record all succeeded.

## Self-Check: PASSED

- Confirmed all seven listed implementation/test files exist.
- Confirmed commits `24b74dc`, `f3f117a`, `dcd8fd2`, `9d005cf`, and `b1de3eb` exist in git history.

## Next Phase Readiness

Phase 16-03 can rely on durable composite room identity and unread state without altering receive, selection, or persistence contracts.
