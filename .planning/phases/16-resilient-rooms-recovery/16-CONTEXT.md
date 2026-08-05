# Phase 16: Resilient Rooms & Recovery - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning
**Mode:** Autonomous smart discuss from explicit user requirements and code-graph evidence

<domain>
## Phase Boundary

Make sidebar navigation and room removal act on the exact coordinator/room intended, add durable per-room unread state, and keep local coordinator startup inside one truthful recovery experience until its hosted rooms are usable. This phase establishes recovery and status semantics consumed by the Phase 17 startup animation; it does not redesign motion, notification settings, or message grouping.

</domain>

<decisions>
## Implementation Decisions

### Contextual sidebar room actions
- **D-01:** Each eligible sidebar room exposes a trailing three-dot trigger on row hover and keyboard focus. Opening the menu must not select or navigate to that room.
- **D-02:** The menu target is captured as the immutable composite `(coordinatorPubkey, roomId)`, never inferred later from the currently open room, title, or room ID alone. — **Reversibility:** costly — Changing this identity contract would reopen cross-coordinator mutation bugs and touch persistence, navigation, and confirmation flows.
- **D-03:** A room hosted by the currently active local coordinator offers **Delete room**; remote participant rooms, retired rooms, and rooms from a previous local coordinator key offer **Leave room**. The host operation deletes coordinator group state and then local state; leave removes only the participant's local membership/cache.
- **D-04:** Both operations use a contextual confirmation dialog that names `# room` and identifies the coordinator/host, states what cached/history data is affected, disables controls while pending, and returns focus to the originating row if cancelled. Success selects the nearest remaining room, or the coordinator empty state when none remains.

### Unread semantics
- **D-05:** Persist read progress per composite room identity. Only newly received messages after the established cache baseline increment unread state; own messages, pending echoes, initial hydration, aliases, and duplicate envelopes do not. — **Reversibility:** costly — The stored read cursor becomes part of the room migration and deduplication contract.
- **D-06:** Clear unread state only for the exact active room when the conversation is actually readable and the document is visible. Switching coordinators or merely focusing a sidebar control must not clear another room.
- **D-07:** Show a compact trailing badge only for nonzero counts, cap presentation at `99+` while retaining the exact count, and derive the coordinator badge from the sum of its room counts. Badge updates must be announced accessibly without making every incoming message verbose.

### Startup recovery state machine
- **D-08:** Coordinator transport/storage startup and local hosted-room recovery form one orchestrated startup transaction. The workspace may replace the startup screen only after transport is ready and every recoverable local hosted room has reached a successful recovered state. — **Reversibility:** costly — The coordinator and room-session lifecycles must share a single progress contract and terminal-state boundary.
- **D-09:** The startup view shows the current room being restored plus aggregate `completed / total` progress. Zero rooms completes the stage immediately; restored rooms are processed deterministically so progress never moves backward.
- **D-10:** Treat connection timeouts as recoverable progress with bounded automatic backoff. A transient attempt stays in the startup/retry experience and must not surface as an MCP error, an offline banner, or a disconnected local chat.
- **D-11:** Only after the retry budget is exhausted may startup show an actionable error. The failed room remains named with a primary retry action and diagnostic detail safe for users; the app does not silently enter a disconnected local-host chat state.
- **D-12:** Repeated start/restart requests share or cancel the active startup transaction so a stale attempt cannot mark a later attempt failed or recreate the `cordn already running` race.

### Reachability and navigation truth
- **D-13:** Green means the coordinator is actually reachable through a confirmed room session. Connecting/recovering is amber, cached/offline is neutral gray, and deleted or terminally unavailable state uses a separate destructive treatment. Selection highlight is visually independent of reachability.
- **D-14:** Every coordinator row remains directly selectable without a page reload. Selection switches context immediately and restores that coordinator's last-open room when it still exists, otherwise its first available room, otherwise its empty state.
- **D-15:** Persist the last-open room as a composite identity and reconcile it against current room storage on reload. Do not route to a removed, foreign, retired-without-cache, or mismatched room.

### the agent's Discretion
- Exact retry count, timeout duration, and backoff values, provided tests use deterministic injected timing and the complete retry window stays humane.
- Whether unread persistence stores a last-read message/cursor or a compact monotonic watermark, provided duplicate and out-of-order delivery cannot inflate counts.
- Exact neutral/destructive colors and menu placement offsets within the existing cypherpunk token palette.
- Which nearest remaining room is selected after removal (previous or next), provided it is deterministic and keyboard focus remains predictable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product contract
- `.planning/ROADMAP.md` — Phase 16 goal, dependency, and five observable success criteria.
- `.planning/REQUIREMENTS.md` — Normative ROOM-01 through ROOM-03 and BOOT-01 through BOOT-03 requirements.
- `.planning/PROJECT.md` — v1.1 scope, browser-only constraints, and validated product invariants.

### Upstream identity and authority boundary
- `.planning/phases/15-identity-continuity-membership-integrity/15-CONTEXT.md` — Composite room identity, durable signer, and cached-room authority decisions that Phase 16 must preserve.
- `.planning/phases/15-identity-continuity-membership-integrity/15-02-SUMMARY.md` — Implemented signer guard, composite reconciliation, and cache-preserving retirement APIs.
- `.planning/phases/15-identity-continuity-membership-integrity/15-SECURITY.md` — Closed cross-coordinator mutation and stale-authority threats that navigation/removal changes must not regress.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkspaceNav.svelte` already groups rooms under coordinators, uses composite room identity, and renders coordinator/room status surfaces.
- `RoomActionsMenu.svelte` and `RoomRemovalDialog.svelte` already provide the content-pane action menu and accessible destructive confirmation patterns; the sidebar should reuse their behavior and styling rather than invent a competing interaction.
- `removeStoredRoom`, `sameRoomIdentity`, `roomIdentityKey`, and `CoordinatorStore.deleteHostedRoom` already enforce exact local-vs-host deletion boundaries.
- `ChatRoomSession` already owns cached messages, connection state, sync polling, server-online events, deduplication, and persistence; it is the natural source of read/unread and recovery attempt signals.
- `CoordinatorStartupProgress`, `startupProgress()`, and `StartupSignalField.svelte` already expose a typed coarse startup contract and screen that can be extended with room-stage data.

### Established Patterns
- Svelte rune stores own long-lived reactive state; state transitions and localStorage records are versioned and validated before use.
- Room authority and list keys are composite `(coordinatorPubkey, roomId)` identities, with verified read-back before alias removal.
- Cached rooms remain readable without granting send authority; reachability is derived from session connection rather than selection or mere storage presence.
- Existing room removal distinguishes local coordinator deletion from participant leave, but the active content pane currently owns the target and the sidebar lacks the required row-level entry point.

### Integration Points
- `WorkspaceNav.svelte` needs row-level hover/focus action triggers, unread badges, coordinator aggregates, truthful state styling, immediate coordinator switching, and last-room restoration.
- `room-store.ts` needs durable read progress and recovery metadata/signals integrated with message deduplication and `ChatRoomSession.syncOnce()`.
- `CoordinatorStore.start()` currently marks the coordinator started immediately after transport creation; Phase 16 must add the hosted-room recovery stage before the UI transition boundary.
- `HostWorkspace.svelte` currently contains both the startup screen and local room-session construction, so it must consume the orchestrated recovery state rather than reveal the chat early.
- `ChatRoute.svelte` and `RoomActionsMenu.svelte` retain remote cached-room behavior, but must share exact removal and read-state semantics with the host workspace.
- Unit coverage belongs in room navigation/store/coordinator state tests; Playwright must cover sidebar actions without opening, exact same-ID coordinator targeting, unread lifecycle, startup retries, and the prohibition against disconnected local chat during startup.

</code_context>

<specifics>
## Specific Ideas

- Restore the polished contextual three-dot room menu interaction that existed before the root/chat shell merge, but place its trigger directly on each sidebar room row.
- The confirmation copy must make the distinction unmistakable: hosts delete their local hosted room; participants leave a remote room; a previous local coordinator key cannot delete a room owned by the current coordinator.
- A green dot always means “coordinator reachable/online,” never “selected,” “cached,” or “room presently displayed.”
- The startup ASCII/progress screen remains visible through hosted-room recovery. Users should see room-by-room progress there instead of ever seeing a same-coordinator offline banner during startup.
- Remember and restore the last valid room for each coordinator across sessions.

</specifics>

<deferred>
## Deferred Ideas

- GSAP ASCII masking and full-viewport startup motion styling — Phase 17 consumes the recovery progress contract created here.
- Consolidated browser/in-app notification controls and cadence — Phase 18.
- Grouped message presentation and expanded reaction polish — Phase 19.

</deferred>

---

*Phase: 16-resilient-rooms-recovery*
*Context gathered: 2026-08-02*
