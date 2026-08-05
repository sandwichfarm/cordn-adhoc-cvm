# Phase 16: Resilient Rooms & Recovery - Pattern Map

**Mapped:** 2026-08-02  
**Files analyzed:** 12  
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/WorkspaceNav.svelte` | component | event-driven | itself: room switcher rows | exact |
| `src/components/RoomRemovalDialog.svelte` | component | request-response | itself: native confirmation dialog | exact |
| `src/components/RoomActionsMenu.svelte` | component | event-driven | itself: accessible three-dot menu | exact |
| `src/components/ChatRoute.svelte` | component | request-response | `src/components/HostWorkspace.svelte` | role-match |
| `src/components/HostWorkspace.svelte` | component | request-response | itself: host session/startup surface | exact |
| `src/chat/room-store.ts` | model/service | CRUD + streaming | itself: `ChatRoomSession.pullMessages` and composite persistence | exact |
| `src/coordinator/types.ts` | model | transform | itself: startup progress contract | exact |
| `src/coordinator/coordinator.svelte.ts` | store/service | event-driven + request-response | itself: `CoordinatorStore.start()` | exact |
| `tests/unit/room-navigation.test.ts` | test | CRUD + transform | itself: composite storage/removal tests | exact |
| `tests/unit/room-session-concurrency.test.ts` | test | streaming + event-driven | itself: mocked `ChatRoomSession` concurrency tests | exact |
| `tests/unit/state-machine.test.ts` | test | transform | itself: table-driven state tests | exact |
| `tests/e2e/phase-one.spec.ts` | test | request-response + event-driven | itself: shared browser/relay harness | exact |

## Pattern Assignments

### `src/components/WorkspaceNav.svelte` (component, event-driven)

**Analog:** existing room switcher and composite-keyed rows in the same file.

**Imports and derived-state pattern** ([lines 2-7, 62-72](../../../src/components/WorkspaceNav.svelte)):

```ts
import { onMount } from "svelte";
import { createSameShellChatHref } from "../chat/room-navigation";
import { hostIdentityForRoom, listRooms, roomIdentityKey, ROOMS_CHANGED_EVENT, SERVER_ONLINE_EVENT, type StoredRoom } from "../chat/room-store";

const storedRooms = $derived(readRooms(roomsRevision));
const roomLinks = $derived(storedRooms.map(toRoomLink));
const homeRooms = $derived(effectiveHomeCoordinatorPubkey
  ? roomLinks.filter((room) => room.coordinatorPubkey === effectiveHomeCoordinatorPubkey)
  : []
);
```

**Identity/key and row activation pattern** ([lines 396-403, 419-426, 443-450](../../../src/components/WorkspaceNav.svelte)):

```svelte
{#each homeRooms as room (roomIdentityKey(room.coordinatorPubkey, room.id))}
  <button class:active={isActive(room)} class="room-row" type="button"
    onclick={() => navigate(room.href)}>
    ...
  </button>
{/each}
```

Capture the action target at this row boundary as an immutable `{ coordinatorPubkey, id }`; action-trigger click/pointer handlers must stop propagation so this `navigate` call cannot run. Use the same composite key for unread state and last-open restoration. Preserve the existing storage/event refresh lifecycle ([lines 255-279](../../../src/components/WorkspaceNav.svelte)).

**Reachability styling pattern** ([lines 144-153, 459-460](../../../src/components/WorkspaceNav.svelte)): selection is `isActive(room)` while connection status is independently derived. Extend this separation: green only for confirmed room connectivity, amber for recovery, neutral for cached/offline, destructive for terminal/deleted.

### `src/components/RoomRemovalDialog.svelte` (component, request-response)

**Analog:** existing native modal behavior.

**Busy/error/confirmation pattern** ([lines 23-53](../../../src/components/RoomRemovalDialog.svelte)):

```ts
let busy = $state(false);
let error = $state("");

async function confirm(): Promise<void> {
  if (busy) return;
  busy = true;
  error = "";
  try {
    await onConfirm();
    dialog?.close("confirmed");
  } catch (cause) {
    error = cause instanceof Error ? cause.message : `Unable to ${mode} this room`;
    busy = false;
  }
}
```

**Accessibility/focus/cancel pattern** ([lines 33-40, 56-70](../../../src/components/RoomRemovalDialog.svelte)): open with `showModal()`, focus the cancel button after `tick()`, prevent native cancel while busy, and delegate final focus restoration through `onClose`. Add coordinator/host copy through props; do not move mutation state into this presentation component.

### `src/components/RoomActionsMenu.svelte` (component, event-driven)

**Analog:** existing accessible three-dot menu.

**Menu lifecycle pattern** ([lines 12-25, 30-69](../../../src/components/RoomActionsMenu.svelte)):

```svelte
<button bind:this={trigger} type="button" aria-haspopup="menu"
  aria-expanded={open} onclick={() => open = !open}>
  <span aria-hidden="true">•••</span>
</button>
{#if open}
  <button class="room-actions-scrim" type="button" aria-label="Close room actions"
    onclick={() => close(true)}></button>
  <div class="room-actions-menu" role="menu">...</div>
{/if}
```

Reuse its Escape/scrim/focus-return behavior for sidebar actions. The sidebar variant must accept/capture the row's composite target before invoking `onRemove`; it must never recover the target from active route state.

### `src/components/HostWorkspace.svelte` and `src/components/ChatRoute.svelte` (components, request-response)

**Analog:** host session restoration and startup gate in `HostWorkspace`.

**Exact-room restore pattern** ([lines 339-365](../../../src/components/HostWorkspace.svelte)):

```ts
const remembered = loadRememberedHostRoom(coordinatorPubkey);
const candidates = remembered ? [remembered, ...hostedRooms.map((entry) => entry.room)
  .filter((candidate) => candidate.id !== remembered.id || candidate.coordinatorPubkey !== remembered.coordinatorPubkey)]
  : hostedRooms.map((entry) => entry.room);

for (const candidate of candidates) {
  const latest = loadRoom(candidate.id, candidate.coordinatorPubkey) ?? candidate;
  await requireRoomSigner(latest, signer);
  await openHostChat(buildHostedRoomEntry(latest).room);
}
```

Keep signer validation and exact composite reconciliation. Replace independent `restoreHostChat()` readiness with coordinator-owned recovery state; `localRoomReady` must require recovery success. The current presentation split is at [lines 1289-1350](../../../src/components/HostWorkspace.svelte); Phase 16 must keep its startup branch mounted through recovery and render terminal retry/error only after the bounded budget.

### `src/chat/room-store.ts` (model/service, CRUD + streaming)

**Analog:** `StoredRoom`, `ChatRoomSession`, exact localStorage functions, and receive loop.

**Schema/session lifecycle pattern** ([lines 42-106, 141-164](../../../src/chat/room-store.ts)):

```ts
export interface StoredRoom {
  version: 1;
  id: string;
  coordinatorPubkey: string;
  lastCursor: number;
  messages: StoredMessage[];
  pending: PendingMessage[];
}

async start(): Promise<void> {
  const generation = ++this.lifecycleGeneration;
  ...
  await this.sync();
  if (this.stopped || generation !== this.lifecycleGeneration) return;
  this.timer = window.setInterval(() => void this.sync(), 4_000);
}
```

Extend the versioned record with optional validated per-room read/last-open/recovery metadata. Keep legacy values readable; malformed optional metadata must be discarded rather than making a cached room disappear.

**Authoritative receive/deduplication hook** ([lines 422-458](../../../src/chat/room-store.ts)):

```ts
const shouldNotify = this.hasCompletedInitialMessageSync;
...
} else if (decoded.envelope && !this.room.messages.some((entry) => entry.id === decoded.envelope?.id)) {
  this.room.messages = [...this.room.messages, { ...decoded.envelope, cursor: message.cursor }];
  if (shouldNotify && decoded.envelope.sender !== this.room.stablePubkey) {
    notificationCenter.enqueue({ category: "new_message", key: decoded.envelope.id, ... });
  }
}
...
this.hasCompletedInitialMessageSync = true;
```

Unread increments belong exactly beside this append gate: after initial hydration, only for a newly appended remote non-pending message. Persist via the existing `finally { this.persist(); this.emit(); }` path ([lines 297-343](../../../src/chat/room-store.ts)); do not derive unread from DOM or notifications.

**Composite persistence/removal pattern** ([lines 741-754, 834-858](../../../src/chat/room-store.ts)): load by `(id, coordinatorPubkey)`, validate the loaded record again, and clear remembered state on exact removal. Evolve `rememberActiveHostRoom`/`loadRememberedHostRoom` to store and validate a composite record rather than allowing an ID-only route.

### `src/coordinator/types.ts` and `src/coordinator/coordinator.svelte.ts` (model/store, event-driven)

**Analog:** typed startup contract and a single `CoordinatorStore.start()` owner.

**Contract pattern** ([types lines 3-21](../../../src/coordinator/types.ts)):

```ts
export interface CoordinatorStartupProgress {
  phase: CoordinatorStartupPhase;
  step: number;
  totalSteps: number;
  percent: number;
  label: string;
  detail: string;
}
```

Add explicit room-recovery fields/types to this contract rather than reconstructing progress in `HostWorkspace`.

**Startup error/state publication pattern** ([lines 236-328, 430-438](../../../src/coordinator/coordinator.svelte.ts)):

```ts
this.status = transitionCoordinator(this.status, "start");
this.setStartupProgress("checking-instance");
...
this.running = await transportFactory.create(...);
this.status = transitionCoordinator(this.status, "started");
...
} catch (error) {
  this.error = error instanceof Error ? error.message : "Coordinator startup failed";
  this.setStartupProgress("failed", this.error);
  this.status = transitionCoordinator(this.status, "error");
}
```

Make recovery a generation-owned continuation inside this transaction. Share/abort active start/retry requests and check generation after every await before publishing progress, attaching a session, or setting failure. Keep user-facing failure safe: room name/status only, no persisted MLS/signing/message detail.

### Tests (test, matching flow)

**Unit storage fixture and exact-removal assertions:** `tests/unit/room-navigation.test.ts` lines 7-39 and 231-264 create full `StoredRoom` fixtures, clear `localStorage` in `beforeEach`, and prove same-ID rooms remain isolated. Extend this file for read-state parsing, composite last-open reconciliation, and exact sidebar removal.

**Unit async/mocking pattern:** `tests/unit/room-session-concurrency.test.ts` lines 5-114 hoists protocol/coordinator mocks and supplies a `deferred()` helper. Add receive-classification and recovery retry/cancellation tests here with injected time/attempt seams—never wall-clock waiting.

**Table-driven reducer pattern:** `tests/unit/state-machine.test.ts` lines 6-31 uses `test.each` to assert valid and invalid transitions. Extend it (or extract a pure recovery reducer first) for monotonic progress, zero rooms, retry, and terminal failure.

**Browser harness pattern:** `tests/e2e/phase-one.spec.ts` lines 1-69 owns the mock relay and coordinator settings helpers. Append Phase 16 cases to this file: sidebar menu without navigation, same-ID exact removal, focus restoration, unread lifecycle, recovery progress/retry, and no disconnected local chat during recovery.

## Shared Patterns

### Composite room authority

**Sources:** `src/components/WorkspaceNav.svelte` lines 396-450; `src/chat/room-store.ts` lines 741-754.

Always pass and revalidate `{ coordinatorPubkey, id }`; `roomIdentityKey` is the keyed-list and persistence identity. Never identify a room by title, active route, or room ID alone.

### Durable updates and UI refresh

**Source:** `src/chat/room-store.ts` lines 297-343 and `src/components/WorkspaceNav.svelte` lines 255-279.

`ChatRoomSession` writes through its `persist()`/`emit()` completion path; storage changes emit `ROOMS_CHANGED_EVENT`; navigation listens and increments a rune revision. New unread/last-open data must flow through this same path.

### Modal and focus behavior

**Sources:** `src/components/RoomRemovalDialog.svelte` lines 33-70; `src/components/RoomActionsMenu.svelte` lines 16-25.

Use native `<dialog>`, busy controls, error retention, Escape/scrim close behavior, and `tick()` focus return. The sidebar must retain a reference to its originating trigger and focus it on cancellation.

### Recovery state safety

**Sources:** `src/coordinator/coordinator.svelte.ts` lines 236-328; `src/chat/room-store.ts` lines 141-164.

`ChatRoomSession` already uses a lifecycle generation to reject stale async work, while `CoordinatorStore.start()` is the single current owner of transport startup. Combine those patterns in one coordinator-owned recovery transaction; never call the normal room offline path for a retryable startup failure.

## No Analog Found

| File/capability | Role | Data Flow | Reason |
|---|---|---|---|
| Coordinator-owned hosted-room recovery transaction | store/service | event-driven | No current recovery coordinator spans transport creation and all host sessions; compose the two existing generation/lifecycle patterns. |
| Durable unread ledger | model | streaming | No persisted unread cursor/count exists; attach it to the established receive and persistence boundaries. |

## Metadata

**Analog search scope:** `src/components`, `src/chat`, `src/coordinator`, `tests/unit`, `tests/e2e`  
**Files scanned:** 12 primary targets plus their direct analogs  
**Pattern extraction date:** 2026-08-02
