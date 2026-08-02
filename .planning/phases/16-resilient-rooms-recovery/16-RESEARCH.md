# Phase 16: Resilient Rooms & Recovery - Research

**Researched:** 2026-08-02
**Domain:** Composite room navigation, durable unread state, and browser-local coordinator recovery
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Each eligible sidebar room exposes a trailing three-dot trigger on row hover and keyboard focus. Opening the menu must not select or navigate to that room.
- **D-02:** The menu target is captured as the immutable composite `(coordinatorPubkey, roomId)`, never inferred later from the currently open room, title, or room ID alone. — **Reversibility:** costly — Changing this identity contract would reopen cross-coordinator mutation bugs and touch persistence, navigation, and confirmation flows.
- **D-03:** A room hosted by the currently active local coordinator offers **Delete room**; remote participant rooms, retired rooms, and rooms from a previous local coordinator key offer **Leave room**. The host operation deletes coordinator group state and then local state; leave removes only the participant's local membership/cache.
- **D-04:** Both operations use a contextual confirmation dialog that names `# room` and identifies the coordinator/host, states what cached/history data is affected, disables controls while pending, and returns focus to the originating row if cancelled. Success selects the nearest remaining room, or the coordinator empty state when none remains.
- **D-05:** Persist read progress per composite room identity. Only newly received messages after the established cache baseline increment unread state; own messages, pending echoes, initial hydration, aliases, and duplicate envelopes do not. — **Reversibility:** costly — The stored read cursor becomes part of the room migration and deduplication contract.
- **D-06:** Clear unread state only for the exact active room when the conversation is actually readable and the document is visible. Switching coordinators or merely focusing a sidebar control must not clear another room.
- **D-07:** Show a compact trailing badge only for nonzero counts, cap presentation at `99+` while retaining the exact count, and derive the coordinator badge from the sum of its room counts. Badge updates must be announced accessibly without making every incoming message verbose.
- **D-08:** Coordinator transport/storage startup and local hosted-room recovery form one orchestrated startup transaction. The workspace may replace the startup screen only after transport is ready and every recoverable local hosted room has reached a successful recovered state. — **Reversibility:** costly — The coordinator and room-session lifecycles must share a single progress contract and terminal-state boundary.
- **D-09:** The startup view shows the current room being restored plus aggregate `completed / total` progress. Zero rooms completes the stage immediately; restored rooms are processed deterministically so progress never moves backward.
- **D-10:** Treat connection timeouts as recoverable progress with bounded automatic backoff. A transient attempt stays in the startup/retry experience and must not surface as an MCP error, an offline banner, or a disconnected local chat.
- **D-11:** Only after the retry budget is exhausted may startup show an actionable error. The failed room remains named with a primary retry action and diagnostic detail safe for users; the app does not silently enter a disconnected local-host chat state.
- **D-12:** Repeated start/restart requests share or cancel the active startup transaction so a stale attempt cannot mark a later attempt failed or recreate the `cordn already running` race.
- **D-13:** Green means the coordinator is actually reachable through a confirmed room session. Connecting/recovering is amber, cached/offline is neutral gray, and deleted or terminally unavailable state uses a separate destructive treatment. Selection highlight is visually independent of reachability.
- **D-14:** Every coordinator row remains directly selectable without a page reload. Selection switches context immediately and restores that coordinator's last-open room when it still exists, otherwise its first available room, otherwise its empty state.
- **D-15:** Persist the last-open room as a composite identity and reconcile it against current room storage on reload. Do not route to a removed, foreign, retired-without-cache, or mismatched room.

### the agent's Discretion
- Exact retry count, timeout duration, and backoff values, provided tests use deterministic injected timing and the complete retry window stays humane.
- Whether unread persistence stores a last-read message/cursor or a compact monotonic watermark, provided duplicate and out-of-order delivery cannot inflate counts.
- Exact neutral/destructive colors and menu placement offsets within the existing cypherpunk token palette.
- Which nearest remaining room is selected after removal (previous or next), provided it is deterministic and keyboard focus remains predictable.

### Deferred Ideas (OUT OF SCOPE)
- GSAP ASCII masking and full-viewport startup motion styling — Phase 17 consumes the recovery progress contract created here.
- Consolidated browser/in-app notification controls and cadence — Phase 18.
- Grouped message presentation and expanded reaction polish — Phase 19.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROOM-01 | A user can hover or keyboard-focus an eligible room in the sidebar, open a three-dot context menu, and leave it without first opening that room. | Row-owned composite target, propagation stop, menu trigger/focus lifecycle, and existing dialog reuse. |
| ROOM-02 | Leaving a room from the sidebar targets that exact room and coordinator and requires a contextual confirmation before local membership state is removed. | Existing composite `removeStoredRoom`, host-only `deleteHostedRoom`, and a target-capturing removal dialog pattern. |
| ROOM-03 | Every room with unread messages shows an accurate unread-count badge that increments for newly received messages and clears when the room is read. | Persisted per-composite read state hooked into `ChatRoomSession.pullMessages`, visibility/active-room acknowledgement, and derived coordinator totals. |
| BOOT-01 | Coordinator startup reports room restoration as an explicit progress stage, including the current room and aggregate completion progress. | Extend the typed coordinator progress contract with monotonic hosted-room recovery fields and keep the startup surface mounted. |
| BOOT-02 | Recoverable room connection timeouts remain in the startup/retry experience instead of surfacing as terminal MCP errors; a persistent failure becomes an actionable error only after recovery is exhausted. | A single cancellable recovery transaction with injected clock/sleeper, bounded retry, and a safe user-facing terminal result. |
| BOOT-03 | A locally hosted room cannot render as a disconnected chat while its coordinator startup and room recovery are still in progress. | Gate `localRoomReady` on recovery completion rather than only coordinator transport state; never set the normal room session to offline during a recoverable attempt. |

**Trace note:** `.planning/ROADMAP.md` and the supplied phase scope bind all six IDs to Phase 16; the Phase 16 requirement-to-phase table in `REQUIREMENTS.md` still labels BOOT-01–03 as Phase 17. Treat that table entry as stale and do not defer BOOT work. [VERIFIED: codebase graph]
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Use the codebase-memory graph before text search for code discovery; use `rg` only for literals, configuration, or graph gaps.
- Preserve unrelated concurrent changes; do not revert or overwrite work outside the assigned artifact.
- Keep Svelte 5 runes, strict TypeScript, browser-safe APIs, and existing component/state patterns; introduce no Node-only runtime dependency.
- Keep private keys, invite secrets, and decrypted messages out of logs, errors, snapshots, fixtures, and commits.
- Use `apply_patch` for intentional edits.
- Run the narrowest relevant checks while iterating; the full project gates are `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, and `git diff --check`.

## Summary

Phase 16 should be an extension of the existing composite-room model, not a new navigation or transport subsystem. `roomIdentityKey`, `sameRoomIdentity`, `removeStoredRoom`, and `CoordinatorStore.deleteHostedRoom` already distinguish same-ID rooms from different coordinators and enforce the host-control boundary. The sidebar must capture that same identity before opening its menu and pass it unchanged through confirmation, deletion/leave, selection fallback, and focus restoration. [VERIFIED: codebase graph]

Unread state should belong to durable room storage, keyed by `(coordinatorPubkey, roomId)`, and be updated at the only authoritative receive point: `ChatRoomSession.pullMessages`. That method already separates initial synchronization using `hasCompletedInitialMessageSync`, excludes duplicate message IDs, excludes the local signer from notifications, and persists room state after every sync; attach unread accounting to those existing gates rather than to rendered message lists or notification UI. [VERIFIED: codebase graph]

Recovery must make coordinator startup and host-room restoration one cancellable transaction. Today `CoordinatorStore.start()` reaches `running` once transport creation succeeds, while `HostWorkspace` independently opens a session for a remembered hosted room and renders an offline panel if it cannot connect. Replace that split terminal boundary with a recovery controller owned by the coordinator/startup layer; it emits transport and per-room stages, retries recoverable timeouts, and only permits the normal hosted chat after every recoverable local hosted room succeeds. [VERIFIED: codebase graph]

**Primary recommendation:** Extend existing room storage and `ChatRoomSession` with composite read/recovery metadata, and introduce one generation-owned coordinator recovery transaction that the workspace consumes as its sole startup truth. [ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contextual room leave/delete | Browser / Client | Database / Storage | UI captures identity and focus; exact persistence/group mutation occurs only after confirmation. [VERIFIED: codebase graph] |
| Composite unread cursor/count | Database / Storage | Browser / Client | Read progress must survive reload and is rendered as a derived room/coordinator badge. [ASSUMED] |
| New-message classification | Browser / Client | — | The in-memory `ChatRoomSession` is where decrypted envelopes, dedupe, pending echoes, and initial hydration are known. [VERIFIED: codebase graph] |
| Hosted-room startup recovery | Frontend Server (SSR) | Browser / Client | In this browser-only app the coordinator store is the lifecycle authority; the workspace only renders its state. [ASSUMED] |
| Coordinator group deletion | API / Backend | Database / Storage | `CoordinatorStore.deleteHostedRoom` owns the local control-plane deletion, followed by exact local cache removal. [VERIFIED: codebase graph] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte | 5.56.3 | Runes-based component state and accessible UI | The project already uses `$state`, `$derived`, `$effect`, native events, and components for long-lived UI state. [VERIFIED: codebase graph] |
| TypeScript | 5.9.3 | Strict recovery and identity contracts | Existing project configuration compiles TypeScript before production build. [VERIFIED: codebase graph] |
| Browser platform APIs | native | `localStorage`, `visibilitychange`, `AbortController`, `<dialog>` | These meet the persistence, visibility, cancellation, and modal requirements without a runtime dependency. Native modal dialogs provide modal/inert behavior and a close lifecycle. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.9 | Store/session/recovery state tests | Inject clock, timeout, and transport/session seams to prove retry and unread invariants without wall-clock waits. [VERIFIED: codebase graph] |
| Playwright | 1.61.0 | Rendered sidebar, focus, and startup proofs | Prove non-navigation menu opening, exact same-ID targeting, visible recovery state, and no premature disconnected host chat. [VERIFIED: codebase graph] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Versioned `StoredRoom` fields | A new global unread/recovery `localStorage` index | A separate index must reconcile every remove/migrate/alias path; keeping metadata with the composite room record preserves current verified read/write and removal boundaries. [ASSUMED] |
| Coordinator-owned recovery transaction | Independent `HostWorkspace` async restoration | Independent UI work recreates the current race where transport reports running before room recovery is terminal. [VERIFIED: codebase graph] |
| Native `<dialog>` | Custom modal/focus trap | The project already has a native dialog with busy/error/cancel handling; a custom trap duplicates browser behavior. [VERIFIED: codebase graph] |

**Installation:** No package installation or upgrade is required. [VERIFIED: codebase graph]

## Architecture Patterns

### System Architecture Diagram

```text
Sidebar room row (captured coordinatorPubkey + roomId)
  ├─ three-dot trigger (stop propagation) ──> contextual menu
  │                                             └─> removal dialog
  │                                                   ├─ current local host: delete coordinator group
  │                                                   └─ otherwise: leave local membership/cache
  │                                                        └─ remove exact stored room → select deterministic neighbor
  └─ row activation ──> persist/reconcile last-open composite identity → open selected room

ChatRoomSession.pullMessages()
  ├─ initial hydration / duplicate / own/pending? ──> advance cursor only
  └─ qualifying remote envelope ──> update composite unread state → save room → nav room badge → coordinator sum

Coordinator start transaction
  ├─ instance/storage/transport ready
  └─ deterministic hosted-room recovery queue
       ├─ attempt succeeds ──> completed += 1
       ├─ recoverable timeout ──> amber retry + bounded backoff
       └─ retry budget exhausted ──> named actionable failure; keep startup surface mounted
             └─ all rooms recovered only ──> expose normal local hosted chat
```

### Recommended Project Structure

```text
src/
├── chat/room-store.ts                 # StoredRoom schema, read progress, session receive/recovery hooks
├── coordinator/coordinator.svelte.ts  # generation-owned startup/recovery transaction and typed progress
├── coordinator/types.ts               # explicit recovery progress/result types
└── components/
    ├── WorkspaceNav.svelte            # row actions, badges, coordinator selection/last-room restoration
    ├── HostWorkspace.svelte           # presentation-only startup and local-chat gate
    └── RoomRemovalDialog.svelte       # shared confirmation copy and cancel focus contract
tests/
├── unit/room-navigation.test.ts       # composite persistence, removal, unread/last-open invariants
├── unit/room-session-concurrency.test.ts # receive dedupe and deterministic recovery behavior
├── unit/state-machine.test.ts         # startup state/progress transitions
└── e2e/phase-one.spec.ts              # existing navigation/recovery browser harness; append phase proofs
```

### Pattern 1: Immutable action target with event isolation

**What:** Each row owns a `RoomIdentity` captured when its trigger opens; the trigger stops click/pointer propagation so opening the menu cannot invoke the row navigation handler. The dialog receives the captured object, not active-route state. [ASSUMED]

**When to use:** For each home, remote, and previous-local sidebar room whose current storage record remains eligible for leave/delete. [ASSUMED]

**Example:**

```ts
// Existing project identity primitive: [VERIFIED: codebase graph]
type RoomTarget = Readonly<{ coordinatorPubkey: string; id: string }>;

function requestRowActions(event: MouseEvent, room: RoomLink) {
  event.stopPropagation();
  menuTarget = { coordinatorPubkey: room.coordinatorPubkey, id: room.id };
}

function removeCapturedRoom(target: RoomTarget) {
  // Look up by both fields again; never derive from the current route/title.
  const room = loadRoom(target.id, target.coordinatorPubkey);
  if (!room || !sameRoomIdentity(room, target)) return;
}
```

### Pattern 2: Receive-time unread ledger

**What:** Add a validated optional versioned field to the persisted room record, such as `readState: { baselineCursor, lastReadCursor, unread }`. Establish the baseline at the first completed hydration; only after that, increment for a newly appended non-own, non-pending envelope. Use a cursor/message identity comparison that is monotonic under duplicate and out-of-order delivery. [ASSUMED]

**When to use:** Inside `pullMessages`, before `saveRoom`, and in an explicit `markRoomRead(identity)` invoked only after the matching chat pane is readable and the document is visible. [ASSUMED]

**Example:**

```ts
// Adapt to the existing ChatRoomSession receive loop. [ASSUMED]
const newlyAdded = decoded.envelope
  && !this.room.messages.some((entry) => entry.id === decoded.envelope.id);
const incomingFromOther = decoded.envelope?.sender !== this.room.stablePubkey;

if (this.hasCompletedInitialMessageSync && newlyAdded && incomingFromOther) {
  this.room.readState = incrementUnread(this.room.readState, message.cursor, decoded.envelope.id);
}
```

### Pattern 3: Single-writer, generation-cancelled recovery

**What:** Model `start()`/`restart()` as a shared active transaction with an incrementing generation and `AbortController`. A later request joins the same intent or aborts/replaces it; every awaited room attempt verifies it still owns the generation before publishing progress or terminal state. `AbortController` provides a browser-standard signal for cancelling supported async work. [CITED: https://developer.mozilla.org/docs/Web/API/AbortController]

**When to use:** For coordinator transport start, each hosted room's connect/sync attempt, scheduled backoff, stop, restart, and manual retry. [ASSUMED]

**Example:**

```ts
// Recovery-controller sketch; use injected timer/session factories in unit tests. [ASSUMED]
private recovery: { generation: number; controller: AbortController; promise: Promise<void> } | null = null;

async recoverHostedRooms(rooms: StoredRoom[], signal: AbortSignal, generation: number) {
  for (const room of rooms.sort(compareRoomIdentity)) {
    await retryRoom(room, { signal, sleep: this.sleep, maxAttempts: 3 });
    if (signal.aborted || this.recovery?.generation !== generation) return;
    this.publishRecoverySuccess(room);
  }
}
```

### Pattern 4: Reachability and selection are separate derived facts

**What:** Continue to style selection from the selected composite identity; calculate green only from a confirmed connected room session. During recovery, render amber. Cached/offline stays neutral gray; terminal deletion/unavailability gets destructive treatment. [VERIFIED: codebase graph]

**Anti-Patterns to Avoid**

- **Inferring the removal target from the active room:** It reintroduces same-ID cross-coordinator deletion/leave errors; carry a frozen composite target. [VERIFIED: codebase graph]
- **Incrementing unread from DOM effects, live regions, or notification enqueueing:** They cannot distinguish initial cache hydration, aliases, duplicates, or own pending echoes. [VERIFIED: codebase graph]
- **Calling `markServerOffline` for a recoverable startup timeout:** This produces the prohibited disconnected local-chat state and conflicts with the recovery UI contract. [ASSUMED]
- **Making `CoordinatorStore.status === "running"` the local-chat ready signal:** Existing code reaches that status before hosted session restoration completes. [VERIFIED: codebase graph]
- **Letting old recovery promises write progress:** A stale failure can overwrite a later start/retry result; gate every publish by generation/abort state. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Composite room lookup | Title/room-ID-only mapping | `roomIdentityKey`, `sameRoomIdentity`, `loadRoom(id, coordinatorPubkey)` | Existing Phase 15 safety boundary already isolates same IDs across coordinators. [VERIFIED: codebase graph] |
| Host group deletion | A sidebar-side group mutation | `CoordinatorStore.deleteHostedRoom` followed by `removeStoredRoom` | It verifies local coordinator ownership before deletion and preserves the control-plane/local-state ordering. [VERIFIED: codebase graph] |
| Modal semantics/focus containment | Custom overlay/focus trap | Existing `RoomRemovalDialog` native `<dialog>` | Existing dialog handles modal open, cancel, busy state, error, and close callback; native modal dialogs place the dialog in the top layer and make document siblings inert. [VERIFIED: codebase graph] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal] |
| Retry cancellation | Ad-hoc boolean flags shared by UI components | Generation + `AbortController` owned by coordinator recovery | Browser cancellation is composable; generation checks prevent non-abortable stale work from publishing. [CITED: https://developer.mozilla.org/docs/Web/API/AbortController] [ASSUMED] |
| Message deduplication | A second unread-specific de-dup cache | Existing message-ID/cursor gates in `pullMessages` | A parallel cache will diverge from the encrypted message session's authoritative history. [VERIFIED: codebase graph] |

**Key insight:** This phase has existing primitives for every dangerous boundary; compose them into one explicit recovery/read contract rather than duplicating state at the sidebar or startup surface. [VERIFIED: codebase graph]

## Common Pitfalls

### Pitfall 1: A menu click selects the row

**What goes wrong:** Opening a three-dot menu navigates into the room, invalidating ROOM-01 and changing the source of truth before confirmation. [ASSUMED]

**Why it happens:** The action trigger is nested in a clickable row and event propagation is not stopped. [ASSUMED]

**How to avoid:** Make the trigger its own accessible button; stop propagation for pointer/click events; preserve the captured target and return focus to its originating trigger on dialog cancellation. [ASSUMED]

**Warning signs:** The URL/active-room label changes when the action trigger is clicked or keyboard activated. [ASSUMED]

### Pitfall 2: Hydration produces phantom unread badges

**What goes wrong:** Every cached message appears new after reload, or an echoed/polled message increments twice. [ASSUMED]

**Why it happens:** Counting based on message-array change lacks `hasCompletedInitialMessageSync`, own-sender, pending, duplicate-ID, and cursor safeguards. [VERIFIED: codebase graph]

**How to avoid:** Seed baseline on initial sync; update only when the existing receive loop appends a qualifying remote envelope; persist a validated composite cursor/watermark. [ASSUMED]

**Warning signs:** A reload changes unread counts without a received envelope, or counts increase when a user sends their own message. [ASSUMED]

### Pitfall 3: Transport-ready is mistaken for room-ready

**What goes wrong:** The coordinator becomes `running` and HostWorkspace renders an offline/disconnected hosted chat during a transient room recovery attempt. [VERIFIED: codebase graph]

**Why it happens:** `CoordinatorStore.start()` currently transitions to `running` immediately after transport creation, while hosted session restoration runs independently in HostWorkspace. [VERIFIED: codebase graph]

**How to avoid:** Add a recovery terminal condition and drive both startup screen visibility and local-chat eligibility from it; only terminal exhaustion may show the named retry error. [ASSUMED]

**Warning signs:** `status-badge` reports running while `room-connection-panel` says local room offline. [VERIFIED: codebase graph]

### Pitfall 4: Restart races create false errors

**What goes wrong:** An old retry finishes after a newer start, marks the current recovery failed, or triggers the single-instance collision message. [ASSUMED]

**Why it happens:** Timers and promises outlive the view/start invocation unless owned and invalidated by a transaction. [ASSUMED]

**How to avoid:** Store one active recovery promise/controller, abort it from stop/restart, and require generation equality before status updates, session attachment, or timer scheduling. [ASSUMED]

**Warning signs:** Progress regresses, current-room label changes backward, or `cordn already running` appears after retry/restart. [ASSUMED]

## Code Examples

### Exact deletion boundary

```ts
// Existing project pattern, src/coordinator/coordinator.svelte.ts. [VERIFIED: codebase graph]
if (target.coordinatorPubkey.trim().toLowerCase() !== this.identity.publicKeyHex.toLowerCase()) {
  throw new Error("Cannot delete a room hosted by another coordinator");
}
await coordinator.deleteHostedRoom(target);
removeStoredRoom(target);
```

### Read only the visible exact room

```ts
// Recommended call-site guard. [ASSUMED]
function acknowledgeVisibleRoom(identity: RoomIdentity) {
  if (document.visibilityState !== "visible") return;
  if (!sameRoomIdentity(activeRoom, identity)) return;
  markRoomRead(identity);
}
```

### Native dialog cancellation/focus contract

```ts
// The existing dialog's close handler is the hand-off point. [VERIFIED: codebase graph]
// Store the originating sidebar trigger with its immutable RoomTarget.
onClose={() => {
  removalTarget = null;
  void tick().then(() => originatingRowTrigger?.focus());
}}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Room ID/title could be treated as room identity | Composite `(coordinatorPubkey, roomId)` identity is the project authority boundary | Phase 15 | All navigation, read state, removal, and remembered room records must use both fields. [VERIFIED: codebase graph] |
| Independent room-local anonymous credentials | Durable active signer plus strict room signer matching | Phase 15 | Recovery must preserve cache-only/retired behavior and may not recreate authority. [VERIFIED: codebase graph] |
| Coordinator startup ends at transport creation | Coordinator startup must include hosted-room recovery | Phase 16 decision | Add a recovery terminal state before exposing local hosted chat. [ASSUMED] |

**Deprecated/outdated:**

- `hostRoomRestoreReady` / `restoreHostChat()` as an independent presentation lifecycle is insufficient for the locked startup transaction; use it only through the coordinator-owned recovery protocol. [VERIFIED: codebase graph] [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A versioned `StoredRoom.readState` field is the least risky persistence location for unread state. | Standard Stack / Pattern 2 | A separate index could be required if storage migration constraints reject record extension. |
| A2 | A three-attempt bounded recovery policy with injected time is suitable. | Pattern 3 | Product may need a different retry window; timing must remain a planner decision and be test-configurable. |
| A3 | CoordinatorStore can own the recovery controller without a separate module. | Summary / Pattern 3 | The existing transport factory may require an extracted service seam for clean cancellation. |
| A4 | The frontend-server label is the closest tier name for the browser-local coordinator lifecycle authority. | Responsibility Map | This naming does not imply SSR; implementation remains browser-only. |

## Open Questions

1. **Precise retry policy**
   - What we know: The retry count, timeout, and backoff are explicitly delegated, and current polling occurs every four seconds. [VERIFIED: codebase graph]
   - What's unclear: The coordinator client does not yet expose a tested per-attempt timeout/cancellation seam. [VERIFIED: codebase graph]
   - Recommendation: Plan a small injectable recovery runtime (`attempt`, `sleep`, `now`/timer) and select concrete values during implementation; do not embed sleeps in browser tests. [ASSUMED]

2. **Last-open persistence ownership**
   - What we know: Local-host remembered selection currently stores only a room ID under a coordinator-specific key; navigation needs every coordinator's composite last-open identity. [VERIFIED: codebase graph]
   - What's unclear: Whether to evolve that existing key into a validated `{ coordinatorPubkey, roomId }` record or add a single versioned navigation preference record. [ASSUMED]
   - Recommendation: Reuse the existing per-coordinator namespace but validate/read back the composite identity and remove it when exact room removal succeeds. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Type checks, Vitest, Vite/Playwright build | ✓ | v25.2.1 | — |
| pnpm | Project scripts | ✓ | 10.17.1 | — |
| Browser native APIs | Dialog, visibility, storage, cancellation | ✓ in supported browser target | native | Existing app already depends on them. [VERIFIED: codebase graph] |
| Existing mock relay/browser harness | E2E recovery proof | ✓ in repository | Playwright 1.61.0 | Use current `phase-one.spec.ts` helpers. [VERIFIED: codebase graph] |

**Missing dependencies with no fallback:** None. [VERIFIED: codebase graph]

**Missing dependencies with fallback:** None. [VERIFIED: codebase graph]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + Playwright 1.61.0. [VERIFIED: codebase graph] |
| Config file | `playwright.config.ts`; Vitest uses the Vite/Svelte project setup without a dedicated `vitest.config.*`. [VERIFIED: codebase graph] |
| Quick run command | `pnpm exec vitest run tests/unit/room-navigation.test.ts tests/unit/room-session-concurrency.test.ts tests/unit/state-machine.test.ts` |
| Full suite command | `pnpm test && pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROOM-01 | Trigger sidebar menu by hover/focus without opening row; cancel returns focus. | e2e | `pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "sidebar room actions"` | ❌ Wave 0 |
| ROOM-02 | Same room ID under two coordinators removes only captured target; host delete versus previous/remote leave. | unit + e2e | `pnpm exec vitest run tests/unit/room-navigation.test.ts && pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "same-id sidebar removal"` | ⚠️ Extend existing |
| ROOM-03 | Initial hydrate/own/pending/duplicate produce no unread; qualifying receive increments; active visible room clears. | unit + e2e | `pnpm exec vitest run tests/unit/room-session-concurrency.test.ts tests/unit/room-navigation.test.ts` | ❌ Wave 0 |
| BOOT-01 | Deterministic hosted rooms report current name and completed/total progress, including zero rooms. | unit + e2e | `pnpm exec vitest run tests/unit/state-machine.test.ts && pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "hosted-room recovery progress"` | ❌ Wave 0 |
| BOOT-02 | Recoverable failures stay in retry state; bounded terminal error names room and retries safely. | unit + e2e | `pnpm exec vitest run tests/unit/room-session-concurrency.test.ts tests/unit/state-machine.test.ts` | ❌ Wave 0 |
| BOOT-03 | During local recovery, startup screen remains and disconnected host chat never appears. | e2e | `pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "does not render disconnected local chat during recovery"` | ⚠️ Extend existing offline-startup case |

### Sampling Rate

- **Per task commit:** Focused Vitest suite for the touched store/coordinator plus the matching Playwright grep.
- **Per wave merge:** `pnpm lint && pnpm exec tsc --noEmit && pnpm test`.
- **Phase gate:** `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check`.

### Wave 0 Gaps

- [ ] Extend `tests/unit/room-navigation.test.ts` with validated read-state, last-open composite identity, and exact sidebar-target removal tests.
- [ ] Extend `tests/unit/room-session-concurrency.test.ts` with receive classification and injected recovery retry/cancellation tests.
- [ ] Extend `tests/unit/state-machine.test.ts` for recovery progress terminal transitions, or extract a small pure recovery reducer and test it there.
- [ ] Extend `tests/e2e/phase-one.spec.ts` with sidebar contextual action/focus, unread lifecycle, recovery progress/retry, and no-disconnected-local-chat assertions.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Preserve `requireRoomSigner` before restoring any send-capable session. [VERIFIED: codebase graph] |
| V3 Session Management | yes | Discard/cancel stale sessions and recovery attempts by generation; do not allow an old attempt to attach after restart. [ASSUMED] |
| V4 Access Control | yes | Frozen composite action target; only current local coordinator identity may call host deletion. [VERIFIED: codebase graph] |
| V5 Input Validation | yes | Strictly parse/version new persisted read/last-open/recovery records and reconcile to an existing exact room before routing. [ASSUMED] |
| V6 Cryptography | yes | No new crypto; never log room state, signer material, or decrypted envelopes in recovery diagnostics. [VERIFIED: codebase graph] |

### Known Threat Patterns for Svelte/browser-local room recovery

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Same-ID foreign room mutation | Elevation of privilege / Tampering | Require `(coordinatorPubkey, roomId)` on every lookup, removal, and host-deletion call. [VERIFIED: codebase graph] |
| Stale recovery overwrites current state | Tampering / Denial of service | Generation and abort ownership checks before every state publish or session attach. [ASSUMED] |
| Malformed persisted cursor/last-open record routes incorrectly | Tampering | Versioned strict parsing, exact room reconciliation, and deletion of invalid/foreign reference. [ASSUMED] |
| Recovery error exposes private material | Information disclosure | User-safe room name/status only; diagnostics exclude secrets, message content, MLS state, and invite tokens. [VERIFIED: codebase graph] |
| Unread badge leaks remote activity across rooms | Information disclosure | Persist/read only under exact composite identity; clear only active visible room; announce summarized badge updates. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- Codebase-memory graph and source inspection — `room-store.ts`, `coordinator.svelte.ts`, `HostWorkspace.svelte`, `WorkspaceNav.svelte`, `ChatRoute.svelte`, and existing room/coordinator tests. [VERIFIED: codebase graph]
- `.planning/phases/16-resilient-rooms-recovery/16-CONTEXT.md` — locked product and recovery decisions. [VERIFIED: codebase graph]
- `.planning/ROADMAP.md` — Phase 16 requirements and observable success criteria. [VERIFIED: codebase graph]

### Secondary (MEDIUM confidence)

- [MDN `<dialog>` reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) — modal focus/close considerations.
- [MDN `AbortController` reference](https://developer.mozilla.org/docs/Web/API/AbortController) — browser cancellation signal semantics.

### Tertiary (LOW confidence)

- Retry count/backoff choice and exact persisted read-record shape are deliberately left for implementation-time decision and require deterministic tests. [ASSUMED]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependency; all named tools are installed project dependencies or native browser APIs.
- Architecture: HIGH — current source has direct seams for composite room state, session receive, coordinator start, and host rendering.
- Pitfalls: HIGH — they follow observed split lifecycle and composite-identity behavior; retry mechanics are MEDIUM until the client cancellation seam is inspected during planning.

**Research date:** 2026-08-02
**Valid until:** 2026-09-01
