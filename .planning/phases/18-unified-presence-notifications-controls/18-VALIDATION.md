---
phase: 18
slug: unified-presence-notifications-controls
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-03
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + Playwright 1.61.0 |
| **Config file** | `vite.config.ts`; `playwright.config.ts` |
| **Quick run command** | `pnpm test -- tests/unit/notification-center.test.ts tests/unit/nostr-invites.test.ts tests/unit/config-store.test.ts` |
| **Full suite command** | `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check` |
| **Estimated runtime** | ~240 seconds |

## Sampling Rate

- **After every task commit:** Run the focused Vitest file or Playwright case named by that task.
- **After every plan wave:** Run `pnpm lint && pnpm exec tsc --noEmit && pnpm test`.
- **Before phase verification:** The full suite must be green.
- **Max feedback latency:** 240 seconds.

## Requirement Verification Map

| Requirement | Secure behavior | Test type | Automated command | Existing seam | Status |
|-------------|-----------------|-----------|-------------------|---------------|--------|
| PRES-01 | Presence selection persists for every identity and never calls coordinator lifecycle methods. | unit + integration | `pnpm test -- tests/unit/config-store.test.ts && pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g "presence"` | extend | ⬜ pending |
| PRES-02 | Avatar control exposes the selected presence textually; color is never the sole signal. | integration | `pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g "presence"` | extend | ⬜ pending |
| INVITE-01 | Only trusted live invites are actionable; read and resolve remain distinct; no URL or token is persisted. | unit + integration | `pnpm test -- tests/unit/nostr-invites.test.ts && pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g "notification.*invite|invite.*notification"` | extend | ⬜ pending |
| SHELL-01 | One personal cluster and one host cluster remain keyboard-reachable without duplicate controls; at compact widths `Open host tools` is the single entry and the drawer orders PERSONAL before HOST. | integration | `pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g "personal controls|host controls|compact"` | extend | ⬜ pending |
| SHELL-02 | Sidebar-originated floating surfaces use the browser top layer, stay within viewport gutters, and return focus. | unit + integration | `pnpm test -- tests/unit/viewport-overlay.test.ts && pnpm exec playwright test tests/e2e/identity-ui-review.spec.ts tests/e2e/workspace-lifecycle.spec.ts -g "viewport|Notification settings|room actions"` | added | ✅ green |
| NOTF-01 | Opening labelled settings never requests permission; validated preferences survive reload. | unit + integration | `pnpm test -- tests/unit/notification-center.test.ts && pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g "Notification settings"` | extend | ⬜ pending |
| NOTF-02 | Feed records events independently of desktop permission, maintains unread state, bounds non-actionable history, and preserves pending invites. | unit + integration | `pnpm test -- tests/unit/notification-center.test.ts tests/unit/nostr-invites.test.ts && pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g "notification feed"` | extend | ⬜ pending |
| NOTF-03 | Only the explicit CTA requests permission; desktop projection preserves the existing 5/15/30/60-second (`5_000`/`15_000`/`30_000`/`60_000` ms) cadence values and remains grouped/de-duplicated. | unit + integration | `pnpm test -- tests/unit/notification-center.test.ts && pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g "desktop notifications"` | extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [ ] Extend `tests/unit/notification-center.test.ts` with feed-first recording, read/unread, bounded persistence, migration, category gating, exact preservation of `5_000`/`15_000`/`30_000`/`60_000` ms cadence choices, cadence grouping, and event-key de-duplication.
- [ ] Extend `tests/unit/nostr-invites.test.ts` with resolved-ID validation/pruning, relay replay suppression, read-versus-resolve, and proof that URLs/tokens are never serialized.
- [ ] Extend `tests/unit/config-store.test.ts` only as needed to preserve validated `online`/`invisible`/`offline` persistence while removing lifecycle coupling.
- [ ] Extend `tests/e2e/workspace-lifecycle.spec.ts` with profile-owned presence, accessible avatar status, personal/host control ownership, separate settings/feed, explicit permission, exact second-based cadence reload behavior, actionable invites, and compact single-entry drawer order/bounds/names.

## Plan Task Mapping

| Plan task | Requirements | Automated evidence created or extended |
|-----------|--------------|----------------------------------------|
| 18-01 Task 1 | NOTF-02, NOTF-03 | `tests/unit/notification-center.test.ts`: feed-first ingestion, safe persistence migration, unread/read, grouping, capacity, cadence, category defaults, and desktop dedupe |
| 18-01 Task 2 | INVITE-01, NOTF-02, NOTF-03 | `tests/unit/nostr-invites.test.ts` plus notification-center coverage: producer migration, seven-day resolution pruning, replay suppression, and absence of persisted capability data |
| 18-02 Task 1 | INVITE-01, NOTF-02 | `tests/e2e/workspace-lifecycle.spec.ts`: bell feed, rendered-read behavior, same-shell accept, confirmed dismiss, compact focus and sheet behavior |
| 18-02 Task 2 | NOTF-01, NOTF-03 | `tests/unit/notification-center.test.ts` and `tests/e2e/workspace-lifecycle.spec.ts`: exact settings label, zero prompt on open, explicit permission CTA, preservation of `5_000`/`15_000`/`30_000`/`60_000` ms across close/reload, category persistence, compact settings sheet |
| 18-03 Task 1 | PRES-01, PRES-02 | `tests/unit/config-store.test.ts` and `tests/e2e/identity-ui-review.spec.ts`: durable profile presence, signer-optional behavior, avatar status, and zero lifecycle mutation |
| 18-03 Task 2 | SHELL-01 | `tests/e2e/workspace-lifecycle.spec.ts`: host-admin badge ownership, save/preview behavior, personal-profile absence, remote mutation absence |
| 18-03 Task 3 | SHELL-01, NOTF-01, NOTF-02 | `tests/e2e/workspace-lifecycle.spec.ts`: desktop/intermediate ownership, compact `Open host tools` single-entry count, PERSONAL-before-HOST drawer order, duplicate-control counts, drawer/sheet accessibility, overflow/style/reduced-motion checks |
| 18-04 Tasks 1–3 | SHELL-02 | `tests/unit/viewport-overlay.test.ts`, `tests/e2e/identity-ui-review.spec.ts`, and `tests/e2e/workspace-lifecycle.spec.ts`: top-layer ownership, collision-aware placement, compact sheets, viewport bounds, and focus-safe close behavior |

## Manual-Only Verifications

All Phase 18 requirements must have automated evidence. Native operating-system notification chrome is not asserted; the browser API invocation, grouping payload, permission gate, and click-routing behavior are asserted through the existing mock.

## Validation Sign-Off

- [x] Every requirement has an automated command and an existing test seam.
- [x] Sampling continuity forbids three consecutive tasks without automated verification.
- [x] No watch-mode flags.
- [x] Feedback latency is bounded at 240 seconds.
- [x] `nyquist_compliant: true` is set in frontmatter.
- [x] Planner maps every implementation task to one or more rows above.
- [ ] Wave 0 coverage is implemented and green.

**Approval:** draft — implementation plan and test extensions pending.
