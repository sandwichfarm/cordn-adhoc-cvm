---
phase: 18-unified-presence-notifications-controls
plan: "01"
subsystem: notifications
tags: [svelte, notifications, browser-api, nostr, invite-safety]
requires:
  - phase: 16-resilient-rooms-recovery
    provides: room message and join-request notification producer seams
provides:
  - feed-first durable notification ledger with unread state
  - grouped optional browser-notification projection
  - seven-day invite-resolution replay suppression
affects: [18-02, 18-03, notification-feed, invitation-actions]
tech-stack:
  added: []
  patterns:
    - feed-first record-then-project notification flow
    - safe allowlisted browser persistence for notification metadata
    - invite capability kept in live memory while resolution IDs persist
key-files:
  created: []
  modified:
    - src/notifications/notification-center.svelte.ts
    - src/invites/nostr-social.svelte.ts
    - src/chat/room-store.ts
    - tests/unit/notification-center.test.ts
    - tests/unit/nostr-invites.test.ts
key-decisions:
  - "The in-app feed records every valid event before optional browser delivery is considered."
  - "Invitation resolution persists only a stable ID and timestamp for seven days; it never persists a URL or room secret."
patterns-established:
  - "Use notificationCenter.record() for every producer; enqueue() delegates only for compatibility."
  - "Read state is independent from invitation resolution and cannot dispose of an invitation."
requirements-completed: [NOTF-02, NOTF-03, INVITE-01]
coverage:
  - id: D1
    description: Durable feed entries are recorded, read, bounded, and safely rehydrated without browser permission.
    requirement: NOTF-02
    verification:
      - kind: unit
        ref: tests/unit/notification-center.test.ts#records safe feed activity even when desktop delivery is unavailable
        status: pass
    human_judgment: false
  - id: D2
    description: Browser delivery remains explicit, grouped on the established cadence, and deduplicated by category/key.
    requirement: NOTF-03
    verification:
      - kind: unit
        ref: tests/unit/notification-center.test.ts#upserts feed rows independently from desktop queue deduplication
        status: pass
    human_judgment: false
  - id: D3
    description: Trusted invite resolution is privacy-minimal and suppresses replay during the retention window.
    requirement: INVITE-01
    verification:
      - kind: unit
        ref: tests/unit/nostr-invites.test.ts#suppresses replay of a trusted invite already resolved inside retention
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-08-03
status: complete
---

# Phase 18 Plan 01: Feed-First Notifications Summary

**A safe, durable in-app notification ledger now captures every eligible event before optional grouped browser delivery, while handled room invites remain replay-safe without leaking capabilities.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-03T05:54:05Z
- **Completed:** 2026-08-03T06:01:19Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Made `notificationCenter.record()` the authoritative feed-first ingestion seam; desktop notifications are a permission/category/cadence-gated projection.
- Added validated, bounded feed persistence with unread/read state, category-key upsert, and protection for pending invitation entries.
- Routed room, join-request, online-contact, and trusted-invitation producers through the feed-first path.
- Persisted only invite resolution ID/timestamp, wrote it before live removal, and suppress replayed trusted invites for seven days.

## Task Commits

1. **Task 1: Prove one event from ingestion to durable feed and optional desktop projection**
   - `82cdad2` `test(18-01): add failing feed-first notification coverage`
   - `d144f84` `test(18-01): cover bounded safe notification history`
   - `5261460` `feat(18-01): make notification feed authoritative`
2. **Task 2: Migrate all producers and suppress resolved invitation replay**
   - `dd66ee7` `test(18-01): cover durable invite resolution`
   - `340405e` `feat(18-01): suppress resolved invite replays`
   - `c01f988` `fix(18-01): validate hydrated notification entries`
   - `445d2c4` `fix(18-01): use reactive notification dedupe sets`

## Files Created/Modified

- `src/notifications/notification-center.svelte.ts` — safe persisted feed, read state, resolution ledger, and optional browser queue.
- `src/invites/nostr-social.svelte.ts` — trusted ingress replay guard and resolution-before-removal.
- `src/chat/room-store.ts` — message and join-request producers now use feed-first recording.
- `tests/unit/notification-center.test.ts` — feed, persistence, retention, and browser projection coverage.
- `tests/unit/nostr-invites.test.ts` — live capability removal and replay suppression coverage.

## Decisions Made

- Treat in-app history as the canonical notification record; the Notification API is a best-effort projection.
- Keep invitation read state independent from resolution, and retain only an ID/timestamp after handling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the durable-storage assertion to inspect the specific feed payload.**
- **Found during:** Task 1
- **Issue:** Serializing the `Storage` host object does not serialize its stored values.
- **Fix:** Read the named feed key directly in the test.
- **Files modified:** `tests/unit/notification-center.test.ts`
- **Verification:** Focused notification tests pass.
- **Committed in:** `5261460`

**2. [Rule 2 - Missing critical functionality] Reject duplicate hydrated feed entries.**
- **Found during:** Task 2
- **Issue:** A malformed persisted payload could contain duplicate category/key records and defeat deterministic upsert history.
- **Fix:** Validate, sort, and retain only the newest safe record for each stable ID during hydration.
- **Files modified:** `src/notifications/notification-center.svelte.ts`, `tests/unit/notification-center.test.ts`
- **Verification:** Focused notification and invite tests pass.
- **Committed in:** `c01f988`

**3. [Rule 1 - Bug] Replaced mutable native sets in reactive notification paths.**
- **Found during:** Post-merge quality gate
- **Issue:** The Svelte lint rule rejects native mutable `Set` instances in state-sensitive feed read, hydration, and resolution de-duplication paths.
- **Fix:** Switched these collections to `SvelteSet` without changing their membership behavior.
- **Files modified:** `src/notifications/notification-center.svelte.ts`
- **Verification:** `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build && git diff --check` passes.
- **Committed in:** `445d2c4`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2). No scope expansion.

## Issues Encountered

None remaining.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plan 18-02 can render the bell feed and invitation actions against stable feed/read/resolution APIs without handling browser permission or secrets itself.

## Self-Check: PASSED

- All five modified files exist.
- Task commits `82cdad2`, `d144f84`, `5261460`, `dd66ee7`, `340405e`, `c01f988`, and `445d2c4` exist.
- Full lint, TypeScript, unit, build, and diff checks pass.

---
*Phase: 18-unified-presence-notifications-controls*
*Completed: 2026-08-03*
