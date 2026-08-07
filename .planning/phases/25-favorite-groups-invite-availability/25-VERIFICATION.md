---
phase: 25-favorite-groups-invite-availability
verified: 2026-08-07T01:10:31Z
status: gaps_found
score: 2/6 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Every favorite appears while its original source row remains in its coordinator section, and removing the favorite from either copy leaves keyboard focus at a meaningful source control."
    status: failed
    reason: "Coordinator cards render only five non-expanded source rows, but Favorites renders every duplicate. Removing a duplicate whose source is collapsed deletes the focused node and the restoration query finds no rendered source row."
    artifacts:
      - path: "src/components/CoordinatorRoomCard.svelte"
        issue: "The coordinator presentation omits source rows after the five-row limit."
      - path: "src/components/HostWorkspace.svelte"
        issue: "Focus restoration silently no-ops when the collapsed source row is absent from the DOM."
    missing:
      - "Keep the favorited source visible or reveal/expand it before duplicate removal and restore focus deterministically."
  - truth: "A rendered shared invite becomes actionable when its exact coordinator is known online."
    status: failed
    reason: "Reachability probing discovers only stored rooms and the active route invite; parsed shared-message invites are not targets. A coordinator referenced only by a newly received invite remains unknown, so Join can never enable."
    artifacts:
      - path: "src/components/HostWorkspace.svelte"
        issue: "reachabilityTargets() does not include parseInviteMessage() results from displayed host or invitee messages."
    missing:
      - "Merge validated shared-invite coordinator pubkeys and relay hints into reachability targets and test unknown/offline-to-online enablement."
  - truth: "Every disabled invite exposes its offline reason through an unambiguous accessible description."
    status: partial
    reason: "Description IDs use only pane prefix and per-streak message index; the index restarts in each MessageGroup, producing duplicate IDs for invites in different sender streaks."
    artifacts:
      - path: "src/components/MessageGroup.svelte"
        issue: "inviteAvailabilityId is not component-unique."
    missing:
      - "Use a component-unique opaque ID prefix and test multiple invite streaks."
behavior_unverified_items:
  - truth: "Favorite duplicates preserve the source row's exact navigation and non-favorite room-action parity without reordering coordinator cards."
    test: "Favorite a room, then use the Favorites copy to open it and exercise a non-favorite room action; repeat after using the source copy."
    expected: "Both copies open the same coordinator-plus-room target, show the same active rail and actions, and leave the original coordinator ordering unchanged."
    why_human: "Both rows use the same component and the duplicate removal path is browser-tested, but no test invokes duplicate navigation or a non-favorite menu action."
---

# Phase 25: Favorite Groups & Invite Availability Verification Report

**Phase Goal:** Frequently used groups stay one click away without leaving their coordinator grouping, and room invites never imply that an offline coordinator can currently be joined.
**Verified:** 2026-08-07T01:10:31Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | An active group exposes the accessible star on the row and the same first menu action; exact coordinator-plus-room favorite state persists. | ✓ VERIFIED | `CoordinatorRoomCard` renders a 44px `aria-pressed` star and forwards the same callback to `RoomActionsMenu`; `HostWorkspace` persists `toggleSidebarFavorite` through `SIDEBAR_LEDGER_KEY`. Focus/menu/reload behavior passed in the focused browser tests. |
| 2 | Favorites appear above coordinator cards without removing the source row; exact unfavorite removes only the duplicate. | ✗ FAILED | A Favorites card renders all duplicates, but the original coordinator card renders only five collapsed source rows. Removing a duplicate after its source is collapsed leaves no source row to focus and contradicts the promised retained source interaction. |
| 3 | Favorite duplicates retain source navigation, active rail, unread/owner/preferences, and all non-favorite room actions without coordinator reordering. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | One reusable `CoordinatorRoomCard` receives the same props/callbacks for Favorites and sources, but no test invokes duplicate navigation or a non-favorite duplicate action. |
| 4 | An invite is actionable only for exact `online` reachability; connecting, offline, and unknown are disabled and a live online transition restores Join. | ✗ FAILED | The resolver is fail-closed but probes only stored rooms/current route invite. A coordinator found only inside a shared message can never obtain an `online` state, so its Join action cannot enable. |
| 5 | Disabled invites are subdued, not-allowed, and expose `Coordinator is offline` by tooltip and accessible text in both render paths. | ✗ FAILED | The presentation source exists, but `aria-describedby` IDs repeat across sender streaks (`guest-invite-availability-0`/`host-invite-availability-0`), making the accessible description ambiguous. |
| 6 | Favorite persistence contains only validated composite room keys and does not introduce favorite metadata or secrets into the sidebar ledger. | ✓ VERIFIED | `parseSidebarLedger` accepts only unique `<64-hex-pubkey>\\0<nonempty-room-id>` strings; mutation stores only `roomIdentityKey`; reconciliation filters against active exact keys. Unit coverage proves malformed/duplicate rejection and stale-key removal; the phase diff adds no logging. |

**Score:** 2/6 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/chat/sidebar-ledger.ts` | Validated composite persistence/mutation/reconciliation | ✓ VERIFIED | Exists, substantive (234 lines), exports all required ledger functions, and is imported by `HostWorkspace`. |
| `src/components/CoordinatorRoomCard.svelte` | Shared source/favorite row renderer | ✓ VERIFIED | Renders both presentations with exact `data-room-key`, shared star/menu callbacks, row navigation, unread and owner indicators. |
| `src/components/RoomActionsMenu.svelte` | First-position favorite action | ✓ VERIFIED | Renders `Add to favorites`/`Remove from favorites` before connection details and invokes the shared callback. |
| `src/components/HostWorkspace.svelte` | Favorites projection and reachability resolver | ✓ VERIFIED | Reconciles persisted ledger, projects active favorites above the original cards, and passes its resolver to host and embedded panes. |
| `src/components/MessageGroup.svelte` | Reactive online-only invite presentation | ✓ VERIFIED | Parses each invite, fail-closes missing resolver to `unknown`, and controls disabled presentation/actionability. |
| `src/components/ChatRoute.svelte` | Embedded availability forwarding | ✓ VERIFIED | Typed resolver prop defaults to `unknown` and is forwarded to its `MessageGroup`. |
| `tests/unit/sidebar-ledger.test.ts` | Ledger recovery/composite identity evidence | ✓ VERIFIED | Five focused tests pass, including malformed/duplicate favorites, exact identity, and stale cleanup. |
| `tests/e2e/workspace-lifecycle.spec.ts` | Browser favorite/invite evidence | ✓ VERIFIED | Three Phase 25 named browser tests pass, but they do not cover the collapsed-source or invite-only-online cases identified below. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `HostWorkspace.svelte` | `sidebar-ledger.ts` | Parse/reconcile/serialize under `SIDEBAR_LEDGER_KEY` | WIRED | Manual trace: storage → `refreshRemoteRooms` → `sidebarLedger`/`activeSidebarRooms` → projection; tool verification reports the required pattern. |
| `CoordinatorRoomCard.svelte` | `RoomActionsMenu.svelte` | Shared favorite boolean/callback | WIRED | Both row star and menu use `favorite` and `onFavorite` from the same card iteration. |
| `HostWorkspace.svelte` | `MessageGroup.svelte` | Exact reachability resolver | WIRED | Resolver branches only on exact coordinator pubkey and is passed directly to the host `MessageGroup`. |
| `ChatRoute.svelte` | `MessageGroup.svelte` | Embedded resolver forwarding | WIRED | `ChatRoute` accepts/forwards the resolver without independently inferring availability. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `HostWorkspace.svelte` | `sidebarLedger`, `activeSidebarRooms`, `favoriteRoomItems` | Browser `localStorage` plus real `listRooms()` → `reconcileSidebarLedger()` | Valid persisted ledger and active stored rooms | ✓ FLOWING |
| `CoordinatorRoomCard.svelte` | `rooms`, `favoriteRoomKeys`, `activeRoomKey` | Real active/favorite projections from `HostWorkspace` | Actual stored room identities and state | ✓ FLOWING |
| `MessageGroup.svelte` | `sharedInvite`, `inviteOnline` | Parsed encrypted-message presentation plus workspace reachability resolver | Actual message invite and current resolver result | ✓ FLOWING |
| `ChatRoute.svelte` | `inviteCoordinatorReachability` | Prop from workspace | Same live resolver reaches invitee `MessageGroup` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Favorite parser, exact identity, malformed recovery, stale removal | `pnpm exec vitest run tests/unit/sidebar-ledger.test.ts` | 5 passed | ✓ PASS |
| Menu/star duplication, persistence, touch targets; unknown invite disabled | `CI=1 PLAYWRIGHT_PORT=4355 pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts --grep 'favorite menu duplicates the exact room and survives reload\\|favorite star mirrors duplicate state and keeps sidebar controls touch-safe\\|shared invite follows exact coordinator availability' --workers=1` | 3 passed | ✓ PASS |
| Full workspace gate | Current execution evidence supplied to verifier: lint, TypeScript, build, 348 unit tests (3 skipped), 114 E2E tests, upstream parity, and upstream interop passed | Not rerun here; no phase-specific failure observed | ℹ️ PROVIDED EVIDENCE |

### Probe Execution

Step 7c: SKIPPED — Phase plans/summaries declare no probe and the repository has no conventional `scripts/*/tests/probe-*.sh` probe.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FAV-01 | `25-01-PLAN.md` | Accessible row/menu favorite controls with exact persisted identity | ✓ SATISFIED | Shared star/menu wiring, composite-key unit tests, and focused menu/star/reload browser tests. |
| FAV-02 | `25-01-PLAN.md` | Duplicate Favorites section retaining source; unfavorite removes duplicate only | ✗ BLOCKED | The source row can be collapsed out of the DOM; duplicate removal then loses its promised focus return. |
| INVMSG-02 | `25-01-PLAN.md` | Online-only invite action with disabled offline presentation | ✗ BLOCKED | Invite-only coordinators are never probed and disabled descriptions can have duplicate IDs. |

No orphaned Phase 25 requirements: the roadmap maps exactly FAV-01, FAV-02, and INVMSG-02, and the plan declares all three.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No Phase 25-introduced `TBD`, `FIXME`, `XXX`, TODO/HACK, placeholder stub, empty implementation, or console-only handler found. | — | No blocker |

The existing `channel-loading-placeholder` in `HostWorkspace.svelte` is outside the Phase 25 diff and is a deliberate loading visual, not a phase-introduced stub.

## Human Verification After Gap Closure

### 1. Favorites duplicate parity

**Test:** Favorite a room, then open and use a non-favorite menu action from its Favorites duplicate and source copy.
**Expected:** Both copies target the same room and retain the same actions/active rail; coordinator order stays unchanged; unfavorite removes only the duplicate.
**Why human:** The shared-component architecture supports this, but the browser scenario does not invoke these parity paths.

### 2. Invite availability transitions and presentation

**Test:** In host and embedded invitee panes, observe one invite while its exact coordinator changes online → connecting/offline/unknown → online.
**Expected:** Only online enables Join. All non-online states remain readable but neutral/subdued with `cursor: not-allowed`, title and accessible text `Coordinator is offline`; online restores Join in place.
**Why human:** Automated evidence proves only an invitee unknown state disabled; after the reachability-target and unique-ID fixes, the other states, restoration, host route, and visual/layout invariants still need exercising.

## Gaps Summary

Three gaps block the phase goal and two requirements: (1) a collapsed source row can disappear and lose focus on Favorites removal, (2) a coordinator known only from a shared invite is never probed and therefore cannot enable Join, and (3) repeated invite-description IDs make accessibility references ambiguous. This is an **Escalation Gate**: create a gap-closure plan, then re-run focused browser coverage for the six-room favorite case and the invite-only offline-to-online path before re-verification.

---

_Verified: 2026-08-07T01:10:31Z_
_Verifier: the agent (gsd-verifier)_
