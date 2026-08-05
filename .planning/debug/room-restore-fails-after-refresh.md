---
status: resolved
trigger: "A valid hosted room cannot be opened after one refresh; startup recovery exhausts at 0/1."
created: 2026-08-03T18:36:30Z
updated: 2026-08-04T17:32:00Z
---

# Room restore fails after refresh

## Symptoms

- A hosted room works before refreshing the page.
- After one refresh and coordinator unlock/start, the startup screen reports `Couldn't restore` for that room.
- Recovery ends at `0/1`, leaving only retry/delete/settings actions instead of reopening the room.
- This flow worked before the recent startup and recovery changes.

## Reproduction

1. Create and use a hosted room under a persisted coordinator.
2. Refresh the page once.
3. Unlock and start the coordinator.
4. Observe hosted-room recovery exhaust before the room can reopen.

## Evidence

- Coordinator start requested at `19:35:10`.
- Single-instance guard acquired at `19:35:13`.
- Heartbeats publish successfully from `19:35:16` onward.
- Coordinator transport does not subscribe until `19:35:43`.
- The restore policy uses short per-attempt timeouts and can exhaust before that subscription exists.

## Root Cause

A locally hosted room used `ChatCoordinatorClient`, sending its recovery calls
out over public Nostr relays and back to the coordinator already running in the
same browser tab. A fresh empty room therefore depended on relay subscription,
delivery, and response latency merely to read its own empty message history.
Partial relay availability or a slow first subscription exhausted recovery and
misclassified a valid local room as failed.

The former four-second outer attempt budget made this coupling easier to hit,
but increasing timeouts could only make the failure slower; it could not make
same-tab state independent of external infrastructure.

## Fix

- Introduce a room-client operations boundary shared by network and local
  clients.
- Route only rooms hosted by the active same-tab coordinator through a direct
  `LocalHostCoordinatorClient` backed by the running `Coordinator` instance.
- Keep remote rooms and external Cordn clients on the canonical Nostr
  transport; the direct path does not alter public interoperability.
- Use the direct path for both newly opened hosted rooms and startup recovery.
- Retain staged outer recovery budgets for actual network-backed rooms.
- Log the internal failure for each attempt while keeping raw transport details
  out of the user-facing startup panel.

## Verification

- Same-tab conformance regression: a newly created room with no messages opens
  and recovers without constructing or contacting a relay client.
- Focused unit/conformance suite — 5 files, 63 tests passed.
- Focused browser recovery suite — 2 tests passed, including an empty hosted
  room surviving refresh while relay delivery is deliberately delayed.
- `pnpm lint` — passed.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm build` — passed (only existing third-party annotation and bundle-size
  warnings).
- `git diff --check` — passed.
