---
phase: 16-resilient-rooms-recovery
verified: 2026-08-02T19:55:34Z
status: gaps_found
score: 12/32 must-haves verified
behavior_unverified: 14
overrides_applied: 0
gaps:
  - truth: "Successful removal selects the previous adjacent room, otherwise the next adjacent room or the documented empty state; removed rooms are no longer remembered."
    status: failed
    reason: "The active removal path selects the first remaining hosted room rather than an adjacent room, and removal does not remove the versioned composite last-open record."
    artifacts:
      - path: "src/components/HostWorkspace.svelte"
        issue: "Uses `remainingRooms[0]` at line 853 after filtering, with no target-index calculation."
      - path: "src/chat/room-store.ts"
        issue: "removeStoredRoom checks the preference key against the legacy raw room ID even though rememberLastOpenRoom stores JSON."
    missing:
      - "Select previous sibling, then next sibling, then render the documented per-coordinator empty state."
      - "Forget the matching versioned composite last-open record at removal time."
  - truth: "Coordinator selection restores a valid remembered exact room, otherwise the first deterministic room, otherwise the documented empty state."
    status: failed
    reason: "selectCoordinator returns immediately when no remembered room exists; it never chooses a first room or an empty-state route."
    artifacts:
      - path: "src/components/HostWorkspace.svelte"
        issue: "Lines 719-730 set selectedServerPubkey then return on !remembered."
    missing:
      - "Implement deterministic first-room and explicit zero-room fallback for every coordinator type."
  - truth: "A zero-room coordinator renders the required No rooms for this coordinator empty state instead of stale context."
    status: failed
    reason: "The required strings do not occur in the implementation; home uses a Create the first room button and remote lists render empty."
    artifacts:
      - path: "src/components/HostWorkspace.svelte"
        issue: "No implementation of either required empty-state string."
    missing:
      - "Render the specified heading and guidance for every selected coordinator with zero rooms."
  - truth: "Removal failure is user-safe and never exposes raw coordinator or transport details."
    status: failed
    reason: "RoomRemovalDialog assigns caught Error.message directly to its visible inline alert. Callers rethrow CoordinatorStore.deleteHostedRoom failures, whose underlying storage/control-plane error can be raw."
    artifacts:
      - path: "src/components/RoomRemovalDialog.svelte"
        issue: "Line 50 renders `cause.message` directly."
      - path: "src/components/HostWorkspace.svelte"
        issue: "Line 827 awaits deleteHostedRoom without mapping errors to a safe message."
      - path: "src/components/ChatRoute.svelte"
        issue: "Lines 338-341 await deleteHostedRoom without mapping errors to a safe message."
    missing:
      - "Map every deletion/leave failure to approved room-named generic copy before it reaches the dialog, and add a failure-path test."
behavior_unverified_items:
  - truth: "Opening an unselected eligible sidebar row's action menu preserves its route, selection, focus context, and unread state."
    test: "Seed an unread unselected room, open its row menu by keyboard and pointer, then assert the URL, active room, badge, and focus are unchanged."
    expected: "The row menu opens without navigating or acknowledging the room."
    why_human: "The passing browser test opens the already-selected local row; source structure alone cannot prove the unselected-state invariant."
  - truth: "Long room lists scroll within the switcher and long labels never cover unread or action controls."
    test: "Use a long list and extreme room/coordinator labels at desktop and compact widths."
    expected: "The list scrolls vertically; labels ellipsize and badges/actions remain visible and reachable."
    why_human: "This is a backstop truth with no wired held-out test. The nearest broad overflow test fails on a 112px topbar versus its 100px assertion and does not exercise this invariant."
  - truth: "Only the exact visible, readable room clears unread; background, coordinator selection, and action-menu focus never acknowledge another room."
    test: "Exercise visibility change, room/coordinator navigation, and menu focus with two same-ID cross-coordinator rooms carrying unread counts."
    expected: "Only the visible active composite room clears, and only when readable."
    why_human: "Units prove exact ledger mutation, but no browser test exercises the visibility and navigation guards."
  - truth: "Unread transition announcements occur once at zero-to-unread and badges remain informational, correctly sized, and non-clickable."
    test: "Deliver two qualifying messages, inspect the polite live region, and keyboard-navigate badges."
    expected: "One announcement is emitted; counts update without another announcement; badges do not accept focus or select a room."
    why_human: "The current browser check verifies seeded badge text, not the transition, announcement, or rendered interaction contract."
  - truth: "Opening a row action menu never clears unread."
    test: "Open and close a menu on an unread non-active room."
    expected: "The exact unread count is unchanged."
    why_human: "No existing test supplies unread state to the sidebar action lifecycle."
  - truth: "Startup is generation-owned through all hosted-room recovery, including stable multi-room ordering/progress, cancellation, and idempotent manual retry."
    test: "Use an injected recovery adapter with multiple targets, deferred attempts, start/restart/stop races, and retry after exhaustion."
    expected: "Only the current generation publishes progress or sessions; target order is roomIdentityKey order; retry preserves completed count."
    why_human: "The recovery-policy unit test exercises one target through private recovery; it does not exercise CoordinatorStore.start/restart/stop or multi-target ordering."
  - truth: "The startup surface announces multi-room progress monotonically and only exposes a retry CTA after exhaustion."
    test: "Run a two-room recovery through success, transient retry, and exhaustion in the browser."
    expected: "Current room/progress never regress, retries remain amber, and Retry recovery appears only after the final attempt."
    why_human: "The passing browser checks cover only zero rooms; no UI test drives a hosted room through retry or exhaustion."
  - truth: "Recovery diagnostics never render sensitive raw details."
    test: "Inject errors containing a relay URL, invite token, key-like text, and message-like text into exhausted recovery."
    expected: "Only the room name and generic connection guidance render."
    why_human: "The code appears to project safe diagnostic text, but there is no end-to-end rendered-error assertion."
  - truth: "Every deterministic hosted room advances displayed completed/total once without backward movement."
    test: "Run a held-out two-or-more-room recovery progression capture."
    expected: "Each target advances completion once and no later progress value decreases."
    why_human: "This is an explicit backstop truth and lacks a held-out/property test."
  - truth: "Startup, automatic retry, and exhaustion never render disconnected local hosted chat or an offline banner."
    test: "Drive a hosted room through automatic retry and exhausted failure."
    expected: "The recovery surface remains mounted and neither local chat nor offline banner appears."
    why_human: "The passing browser assertion covers the zero-room startup path, not retry/exhaustion with a hosted room."
---

# Phase 16: Resilient Rooms & Recovery Verification Report

**Phase Goal:** Users can navigate and leave the exact room they intend while room restoration presents reliable state instead of misleading failures.
**Verified:** 2026-08-02T19:55:34Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Sidebar action confirms leaving the intended composite room without opening it first. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Sibling controls and exact records exist; passing e2e covers menu/focus and same-ID isolation, but not confirmation from an unselected unread room. |
| 2 | New messages show accurate unread counts that increment and clear when read. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Ledger and receive classification have passing units; seeded badge e2e passes, but readable/visibility clearing is not exercised in-browser. |
| 3 | Startup shows every room being restored and aggregate progress. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code queues targets and the zero-room e2e passes; multi-room progress/order is untested. |
| 4 | Recoverable timeout remains recovery progress; only exhaustion is actionable. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Policy and safe session failure units pass; retry/exhaustion UI path is not exercised. |
| 5 | Hosted local room stays recovering, never disconnected chat, until recovery finishes. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `localRoomReady` gates chat and zero-room e2e passes; hosted retry/exhaustion paths lack behavioral evidence. |

### Plan Must-Haves

| Plan | # | Truth (abridged) | Status | Evidence |
|---|---:|---|---|---|
| 16-01 | 1 | Row action preserves unselected context/read state. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Sibling button/CSS and active-row e2e exist; unselected state is untested. |
| 16-01 | 2 | Frozen composite target persists through all lifecycle/fallback. | ✗ FAILED | Fallback/remembrance path is incorrect; see Gap 1. |
| 16-01 | 3 | Only active local host deletes; all other records leave. | ✓ VERIFIED | `removalModeFor` requires host, non-retired record, and coordinator equality; same-ID/local-vs-remote e2e passes. |
| 16-01 | 4 | Contextual safe confirmation with coordinator/host and focus lifecycle. | ✗ FAILED | Dialog has no coordinator/host value and renders raw caught errors; see Gap 4. |
| 16-01 | 5 | Removal chooses previous/next/empty and forgets removed room. | ✗ FAILED | `remainingRooms[0]` and stale JSON preference; see Gap 1. |
| 16-01 | 6 | Coordinator selection remembered → first → empty. | ✗ FAILED | No remembered target returns early; see Gap 2. |
| 16-01 | 7 | Last-open composite records are strictly reconciled. | ✓ VERIFIED | `loadLastOpenRoom` validates version/fields/exact room; 46 focused navigation/session units pass. |
| 16-01 | 8 | Reachability is distinct from selection. | ✓ VERIFIED | Active classes are separate from connection state; recovery/session states map independently. |
| 16-01 | 9 | Zero-room coordinator uses specified empty copy. | ✗ FAILED | Required strings absent; see Gap 3. |
| 16-01 | 10 | Labels/dialog/switcher obey overflow contract. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Relevant CSS exists; broad overflow browser test currently fails and does not target row controls. |
| 16-01 | 11 | Long-list overflow backstop. | ⚠️ insufficient_spec | No held-out test; see behavior-unverified item. |
| 16-01 | 12 | Failed removal backstop is safe/no-op/non-duplicate. | ✗ FAILED | Raw error reaches inline alert; no failure-path test. |
| 16-02 | 1 | Exact persisted read state with safe malformed baseline. | ✓ VERIFIED | Passing parser/isolation unit coverage. |
| 16-02 | 2 | Qualifying remote receives increment exactly once. | ✓ VERIFIED | `pullMessages` increments after auth/dedup/baseline gate; all focused ledger/session units pass. |
| 16-02 | 3 | Out-of-order unique envelopes count once. | ✓ VERIFIED | Receive classification unit coverage passes. |
| 16-02 | 4 | Only exact visible readable room clears. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Composite `markRoomRead` exists but visibility/navigation guards are untested. |
| 16-02 | 5 | Badge range/cap retains exact count. | ✓ VERIFIED | Unit saturation plus `99+` browser assertion pass. |
| 16-02 | 6 | Invalid values normalize and aggregation saturates. | ✓ VERIFIED | Parser/saturation units pass. |
| 16-02 | 7 | Coordinator total is composite, order-independent sum. | ✓ VERIFIED | `coordinatorUnreadTotal` filters coordinator and saturates; focused units pass. |
| 16-02 | 8 | One zero-to-unread polite announcement. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Event/live-region code exists; transition is untested. |
| 16-02 | 9 | Informational non-clickable 16px badges. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Markup/CSS exists; rendered keyboard/visual contract untested. |
| 16-02 | 10 | Row menu never clears unread. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | No unread-menu lifecycle test. |
| 16-03 | 1 | Startup transaction gates running/chat on recovery. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Source has generation checks and local gate; no start/restart transaction test. |
| 16-03 | 2 | Stable composite order and monotonic multi-room progress. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Sorting code exists; only zero-room browser evidence. |
| 16-03 | 3 | Three 4s attempts and 250/750 retry, no terminal timeout. | ✓ VERIFIED | Recovery-policy and abort-safe session tests pass. |
| 16-03 | 4 | Only exhaustion renders safe retry CTA. | ✓ VERIFIED | Exhaustion state/diagnostic unit passes; startup template gates CTA on exhausted. |
| 16-03 | 5 | Shared start, cancellation, and stale-generation suppression. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Guards exist, but no test drives CoordinatorStore generation races. |
| 16-03 | 6 | Manual retry preserves progress and is idempotent. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code retains targets/completed set; no behavioral test. |
| 16-03 | 7 | Progress announcements/current-room wrapping are correct. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Template/live region exists; multi-room/retry rendering untested. |
| 16-03 | 8 | Recovery diagnostics expose only safe copy. | ✓ VERIFIED | Template renders generic diagnostic and static exhaustive path does not interpolate caught error. |
| 16-03 | 9 | Monotonic room progress backstop. | ⚠️ insufficient_spec | No held-out multi-room test. |
| 16-03 | 10 | No disconnected chat/offline banner backstop. | ⚠️ insufficient_spec | Zero-room e2e passes, but hosted retry/exhaustion has no held-out test. |

**Score:** 12/32 truths verified (14 present but behavior-unverified)

### Required Artifacts

All 22 declared artifacts exist and pass the structural/substantive check (`verify.artifacts`: 8/8, 7/7, 7/7). They are imported by the live Svelte/coordinator paths; none is a stub or orphan. The substantive gaps are in their navigation/error behavior, not file presence.

### Key Link Verification

| Link | Status | Details |
|---|---|---|
| HostWorkspace → room store exact removal/last-open | PARTIAL | Exact reads/removal are wired, but removal leaves the JSON last-open record and fallback is not adjacent. |
| WorkspaceNav → RoomActionsMenu sibling controls | WIRED | Rows use sibling primary/menu buttons; menu trigger has 44px sizing and `focus-within` styling. |
| ChatRoute → room store removed-room discard | WIRED | `ROOMS_CHANGED_EVENT` compares both `roomId` and `coordinatorPubkey` before discard/navigation. |
| HostWorkspace → CoordinatorStore.deleteHostedRoom | WIRED | Delete runs before local removal when mode predicate permits; unsafe error propagation remains. |
| ChatRoomSession.pullMessages → readState | WIRED | Authenticated non-duplicate remote append calls `incrementUnread` beside the append gate. |
| CoordinatorStore.start → recovery adapter | WIRED | Transport assignment calls `recoverHostedRooms` before `transitionCoordinator(..., "started")`; query tooling's false negative is caused by the `#Method` notation in plan metadata. |
| HostWorkspace → ChatRoomSession.recover/UI gate | WIRED | Adapter revalidates exact room/signer and `localRoomReady` requires `roomRecovery.state === "complete"` plus connected session. |

### Data-Flow Trace

| Artifact | Data variable | Source | Status |
|---|---|---|---|
| Navigation badges | `roomUnreadCount` / coordinator total | Persisted exact `readState`, receive-time `incrementUnread`, `ROOM_UNREAD_CHANGED_EVENT` | ✓ FLOWING |
| Recovery panel | `coordinator.startupProgress.roomRecovery` | Coordinator recovery queue and hosted adapter | ✓ FLOWING |
| Room actions | `roomRemovalTarget` | Exact stored room re-load before mutation | ⚠️ PARTIAL — errors and fallback handling violate contract |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Composite storage, unread classification, exact acknowledgement | `pnpm exec vitest run tests/unit/room-navigation.test.ts tests/unit/room-session-concurrency.test.ts` | 46 passed | ✓ PASS |
| Retry policy and exhausted safe state | `pnpm exec vitest run tests/unit/state-machine.test.ts -t 'coordinator recovery policy'` | 2 passed | ✓ PASS |
| Recovery session abort/no offline publication | focused `room-session-concurrency` test names | 2 passed | ✓ PASS |
| Sidebar/unread/zero-room recovery UI | focused Playwright grep, one worker | 5 passed | ✓ PASS |
| Broad overflow guard | `pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep 'operator shell does not overflow common viewports' --workers=1` | Failed: `.host-topbar` 112px, required <=100px | ✗ FAIL |

### Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| ROOM-01 | ✗ BLOCKED | Action surface and exact targeting exist, but unselected-state proof and required safe confirmation contract are incomplete. |
| ROOM-02 | ✗ BLOCKED | Exact identity is strong, but removal fallback/remembered-state contract is observably wrong. |
| ROOM-03 | ✓ SATISFIED | Exact persisted ledger, qualification, saturation, isolation, and badges have passing focused unit/browser evidence. |
| BOOT-01 | ⚠️ NEEDS HUMAN | Zero-room stage is proven; multi-room restoration progression lacks behavioral evidence. |
| BOOT-02 | ⚠️ NEEDS HUMAN | Retry policy/session handling is proven, but retry/exhaustion surface is not. |
| BOOT-03 | ⚠️ NEEDS HUMAN | Gate is wired and zero-room check passes; hosted retry/exhaustion boundary is unexercised. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `src/components/RoomRemovalDialog.svelte` | 50 | Raw caught `Error.message` rendered | 🛑 BLOCKER | Can disclose prohibited coordinator/control-plane detail. |
| `src/components/HostWorkspace.svelte` | 853 | First remaining room chosen | 🛑 BLOCKER | Violates deterministic adjacent fallback. |
| `src/components/HostWorkspace.svelte` | 723 | Early return without fallback | 🛑 BLOCKER | Coordinator selection can leave stale prior room context. |

No unreferenced `TBD`, `FIXME`, or `XXX` markers were found in phase-modified files. No phase probes were declared or present.

### Human Verification Required

The 14 behavior-unverified truths in frontmatter remain relevant after gap closure. Prioritize the multi-room/retry startup path, unread acknowledgement under visibility changes, and compact long-list interaction.

### Gaps Summary

The core data models and retry loop are substantive and several focused tests pass. The goal is nevertheless not achieved: navigation after removal/selection can choose stale or non-deterministic context, the mandated zero-room state is absent, and failed room deletion can expose raw errors. These are implementation defects, not deferred work; later roadmap phases do not explicitly cover them. The overflow failure is also not deferred, but it is a broad existing UI guard rather than evidence that the phase's row-overflow implementation is missing.

---

_Verified: 2026-08-02T19:55:34Z_  
_Verifier: the agent (gsd-verifier)_
