---
phase: 25-favorite-groups-invite-availability
reviewed: 2026-08-07T01:10:40Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/chat/sidebar-ledger.ts
  - src/components/ChatRoute.svelte
  - src/components/CoordinatorRoomCard.svelte
  - src/components/HostWorkspace.svelte
  - src/components/MessageGroup.svelte
  - src/components/RoomActionsMenu.svelte
  - tests/e2e/workspace-lifecycle.spec.ts
  - tests/unit/sidebar-ledger.test.ts
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-08-07T01:10:40Z  
**Depth:** deep  
**Files Reviewed:** 8  
**Status:** issues_found

## Summary

The favorite ledger itself correctly uses the composite room key and the new UI retains the source data. However, shared invites to coordinators that are not already represented by a stored room can never become joinable, and removing a duplicate can strand keyboard focus when its source row is collapsed. The availability description also generates duplicate DOM IDs, while the new browser test proves only the disabled path it is named to cover.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Shared-invite coordinators are never probed

**Classification:** BLOCKER  
**File:** `src/components/HostWorkspace.svelte:642-663`  
**Issue:** `reachabilityTargets()` derives probe targets only from stored remote/previous-local rooms and the route's currently opened invite. A coordinator referenced only by a shared message invite is absent from that list. `inviteCoordinatorReachability()` therefore returns `unknown` for it (`:693-695`), and `MessageGroup` permanently disables Join unless the value is exactly `online` (`src/components/MessageGroup.svelte:285-295`). This is the normal use case for accepting a newly shared group: an online coordinator that the recipient has not joined before is never checked and is unjoinable in both host and invitee panes.

**Fix:** Include validated `parseInviteMessage()` results from the displayed host room and embedded invitee room in the reachability target set, merging their public relay hints by coordinator key. Re-run probing whenever those message collections change, while retaining the existing `unknown`-until-probed fail-closed behavior. Add an integration test that supplies a live heartbeat for an invite-only coordinator and verifies the same rendered button changes from disabled to enabled.

### CR-02: Removing a favorite can lose focus and hide its required source row

**Classification:** BLOCKER  
**File:** `src/components/CoordinatorRoomCard.svelte:52-58`  
**Issue:** A non-active source row after the fifth room is omitted from the coordinator card. Favorites render every duplicate, so a room can be favorited while active/expanded, later be collapsed out of its source card, then be removed from the Favorites section. The post-removal focus restoration searches only rendered source rows and silently does nothing when that happens (`src/components/HostWorkspace.svelte:622-625`). Focus is then removed with the duplicate button, leaving keyboard users without a reliable focus target. This also contradicts the requirement that the original row remain visible.

**Fix:** Coordinate removal with the source card: ensure a favorited source is rendered, or expand/reveal its card before deleting the duplicate. If the source cannot remain visible after removal, move focus to a stable, meaningful control such as that card's reveal button and expose the source. Add a browser case with at least six rooms: favorite a non-first row, collapse the card, remove it from Favorites, and assert both a visible source/reveal control and deterministic focus.

## Warnings

### WR-01: Disabled invite descriptions use duplicate IDs

**Classification:** WARNING  
**File:** `src/components/MessageGroup.svelte:286-304`  
**Issue:** `messageIndex` resets for every `MessageGroup` (one component per sender streak), while `idPrefix` is only `host` or `guest`. Two invite messages in separate streaks therefore emit the same `guest-invite-availability-0` or `host-invite-availability-0` ID. Duplicate IDs make `aria-describedby` resolution invalid and can associate a control with the wrong element.

**Fix:** Allocate a component-unique opaque prefix (for example, Svelte's `$props.id()`) and include it in `inviteAvailabilityId`; do not derive it from room or message identifiers. Add a DOM assertion with invite messages in two sender streaks that every description ID is unique and resolves to its own element.

### WR-02: The availability browser test does not test an online transition

**Classification:** WARNING  
**File:** `tests/e2e/workspace-lifecycle.spec.ts:803-835`  
**Issue:** Despite its name, this test seeds an invite-only coordinator with an unreachable relay and asserts only that Join is disabled. It neither registers the coordinator as a reachability target nor produces an online heartbeat, waits for an enabled state, or checks that activation follows the established autojoin flow. It therefore misses the blocker above and provides no evidence for the promised offline-to-online behavior.

**Fix:** Drive both states against the mock relay: begin with no/failing heartbeat and assert the disabled presentation, publish a valid fresh heartbeat for the invite coordinator, then assert the unchanged card's Join button enables and navigates through the existing autojoin route. Cover the host and embedded invitee render paths or factor the shared expectation into both paths.

---

_Reviewed: 2026-08-07T01:10:40Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
