---
quick_id: 260802-jj8
status: complete
completed: 2026-08-02
subsystem: encrypted-chat
tags: [mls, reactions, svelte, accessibility]
dependencies:
  requires: [existing-chat-envelope, room-message-cursor]
  provides: [authenticated-reactions, canonical-emoji-shortcuts]
  affects: [host-workspace, guest-chat-route]
tech_stack:
  added: []
  patterns: [signed-MLS-envelope-extension, bounded-reaction-projection]
key_files:
  modified:
    - src/chat/protocol.ts
    - src/chat/room-store.ts
    - src/components/HostWorkspace.svelte
    - src/components/ChatRoute.svelte
    - src/components/RoomActionsMenu.svelte
    - src/components/WorkspaceNav.svelte
    - tests/unit/chat-protocol.test.ts
    - tests/e2e/phase-one.spec.ts
    - tests/e2e/stale-local-sessions.spec.ts
decisions:
  - Reactions remain type=message envelopes with a human-readable fallback so legacy peers advance MLS state.
  - The projection stores only latest participant/message/emoji state and never renders reaction envelopes as messages.
  - The pre-merge room-action popover now lives only in the active content pane; hosts delete and remote members leave through the existing confirmation path.
metrics:
  tasks_completed: 3
  commits: uncommitted (dirty shared checkout)
---

# Quick Task 260802-jj8: Participant emoji shortcuts and persistent message reactions Summary

Signed, MLS-encrypted reactions now synchronize through the existing room cursor and every active chat pane exposes canonical composer shortcuts plus accessible reaction controls.

## Completed Work

- Added canonical six-emoji exports and signature-bound reaction mutations, including forged-field rejection tests.
- Added bounded latest-state reaction projection, optimistic pending delivery, cursor confirmation, synchronization, and tolerant legacy cache hydration.
- Added host and guest add/toggle chips, keyboard-accessible pickers, offline-disabled mutation controls, and six always-visible composer shortcuts at every viewport width.
- Transplanted the polished pre-merge `Room actions / # room` popover to the content pane, including its subtle scrim, ON/OFF sound row, and exact Delete/Leave semantics; removed duplicate header actions.
- Enlarged the CAHMLS camel to span the wordmark and underline without increasing compact-header layout dimensions.

## Verification

- `pnpm vitest run tests/unit/chat-protocol.test.ts` — passed (2 tests)
- `pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "message reactions persist and synchronize"` — passed
- `pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "emoji shortcuts and offline cached reactions"` — passed
- `pnpm test` — passed (21 files, 148 tests)
- `pnpm test:e2e` — passed (39 Chromium scenarios)
- Contextual Delete/Leave and stale-session Playwright regressions — passed (6 scenarios)
- Six-viewport operator-shell overflow regression — passed with the enlarged camel
- `pnpm lint` — passed
- `pnpm build` — passed (existing dependency annotation/chunk-size warnings only)
- `git diff --check -- src/chat/protocol.ts src/chat/room-store.ts src/components/HostWorkspace.svelte src/components/ChatRoute.svelte tests/unit/chat-protocol.test.ts tests/e2e/phase-one.spec.ts` — passed

## Deviations from Plan

### Auto-fixed Issues

1. [Rule 1 - Bug] Stored reaction validation initially treated projection metadata as part of the exact wire mutation shape.
   - Fixed by validating the embedded target/emoji/active tuple separately while retaining strict metadata checks.

2. [Rule 2 - Missing functionality] Restored the requested active-chat-pane `More room actions` control after the route merge hid the global control in embedded views.
   - It uses the exact richer pre-merge popover styling, reuses existing delete/leave confirmation behavior, and removes the redundant header control.

## Commits

No commit created: `uncommitted (dirty shared checkout)` as required for the shared checkout.

## Self-Check: PASSED

All declared modified files and this summary exist; focused verification passed.
