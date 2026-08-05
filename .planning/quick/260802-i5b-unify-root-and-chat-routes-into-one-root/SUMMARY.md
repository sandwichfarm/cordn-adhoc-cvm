---
phase: quick-260802-i5b
plan: "01"
subsystem: workspace-ui
tags: [svelte, playwright, routing, identity, reachability, room-actions]
provides:
  - One canonical root workspace for hosted, joined, cached, and invite-driven rooms
  - Identity-ready invite autojoin without anonymous or NIP-07 chooser flashes
  - Heartbeat-backed coordinator reachability and stable server switching
  - Exact composite Leave/Delete actions and edge-to-edge embedded chat layout
tech-stack:
  added: []
  patterns: [root URL intent canonicalization, embedded chat context, coordinator heartbeat probing]
key-files:
  created: [src/navigation/workspace-route.ts, src/chat/chat-pane-context.ts]
  modified: [src/App.svelte, src/components/HostWorkspace.svelte, src/components/ChatRoute.svelte, src/components/WorkspaceNav.svelte, src/identity/user-profile.svelte.ts, src/coordinator/single-instance-guard.ts]
status: complete
completed: 2026-08-02
---

# Quick Task 260802-i5b: Unified root workspace summary

The app now uses the root operator workspace as its only visible GUI. Legacy and invite chat paths are captured as internal intent, canonicalized to `/`, and opened in the same shell with the sidebar and host controls intact.

## Accomplishments

- Moved route ownership to `App.svelte`, preserving deep-link state while eliminating the standalone chat/lobby render split.
- Serialized identity restoration before invite joining; anonymous is treated as a valid identity and restored NIP-07 is stable-public-key bound.
- Embedded remote and cached chat bodies into the host content pane and forced the route plus cached surface to fill that pane edge-to-edge at every viewport.
- Restored the unified `More room actions` menu with sound control and exact Leave/Delete behavior backed by composite `{ coordinatorPubkey, roomId }` targeting.
- Fixed coordinator switching so a selected server is not reset by the still-open room route.
- Replaced origin/category-colored status dots with semantic heartbeat-backed `online`, `connecting`, `offline`, and `unknown` states. Successful room sync is immediate positive evidence; room failure triggers verification rather than falsely declaring the coordinator offline.
- Added periodic, lifecycle-aware reachability probing without opening new probes on every room persistence event; offline-to-online recovery emits the existing badge/tone event.
- Made running/stopped Nostr heartbeat timestamps monotonic and awaited the stopped publication so same-second replacement ordering cannot leave stale online state.

## Verification

- PASS — `pnpm lint`
- PASS — `pnpm test` (21 files, 147 tests)
- PASS — `pnpm build`
- PASS — `tests/e2e/nip07-session-restoration.spec.ts` (2 tests)
- PASS — `tests/e2e/stale-local-sessions.spec.ts` (2 tests)
- PASS — targeted room-action, full-width, server-switching, startup, and online/offline/recovery Playwright scenarios (8 tests)
- PASS — full Playwright suite (37/37 scenarios)

## Notes

- No dependency or lockfile changes were introduced.
- No commits or staging were performed because the checkout already contained overlapping uncommitted work.
