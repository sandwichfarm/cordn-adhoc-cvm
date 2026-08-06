---
phase: 18-unified-presence-notifications-controls
plan: "04"
status: complete
requirements: [SHELL-02]
completed: 2026-08-06
---

# Plan 18-04 Summary

Implemented one browser top-layer overlay action for sidebar-originated floating UI. Profile, presence, notification feed/settings, and room-action surfaces now use fixed viewport positioning, collision-aware flipping, compact bottom-sheet behavior, scroll/resize repositioning, and focus return without being clipped by the sidebar.

Evidence:

- `tests/unit/viewport-overlay.test.ts` verifies deterministic placement, viewport gutters, flipping, and compact behavior.
- Playwright verifies every migrated surface is in the browser top layer and remains within desktop, narrow, and short viewport bounds.
- `pnpm test:e2e`: 94 passed.

