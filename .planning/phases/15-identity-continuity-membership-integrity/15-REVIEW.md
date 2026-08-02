---
phase: 15-identity-continuity-membership-integrity
reviewed: 2026-08-02T16:34:14Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/App.svelte
  - src/chat/room-store.ts
  - src/components/ChatRoute.svelte
  - src/components/HostWorkspace.svelte
  - src/components/IdentityRotationDialog.svelte
  - src/components/InvitePanel.svelte
  - src/components/UserProfile.svelte
  - src/components/WorkspaceNav.svelte
  - src/crypto/browser-nostr-signer.ts
  - src/identity/anonymous-identity.ts
  - src/identity/user-profile.svelte.ts
  - tests/e2e/nip07-session-restoration.spec.ts
  - tests/e2e/stale-local-sessions.spec.ts
  - tests/unit/room-navigation.test.ts
  - tests/unit/user-profile.test.ts
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-02T16:34:14Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The review covered the durable anonymous signer, rotation/recovery transaction, room persistence, Svelte session attachment, and all Phase 15 unit and browser tests. IDEN-01's identity persistence works in the exercised path, but IDEN-02 through IDEN-04 are not shippable: recovery can leave prior anonymous credentials on disk, and rotation cannot distinguish anonymous room authority from an authenticated room that uses the same pubkey. Focused unit, type, lint, diff, and browser suites pass but do not exercise these paths.

## Narrative Findings (AI reviewer)

### BLOCKER

#### CR-01: Anonymous rotation can retire authenticated room authority that has the same pubkey

**File:** `src/chat/room-store.ts:483-515, 599-665`

**Issue:** New rooms record only `stablePubkey`; they do not persist whether the signer was the local anonymous identity or NIP-07/NIP-46. `belongsToAnonymousMembership()` therefore treats every record with the old anonymous pubkey as anonymous at line 665. If a user signs in with an extension/remote signer that owns that same key, creates or joins a room, logs out, and rotates the anonymous identity, `retireAnonymousMemberships()` clears that authenticated room's MLS state, key package, pending data, and invite at lines 621-630. This loses local authenticated membership and violates the required isolation of NIP-07/NIP-46 flows.

**Fix:** Persist an ownership discriminator when creating/joining a room (for example `identityOwner: "anonymous" | "external"`, or a durable anonymous-identity marker). Retire only explicitly anonymous records; use the legacy `anonymousSecretKey` solely for controlled migration. Add a regression test where an authenticated signer shares the anonymous pubkey and prove rotation leaves its room unchanged.

#### CR-02: Corrupt-identity recovery promises credential retirement but leaves old room secrets and MLS authority stored

**File:** `src/identity/user-profile.svelte.ts:161-176`

**Issue:** When boot detects a malformed anonymous identity, `recoverAnonymousIdentity()` creates and publishes a replacement without calling `retireAnonymousMemberships()` or any equivalent authority purge. Existing room records retain `anonymousSecretKey`, `stateBase64`, and private key-package material, even though the recovery dialog tells the user that local room access will be removed. The retained legacy secret is still convertible into a usable `BrowserNostrSigner` by `signerForStoredRoom()` in `src/chat/room-store.ts:570-582`.

**Fix:** Make corrupt-record recovery enter the same authority-retirement transaction before publishing a new signer. To do this safely, add durable room ownership provenance/non-secret anonymous identity metadata; if prior ownership cannot be established, require explicit recovery consent to retire every affected local anonymous membership and verify the retired records before clearing the recovery marker. Add unit and Playwright coverage seeded with corrupt identity storage plus a room containing MLS/key-package/legacy-secret authority.

### WARNING

#### WR-01: Successful membership retirement does not notify same-tab room consumers

**File:** `src/chat/room-store.ts:621-642`

**Issue:** `retireAnonymousMemberships()` mutates localStorage but emits no `ROOMS_CHANGED_EVENT` after successful retirement. The only event in this transaction is the rollback event at line 659. `HostWorkspace` and `WorkspaceNav` rely on this event to refresh their persisted-room projections (`src/components/HostWorkspace.svelte:859` and `src/components/WorkspaceNav.svelte:267`). After rotation, the same tab can keep showing an active-looking pre-retirement room until a reload, while the storage record is already read-only.

**Fix:** After all target records have been verified and before returning the journal, dispatch `ROOMS_CHANGED_EVENT` with a `membership-retired` action (and appropriate affected composite identities). Ensure rollback dispatches a compensating refresh. Add a unit test asserting the successful path emits the event and a UI test proving the room projection changes immediately.

#### WR-02: Host-session restoration races identity bootstrap and discards the remembered room selection

**File:** `src/components/HostWorkspace.svelte:274-335, 819-830`

**Issue:** On mount, `restoreHostChat()` runs without waiting for the `identityReady` prop. `openHostChat()` requires `userProfileStore.activeSigner` at lines 274-277, but App starts the asynchronous identity bootstrap separately (`src/App.svelte:26-28`). On ordinary reload this can make restoration fail before the anonymous signer exists; the catch then calls `forgetRememberedHostRoom()` for the remembered room at lines 333-334. Nothing retries when `identityReady` becomes true, so the previous active host room is no longer restored and its selection is lost.

**Fix:** Gate `restoreHostChat()` and intended-host-room selection on `identityReady`, then run them exactly once from a reactive effect when it becomes true. Do not clear the remembered-room key for an unavailable signer; clear it only after identity is ready and `requireRoomSigner()` proves the record is unusable. Add a reload test with a stored anonymous host room that asserts its remembered selection and session restore after identity initialization.

---

_Reviewed: 2026-08-02T16:34:14Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
