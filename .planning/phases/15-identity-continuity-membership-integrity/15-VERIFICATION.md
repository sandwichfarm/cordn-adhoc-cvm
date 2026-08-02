---
phase: 15-identity-continuity-membership-integrity
verified: 2026-08-02T17:15:43Z
status: human_needed
score: 19/23 must-haves verified
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "During rotation/recovery, every action is disabled, the primary action reads Rotating… or Creating…, and a polite live status communicates progress."
    test: "Create an anonymous room, delay the rotation transaction after confirmation, then try both dialog controls and Escape/backdrop while the operation is pending."
    expected: "All controls are disabled, the primary label and live region show progress, the dialog remains open, and neither avatar nor pubkey changes before success."
    why_human: "The code implements busy state, but no automated test holds the transaction in flight to exercise the state transition."
  - truth: "A pre-boundary failed action keeps the confirm modal open, shows the actionable role=alert error, and leaves the current identity and local access unchanged."
    test: "Inject a pre-boundary local-storage/session-retirement failure after opening the confirmation dialog and confirm rotation."
    expected: "The dialog stays open with an actionable alert; the same pubkey/avatar and usable local-room authority remain."
    why_human: "Unit tests verify store rollback, but no browser test observes the modal/error presentation on that failure path."
human_verification:
  - test: "Exercise the two in-flight and pre-boundary-failure checks above."
    expected: "Busy/error modal behavior preserves the stated identity and authority invariants."
    why_human: "These are present and wired but not behaviorally exercised by a browser test."
  - test: "Reload with an intentionally malformed anonymous-identity localStorage record, then choose Create new identity from the recovery dialog."
    expected: "No coordinator or legacy room pubkey is presented as the local identity; no replacement appears before explicit recovery."
    why_human: "IDEN-01 transparency/safety prohibitions are judgment-tier and arrive flagged without a deterministic enforcement test."
  - test: "Seed two same-room-ID records under different coordinator pubkeys plus a verified v2/legacy alias pair, reload, and inspect the navigation."
    expected: "Each coordinator/room appears exactly once; neither alias nor legacy room key becomes the device identity."
    why_human: "The IDEN-04 prohibition is judgment-tier; automated tests cover storage cases but a human must confirm the end-to-end presentation."
  - test: "Open the rotation dialog with one local room, then repeat while NIP-07 and NIP-46 are selected."
    expected: "The anonymous dialog says cached/coordinator-hosted data is not deleted; authenticated menus do not expose rotation and their sessions remain unchanged."
    why_human: "IDEN-02/03 prohibitions are judgment-tier and require the requested end-of-phase visual/user-flow review."
prohibitions:
  - requirement_id: IDEN-01
    statement: "The application must not present the coordinator key or an arbitrary legacy per-room key as the user's durable device-local identity."
    status: human_needed
    evidence: "Non-authoritative static review: App bootstraps UserProfileStore.initialize(configStore.userName), and UserProfileStore loads only cordn:v1:anonymous-identity."
  - requirement_id: IDEN-01
    statement: "Corrupt persisted anonymous identity material must not silently create or display a replacement identity."
    status: human_needed
    evidence: "Unit corruption matrix passes; flagged because the plan declares the prohibition unverified."
  - requirement_id: IDEN-04
    statement: "Reconciliation must not collapse rooms by title, origin, or room ID alone, and must not promote any legacy per-room secret into the durable device identity."
    status: human_needed
    evidence: "Composite helpers and targeted unit/browser tests pass; flagged judgment-tier item."
  - requirement_id: IDEN-02
    statement: "Rotation UI and completion messaging must not claim that cached conversation history or coordinator-hosted group data is deleted."
    status: human_needed
    evidence: "Dialog copy explicitly preserves coordinator-hosted data; flagged judgment-tier item."
  - requirement_id: IDEN-03
    statement: "Anonymous rotation must not act on authenticated NIP-07/NIP-46 signer sessions or expose rotation controls while either authenticated method is selected."
    status: human_needed
    evidence: "Method guard and active-signer isolation are present; flagged judgment-tier item."
---

# Phase 15: Identity Continuity & Membership Integrity Verification Report

**Phase Goal:** Anonymous users retain one durable local identity and only the room authority that belongs to that identity.
**Verified:** 2026-08-02T17:15:43Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Reload/restart retains the anonymous pubkey, avatar, and separate local name. | ✓ VERIFIED | `UserProfileStore.bootstrap()` loads the versioned record before profile display; targeted unit reload test and Playwright reload tracer pass. |
| 2 | First use creates one signer; invalid stored credentials fail closed rather than rotate silently. | ✓ VERIFIED | Strict version/exact-64-hex parser; all five targeted corrupt-record cases pass. |
| 3 | The profile store owns the anonymous signer; coordinator identity is not substituted. | ✓ VERIFIED | `activeSigner` returns the private anonymous signer only in anonymous mode; App calls `initialize(configStore.userName)` without coordinator input. |
| 4 | NIP-07/NIP-46 stay isolated and logout restores the loaded anonymous signer. | ✓ VERIFIED | Separate signer fields and authenticated-method tests; targeted NIP-07 logout-isolation test passes. |
| 5 | Persisted/private identity material is not exposed through product UI/errors/logs and retired signer work rejects. | ✓ VERIFIED | No debt/secret-output markers found in phase files; signer zeroizes its owned buffer and targeted post-destroy test exists. |
| 6 | Host, join, and resume consume the selected durable signer. | ✓ VERIFIED | `ChatRoute`, `HostWorkspace`, and `InvitePanel` read `userProfileStore.activeSigner`; room creators require `signer`. |
| 7 | A room can attach/send only when signer pubkey equals immutable `stablePubkey`; mismatches keep cache readable. | ✓ VERIFIED | Central `requireRoomSigner()` guard precedes attachment; targeted unit and browser stale-cache tests pass. |
| 8 | Room lookup, rendering, updates, removal, and migration use `(coordinatorPubkey, roomId)`. | ✓ VERIFIED | `roomIdentityKey`/`sameRoomIdentity` are used by store and Svelte keys; targeted same-ID isolation unit test passes. |
| 9 | Reload/reconciliation yields one authoritative entry per composite identity. | ✓ VERIFIED | `listRooms()` groups by composite key and only removes aliases after verified read-back; targeted foreign-host reload browser test passes. |
| 10 | Interrupted/overlapping legacy-v2 reconciliation leaves verified v2 authoritative and aliases intact until read-back. | ✓ VERIFIED | Explicit backstop evidence: targeted `preserves a valid legacy room when its v2 destination is corrupt` and duplicate-order tests pass. |
| 11 | Verified v2 records win; same room IDs at distinct coordinators remain independent and legacy room secrets never seed global identity. | ✓ VERIFIED | Migration verifies the composite target before source deletion; anonymous identity module does not read room storage. |
| 12 | Retired memberships preserve read-only cache while removing authority and requiring a fresh invite. | ✓ VERIFIED | Retirement scrubs MLS/signing/invite fields and marks `retired`; targeted lifecycle-retirement unit test and browser cache-only test pass. |
| 13 | Only anonymous users see the contextual rotation/recovery surface. | ✓ VERIFIED | `UserProfile.svelte` guards Rotate identity on `method === "anonymous"`; store rejects other methods. |
| 14 | Confirmed rotation stages a candidate, retires local/live authority, crosses recovery boundary, destroys old signer, verifies replacement, then publishes it. | ✓ VERIFIED | Ordered store transaction plus passing targeted lifecycle-retirement test; old signer rejects work after rotation. |
| 15 | A pre-boundary failure restores exact local authority and old identity. | ✓ VERIFIED | Targeted storage-failure rollback test passes and compares complete localStorage snapshots. |
| 16 | A post-boundary interruption exposes only durable recovery, never the old/unpublished identity. | ✓ VERIFIED | Bootstrap checks recovery marker first; targeted recovery-boundary test passes and browser recovery route is covered. |
| 17 | Rotation changes the durable credential rather than adding a second selectable identity. | ✓ VERIFIED | One `anonymousSigner` field and anonymous-only rotation; no secondary identity store/selector exists. |
| 18 | Zero membership uses the documented empty-state heading instead of a room list. | ✓ VERIFIED | Targeted rotation Playwright test observes `No local room memberships`. |
| 19 | Busy rotation/recovery disables controls and reports progress without premature identity change. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Busy UI is implemented, but no test holds the asynchronous operation in flight. |
| 20 | Pre-boundary failure remains in the dialog with `role="alert"` and unchanged access. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Store rollback passes, but browser error/modal behavior is unexercised. |
| 21 | Impact copy correctly handles zero/one/many without room names. | ✓ VERIFIED | Derived scalar copy branches on `membershipCount`; room names are not passed to the dialog. |
| 22 | Key summary, ellipsis, and wrapping avoid visual overflow. | ? UNCERTAIN | Source implements `8…6`, `min-w-0`, and `overflow-wrap`; visual behavior needs human inspection. |
| 23 | Playwright proves the in-flight dialog invariant and atomic completion. | ? INSUFFICIENT_SPEC | The declared `verification: backstop` truth has completion coverage but no held-in-flight browser test. |

**Score:** 19/23 truths verified (2 present, behavior-unverified; 2 require human confirmation).

### Required Artifacts

| Artifact group | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/identity/anonymous-identity.ts`, `user-profile.svelte.ts`, `browser-nostr-signer.ts`, `App.svelte` | Validated durable signer and identity-first bootstrap | ✓ VERIFIED | All exist, are substantive, and are imported/called along the app bootstrap path. |
| `src/chat/room-store.ts`, `ChatRoute.svelte`, `HostWorkspace.svelte`, `InvitePanel.svelte`, `WorkspaceNav.svelte` | Durable authority, composite reconciliation, and room UI wiring | ✓ VERIFIED | All exist, substantive, and wired into creator/attach/navigation paths. |
| `IdentityRotationDialog.svelte`, `UserProfile.svelte` | Anonymous-only rotation/recovery UI | ✓ VERIFIED | Dialog has `data-testid="identity-rotation-dialog"`; artifact checker’s literal unquoted-pattern miss is not an implementation defect. |
| `tests/unit/user-profile.test.ts`, `room-navigation.test.ts`, `tests/e2e/nip07-session-restoration.spec.ts`, `stale-local-sessions.spec.ts` | Phase behavioral evidence | ✓ VERIFIED | Tests are discovered by Vitest/Playwright and selected named tests passed in this verification. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `App.svelte` | `UserProfileStore` | `initialize(configStore.userName)` | ✓ WIRED | App imports singleton and calls initialization before `identityReady` enables host restoration. |
| `UserProfileStore` | anonymous identity module | load/create on bootstrap | ✓ WIRED | Imports `loadAnonymousIdentity` and `createAnonymousIdentity`; only absent storage creates. |
| anonymous identity module | `BrowserNostrSigner` | validated construction/staged destroy | ✓ WIRED | Constructs after parse; aborted/retired candidates call `destroy()`. |
| `ChatRoute.svelte` | profile store | active signer on join/resume | ✓ WIRED | Reads `activeSigner` in initial route, retry, and restore paths. |
| `HostWorkspace.svelte` | room store | create/verify host sessions | ✓ WIRED | Calls `createHostedRoom` and `requireRoomSigner` with active signer. |
| room store | localStorage | composite read-back | ✓ WIRED | `roomIdentityKey`, verified reads, and alias cleanup are in the persistence path. |
| `WorkspaceNav.svelte` | room store | composite keys | ✓ WIRED | Imports `roomIdentityKey` and keys every room collection with coordinator plus ID. |
| profile UI/routes | rotation store | transaction and lifecycle registration | ✓ WIRED | Confirm/recovery handlers await store methods; joined/hosted sessions register and unregister lifecycles. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| `UserProfileStore` | `pubkey`, `avatarUrl`, `activeSigner` | validated browser-local record → `BrowserNostrSigner` | Generated on first use and read on reload | ✓ FLOWING |
| `ChatRoute` | room/session signer | profile store → `createJoiningRoom`/`requireRoomSigner` | Current signer and persisted composite room | ✓ FLOWING |
| `HostWorkspace` | hosted rooms/session | profile signer → `createHostedRoom` → `saveRoom` | Real persisted room records | ✓ FLOWING |
| `WorkspaceNav` | room lists | `listRooms()` over validated storage | Composite-deduplicated persisted entries | ✓ FLOWING |
| rotation UI | membership count | `anonymousMembershipImpact()` storage scan | Distinct matching composite identities | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Durable reload identity | `vitest ... -t 'creates and reloads one durable anonymous identity...'` | 1 passed | ✓ PASS |
| Composite isolation | `vitest ... -t 'keeps identical room ids isolated by coordinator'` | 1 passed | ✓ PASS |
| Retire before replacement | `vitest ... -t 'retires matching local room authority...'` | 1 passed | ✓ PASS |
| Alias interruption/order | `vitest ... -t 'preserves a valid legacy...'`; `-t 'cleans a duplicate legacy key'` | 1 + 2 passed | ✓ PASS |
| Browser reload continuity | `playwright ... -g 'established anonymous identity opens a legacy invite'` | 1 passed | ✓ PASS |
| Browser confirmed rotation | `playwright ... -g 'rotates a zero-membership...'` | 1 passed | ✓ PASS |
| Browser stale mismatch cache | `playwright ... -g 'stale remote room readable...'` | 1 passed | ✓ PASS |
| Browser foreign-host reload | `playwright ... -g 'foreign host record ... after reload'` | 1 passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| IDEN-01 | 15-01, 15-02 | Durable anonymous key/profile survives reload/restart. | ✓ SATISFIED | Strict record/bootstrap, direct reload unit and browser tracer, isolated authenticated signers. |
| IDEN-02 | 15-03 | Deliberate menu rotation after consequences confirmation. | ✓ SATISFIED | Anonymous-only menu, native dialog consequence text, and targeted Playwright confirmation pass. |
| IDEN-03 | 15-02, 15-03 | Rotation retires old local authority so new identity cannot send. | ✓ SATISFIED | Signer gate, retirement journal/session discard, targeted retirement and stale-cache browser evidence. |
| IDEN-04 | 15-02 | Reloaded ephemeral host does not duplicate coordinator/room entries. | ✓ SATISFIED | Composite storage/UI keys, alias read-back tests, and targeted foreign-host reload browser pass. |

No orphaned Phase 15 requirements were found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No unreferenced `TBD`, `FIXME`, `XXX`, stub return, or product placeholder found in phase implementation files. | ℹ️ Info | No blocker. |

### Full Playwright Suite Context

The supplied full-suite result is 38 passed / 3 failed. None is a failed Phase 15 success criterion:

1. The mobile topbar-height assertion is in `phase-one.spec.ts:406`, introduced before Phase 15 and concerns shell layout.
2. `phase-one.spec.ts:1376` expects a transient `Room cached` label after reload. Current host restore proves identity readiness first, then constructs the valid session, so the observed label is `Room connecting`; this does not create duplicate room/coordinator records or grant mismatched authority.
3. `phase-one.spec.ts:1624` expects `localStorage.length === 0` after coordinator destruction. The durable `cordn:v1:anonymous-identity` record correctly remains outside coordinator state: deleting it would contradict IDEN-01’s device-local continuity. This assertion is obsolete for the Phase 15 storage boundary.

### Human Verification Required

1. **Rotation in flight and failure UI**

**Test:** Delay a confirmed rotation, then simulate a pre-boundary failure.
**Expected:** Controls/progress/error/modal/identity all follow the two behavior-unverified items in frontmatter.
**Why human:** No browser test presently holds this asynchronous UI state.

2. **Prohibition and visual review**

**Test:** Perform the five frontmatter prohibition checks across anonymous, corrupt, same-ID multi-coordinator, and authenticated states; inspect the dialog at desktop and narrow width.
**Expected:** The local identity never becomes a coordinator/legacy key; corrupt data does not rotate silently; no misleading deletion claim, authenticated impact, duplicate room, or overflow appears.
**Why human:** The PLAN marks these as judgment-tier `unverified` prohibitions, which cannot silently pass.

---

_Verified: 2026-08-02T17:15:43Z_
_Verifier: the agent (gsd-verifier)_
