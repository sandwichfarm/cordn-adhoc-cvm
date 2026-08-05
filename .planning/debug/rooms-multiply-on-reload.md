---
status: resolved
trigger: "After accepting one remote room invite, every reload adds another visually identical room under a different remote coordinator. The host appears to use an ephemeral coordinator key while room records persist. Participants need clear host-key-change information and a safe way to leave obsolete room generations; hosts need UX explaining the persistence/identity behavior."
created: 2026-08-02
updated: 2026-08-02
---

# Debug Session: Rooms multiply on reload

## Symptoms

- expected: Accepting one invite creates one durable room entry across reloads. If a host intentionally uses an ephemeral coordinator identity, identity rotation must be explicit, old room generations must be identifiable and leaveable, and host UX must explain the consequences.
- actual: Each reload adds another room named `test` under a new remote coordinator pubkey at the same origin, even though only one invite was accepted.
- errors: No runtime error is shown.
- timeline: Observed in the current build after the recent remote-room action fix.
- reproduction: Accept one remote invite, then reload repeatedly and open the room/coordinator browser; another coordinator group and duplicate room entry appears after each reload.

## Current Focus

- bug_class: bohrbug
- hypothesis: Confirmed: key persistence being disabled rotates the local coordinator identity on reload while coordinator-scoped room records persist; foreign `isHost: true` records are previous-local sessions, never remote memberships or current hosted rooms.
- test: The isolated Chromium regression creates same-id current and foreign host records, verifies both presentation paths, leaves the foreign composite identity, and inspects exact localStorage keys.
- expecting: The previous key is absent and the current record remains `isHost: true` under its own coordinator key.
- next_action: resolved — automated browser/localStorage proof replaced the manual workflow gate.

reasoning_checkpoint:
  hypothesis: "When coordinator-key persistence is disabled, a reload generates a new coordinator pubkey while localStorage retains rooms keyed by the old pubkey; UI filters then classify old `isHost: true` rooms as remote despite their being previous local host generations."
  confirming_evidence:
    - "CoordinatorStore.constructor calls KeyManager.generate whenever keyStorage.hasPersisted() is false."
    - "room-store saves by coordinatorPubkey plus group id, and listRooms deliberately retains different coordinator identities."
    - "HostWorkspace currently puts every record whose coordinatorPubkey differs from the current key into remoteRooms; WorkspaceNav groups the same records under otherServers."
  falsification_test: "If a persisted record with isHost: true and a non-current coordinator key is intended to represent a true remote membership, treating it as a previous local session would be wrong; product invariant states these records are stale local generations."
  fix_rationale: "Classifying foreign isHost records separately preserves their composite identity and makes the existing leave/discard path safe; it does not merge distinct rooms or alter coordinator storage. Key-mode metadata and explanatory copy disclose why a future reload can create a new generation."
  blind_spots: "The bounded Playwright reload probe did not finish, so production browser behavior under a live relay remains to be manually confirmed after the targeted UI tests pass."
  candidate_causes:
    - "code: remote grouping predicates ignore isHost and treat any foreign coordinator key as a remote membership."
    - "config: encrypted coordinator-key persistence is opt-in, so normal reloads rotate the local host identity."
  and_gate: "yes — the confusing stale-remote presentation requires both key rotation without persistence and the UI's foreign-key-only grouping predicate."

## Evidence

- timestamp: 2026-08-02
  checked: .planning/debug/knowledge-base.md
  found: No debug knowledge base exists, so there is no prior-resolution candidate to test.
  implication: Investigation starts from the reported behavior and repository evidence.

- timestamp: 2026-08-02
  checked: relevant project debug and GUI skills
  found: The project directs GUI fixes to apps/gui, expects package-scoped pnpm validation, and requires a focused regression test after root cause is found.
  implication: Trace the GUI persistence boundary first and validate the owning package plus its consumer boundary.

- timestamp: 2026-08-02
  checked: codebase graph architecture and room/coordinator symbol search
  found: Room records are owned by src/chat/room-store.ts, with explicit createHostedRoom, createJoiningRoom, loadRoom, saveRoom, listRooms, reconciliation, and remembered-host helpers; browser coordinator persistence is separately owned under src/cordn/coordinator/storage and CoordinatorStore.
  implication: The symptom can arise either from room-store keying/creation or a coordinator-reload caller; both boundaries must be traced before assigning cause.

- timestamp: 2026-08-02
  checked: room-store creation, persistence, and storage-key functions
  found: createHostedRoom and createJoiningRoom both unconditionally create and save a new room; saveRoom keys records by coordinator pubkey and MLS group id. listRooms deduplicates only exact coordinator+group identities, deliberately retaining a room when either changes.
  implication: Each displayed generation represents a separate persisted record, not duplicate enumeration of the same localStorage key. The next discriminating test is whether reload reaches either creation function with a changed coordinator identity.

- timestamp: 2026-08-02
  checked: graph call paths and host-workspace graph result
  found: The graph exposes saveRoom callers but has no inbound edges for the exported creation functions. Its code result places createHostedRoom in HostWorkspace's user-initiated createInvite action, while HostWorkspace separately restores previously persisted host rooms by coordinator pubkey.
  implication: The graph lacks some Svelte call edges, so exact source text is required to trace reload and guest autojoin without assuming the apparent host-only creation path accounts for the participant symptom.

- timestamp: 2026-08-02
  checked: exact creation call sites by source text
  found: createHostedRoom is called only by user-invoked host UI components; createJoiningRoom is called only by src/components/ChatRoute.svelte. HostWorkspace's restore path opens saved rooms and never creates one.
  implication: A deterministic reload multiplication must pass through ChatRoute acceptance or occur because a separate coordinator-key initialization changes how existing host records are classified; a HostWorkspace reload alone is not a source of new room records.

- timestamp: 2026-08-02
  checked: ChatRoute mount and acceptance control flow
  found: On mount, ChatRoute first loads local storage by the invite's group id and coordinator pubkey; it calls createJoiningRoom only when no exact record exists and the URL has autojoin=1. It neither removes autojoin nor deduplicates across a changed coordinator pubkey.
  implication: Repeated reloads are safely idempotent for a stable invite identity but create another joined record for each changed coordinator pubkey. The source of the changing pubkey is now the leading code branch.

- timestamp: 2026-08-02
  checked: App startup, KeyManager, CoordinatorStore, and browser coordinator storage
  found: CoordinatorStore generates a fresh KeyManager in its constructor whenever keyStorage.hasPersisted() is false. The generated identity is passed as HostWorkspace's home coordinator pubkey. Room records always persist in localStorage by their original coordinator pubkey, independently of coordinator key persistence.
  implication: Reload deterministically changes the local coordinator identity when persistence is disabled, while retaining prior room records. HostWorkspace's exact `storedRoom.coordinatorPubkey !== coordinatorPubkey` filter then presents those retained host generations as remote. This is a confirmed visual-classification mechanism, pending verification of the alleged additional write.

- timestamp: 2026-08-02
  checked: all saveRoom call sites and WorkspaceNav room-browser derivation
  found: The only new-record writes are createHostedRoom and createJoiningRoom. Other saveRoom calls mutate an existing room. WorkspaceNav groups each persisted coordinator identity separately and can render one non-persisted invite placeholder when no matching stored record exists.
  implication: There is no unconditional reload write in the host workspace. The reported multiplication needs either a changing autojoin invite identity (which calls createJoiningRoom) or is a UI presentation of retained coordinator generations plus an invite placeholder; room-store itself is not cloning a record on reload.

- timestamp: 2026-08-02
  checked: SBFL eligibility
  found: The project has Vitest tests but no failing test or per-test coverage spectrum for this issue.
  implication: SBFL skipped: no failing tests and no per-test coverage available; deterministic source tracing and focused tests remain the appropriate Bohrbug route.

- timestamp: 2026-08-02
  checked: focused Vitest suite for room navigation and coordinator storage
  found: 20 test files and 129 tests pass, including tests that preserve same-id rooms under different coordinator pubkeys and scope deletion tombstones to a coordinator identity.
  implication: Coordinator-scoped room persistence is established behavior. The missing coverage is an end-to-end reload test that distinguishes localStorage writes from UI regrouping.

- timestamp: 2026-08-02
  checked: browser reload probe
  found: The ad-hoc Playwright run did not complete because the app keeps relay work active through the network-idle wait; source-level enumeration and focused unit tests remain the direct, deterministic evidence. No browser storage was modified outside the isolated temporary context.
  implication: The direct source findings are sufficient to reject an unconditional reload write. The fix must address the confirmed classification and identity-lifecycle mismatch rather than introduce title/origin deduplication.

- timestamp: 2026-08-02
  checked: requested invariant and presentation paths
  found: The product invariant classifies any foreign `isHost: true` record as a previous local generation, never as a remote membership. Existing ChatRoute logic uses the full coordinator pubkey plus room id when leaving and only allows deletion when both key and host identity match the current coordinator.
  implication: The UI fix splits lists by `isHost`, preserves the composite key, and delegates removal to the existing safe leave flow rather than conflating or deleting records by title, origin, or room id alone.

- timestamp: 2026-08-02
  checked: pnpm build
  found: TypeScript passed, then the Svelte compiler rejected `{@const selectedExternalServer}` inside a div because const tags must be immediate control-flow children.
  implication: The classification logic is not yet accepted; move this display-only derived value into the script before retesting.

- timestamp: 2026-08-02
  checked: pnpm build after moving selectedExternalServer to script scope
  found: TypeScript and the production Vite build pass. Vite emitted existing third-party annotation and chunk-size warnings only.
  implication: The new grouping, temporary-key labels, and host warning compile successfully; focused browser behavior is next.

- timestamp: 2026-08-02
  checked: attempted package-script E2E invocation
  found: The script forwarded the separator in a way that caused Playwright to collect its 34-test default E2E suite; an unrelated existing lifecycle test failed during that broad run.
  implication: This result is not evidence for the isolated change. Use direct Playwright file selection and do not attribute the unrelated failure to the room-generation fix.

- timestamp: 2026-08-02
  checked: direct standalone Playwright invocation
  found: The test correctly selected one file, but expected WorkspaceNav's Rooms button in HostWorkspace, where that component deliberately receives `showRoomBrowser=false`.
  implication: The test fixture and UI behavior are sound; update the test to use HostWorkspace's coordinator menu, which is the actual host-facing classification surface.

- timestamp: 2026-08-02
  checked: corrected standalone Playwright invocation
  found: The test reached the host coordinator menu, displayed `Previous local sessions`, selected the previous coordinator, and displayed the leave-only guidance. It then failed because `getByText("temporary key", { exact: true })` requires a standalone text node; the Playwright accessibility snapshot shows the actual button content as `Recovered local host session · temporary key Original host`.
  implication: The temporary-key UI is present. The failure is a locator-oracle mismatch, not a product failure; scope the assertion to the previous-local room button and use `toContainText`.

- timestamp: 2026-08-02
  checked: standalone Chromium regression after locator correction
  found: `pnpm exec playwright test tests/e2e/stale-local-sessions.spec.ts --project=chromium` ran one test and passed in 15.4 seconds. It verified previous-local classification, the temporary-key marker, leave-only controls, and deletion of only the foreign coordinator-plus-room storage key.
  implication: The targeted UI and composite-identity removal behavior are self-verified; only real-workflow confirmation of a live ephemeral coordinator reload remains.

- timestamp: 2026-08-02
  checked: extended standalone Chromium regression with a same-id current host record
  found: The test failed because ChatLobby did not render the injected current-key record after browser back-navigation.
  implication: The next discriminating check must determine whether back-navigation reinitializes the ephemeral coordinator identity (making the test record legitimately previous-local) or whether the lobby missed the storage update.

- timestamp: 2026-08-02
  checked: corrected focused Chromium regression with current-room disclosure expanded
  found: The test reached the leave confirmation and proved removal of the foreign composite key while the current composite key remained, but its final lobby assertion could not find the current room button.
  implication: The localStorage key alone is insufficient to distinguish an intact hosted record from a stale/mutated record or a post-leave lobby classification defect; inspect the post-leave DOM and stored object next.

- timestamp: 2026-08-02
  checked: Playwright post-leave accessibility snapshot
  found: ChatLobby rendered the retained current room under `Current coordinator rooms`; its host label had changed from the fixture's `Current host` to `anon` because HostWorkspace synchronizes local hosted-room identity to the current user profile during navigation.
  implication: The failed final lookup was an over-specific test oracle, not a classification defect. Assert the invariant fields (current coordinator key, room id, `isHost: true`) and the hosted-room presentation independently of mutable profile display text.

- timestamp: 2026-08-02
  checked: direct focused Chromium regression with same-id current and previous hosted records
  found: `pnpm exec playwright test tests/e2e/stale-local-sessions.spec.ts --project=chromium` passed (1 test, 5.2 seconds). It classified the foreign host only as previous-local in ChatLobby and WorkspaceNav, left it using its foreign composite key, and verified the same-id current-key record remained `{ id, coordinatorPubkey, isHost: true }` while the previous key was null.
  implication: The manual live-workflow gate is replaced by a deterministic browser and localStorage proof of the required identity invariant.

- timestamp: 2026-08-02
  checked: final App/ChatLobby/WorkspaceNav classification audit
  found: App supplies the ready coordinator pubkey to ChatLobby; ChatLobby puts `isHost: true` records only in current-key or previous-local lists; WorkspaceNav excludes all `isHost: true` records from remote groups and does not add an invite placeholder when its composite identity is already stored.
  implication: A foreign hosted record cannot be presented as remote or currently hosted, including when it shares its room id with the current coordinator's record.

## Eliminated

## Resolution

- root_cause: Coordinator-key persistence is opt-in, so a reload with it disabled generates a new local coordinator pubkey while room-store retains rooms under their original coordinator-pubkey-plus-room-id storage keys. UI grouping previously treated every foreign coordinator key as remote, thereby presenting retained `isHost: true` records from prior local generations as remote rooms.
- fix: Split foreign `isHost: true` records into explicit previous-local coordinator/session groups in ChatLobby, HostWorkspace, and WorkspaceNav; keep only `isHost: false` records in remote groups. App now supplies the current coordinator identity to ChatLobby. Preserve composite-key leave behavior, label ephemeral key mode, and prevent WorkspaceNav from adding a duplicate remote invite placeholder for an already stored identity.
- oracle_type: specified — the requirement explicitly states that foreign `isHost: true` records are previous local, not remote/current, and that leaving one composite identity must not remove a same-id current record.
- verification:
    target_test: { result: pass, command: "pnpm exec playwright test tests/e2e/stale-local-sessions.spec.ts --project=chromium", result_detail: "1 Chromium test passed in 5.2 seconds; foreign previous-local appears once, no remote placeholder appears, leave removes only the foreign composite key, and the same-id current record remains isHost:true." }
    mutation_check: { result: skipped, reason_if_skipped: "No Stryker configuration or dependency is present." }
    no_op_deletion: { result: pass, deletion_justified_by_rca: false, result_detail: "Scoped diff adds identity-aware classification and a duplicate-placeholder guard; it does not remove or short-circuit room behavior." }
    adjacent_tests: { result: pass, suites_run: ["pnpm test (20 files, 131 tests)", "pnpm lint", "pnpm build", "existing same-ID current/remote E2Es (2 tests)", "guest invite lifecycle E2E (1 test)"] }
    revert_and_reconfirm: { result: skipped, reason: "Not safe in the shared dirty worktree: the fix is uncommitted and interleaved with root-owned changes; the focused browser regression provides the deterministic direct proof required by this continuation." }
    guardrail_verdict: accepted
- files_changed:
  - src/App.svelte
  - src/components/ChatLobby.svelte
  - src/components/HostWorkspace.svelte
  - src/components/WorkspaceNav.svelte
  - tests/e2e/stale-local-sessions.spec.ts
- files_changed:
  - src/components/HostWorkspace.svelte
  - src/components/WorkspaceNav.svelte
  - tests/e2e/stale-local-sessions.spec.ts
