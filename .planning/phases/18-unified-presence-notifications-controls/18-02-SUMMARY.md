---
phase: 18-unified-presence-notifications-controls
plan: "02"
subsystem: notifications
tags: [svelte, notifications, accessibility, responsive-ui, invite-safety]
requires:
  - phase: 18-unified-presence-notifications-controls
    provides: feed-first durable notification ledger and invite resolution IDs
provides:
  - grouped in-app notification feed with safe trusted-invite handling
  - explicit desktop-notification settings and permission flow
  - keyboard-safe compact notification sheets
affects: [18-03, host-workspace, notification-controls]
tech-stack:
  added: []
  patterns:
    - notification feed and desktop preferences use separate entry points
    - live invite capabilities are looked up only at action time
    - compact dialogs retain focus and prevent parent-drawer Escape handling
key-files:
  created:
    - src/components/NotificationFeed.svelte
  modified:
    - src/components/NotificationCenter.svelte
    - src/components/HostWorkspace.svelte
    - tests/e2e/workspace-lifecycle.spec.ts
  deleted:
    - src/components/InviteInbox.svelte
key-decisions:
  - "Opening the notification feed marks its currently visible items as read without resolving invitations."
  - "Desktop-notification permission is requested only from the explicit Enable desktop notifications control."
  - "Invitation actions require a live trusted capability; persisted feed history alone can never reconstruct an invite URL."
requirements-completed: [NOTF-01, NOTF-02, NOTF-03, INVITE-01]
coverage:
  - id: D1
    description: Notification history is grouped, marks visible entries read, and keeps expired invitations safely unavailable.
    requirement: NOTF-02
    verification:
      - kind: e2e
        ref: tests/e2e/workspace-lifecycle.spec.ts#notification-feed-accepts-trusted-invite-only-from-live-state
        status: pass
    human_judgment: false
  - id: D2
    description: Opening settings is passive and browser permission is prompted only by the explicit desktop-notification CTA.
    requirement: NOTF-01
    verification:
      - kind: e2e
        ref: tests/e2e/workspace-lifecycle.spec.ts#notification-settings-keeps-permission-explicit-and-persists-grouped-notification-preferences
        status: pass
    human_judgment: false
  - id: D3
    description: Feed and settings sheets stay keyboard-safe and inside the compact viewport.
    requirement: NOTF-01
    verification:
      - kind: e2e
        ref: tests/e2e/workspace-lifecycle.spec.ts#compact-notification-feed-and-notification-settings-stay-viewport-bound
        status: pass
    human_judgment: true
duration: 10min
completed: 2026-08-03
status: complete
---

# Phase 18 Plan 02: Notification Feed and Settings Summary

**CAHMLS now separates durable in-app activity from opt-in desktop delivery, with grouped feed history, safe invitation actions, and compact keyboard-safe controls.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-03T06:09:17Z
- **Completed:** 2026-08-03T06:18:37Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Added a persistent, accessible `Clear all` feed action that resets history and unread state without accepting, dismissing, or resolving live invitations (NOTF-05).

- Replaced the invite inbox with a bell feed that groups Now, Today, and Earlier activity, shows an unread badge, and marks only visible entries read when opened.
- Kept invitation capabilities in live memory: stale feed entries are informative but cannot fabricate a redeemable invite, while trusted live entries can use the existing root-shell redemption route.
- Added inline dismissal confirmation without revealing invite data, and preserve seven-day resolution replay protection from the notification store.
- Moved desktop preferences behind a distinct `Notification settings` control; opening it synchronizes permission state without prompting, while one explicit `Enable desktop notifications` button owns the browser request.
- Made both notification surfaces accessible dialogs with focus return, Tab trapping, Escape/backdrop behavior, and bottom-sheet layout at compact widths.

## Task Commits

1. **Task 1: Build the grouped notification feed and migrate invitation actions**
   - `fe907b9` `test(18-02): specify notification feed and settings boundaries`
   - `91a09b0` `feat(18-02): add grouped notification feed`
2. **Task 2: Make desktop permission explicit and compact controls reliable**
   - `265dcb9` `feat(18-02): separate notification settings from feed`
3. **Post-wave quality gate: Preserve reactive notification grouping**
   - `fc2d392` `fix(18-02): use reactive notification grouping date`

## Files Created/Modified

- `src/components/NotificationFeed.svelte` — bell control, grouped feed, live invitation accept/dismiss flow, and compact dialog treatment.
- `src/components/NotificationCenter.svelte` — passive settings opener, sole explicit permission CTA, categories, cadence, and focus handling.
- `src/components/HostWorkspace.svelte` — compact utility layout that prevents controls from overlaying one another.
- `tests/e2e/workspace-lifecycle.spec.ts` — explicit permission, feed safety, and viewport/focus regression coverage.
- `src/components/InviteInbox.svelte` — removed after its responsibility moved into the feed.

## Decisions Made

- Keep in-app notification history available regardless of browser-notification permission.
- Read state is a feed concern; handling an invitation remains an explicit action with its own irreversible confirmation.
- Let the live social store supply the capability at accept time, so persisted history never stores or reconstructs invite material.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stopped compact dialog Escape from closing the host utility drawer.**
- **Found during:** Task 2 compact interaction verification.
- **Issue:** Escape bubbled from a notification dialog to the parent workspace handler, which hid the utility drawer and prevented focus from returning to the original control.
- **Fix:** Contained Escape within each dialog and restored focus to its trigger or retained invitation action.
- **Files modified:** `src/components/NotificationFeed.svelte`, `src/components/NotificationCenter.svelte`
- **Verification:** Compact Playwright coverage passes.
- **Committed in:** `265dcb9`

**2. [Rule 1 - Bug] Prevented compact utility controls from intercepting the notification bell.**
- **Found during:** Task 2 compact interaction verification.
- **Issue:** The prior multi-column mobile utility grid let the expanded settings trigger overlap the feed trigger.
- **Fix:** Use a single-column compact utility stack with full-width controls.
- **Files modified:** `src/components/HostWorkspace.svelte`
- **Verification:** Compact Playwright coverage passes.
- **Committed in:** `265dcb9`

**3. [Rule 1 - Bug] Used Svelte's reactive date implementation for feed grouping.**
- **Found during:** Post-wave lint gate.
- **Issue:** A mutable native `Date` in the notification grouping path violates the Svelte reactivity lint rule.
- **Fix:** Replaced the grouping boundary with `SvelteDate`, preserving the same local-midnight grouping semantics.
- **Files modified:** `src/components/NotificationFeed.svelte`
- **Verification:** Full lint, type, unit, build, and diff gates pass.
- **Committed in:** `fc2d392`

---

**Total deviations:** 3 auto-fixed Rule 1 interaction bugs. No scope expansion.

## Verification

- `pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g "notification feed|Notification settings|notification permission" --workers=1` — pass (3 tests)
- `pnpm exec vitest run tests/unit/notification-center.test.ts tests/unit/nostr-invites.test.ts` — pass (14 tests)
- `pnpm exec tsc --noEmit` — pass
- `git diff --check` — pass
- `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build && git diff --check` — pass (22 files, 212 tests)

## Known Stubs

None.

## User Setup Required

None — browser permission is requested only when the user chooses to enable desktop notifications.

## Next Phase Readiness

Plan 18-03 can place the unified controls in their final utility stack knowing notification history, permission, focus, and trusted invite behavior are separately owned and covered.

## Self-Check: PASSED

- `src/components/NotificationFeed.svelte` exists and `src/components/InviteInbox.svelte` is absent.
- Task commits `fe907b9`, `91a09b0`, `265dcb9`, and `fc2d392` exist.
- Focused browser, unit, TypeScript, and diff verification pass.

---
*Phase: 18-unified-presence-notifications-controls*
*Completed: 2026-08-03*
