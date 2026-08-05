# Phase 15: Identity Continuity & Membership Integrity - Pattern Map

**Mapped:** 2026-08-02  
**Files analyzed:** 13  
**Analogs found:** 12 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/identity/anonymous-identity.ts` | service / utility | file-I/O | `src/config/config.svelte.ts`, `src/chat/room-store.ts` | role-match |
| `src/identity/user-profile.svelte.ts` | store | request-response | itself: `UserProfileStore` | exact |
| `src/crypto/browser-nostr-signer.ts` | service | transform | itself: `BrowserNostrSigner` | exact |
| `src/chat/room-store.ts` | service / model | CRUD, file-I/O | itself: composite storage helpers | exact |
| `src/App.svelte` | component / bootstrap | request-response | itself: app initialization gate | exact |
| `src/components/ChatRoute.svelte` | component / controller | event-driven | itself: join/resume + attach guard | exact |
| `src/components/HostWorkspace.svelte` | component / controller | event-driven | itself: room reconciliation | exact |
| `src/components/UserProfile.svelte` | component | event-driven | itself: anonymous menu and auth actions | exact |
| `src/components/IdentityRotationDialog.svelte` | component | event-driven | `src/components/RoomRemovalDialog.svelte` | exact role/data-flow |
| `tests/unit/user-profile.test.ts` | test | request-response | itself: `UserProfileStore` lifecycle tests | exact |
| `tests/unit/room-navigation.test.ts` | test | CRUD, file-I/O | itself: v2/legacy storage tests | exact |
| `tests/e2e/nip07-session-restoration.spec.ts` | test | event-driven | itself: reload/profile-menu flow | exact |
| `tests/e2e/stale-local-sessions.spec.ts` | test | CRUD, event-driven | itself: localStorage isolation flow | exact |

`src/identity/anonymous-identity.ts` is the only genuinely new source module. It should use the validation/read-back conventions below; no close identity-specific analog exists.

## Pattern Assignments

### `src/identity/anonymous-identity.ts` (service / utility, file-I/O)

**Analog:** `src/chat/room-store.ts` storage validation and migration helpers.

**Validate untrusted storage before exposing it** (lines 641-677, 694-696):

```typescript
function readStoredRoom(raw: string | null): StoredRoom | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    // narrow every persisted field before returning it
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

For the identity module, retain the `try`/narrow pattern but distinguish **absent** from **present-but-corrupt** rather than returning `null` for both. Validate record version, hex form, and decoded 32-byte length before constructing a signer. Never log the record or secret.

**Write then verify before retiring an alias** (lines 786-803):

```typescript
const current = readStoredRoom(localStorage.getItem(nextKey));
if (!sameRoomIdentity(current, room)) localStorage.setItem(nextKey, JSON.stringify(room));
const verified = readStoredRoom(localStorage.getItem(nextKey));
if (storageKey !== nextKey && sameRoomIdentity(verified, room)) {
  const source = readStoredRoom(localStorage.getItem(storageKey));
  if (sameRoomIdentity(source, room)) localStorage.removeItem(storageKey);
}
```

Apply the same persistence transaction for initial creation and rotation: write the versioned record, re-read/validate it, then return/publish the new signer. Keep the old signer active until the rotation caller has completed session teardown and room purge.

### `src/identity/user-profile.svelte.ts` (store, request-response)

**Analog:** existing `UserProfileStore` state ownership.

**Reactive state plus single bootstrap promise** (lines 28-72):

```typescript
method = $state<UserAuthMethod>("anonymous");
pubkey = $state("");
anonymousName = $state("");
profile = $state<NostrProfile | null>(null);
status = $state<UserProfileStatus>("idle");
error = $state("");
initialized = $state(false);
private signer: NostrSigner | null = null;
private initialization: Promise<void> | null = null;

initialize(anonymousPubkey: string, anonymousName = ""): Promise<void> {
  if (this.initialization) this.setAnonymous(anonymousPubkey, anonymousName);
  this.initialization ??= this.bootstrap(anonymousPubkey, anonymousName);
  return this.initialization;
}
```

Change the initializer to own the durable anonymous signer and its recovery state, while retaining the one-promise gate. The anonymous signer must remain separate from `remoteSigner`/`remotePool`.

**Auth-method isolation and actionable error state** (lines 74-91, 107-130):

```typescript
async connectNip07(): Promise<NostrSigner> {
  this.status = "connecting";
  this.error = "";
  try {
    const signer = new ExtensionSigner() as unknown as NostrSigner;
    await this.adoptSigner(signer, "nip07");
    return signer;
  } catch (cause) {
    this.status = "error";
    this.error = cause instanceof Error ? cause.message : "Could not connect the NIP-07 signer";
    throw cause;
  }
}
```

Rotation is anonymous-only: keep NIP-07/NIP-46 methods and persistence out of the anonymous record. Expose an awaitable `rotateAnonymousIdentity()` plus registration/unregistration for anonymous room-session teardowns; only update `$state` after teardown, purge, destruction, and verified replacement persistence succeed.

### `src/crypto/browser-nostr-signer.ts` (service, transform)

**Analog:** existing deterministic local signer (lines 5-31).

```typescript
export class BrowserNostrSigner implements NostrSigner {
  private readonly privateKey: Uint8Array;
  private readonly publicKey: string;

  constructor(privateKey: Uint8Array) {
    this.privateKey = new Uint8Array(privateKey);
    this.publicKey = getPublicKey(this.privateKey);
  }

  async getPublicKey(): Promise<string> { return this.publicKey; }
  async signEvent(event: EventTemplate): Promise<NostrEvent> {
    return finalizeEvent(event, this.privateKey);
  }
}
```

Add a destruction guard in this class (or keep it wholly inside the identity owner). If the class is extended, make its owned buffer mutable, fill it with zero bytes in `destroy()`, mark it destroyed, and make signing/NIP-44 operations reject thereafter. Preserve the constructor’s defensive byte copy and deterministic pubkey derivation.

### `src/chat/room-store.ts` (service/model, CRUD + file-I/O)

**Analog:** existing room creation, attachment, and composite reconciliation.

**One signer determines stored immutable pubkey** (lines 411-446):

```typescript
export async function createJoiningRoom(input: {
  invite: ChatInvite; name: string; signer: NostrSigner;
  anonymousSecretKey?: string; avatar?: string;
}): Promise<StoredRoom> {
  const stablePubkey = await input.signer.getPublicKey();
  const key = await createKeyPackage(stablePubkey);
  const room: StoredRoom = { /* stablePubkey, MLS state, key package */ };
  // publish package/request, close client in finally, then saveRoom(room)
}
```

Replace room-local anonymous secret generation/storage in `createHostedRoom` (lines 374-409) and anonymous join inputs with the active durable signer. Retain `stablePubkey` as the immutable record field.

**Require signer/pubkey agreement before attachment** (ChatRoute lines 485-503):

```typescript
const signerPubkey = await signer.getPublicKey();
if (signerPubkey !== room.stablePubkey) {
  throw new Error("This signer does not match the identity that joined this room");
}
```

Centralize this guard and use it for reconstructed anonymous signers as well as authenticated signers. The current `signerForStoredRoom` at lines 448-450 is intentionally the seam to replace/remove.

**Composite identity is the only storage identity** (lines 633-692):

```typescript
function roomIdentity(coordinatorPubkey: string, id: string): string {
  return `${coordinatorPubkey}\u0000${id}`;
}
function roomStorageKey(coordinatorPubkey: string, id: string): string {
  return `${ROOM_KEY_PREFIX}v2:${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(id)}`;
}
function sameRoomIdentity(left: StoredRoom | null, right: Pick<StoredRoom, "coordinatorPubkey" | "id">): left is StoredRoom {
  return Boolean(left && left.id === right.id && left.coordinatorPubkey === right.coordinatorPubkey);
}
```

Use this exact pair for grouping, migration, removal, active-host cleanup, and the new exhaustive anonymous membership scan. Do not compare title, origin, or room ID alone.

**Session terminal teardown before storage removal** (lines 115-133):

```typescript
stop(): void { /* restartable transport stop */ }
discard(): void {
  this.persistenceEnabled = false;
  this.stop();
}
```

Rotation must register/use `discard()`, not only `stop()`, before deleting anonymous-secret-backed v2 records and aliases.

### `src/App.svelte` (component/bootstrap, request-response)

**Analog:** current identity gate (lines 18-28, 69-81).

```svelte
const identityReady = $derived(userProfileStore.initialized);

$effect(() => {
  void userProfileStore.initialize(homeCoordinatorPubkey ?? "", configStore.userName);
});

<HostWorkspace {identityReady} ... />
```

Preserve the route gate but remove coordinator-pubkey-as-anonymous-identity coupling. Bootstrap the durable identity before `identityReady` becomes true; recovery must hold this gate closed until explicit consent.

### `src/components/UserProfile.svelte` and `src/components/IdentityRotationDialog.svelte` (components, event-driven)

**Analogs:** `UserProfile.svelte` anonymous menu (lines 43-55, 134-175) and `RoomRemovalDialog.svelte` (lines 23-110).

**Menu state and store-owned errors**:

```svelte
let open = $state(false);
const shortKey = $derived(userProfileStore.pubkey
  ? `${userProfileStore.pubkey.slice(0, 8)}…${userProfileStore.pubkey.slice(-6)}`
  : "local identity"
);
```

Place `Rotate identity…` in the existing anonymous section after the display-name control and before external signer controls. It must not render for NIP-07/NIP-46. Use the existing `8…6` summary and only the `local` chip.

**Native destructive modal lifecycle**:

```svelte
onMount(() => {
  dialog?.showModal();
  void tick().then(() => cancelButton?.focus());
});

async function confirm(): Promise<void> {
  if (busy) return;
  busy = true; error = "";
  try { await onConfirm(); dialog?.close("confirmed"); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Unable to rotate your identity"; busy = false; }
}
```

Copy `RoomRemovalDialog`’s native `<dialog>`, `aria-labelledby`/`aria-describedby`, `oncancel` prevention, backdrop click handling, busy disablement, `role="alert"` error, and focus-on-safe-button pattern (lines 33-106). Adapt labels/copy exactly to `15-UI-SPEC.md`: no `Cancel` CTA, default focus `Keep current identity`, a non-dismissable recovery variant, and a polite live status during work.

### `src/components/ChatRoute.svelte` and `src/components/HostWorkspace.svelte` (components/controllers, event-driven)

**Analogs:** ChatRoute’s composite attachment/delete guard (lines 304-311, 485-503) and HostWorkspace’s composite updates (lines 576-625, 728-741).

```typescript
session?.discard();
removeStoredRoom(target);

if (room.id !== expectedRoom.id || room.coordinatorPubkey !== expectedRoom.coordinatorPubkey) return;
if (await signer.getPublicKey() !== room.stablePubkey) {
  throw new Error("This signer does not match the identity that joined this room");
}
```

Register active anonymous sessions with the profile-store rotation teardown registry as they attach/start, and unregister on disposal. Thread the durable signer into anonymous host/join/resume; do not generate a secret in `ChatRoute`. Replace every HostWorkspace `room.id`-only list/update/key comparison with `(coordinatorPubkey, id)` as already done at lines 576-577, 624-627, 728-741; specifically fix line 1134’s `{#each hostedRooms as entry (entry.room.id)}` key.

### Tests (test, request-response / file-I/O / event-driven)

**Unit setup pattern:** `tests/unit/user-profile.test.ts` lines 83-119 creates independent store instances and awaits `initialize`; use it for durable-record/recovery/rotation-order coverage. Keep deterministic synthetic keys out of snapshots and never assert/log private bytes.

**Storage test pattern:** `tests/unit/room-navigation.test.ts` lines 287-332 sets raw legacy/v2 records, exercises public APIs, then proves the intended current value and alias removal. Extend it with same-ID/different-coordinator, verified-read-back, signer mismatch, and exhaustive anonymous alias-purge cases.

**Browser menu/reload pattern:** `tests/e2e/nip07-session-restoration.spec.ts` lines 228-256 opens `data-testid="user-profile"`, queries the accessible `User profile` dialog, reloads, and asserts visible restoration. Add anonymous reload and cancel/confirm/recovery flows using accessibility selectors and dialog test IDs.

**Browser storage-isolation pattern:** `tests/e2e/stale-local-sessions.spec.ts` lines 49-90 seeds explicit v2 localStorage records and lines 212-227 polls storage after action. Use this technique to prove rotation deletes only anonymous local memberships, preserving same-room-ID records at other coordinators and never calling remote group deletion.

## Shared Patterns

### Browser storage validation and migration

**Source:** `src/chat/room-store.ts` lines 641-688, 786-803.  
**Apply to:** anonymous identity record and all room alias reconciliation.

- Parse unknown values in `try/catch`, then narrow every field.
- Write/read-back/compare target before deleting a source alias.
- For identity corruption, expose a distinct recovery state; for room corruption, keep existing fail-safe no-attach behavior.

### Anonymous signer authority

**Source:** `src/crypto/browser-nostr-signer.ts` lines 5-31 and `src/chat/room-store.ts` lines 411-446.  
**Apply to:** identity store, host/join/resume, room attachment.

- `UserProfileStore` owns the durable anonymous signer.
- `stablePubkey` is derived from that signer and verified before a session attaches/sends.
- NIP-07/NIP-46 use `adoptSigner` and never read/write anonymous secret material.

### Destructive local transaction

**Source:** `src/chat/room-store.ts` lines 115-133; `src/components/RoomRemovalDialog.svelte` lines 38-52.  
**Apply to:** anonymous rotation.

1. Disable dialog action and call registered session `discard()` callbacks.
2. Scan/purge all anonymous-secret-backed records and validated aliases by composite room identity.
3. Destroy old secret buffer.
4. Persist and re-validate the replacement identity.
5. Atomically expose the replacement pubkey/profile and close dialog/menu.

If any step before replacement publication fails, retain the old visible identity/access and show the dialog error.

### Composite room identity

**Source:** `src/chat/room-store.ts` lines 505-560, 605-620, 633-692; `tests/unit/room-navigation.test.ts` lines 210-284.  
**Apply to:** all HostWorkspace comparisons, storage scans, migration/removal, and test fixtures.

Always key/group/remove via `(coordinatorPubkey, roomId)`. v2 records win over aliases only after read-back proves the same composite identity.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/identity/anonymous-identity.ts` | service / utility | file-I/O | No existing versioned local signing-identity manager; combine room-store validation/migration conventions with `BrowserNostrSigner`. |

## Metadata

**Analog search scope:** `src/identity`, `src/crypto`, `src/chat`, `src/components`, `tests/unit`, `tests/e2e`  
**Files scanned:** 12 source/test analogs  
**Pattern extraction date:** 2026-08-02
