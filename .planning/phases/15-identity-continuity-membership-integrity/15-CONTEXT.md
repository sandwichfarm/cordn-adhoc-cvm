# Phase 15: Identity Continuity & Membership Integrity - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning
**Mode:** Autonomous smart discuss from explicit user requirements and code evidence

<domain>
## Phase Boundary

Deliver one durable browser-local anonymous identity, make explicit rotation a clear privacy boundary, and reconcile stored room/coordinator records by stable composite identity. This phase does not redesign authenticated NIP-07/NIP-46 login or the conversation UI.

</domain>

<decisions>
## Implementation Decisions

### Durable anonymous identity
- Store one versioned, strictly validated 32-byte anonymous secret locally and derive its public key; do not reuse the coordinator key as the user's anonymous identity.
- `UserProfileStore` owns and exposes the durable anonymous signer while the active method is anonymous.
- Preserve the existing persisted anonymous display name/profile configuration separately from signing material.
- Corrupt persisted identity material fails closed into an explicit recovery/rotation path; it must not silently rotate on reload.

### Room authority
- Newly hosted and joined anonymous rooms use the durable anonymous signer and immutable `stablePubkey` rather than generating unrelated room identities.
- Any reconstructed signer must derive exactly the stored room `stablePubkey` before a session can attach or send.
- Authenticated NIP-07/NIP-46 signers remain isolated from anonymous credential storage and rotation.

### Identity rotation
- Rotation is available only for the anonymous/local identity and requires a contextual confirmation explaining that room memberships on this device will not carry over.
- On confirmation, tear down matching in-memory sessions and remove anonymous room records/credentials before persisting and exposing the fresh signer.
- Rotation removes local room membership state but does not delete the coordinator's hosted group data for other participants.
- After rotation, the new identity must receive or redeem a new invite before sending to any prior room.

### Reconciliation and migration
- `(coordinatorPubkey, roomId)` is the sole room identity for lookup, grouping, removal, and migration. Never merge by title, origin, or room ID alone.
- Prefer verified current v2 storage records and remove legacy aliases only after the target write can be read back and proven to represent the same composite room.
- Do not choose an arbitrary legacy per-room key as the new global identity when stored rooms contain multiple old pubkeys.
- Legacy records remain isolated during migration; rotation removes all anonymous-secret-backed local memberships so old credentials cannot outlive the privacy boundary.

### Agent's Discretion
- Exact storage module/file naming, version number, and validation helper organization.
- Whether signer zeroization is implemented on `BrowserNostrSigner` or in a dedicated anonymous-identity manager, provided old secret buffers are destroyed before the new identity becomes active.
- Exact confirmation-dialog copy and visual treatment, consistent with existing destructive/privacy confirmations.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UserProfileStore` already centralizes anonymous, NIP-07, and NIP-46 presentation state and session restoration.
- `BrowserNostrSigner` deterministically derives a pubkey from secret bytes and signs room envelopes.
- `RoomRemovalDialog.svelte` provides an accessible contextual confirmation pattern.
- `roomIdentity`, `sameRoomIdentity`, `roomStorageKey`, and `migrateLegacyRoom` already establish a composite room-key model.

### Established Patterns
- Versioned localStorage records are validated before use; malformed records fall back or surface an explicit error.
- Room records currently persist `stablePubkey`, MLS state, key package, and (for local anonymous room signers) `anonymousSecretKey`.
- NIP-07 persists only a local selection marker and restores the extension signer; NIP-46 remains memory-only.
- Source migrations write/verify the new record before removing an old alias.

### Integration Points
- `App.svelte` currently initializes anonymous profile state from the coordinator public key and must instead bootstrap the anonymous identity manager.
- `ChatRoute.svelte` currently creates a new secret for anonymous joins and resumes stored room signers.
- `createHostedRoom` and `createJoiningRoom` currently accept/generate per-room signing material.
- `HostWorkspace.svelte` contains several room comparisons that must consistently use the composite identity.
- Unit coverage lives in `user-profile.test.ts`, `room-navigation.test.ts`, and room-store/protocol tests; browser flows live in `nip07-session-restoration.spec.ts`, `stale-local-sessions.spec.ts`, and `phase-one.spec.ts`.

</code_context>

<specifics>
## Specific Ideas

- The identity menu should describe the current anonymous identity as device-local and offer a clearly labeled rotate/refresh action.
- Confirmation copy must explicitly state that local room access is removed and fresh invitations are required, while coordinator-hosted data is not destroyed.
- Reloading must return the same anonymous pubkey/avatar without an identity-selection flash.

</specifics>

<deferred>
## Deferred Ideas

- Passphrase-protecting the device-local anonymous identity.
- Restoring historical room access after deliberate rotation.
- Persisting or auto-restoring NIP-46 sessions.

</deferred>
