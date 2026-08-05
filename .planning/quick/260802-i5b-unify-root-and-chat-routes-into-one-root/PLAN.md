---
status: complete
quick_id: 260802-i5b
slug: unify-root-and-chat-routes-into-one-root
phase: quick-260802-i5b
plan: "01"
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - src/App.svelte
  - src/navigation/workspace-route.ts
  - src/components/HostWorkspace.svelte
  - src/components/ChatPane.svelte
  - src/components/ChatRoute.svelte
  - src/components/ChatLobby.svelte
  - src/identity/user-profile.svelte.ts
  - tests/unit/workspace-route.test.ts
  - tests/unit/user-profile.test.ts
  - tests/e2e/phase-one.spec.ts
  - tests/e2e/nip07-session-restoration.spec.ts
  - tests/e2e/stale-local-sessions.spec.ts
must_haves:
  truths:
    - "Per D-01 and D-03, every workspace, browse, invite, cached-room, and joined-room state renders inside one `HostWorkspace` root shell with its sidebar and host controls; no standalone chat lobby or chat-route chrome remains."
    - "Per D-02, a direct `/chat/*`, `/chat`, `/chat/`, or `/chats` request is captured before the first app render, represented as workspace intent, and immediately leaves `/` as the visible URL without losing invite or browse state."
    - "Per D-04, a selected room is always identified by both coordinator public key and room id, and an exact remote selection survives reload and browser history without aliasing a same-id local or previous-local room."
    - "Per D-05 and D-06, one app-owned memoized identity bootstrap completes before invite autojoin; an established anonymous identity is valid, a restored NIP-07 signer is matched to the stored stable public key, and identity-choice UI appears only when no usable identity exists."
    - "Per D-07, a persisted coordinator may remain locked while the root shell lists and opens cached remote chats; host-only identity access and controls stay gated until unlock."
    - "Invite redemption and room switching remain same-document operations: the existing sentinel survives, the home coordinator keeps its runtime state, and cached remote messages remain available."
  artifacts:
    - path: "src/App.svelte"
      provides: "Synchronous route-intent capture, root URL canonicalization, app-owned identity bootstrap, and the single HostWorkspace render path"
    - path: "src/navigation/workspace-route.ts"
      provides: "Validated, clone-safe workspace history intent for home, browse, and exact composite room destinations"
    - path: "src/components/HostWorkspace.svelte"
      provides: "The sole application chrome, coordinator sidebar/controls, locked state, and hosted-or-remote pane selection"
    - path: "src/components/ChatPane.svelte"
      provides: "Embedded invite join, cached-room resume, message body, composer, and room-action lifecycle without global chrome"
    - path: "src/identity/user-profile.svelte.ts"
      provides: "Memoized application bootstrap and stable-public-key-bound NIP-07 restoration"
    - path: "tests/e2e/phase-one.spec.ts"
      provides: "Root-shell, direct-route, invite sentinel, composite selection, reload, and locked-coordinator regressions"
    - path: "tests/e2e/nip07-session-restoration.spec.ts"
      provides: "Delayed NIP-07 restoration proof before invite autojoin"
  key_links:
    - from: "src/App.svelte"
      to: "src/navigation/workspace-route.ts"
      via: "module-initial route capture plus replaceState/pushState/popstate normalization"
      pattern: "(initialWorkspaceIntent|workspaceIntentFromHref|withWorkspaceIntent)"
    - from: "src/App.svelte"
      to: "src/identity/user-profile.svelte.ts"
      via: "one application bootstrap promise controls the identity-ready gate passed into the workspace"
      pattern: "userProfileStore\.(initialize|bootstrap)"
    - from: "src/components/HostWorkspace.svelte"
      to: "src/components/ChatPane.svelte"
      via: "the exact room intent is keyed by coordinator public key plus room id and rendered in the workspace main panel"
      pattern: "ChatPane"
    - from: "src/components/ChatPane.svelte"
      to: "src/chat/room-store.ts"
      via: "loadRoom(groupId, coordinatorPubkey), signerForStoredRoom, createJoiningRoom, and composite remove semantics"
      pattern: "(loadRoom|signerForStoredRoom|createJoiningRoom|removeStoredRoom)"
    - from: "src/identity/user-profile.svelte.ts"
      to: "tests/unit/user-profile.test.ts"
      via: "the persisted NIP-07 marker records and verifies the signer stablePubkey before restoration is exposed"
      pattern: "stablePubkey"
---

# Quick Task 260802-i5b: Unify root and chat routes into one workspace

<objective>
Make `/` the only visible application shell while preserving deep-link, invite, browse, history, identity, room-selection, and locked-coordinator behavior inside `HostWorkspace`.

Purpose: The current dirty worktree has begun removing `App.svelte`'s three-way route split, but it still embeds `ChatRoute`, loses browse intent, gates the whole workspace behind coordinator unlock, and allows identity restoration to race invite autojoin.
Output: A single root workspace with an embedded `ChatPane`, typed history intent, exact composite room restoration, deterministic identity bootstrap, and browser/unit regression coverage.
</objective>

<execution_context>
@/Users/sandwich/.codex/gsd-core/workflows/execute-plan.md
@/Users/sandwich/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/debug/invite-identity-screen-flash.md
@.planning/debug/nip07-session-not-restored.md
@.planning/debug/rooms-multiply-on-reload.md
@.planning/debug/remote-room-action-targeting.md
@.planning/quick/260802-f3u-add-in-session-invite-redemption-by-past/260802-f3u-SUMMARY.md
@src/App.svelte
@src/navigation/workspace-route.ts
@src/chat/chat-pane-context.ts
@src/chat/invite.ts
@src/chat/room-navigation.ts
@src/chat/room-store.ts
@src/components/HostWorkspace.svelte
@src/components/ChatRoute.svelte
@src/components/ChatLobby.svelte
@src/components/UserProfile.svelte
@src/identity/user-profile.svelte.ts
@tests/unit/workspace-route.test.ts
@tests/unit/user-profile.test.ts
@tests/unit/room-navigation.test.ts
@tests/e2e/phase-one.spec.ts
@tests/e2e/nip07-session-restoration.spec.ts
@tests/e2e/stale-local-sessions.spec.ts

<locked_decisions>
- D-01: `HostWorkspace` is the canonical root GUI and retains the sidebar and host controls in every state.
- D-02: Direct `/chat/*`, `/chat`, `/chat/`, and `/chats` inputs are synchronously extracted, then the visible URL is canonicalized to `/`.
- D-03: Chat joining and message-body behavior live in an embedded `ChatPane`; standalone `ChatLobby` and `ChatRoute` chrome is removed.
- D-04: Room targeting and reload restoration use the exact `{ coordinatorPubkey, id }` identity; the selected remote room survives reload.
- D-05: Identity bootstrap is app-owned and memoized, finishes before invite autojoin, treats an established anonymous identity as valid, and shows the chooser only for genuine absence.
- D-06: NIP-07 restoration is bound to a persisted `stablePubkey` and cannot lose a signer race to anonymous initialization.
- D-07: A locked persisted coordinator does not hide or break cached remote chats; host-only behavior remains locked.
</locked_decisions>

<interfaces>
- `parseInviteUrl(value: string): ChatInvite | null` is the authoritative decoder for group id and remote coordinator public key; never derive room identity from title, origin, or room id alone.
- `createSameShellChatHref(shellOrigin, room)` produces local-shell chat links while retaining the remote coordinator target and invite metadata.
- `loadRoom(id, coordinatorPubkey)` and `removeStoredRoom({ id, coordinatorPubkey })` already enforce composite room identity; keep both arguments through every new selection and action path.
- `signerForStoredRoom(room)` reconstructs a saved anonymous room signer; a cached room without a signer remains readable and uses the existing reconnect UI.
- `ChatPaneContext` already carries the active room, host, connection, sound state, and removal capability needed by `HostWorkspace` chrome.
- `CoordinatorStore.loadState === "prompting"` means `coordinator.identity` cannot be read. The locked workspace must use optional identity/public-key props and defer host-only initialization.
- The current `workspace-route.ts` string intent, `HostWorkspace` embedded `ChatRoute`, and `UserProfileStore.initialize` are partial shared-worktree changes. Preserve their useful behavior and evolve them in place; do not reset, revert, or replace unrelated edits.
</interfaces>
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Run one direct invite end to end inside the canonical root workspace</name>
  <reversibility rating="costly">Moving the chat lifecycle into the root workspace changes several component boundaries, but persisted room and invite formats remain unchanged.</reversibility>
  <files>src/App.svelte, src/components/HostWorkspace.svelte, src/components/ChatPane.svelte, src/components/ChatRoute.svelte, src/components/ChatLobby.svelte</files>
  <behavior>
    - Direct invite: opening a valid `/chat/{group}` invite captures the full invite before render, immediately shows `/`, renders exactly one `operator-shell`, and joins or opens the exact remote room in its main panel.
    - Same document: redeeming an invite from a running host workspace preserves the window sentinel and home coordinator status while changing only workspace state.
    - Shell ownership: the sidebar, profile, notifications, invite controls, host controls, mobile rail, and global header are rendered only by `HostWorkspace`; the embedded pane supplies no duplicate chrome.
    - Room lifecycle: cached anonymous signer recovery, active-signer recovery, fresh joining, messages, composer, offline/deleted states, and leave/delete capability retain their current behavior.
  </behavior>
  <action>
Per D-01, D-02, and D-03, finish the existing single-shell tracer without discarding concurrent worktree edits. In `App.svelte`, synchronously capture a room or legacy browse input before template evaluation, replace the address with `/`, keep the captured value as internal workspace state, and render only `HostWorkspace`; normal invite navigation must remain a same-document state transition. In `HostWorkspace.svelte`, accept locked-safe optional local identity data, own all global chrome, and render the current hosted-room body or one embedded remote/invite pane in the existing main-panel slot. Move the room lifecycle and body from `ChatRoute.svelte` into `ChatPane.svelte`: retain exact `parseInviteUrl` plus `loadRoom(groupId, coordinatorPubkey)` lookup, metadata reconciliation, saved anonymous signer recovery, active signer resume, join-request flow, message sync/composer, offline/deleted banners, and composite leave/delete checks, but remove `main`, `WorkspaceNav`, `UserProfile`, `InviteInbox`, `NotificationCenter`, and mobile-global-action chrome from the pane. Feed active pane state back through `ChatPaneContext` so the workspace header and sidebar own sounds, host badge, connection status, and room action. Key/reinitialize the pane by the captured room destination so switching between same-id rooms under different coordinators cannot retain stale state. Remove the obsolete standalone route and lobby component files after `App.svelte` and `HostWorkspace.svelte` have no imports or render branches for them. Keep `coordinatorStore` as the sole home-coordinator lifecycle owner and keep all remote joins in the existing room-store path.
  </action>
  <verify>
    <automated>pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "in-session invite redemption preserves the running home coordinator"</automated>
  </verify>
  <done>A pasted invite opens and joins inside the root `HostWorkspace`, the visible URL is `/`, the existing sentinel and home coordinator survive, one global chrome is rendered, and `ChatRoute.svelte`/`ChatLobby.svelte` are no longer runtime components.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Serialize identity bootstrap before every invite autojoin</name>
  <files>src/App.svelte, src/components/ChatPane.svelte, src/identity/user-profile.svelte.ts, tests/unit/user-profile.test.ts, tests/e2e/nip07-session-restoration.spec.ts</files>
  <behavior>
    - Memoization: repeated application/bootstrap callers receive the same in-flight promise and construct at most one restoration signer.
    - Stable identity: a successful NIP-07 choice stores its public key as `stablePubkey`; reload exposes the restored signer only when its current public key matches that stored key.
    - Compatibility and failure: a prior marker without the public key is upgraded after successful restoration; malformed, unavailable, rejected, or mismatched restoration settles to a usable anonymous-or-absent state without hanging bootstrap.
    - Ordering: a delayed NIP-07 `getPublicKey` completes before invite autojoin selects a signer, and the created/joined room uses the stored stable public key.
    - Presentation: identity-choice content never renders while bootstrap is pending; an established anonymous identity autojoins through the anonymous signer path, while a chooser appears only when bootstrap reports no usable identity and the room has no saved signer.
  </behavior>
  <action>
Per D-05 and D-06, make `UserProfileStore` the single identity-bootstrap state machine and make `App.svelte` start it once regardless of whether the coordinator key is unlocked. Change the current initializer so all calls share one promise, restoration is attempted before anonymous setup can overwrite signer state, and completion is recorded in a `finally` path. Persist a schema-validated NIP-07 selection containing `method` and `stablePubkey` only after `getPublicKey()` succeeds; accept the prior marker shape by restoring once and rewriting it, but for a marker that already has `stablePubkey`, compare the extension's current key before assigning `signer`, `method`, or profile state. On mismatch or restoration failure, clear/ignore the unusable selection and leave the store settled without an authenticated signer. Keep later manual NIP-07/NIP-46 connections and logout semantics intact. Have `App.svelte` supply an unlocked local anonymous public key/name separately when available, without starting a second bootstrap. In `ChatPane.svelte`, await the app readiness signal before evaluating autojoin: recover a room-owned signer first, otherwise use the restored active signer, otherwise treat an established anonymous method as a real identity and call the existing anonymous join; render a neutral joining state during the wait and expose identity choices only after the resolved store truly lacks a usable identity. Extend the unit mock to count/delay signer calls and assert the exact stored stable public key, legacy upgrade, mismatch rejection, memoized promise, anonymous readiness, and logout cleanup. Extend the existing browser NIP-07 mock so reload plus immediate invite intent proves no chooser flash and verifies the stored room's `stablePubkey` equals the persisted signer key.
  </action>
  <verify>
    <automated>pnpm exec playwright test tests/e2e/nip07-session-restoration.spec.ts</automated>
  </verify>
  <done>Identity initialization is app-owned, memoized, and terminal; invite autojoin cannot outrun NIP-07 restoration, the saved stable public key is verified, established anonymous users do not see a chooser, and genuine absence remains recoverable.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Preserve browse and exact room intent through root history, reload, and coordinator lock</name>
  <files>src/navigation/workspace-route.ts, src/App.svelte, tests/unit/workspace-route.test.ts, tests/e2e/phase-one.spec.ts, tests/e2e/stale-local-sessions.spec.ts</files>
  <behavior>
    - Direct paths: `/chat/{group}`, `/chat`, `/chat/`, and `/chats` are synchronously classified before the address becomes `/`; room intent retains its full invite/deep-link payload and browse intent opens the root room browser.
    - History: in-app home, browse, and room changes create distinct root-URL history entries; back/forward restores the entry's intent without a reload or external navigation.
    - Composite reload: selecting a remote room stores both coordinator public key and room id in clone-safe history state; reload reopens that exact room even when a local or previous-local room shares its id.
    - Locked coordinator: after encrypted coordinator persistence triggers the unlock state, the operator shell and cached remote sidebar remain usable, the selected cached remote body opens read-only/reconnect-capable, and no local identity getter or host-only action runs before unlock.
    - Classification: foreign `isHost` records remain previous-local, normal joined records remain remote, and leaving either removes only its exact composite record.
  </behavior>
  <action>
Per D-02, D-04, and D-07, replace the partial string-or-null history contract in `workspace-route.ts` with a schema-validated, structured-clone-safe workspace intent that distinguishes home, browse, and room destinations. A room intent must keep the current-origin canonical href plus the parsed `{ id: groupId, coordinatorPubkey }`; a browse intent must remain distinct from home after the visible path becomes `/`. Reject unrelated paths, cross-origin non-chat navigation, malformed history values, and room state whose composite identity disagrees with the parsed href. In `App.svelte`, use `replaceState` only for initial/direct canonicalization and normalization, use `pushState` for in-app destination changes, consume `popstate.state`, preserve unrelated history fields, and always show `/`. Adapt the intent back to the existing `HostWorkspace` input so browse opens its channel rail/browser and a room reselects the exact server and row after reload. Keep `HostWorkspace` mounted when `coordinator.loadState` is prompting: the lock prompt belongs in the workspace main panel when no cached remote pane is selected; cached remote/previous-local lists and bodies remain available, while local coordinator identity, settings, create/start/delete, presence, and persistence controls are hidden or disabled until unlock. Rewrite the old lobby-route Playwright assertions in `phase-one.spec.ts` and `stale-local-sessions.spec.ts` around the root `operator-shell`, root URL, workspace channel browser, and embedded pane. Add same-id local/remote reload coverage, selected-remote reload coverage, direct legacy browse coverage, locked cached-room coverage, and assertions that standalone lobby/route test ids never appear. Preserve the existing invite sentinel, remote/local action targeting, previous-local classification, and cached-message assertions rather than replacing them with weaker checks.
  </action>
  <verify>
    <automated>pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "opens joined chats|browses cached chats|chat index|same-id|persistent host|in-session invite redemption"</automated>
  </verify>
  <done>All legacy chat entry paths visibly settle on `/`, root history retains home/browse/exact-room intent, the selected remote survives reload without same-id aliasing, and a locked coordinator still exposes cached remote chats inside the one operator shell.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser URL/history -> workspace intent | External deep links and mutable history state select rooms and may carry invite capabilities. |
| Browser extension -> application identity | NIP-07 supplies a signer whose current public key may differ from the identity previously selected by the user. |
| Persisted room/history data -> room actions | Local browser data can be stale or malformed; delete/leave capability must follow the current coordinator plus room composite identity. |
| Locked coordinator -> root workspace | Cached remote data is readable while the encrypted local coordinator identity and host control plane remain unavailable. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-i5b-01 | Spoofing / Tampering | `workspace-route.ts` | high | mitigate | Parse chat destinations on the current shell, validate history intent shape, and require the parsed coordinator public key plus room id to agree before selection. |
| T-i5b-02 | Information Disclosure | root history intent | medium | mitigate | Keep invite capability in the current history entry needed for reload/back behavior, never copy it into room-selection storage or logs, and continue using the validated invite parser. |
| T-i5b-03 | Spoofing | NIP-07 restore | high | mitigate | Persist `stablePubkey`, compare it with the restored extension signer before adoption, and test mismatch rejection and delayed restoration. |
| T-i5b-04 | Tampering / Elevation of Privilege | room delete/leave actions | high | mitigate | Preserve the existing current-coordinator authorization check and pass `{ id, coordinatorPubkey }` through selection, removal, and reload tests. |
| T-i5b-05 | Information Disclosure / Elevation of Privilege | locked `CoordinatorStore` | high | mitigate | Never read `coordinator.identity` or expose host-only controls while `loadState` is prompting; render only cached remote data and the unlock affordance. |
| T-i5b-06 | Denial of Service | bootstrap/autojoin ordering | medium | mitigate | Memoize bootstrap, settle failure paths, gate autojoin on completion, and keep cached rooms readable when no active signer is available. |
| T-i5b-SC | Tampering | package supply chain | low | accept | The plan installs no package and changes no lockfile; it reuses current Svelte, history, signer, and room-store APIs. |
</threat_model>

## Source Coverage Audit

| Source | ID | Feature / constraint | Task | Status | Notes |
|--------|----|----------------------|------|--------|-------|
| GOAL | — | One canonical root GUI for host and chat behavior | 1 | COVERED | `HostWorkspace` owns all chrome and embeds `ChatPane`. |
| CONTEXT | D-01 | Root shell retains sidebar and host controls | 1, 3 | COVERED | One `operator-shell` remains mounted, including locked state. |
| CONTEXT | D-02 | Extract `/chat/*`, `/chat`, `/chat/`, `/chats`, then visibly canonicalize to `/` | 1, 3 | COVERED | Initial capture precedes render; typed history preserves room/browse state. |
| CONTEXT | D-03 | Migrate join/body into root; no standalone lobby/route chrome | 1 | COVERED | `ChatPane` is body-only; old full-page components are removed. |
| CONTEXT | D-04 | Preserve composite room identity and selected remote across reload | 1, 3 | COVERED | Intent carries parsed coordinator public key plus room id and reload E2E covers collisions. |
| CONTEXT | D-05 | App-owned memoized bootstrap before autojoin; anonymous counts; chooser only for absence | 2 | COVERED | Store, pane ordering, unit tests, and browser regression are explicit. |
| CONTEXT | D-06 | Prevent NIP-07 race and test stored stable public key | 2 | COVERED | Marker binding, mismatch rejection, delayed mock, and stored-room assertion are planned. |
| CONTEXT | D-07 | Locked persisted coordinator does not break cached remote chats | 1, 3 | COVERED | Optional local identity plus root-shell locked/cached regression. |
| RESEARCH | — | Existing architecture finding: App has three shells; HostWorkspace is desired shell; ChatRoute owns body/lifecycle | 1 | COVERED | The tracer performs the stated extraction instead of adding another wrapper. |
| RESEARCH | — | Existing tests provide invite sentinel and browser NIP-07 mock | 1, 2, 3 | COVERED | Both fixtures are retained and strengthened. |
| REQ | — | Roadmap requirement IDs | N/A | N/A | This quick task is outside the completed roadmap and has no assigned requirement IDs. |

<verification>
## Verification Matrix

| Capability | Automated proof | Expected evidence |
|------------|-----------------|-------------------|
| Direct and legacy routes canonicalize to root while retaining intent | `pnpm vitest run tests/unit/workspace-route.test.ts` | Home, browse, room, malformed state, cross-origin chat normalization, and composite mismatch cases pass. |
| Root invite redemption preserves the document and home coordinator | `pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "in-session invite redemption preserves the running home coordinator"` | URL is `/`, sentinel remains true, remote room opens in the operator shell, coordinator stays running. |
| NIP-07 bootstrap is memoized and stable-key-bound | `pnpm vitest run tests/unit/user-profile.test.ts` | One restore, stored `stablePubkey`, legacy upgrade, mismatch rejection, anonymous readiness, and logout pass. |
| Restored signer wins before invite autojoin | `pnpm exec playwright test tests/e2e/nip07-session-restoration.spec.ts` | No identity chooser flash; joined room and persisted marker use the same signer public key. |
| Selected remote and same-id local/remote identities survive reload/history | `pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "same-id|persistent host|selected remote"` | Exact remote selection reopens; local/remote action modes and records do not cross. |
| Locked coordinator keeps cached chats available | `pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "browses cached chats while a persisted coordinator stays locked"` | Root shell/sidebar and cached body render before unlock; host-only controls do not. |
| Previous-local classification stays composite-safe in the root shell | `pnpm exec playwright test tests/e2e/stale-local-sessions.spec.ts --project=chromium` | Foreign host record is leave-only and removing it retains the same-id current record. |
| Standalone chat chrome is gone | `test ! -e src/components/ChatRoute.svelte && test ! -e src/components/ChatLobby.svelte` | Both obsolete full-page components are absent. |
| Project integration | `pnpm lint` then `pnpm test` then `pnpm build` | Lint, the full unit suite, TypeScript, and production build pass. |
</verification>

<success_criteria>
- `/` is the only visible application URL after any accepted workspace/chat entry, with distinct home, browse, and exact room state retained in history.
- `HostWorkspace` is the only global shell and `ChatPane` is the only guest/invite/cached-room body implementation.
- Direct and in-session invites cannot render an identity chooser before bootstrap resolves; restored NIP-07 and established anonymous identities autojoin through their correct signer paths.
- The persisted NIP-07 selection includes `stablePubkey`, and restoration refuses a different extension key.
- Remote/local/previous-local same-id rooms remain isolated by coordinator public key and room id across switching, reload, leave, and delete.
- A locked persisted coordinator still allows cached remote browsing and reading without exposing the local coordinator identity or host-only capabilities.
- No new dependency, lockfile change, page reload, new tab, or full-page external navigation is introduced for workspace/chat transitions.
</success_criteria>

<output>
Create `.planning/quick/260802-i5b-unify-root-and-chat-routes-into-one-root/SUMMARY.md` when done.
</output>
