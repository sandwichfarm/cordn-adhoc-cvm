---
phase: 16-resilient-rooms-recovery
plan: 05
status: complete
completed: 2026-08-02
requirements:
  - ROOM-01
  - ROOM-03
---

# Plan 16-05 Summary

Unread state is now projected through stable composite room identities, acknowledged only by the exact visible readable room, and announced from one page-level owner. Opening or closing an unselected room menu preserves selection, URL, focus, and unread state; badges remain informational 16px spans outside the tab order.

Long coordinator room lists now remain contained and internally scrollable at desktop and compact widths. Extreme labels ellipsize without covering the adjacent action trigger, and the compact two-row operator topbar stays within the existing 100px height contract while retaining 44px controls.

## Verification

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- Focused Playwright unread/menu/layout suite — 4 passed
- Standalone long-navigation Playwright regression — 1 passed
- `git diff --check`

## Commits

- `4610c56` — `fix(16-05): harden unread and compact navigation`
