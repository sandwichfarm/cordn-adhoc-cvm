---
status: investigating
trigger: "A remote room is shown as remote in the room browser, but its chat action menu offers Delete this room instead of Leave this room, and invoking delete can delete a different local hosted room. Remote and local room UX and destructive targeting must be made consistent and coordinator-scoped."
created: 2026-08-02
updated: 2026-08-02T10:16:37Z
---

# Debug Session: Remote room action targeting

## Symptoms

- expected: A room hosted by another coordinator offers `Leave this room`; leaving removes only that exact remote room membership/cache after a contextual confirmation. A room hosted by the current local coordinator offers `Delete this room`; deleting targets only that exact hosted room after a stronger contextual confirmation.
- actual: A room visibly grouped under a remote coordinator offers `Delete this room`. The destructive action can resolve against a local workspace room and delete a different room instead of the active remote room.
- errors: No runtime error is shown; the failure is contradictory ownership presentation and incorrect destructive targeting.
- timeline: Observed in the current build after joining and opening a remote room while the same browser session also owns a running local coordinator.
- reproduction: Run a local coordinator with hosted rooms, join a room from another coordinator, open that remote chat, open the `Chat actions` sheet, and inspect or invoke the room-removal action.

## Current Focus

- bug_class: bohrbug (provisionally deterministic identity/ownership scoping defect)
- hypothesis: `ChatRoute` initializes the active room only in `onMount`; in-place navigation from a hosted local chat to a remote room updates `currentUrl` but leaves the previous hosted room state mounted. The menu then correctly acts on the stale local room, producing the wrong Delete label and deleting that local room.
- test: Execute the existing `a persistent host can navigate home rooms while communicating on another coordinator` Playwright scenario, which switches between two `/chat/...` URLs through the in-place room switcher.
- expecting: Before a fix, the scenario will fail immediately after it selects `Home alpha`: its URL will change but `active-server-context` remains the prior remote room. This directly demonstrates that `ChatRoute` state did not follow the prop change.
- next_action: Run that single Playwright test with its existing 90-second bound and record its first failing assertion.
- reasoning_checkpoint: pending

## Evidence

- timestamp: 2026-08-02T10:16:37Z
  checked: Phase 0 semantic knowledge-base recall and durable fallback
  found: `mempalace` is not installed on PATH, and `.planning/debug/knowledge-base.md` does not exist.
  implication: No prior-resolution candidate is available; investigate from first-party code evidence.

- timestamp: 2026-08-02T10:16:37Z
  checked: Code graph discovery for room action, ownership, and removal
  found: `room-store.ts` has a composite `roomIdentity`/`sameRoomIdentity` and `removeStoredRoom(room: { id, coordinatorPubkey })`; `CoordinatorStore.deleteHostedRoom` accepts only `groupId` for the local control plane.
  implication: The persistence layer appears composite-aware, while a UI branch that calls the local delete function from a remote active room would explain both the wrong label and wrong target.

- timestamp: 2026-08-02T10:16:37Z
  checked: Exact storage and local-control-plane implementations
  found: `removeStoredRoom` builds a coordinator+room-id key and protects legacy-key removal with `sameRoomIdentity`. In contrast, `CoordinatorStore.deleteHostedRoom(groupId)` unconditionally calls the active local coordinator/storage with that one id; its docstring explicitly limits it to local host control.
  implication: Passing a remote room id into `deleteHostedRoom` deterministically deletes the local same-id room, so the remaining question is whether `ChatRoute` makes that invalid call.

- timestamp: 2026-08-02T10:16:37Z
  checked: Code-graph trace of `ChatRoute` local action functions
  found: The graph identifies `ChatRoute.svelte` as the sole source containing both menu labels but has no symbol nodes for its local Svelte functions; its call trace has no indexed callers for `removeStoredRoom`.
  implication: Graph discovery is insufficient for this Svelte-local control flow, so the permitted fallback is a complete source read scoped to the identified component.

- timestamp: 2026-08-02T10:16:37Z
  checked: `ChatRoute` removal references
  found: The action menu derives its label from `room.isHost`, but `removeCurrentRoom` guards deletion with `target.coordinatorPubkey === coordinatorPubkey` before invoking local `deleteHostedRoom(target.id)`; all paths call composite-aware `removeStoredRoom(target)` afterward.
  implication: The direct UI-to-local-control-plane hypothesis is refuted. The current evidence instead points to incorrect `StoredRoom` ownership/identity before the menu renders.

- timestamp: 2026-08-02T10:16:37Z
  checked: Complete `ChatRoute`, `room-store`, and removal-dialog source
  found: `createHostedRoom` is the only constructor that sets `isHost: true`; `createJoiningRoom` always copies the invite coordinator pubkey and sets `isHost: false`; `ChatRoute` loads a cached room using both invite group id and invite coordinator pubkey. However, `readStoredRoom` accepts any persisted boolean `isHost` and coordinator string without cross-validating whether the room was locally hosted.
  implication: Normal new joins preserve remote ownership, so the remaining high-probability paths are navigation creating the wrong invite identity or persisted data containing a mismatched-but-shape-valid room.

- timestamp: 2026-08-02T10:16:37Z
  checked: Composite chat-navigation helper
  found: `createSameShellChatHref` serializes `StoredRoom.id`, `StoredRoom.coordinatorPubkey`, relay URLs, origin, and host identity into the invite URL; its graph caller data is incomplete.
  implication: The standard helper preserves the composite identity. Investigation must verify whether all room-browser callers use this helper before eliminating navigation as a cause.

- timestamp: 2026-08-02T10:16:37Z
  checked: Graph-augmented caller and test discovery, package test configuration, and worktree status
  found: All source callers found by literal search (`ChatLobby`, `HostWorkspace`, `WorkspaceNav`, and `InviteRedeemer`) use `createSameShellChatHref`; `ChatRoute` is the only `loadRoom` UI caller and passes both fields. Vitest is available, but `package.json` has no coverage command/configuration. The worktree contains extensive unrelated tracked and untracked changes, including the files under investigation.
  implication: No id-only navigation path is present in the current source, so navigation is unlikely to be the cause. SBFL can only be skipped after the narrow suite confirms no failing test, and any fix must be minimal and coexist with current uncommitted work.

- timestamp: 2026-08-02T10:16:37Z
  checked: Complete chat-lobby and composite storage regression tests
  found: `ChatLobby` categorizes remote rooms as `!room.isHost` and opens every room through the composite-safe helper. The unit suite verifies same-id coordinator isolation and exact storage deletion, but has no UI/action-mode or same-component route-transition test.
  implication: A remote room that appears in the remote browser group starts with `isHost: false`; the wrong action must arise after navigation or through a missing UI-layer invariant. The untested same-component route transition is now the leading code branch.

- timestamp: 2026-08-02T10:16:37Z
  checked: `App` route rendering and `WorkspaceNav` room-switching graph evidence
  found: `App.navigate` changes only `currentUrl` with `history.pushState`; any two `/chat/...` destinations keep `isChatRoute` true and render the same unkeyed `<ChatRoute currentUrl={currentUrl}>` instance. `ChatRoute` reads/parses/loads the URL only inside `onMount`, with no reactive rerun. `WorkspaceNav` holds remote-room hrefs and calls the supplied in-place `navigate` callback.
  implication: This precisely produces a stale locally hosted `room` after a remote room is selected in the in-chat room switcher: all action/UI state remains tied to the local room while the URL changes to the remote destination.

- timestamp: 2026-08-02T10:21:46Z
  checked: Phase 1.25 SBFL prerequisites via the bounded `pnpm test -- tests/unit/room-navigation.test.ts` baseline
  found: The Vitest command completed in 2.25 seconds with 20 files/128 tests passing. No failing test exists, and no per-test coverage command/configuration is available.
  implication: SBFL skipped: no failing test and no coverage spectrum. Existing passing storage tests do not exercise the stale in-place route lifecycle.

- timestamp: 2026-08-02T10:21:46Z
  checked: Existing browser tests for room actions and in-place switching
  found: One test verifies contextual local delete and remote leave separately; a second already switches an in-place `ChatRoute` from remote to local and back, but it does not assert the action mode or same-id deletion isolation. Together they provide the nearest regression harness, but neither directly covers the reported remote-after-local destructive target.
  implication: The existing switching test is a direct pre-fix reproduction candidate; the permanent regression must extend that harness to assert local Delete and remote Leave targets by composite identity.

## Eliminated

- hypothesis: `ChatRoute` calls local `deleteHostedRoom` for a remote active room without comparing coordinator identities.
  evidence: The handler at `ChatRoute.svelte:260-275` rejects any target whose `coordinatorPubkey` differs from the local `coordinatorPubkey` before the local delete call.
  timestamp: 2026-08-02T10:16:37Z

- hypothesis: Normal `createJoiningRoom` construction marks a remote invite as hosted or replaces its coordinator pubkey with the local coordinator.
  evidence: `createJoiningRoom` assigns `coordinatorPubkey: input.invite.coordinatorPubkey` and `isHost: false`; only `createHostedRoom` sets `isHost: true`.
  timestamp: 2026-08-02T10:16:37Z

- hypothesis: A current source room-browser navigation site drops/replaces a room coordinator pubkey before `ChatRoute` loads it.
  evidence: Every discovered source navigation caller uses `createSameShellChatHref`, which includes the stored/invite coordinator pubkey; `ChatRoute` loads by group id plus invite coordinator pubkey.
  timestamp: 2026-08-02T10:16:37Z

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
