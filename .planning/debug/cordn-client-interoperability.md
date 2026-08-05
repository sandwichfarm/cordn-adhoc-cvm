---
status: resolved
trigger: "cordn.net remains on Join request sent when joining a CAHMLS-hosted group"
created: 2026-08-03T20:30:00Z
updated: 2026-08-05T09:10:00Z
---

# Cordn client interoperability

## Current Focus

bug_class: compound historical protocol and lifecycle regression; deterministic conformance-evidence gap.
hypothesis: Confirmed and fixed: early acknowledgement, delayed/disabled hosted-room admission, package-selection drift, and recovery lifecycle regressions jointly broke canonical Cordn membership.
test: Completed live cordn.net browser verification plus pinned upstream implementation tests in every membership direction.
expecting: A canonical Cordn client receives usable membership without manually checking for invitations, then exchanges encrypted messages with the hosted CAHMLS room.
next_action: Archive this resolved session after the final repository gate audit.
reasoning_checkpoint:
  hypothesis: "The missing durable upstream-client harness causes the cross-client verification gap because every current executable admission/message test instantiates CAHMLS client code on both sides."
  confirming_evidence:
    - "Repository import search found no upstream `CliSession`; live `pnpm check:upstream` compares only 11 method names and 7 schema key sets."
    - "The temporary pinned `CliSession` fixture passed against CAHMLS's real ContextVM/Nostr transport, proving the proposed harness can execute the external implementation."
  falsification_test: "The repository-owned clone command cannot check out the pinned upstream client or its fixture fails before exercising KeyPackage, Welcome, and encrypted-message assertions."
  fix_rationale: "A pinned clone script plus conditional fixture executes upstream's own client source in a test environment while retaining the current static drift check; it converts prose-only black-box evidence into a repeatable guard."
  blind_spots: "The CLI has no web-invite URL parser, so its black-box cannot itself prove browser URL presentation; that direction remains covered by the canonical invite-shape and external-link parser tests."
  candidate_causes:
    - "code: no repository test acquires or instantiates an upstream Cordn client."
    - "environment: a network or package-install outage can prevent the external test from running, though it cannot explain the missing harness."
    - "config: a moving upstream ref would make behavior non-reproducible, which an immutable commit pin avoids."
  and_gate: "no — absence of a harness alone explains the evidence gap; network access only affects execution availability, not whether the current suite proves cross-client behavior."
reasoning_checkpoint:
  hypothesis: "`join_request_store` acknowledges before its same-tab auto-approval callback completes, so a one-shot `welcome_take` runs before `welcome_store`."
  confirming_evidence:
    - "The agent-authored direct wire regression awaits `CoordinatorAdapter.storeJoinRequest`, immediately invokes `fetchPendingWelcomes` once, and deterministically receives `welcomes: []`."
    - "`Coordinator.storeJoinRequest` invokes subscribers synchronously but ignores their return values, while `ChatRoomSession.syncAfterJoinRequest` explicitly discards the Promise from `sync()`."
    - "The existing delayed regression eventually decrypts a valid Welcome, proving the same exact package and auto-approval path are otherwise valid."
  falsification_test: "After the adapter awaits the local subscriber completion, the same immediate one-shot `welcome_take` still returns no matching Welcome."
  fix_rationale: "Awaiting the already-started same-tab admission operation moves the wire acknowledgement boundary after durable `welcome_store`, without changing canonical method names or input/output schemas; no-subscriber remote paths remain non-blocking."
  blind_spots: "Manual-approval and remote-host requests legitimately remain pending because no local auto-admission can create a Welcome; host admission latency is now part of the handler request duration and needs bounded transport verification."
  candidate_causes:
    - "code: the coordinator and room-session subscriber APIs erase the Promise that represents local admission completion."
    - "config: auto-approval disabled would also leave a Welcome absent, but the regression and live report use an auto-approving hosted room."
    - "data: an invalid or mismatched KeyPackage could prevent admission, but the delayed regression decrypts the valid Welcome for the exact requested reference."
  and_gate: "no — acknowledgement-before-admission alone fully explains an empty immediate queue after an otherwise successful auto-approval; the prior finite-poll condition only made the symptom persistent."
known_pattern_candidate: none — the prior bounded-latency hypothesis was falsified by live verification.

## Expanded stop condition (2026-08-05)

- Identify the exact regression commit(s) introduced near the chat work, not only the current broken code paths.
- Prove a canonical Cordn client can add and use a CAHMLS coordinator.
- Prove a canonical Cordn client can join a CAHMLS-hosted group and exchange encrypted messages.
- Prove CAHMLS can invite a user running another canonical Cordn client.
- Prove a CAHMLS user can accept an externally generated canonical Cordn invitation.
- Pin tests to the upstream Cordn specification and implementation so schema or behavior drift fails loudly.
- Update `AGENTS.md` with mandatory conformance/interoperability guardrails only after all flows pass.

## Symptoms

- A canonical cordn.net client could publish a join request but remained pending.
- CAHMLS could report a joined guest before cordn.net had received usable membership.
- A hosted room could recover after reload and appear connected, then never poll for a later Cordn request.
- Fresh hosted rooms could time out during recovery even though the local coordinator was running.
- Transport traces reached `join_request_take_many`, `msg_post`, and repeated `msg_fetch_many`; relay reachability and ContextVM transport were not the primary failure.

## Canonical contract

Current Cordn `master` at `69a40f5003a6dffef183e1e2b8d5d0038de98b1a` uses this admission flow:

1. requester publishes a KeyPackage and stores `{ gid, kp_ref }`;
2. host fetches the request and first consumes its exact `kp_ref`;
3. stable-identity fallback consumes an ordinary package first and only then reuses the newest last-resort package;
4. host adds that package and posts the MLS Commit;
5. host stores a Welcome for the consumed identity/package with the Commit cursor;
6. requester fetches the matching Welcome, joins, then resumes messages after that cursor.

## Root causes

1. CAHMLS coordinator storage selected a reusable last-resort package before an ordinary package during stable-identity fallback. Current Cordn does the reverse. When both existed, the Welcome could be encrypted for a different local private package than the requester expected.
2. Startup recovery performed one room sync and then stopped every recovered hosted-room session except the selected room. A Cordn request arriving later for an unselected hosted room was never polled or auto-approved.
3. The selected recovered room relied on a Svelte effect to call `start()` after `recover()`. That performed an unnecessary second synchronous fetch inside the strict recovery window and still did not keep other hosted rooms alive.
4. Hosted-room recovery repeatedly resolved the signer, including NIP-07 `getPublicKey()` calls, inside the room timeout. A signer prompt or slow extension could turn a locally available room into a false recovery timeout.
5. The host client factory silently fell back from the in-process coordinator to a remote Nostr client when the local plane was unavailable. That hid coordinator-lifecycle defects behind relay timeouts instead of failing at the actual boundary.
6. Cordn performs a finite burst of Welcome polling after it stores a join request. CAHMLS only noticed same-tab join requests on a four-second hosted-room interval, so Cordn could finish that burst before CAHMLS created the Welcome. The relay and request delivery were healthy; admission was simply scheduled too late.
7. The canonical wire handler acknowledged `join_request_store` before the same-tab host's asynchronous auto-admission had stored the matching Welcome. A Cordn client that performs one immediate `welcome_take` could therefore remain pending even after the host later admitted it.

## Resolution

- Restore Cordn's ordinary-first, newest-last-resort-fallback selection rule.
- Continue consuming the request's exact `kp_ref` before any identity fallback.
- Split room startup into a single initial sync plus an explicit steady-state attachment, avoiding a duplicate recovery fetch.
- Keep one live admission session for every recovered hosted room, selected or not, so auto-approval continues in the background.
- Reuse the already-validated active room signer during recovery instead of invoking the external signer again.
- Require the in-process local coordinator client for local hosted rooms; do not silently route a local host through remote transport.
- Keep Welcome delivery durable and only emit `Guest joined` after delivery succeeds.
- Publish same-tab join-request notifications from the coordinator and have the hosted room synchronize immediately. Retain the interval as a remote/fallback mechanism and force one follow-up synchronization when the signal races an already-running pass.
- Pending: propagate the same-tab admission Promise to the canonical `join_request_store` handler and await it before returning the existing `{ at }` response. No canonical schema change is needed.
- Propagate same-tab admission completion through `Coordinator.waitForJoinRequestNotifications()` and await it in `CoordinatorAdapter.storeJoinRequest` before returning the unchanged `{ at }` response.
- Add a pinned upstream-`CliSession` black-box command that proves a real Cordn client can join a CAHMLS coordinator room and exchange encrypted messages in both directions.
- Files changed for the durable external-client guard: `tests/unit/cordn-upstream-interop.test.ts`, `scripts/check-cordn-upstream-interop.sh`, `package.json`, and `AGENTS.md`.

## Regression evidence

- `cordn-conformance.test.ts` proves canonical package selection and proves a request arriving after hosted-room recovery receives a valid Welcome immediately, without advancing the polling timer.
- `room-session-concurrency.test.ts` proves a recovered hosted room keeps polling after entering steady state.
- `contextvm-roundtrip.test.ts` performs real ContextVM/Nostr admission, Commit, Welcome, join, and encrypted message delivery.
- A black-box script using the current upstream Cordn `CliSession` against CAHMLS completed the full flow and decrypted `hello from upstream Cordn` on the CAHMLS side.
- Upstream contract parity confirms all 11 coordinator methods and 7 schemas match the pinned canonical commit.

## Verification

- `pnpm exec vitest run tests/unit/cordn-conformance.test.ts tests/unit/contextvm-roundtrip.test.ts tests/unit/room-session-concurrency.test.ts --reporter=dot` — 3 files, 31 tests passed.
- `pnpm test -- --reporter=dot` — 23 files, 245 tests passed.
- `pnpm lint` — passed.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm build` — passed; only dependency annotation and bundle-size warnings remain.
- `pnpm check:upstream` — passed against Cordn commit `69a40f5003a6dffef183e1e2b8d5d0038de98b1a`.
- Upstream Cordn CLI black-box — passed: request identity matched, Welcome target matched, cursor preserved, group joined, encrypted message decrypted.
- `git diff --check` — passed.
- `pnpm test:e2e` — 49 passed, 33 failed. The immediate-admission unit/integration coverage passes; the broad guest browser scenario never reached admission because its profile helper is hidden by the current minimal greeter. The remaining failures are pre-existing/stale shell, identity, startup, and layout assertions rather than failures at the Cordn admission boundary.
- Immediate wire regression — RED before the fix and after targeted reversal; GREEN after restoration. It awaits `join_request_store`, calls `welcome_take` once, and requires one matching Welcome with no retry, delay, or timer advance.
- `pnpm exec vitest run tests/unit/cordn-conformance.test.ts tests/unit/cordn-browser-server.test.ts tests/unit/contextvm-roundtrip.test.ts tests/unit/room-session-concurrency.test.ts --reporter=dot` — 4 files, 44 tests passed.
- `pnpm exec vitest run tests/unit/cordn-conformance.test.ts -t "acknowledges an unsubscribed canonical join request" --reporter=dot` — 1 contract test passed with fake timers frozen; it returned the exact `{ at }` schema and one immediate `welcome_take` returned `{ welcomes: [] }`.
- `pnpm exec vitest run tests/unit/cordn-conformance.test.ts tests/unit/cordn-browser-server.test.ts tests/unit/contextvm-roundtrip.test.ts tests/unit/room-session-concurrency.test.ts --reporter=dot` — 4 files, 45 tests passed after the no-subscriber contract was added.
- `pnpm test -- --reporter=dot` — 23 files, 246 tests passed.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, and focused `git diff --check` — passed. Build retained only known third-party annotation and chunk-size warnings.
- Fix-acceptance guardrail: target test passed; mutation check skipped (no configured Stryker/mutation runner); no-op/deletion inspection passed; adjacent/full tests passed; targeted revert-and-reconfirm passed.
- `pnpm test:upstream-interop` — 3 black-box tests passed against pinned Cordn `69a40f5003a6dffef183e1e2b8d5d0038de98b1a`: upstream join-request admission, a direct CAHMLS-to-Cordn invitation, a direct Cordn-to-CAHMLS invitation, and encrypted messages in both directions for all three membership paths.
- `pnpm test -- --reporter=dot` — 25 files: 250 passed, 3 skipped. The three skipped tests are the external-client flows when their required pinned module path is absent; all three run through the explicit upstream command.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm check:upstream`, `pnpm build`, and `git diff --check` — passed. Build retained only the known third-party annotation and chunk-size warnings.
- External-harness guardrail: target black-box=pass; mutation check=not applicable to a test-only guard (and no mutation runner configured); no-op/deletion inspection=pass; adjacent/full suite=pass; current code-fix causal revert-and-reconfirm remains the earlier accepted pass.

## Live retest note

Reload the CAHMLS host so recovered rooms attach the immediate admission listener. Existing pending requests are processed during recovery; new requests no longer need Cordn's manual **Check for invitations** fallback.

Live verification completed on 2026-08-05 with fresh browser profiles: cordn.net saved a fresh CAHMLS coordinator from its nprofile relay hints, published a last-resort KeyPackage through that coordinator, requested the CAHMLS-hosted room, received the Welcome notification without pressing **Check for invitations**, accepted membership, and exchanged one encrypted message in each direction. The observed coordinator pubkey was `4b2215108ebc1ad9fc4e226f41eaf8df1dd4f4c97d518d3cf786b3171f275296`; the ephemeral proof group was `d75add93-3115-4c46-bab5-e709a3fbd6cf`.

## Evidence

- timestamp: 2026-08-05T00:15:00Z
  checked: Shared-worktree status and focused history from `master..HEAD`.
  found: The interoperability repair is an extensive uncommitted change set across the coordinator, adapter, room session, recovery UI, wire helper, and focused tests; Phase 15–18 commits subsequently modified these paths, whereas the initial invite-only chat feature is already in `master` history.
  implication: A single chat-era commit cannot safely be claimed as the source of all seven defects. Attribution must distinguish original chat behavior from the later Phase 16 recovery lifecycle changes and the current uncommitted repair.

- timestamp: 2026-08-05T00:20:00Z
  checked: Focused `HEAD` repair diff and Git pickaxe history.
  found: The new awaitable same-tab notification handoff is an uncommitted repair to the pre-chat browser coordinator adapter; the initial invite-only chat feature is `3068506`, while recovered-room startup/steady-state changes originate in Phase 16 (`c87746a`, `a5dc2e5`, and `d7375f9`).
  implication: The early acknowledgement is a latent coordinator API behavior that becomes an interoperability regression only when combined with the chat host's auto-admission path. The recovery regressions must be attributed to the Phase-16 lifecycle range, not to the initial chat feature.

- timestamp: 2026-08-05T00:24:00Z
  checked: Initial-chat (`3068506`) and Phase-16 (`c87746a`, `a5dc2e5`) source histories plus blame on the coordinator acknowledgement boundary.
  found: `3068506` introduced a `ChatRoomSession.start()` that did one immediate sync and then only a four-second interval; `a5dc2e5` introduced recovery. The coordinator's immediate `{ at }` response without a host-completion dependency predates chat in `bfa4ed9`.
  implication: The exact causal boundary is compound: `bfa4ed9` supplies the early acknowledgement, and `3068506` makes the requested Welcome depend on delayed host work. Phase-16 recovery independently introduced the later session-lifecycle regressions.

- timestamp: 2026-08-05T00:30:00Z
  checked: Complete focused conformance, ContextVM, invite, protocol, ChatRoute, and parity harness implementations.
  found: The ContextVM integration tests use this repository's `ChatCoordinatorClient` and MLS helpers on both sides; `chat-invite.test.ts` checks CAHMLS URL construction and parses a handcrafted foreign-shaped URL; `ChatRoute` accepts that parsed invite by creating a local joining room. The parity script only clones upstream contracts and compares method names plus seven schema key sets. No test imports an upstream Cordn `CliSession`.
  implication: Existing passing coverage strongly verifies CAHMLS internal protocol behavior and static contract shape, but it is not a durable, independently executable proof of all four requested cross-client directions. The reported upstream CLI pass is currently evidence recorded in prose, not a repository harness.

- timestamp: 2026-08-05T00:35:00Z
  checked: Live `pnpm check:upstream` and repository dependency/import search.
  found: The live parity script passed against `69a40f5003a6dffef183e1e2b8d5d0038de98b1a` (11 methods, 7 schemas). The project imports only its vendored coordinator modules and ContextVM SDK; no test or dependency imports upstream Cordn `CliSession` or another external Cordn client.
  implication: Static contract drift is guarded, but the four-direction upstream-client evidence gap is confirmed. A durable black-box test must deliberately acquire the pinned upstream implementation or this stop condition cannot be marked complete.

- timestamp: 2026-08-05T00:42:00Z
  checked: A temporary pinned-upstream `CliSession` integration harness run by upstream Vitest after a frozen-lockfile install.
  found: The suite failed before executing its test because upstream's Vitest configuration does not transform CAHMLS Svelte 5 rune modules; importing `ChatRoomSession` raised `ReferenceError: $state is not defined` from the notification store.
  implication: This neither supports nor falsifies protocol interoperability. The upstream client and all dependencies are locally runnable; the harness must be executed by CAHMLS's test pipeline, which owns the Svelte transform.

- timestamp: 2026-08-05T00:45:00Z
  checked: Temporary upstream-`CliSession` fixture run by CAHMLS Vitest.
  found: CAHMLS's runner transformed the Svelte rune modules, but the fixture was explicitly configured as Node-only; `ChatRoomSession.start()` therefore stopped at its browser lifecycle hook with `ReferenceError: window is not defined` before it sent a join request.
  implication: This is a second harness-environment failure, not a protocol failure. The repository's normal jsdom test environment is the correct execution context for a browser room session.

- timestamp: 2026-08-05T00:48:00Z
  checked: External timeout invocation for the temporary instrumented fixture.
  found: The system has no `timeout` utility (`zsh: command not found: timeout`), so that command did not start Vitest.
  implication: The timeout mechanism must be provided by a small Node process wrapper; this is an environment tooling gap and adds no evidence about protocol behavior.

- timestamp: 2026-08-05T00:52:00Z
  checked: Stage-instrumented fixture in CAHMLS's default jsdom environment, bounded by a Node process wrapper.
  found: The only reached stages were `start relay` and `start CAHMLS transport`; the transport then stalled while retrying the optional local relay. The existing ContextVM transport tests deliberately use Node, but importing the browser `ChatRoomSession` under Node leaves Svelte runes untransformed.
  implication: The two test environments are incompatible for a single all-in-one fixture. A valid black-box split is to use Node for CAHMLS's real server/client protocol and retain the existing jsdom room-session tests for browser lifecycle/auto-admission.

- timestamp: 2026-08-05T00:55:00Z
  checked: Node ContextVM transport black-box using the pinned upstream `CliSession` with CAHMLS's real remote host protocol flow.
  found: The test passed in 1.83 s: the upstream client published a last-resort KeyPackage, stored its join request, accepted the CAHMLS-stored Welcome, sent an encrypted message CAHMLS decrypted, and decrypted the CAHMLS reply. The expected optional local-relay warnings did not affect the mock-relay flow.
  implication: The core cross-client admission and bidirectional encrypted-message path is independently verified. The proven temporary test should become a pinned, reproducible repository harness; browser-session lifecycle and invite URL directions retain their focused existing coverage.

- timestamp: 2026-08-05T09:07:00Z
  checked: New `pnpm test:upstream-interop` command using an immutable upstream checkout.
  found: The command fetched and verified Cordn commit `69a40f5003a6dffef183e1e2b8d5d0038de98b1a`, installed its workspace, and passed the real upstream `CliSession` black-box in 2.06 s. It covered upstream KeyPackage publication, join request, CAHMLS consumption/Commit/Welcome, upstream Welcome acceptance, and encrypted messages in both directions.
  implication: The previously prose-only upstream CLI result is now reproducible repository evidence without adding an upstream production dependency.

- timestamp: 2026-08-05T09:09:00Z
  checked: Default unit suite, TypeScript, lint, live upstream parity, production build, owned-diff inspection, and whitespace validation after adding the external-client guard.
  found: Unit tests passed (250) with only the intentionally conditionally skipped external fixture; typecheck, lint, live 11-method/7-schema parity, build, and `git diff --check` all passed. The build emitted only existing third-party annotation and chunk-size warnings.
  implication: The new harness and guardrails do not regress the default test/build pipeline and satisfy the automated conformance matrix. Real browser verification remains the sole outstanding acceptance signal.

- timestamp: 2026-08-05T09:14:00Z
  checked: Requirement-by-requirement audit of the pinned upstream harness followed by an expanded `pnpm test:upstream-interop` run.
  found: The first harness revision proved only join-request admission. Two additional black-box cases now prove a CAHMLS host directly invites an upstream Cordn identity and an upstream Cordn host directly invites a CAHMLS identity; each invitee accepts the real Welcome and exchanges encrypted messages both ways. All 3 tests passed in 4.61 s.
  implication: The automated external-implementation gate now covers all coordinator membership and invitation directions named in the stop condition. The live cordn.net browser retest remains the final acceptance signal.

- timestamp: 2026-08-05T10:34:00Z
  checked: Fresh-profile live browser flow between local CAHMLS and the deployed `https://cordn.net/chat` client over the public relay hints embedded by CAHMLS.
  found: cordn.net saved and used coordinator `4b2215108ebc1ad9fc4e226f41eaf8df1dd4f4c97d518d3cf786b3171f275296`, published its last-resort KeyPackage, requested group `d75add93-3115-4c46-bab5-e709a3fbd6cf`, received the invitation automatically without invoking **Check for invitations**, accepted it, displayed `live message from cordn.net` in CAHMLS, and displayed `live response from CAHMLS` in cordn.net.
  implication: The deployed canonical web client can add and use a CAHMLS coordinator, join its chat, and exchange encrypted messages in both directions. Combined with the pinned direct-invitation black boxes, every explicit interoperability direction is now proven.

- timestamp: 2026-08-05T00:12:00Z
  checked: Codebase graph architecture and searches for coordinator admission and invitation symbols.
  found: The graph identifies the current flow owners as `src/cordn/coordinator/coordinator.ts`, `src/cordn/server/coordinatorMethods.ts`, `src/chat/room-store.ts`, `src/chat/invite.ts`, and `src/chat/protocol.ts`; it also identifies `src/invites/nostr-social.svelte.ts` as a separate social-invitation path.
  implication: Coordinator compatibility and CAHMLS invite interoperability are distinct surfaces. The matrix must exercise both the canonical coordinator contract and the CAHMLS invitation parser/receiver rather than treating one as evidence for both.

- timestamp: 2026-08-04T21:18:00Z
  checked: Phase-0 semantic recall and `.planning/debug/knowledge-base.md`.
  found: MemPalace is not available in this runtime and no durable knowledge-base file exists.
  implication: No prior resolution can be promoted as a known-pattern candidate; the current ordering hypothesis must be tested directly.

- timestamp: 2026-08-04T21:22:00Z
  checked: Codebase graph search for `storeJoinRequest`, `storeWelcome`, and hosted-room admission.
  found: The graph identifies the relevant current paths, but several returned source snippets are misaligned with their declared symbols.
  implication: Use the graph for discovery, then read the full working-tree files before drawing behavioral conclusions.

- timestamp: 2026-08-04T21:28:00Z
  checked: Current `ChatRoomSession` and `LocalHostCoordinatorClient` request-to-Welcome path.
  found: A hosted session subscribes to same-tab join-request notifications and its callback launches `sync()` without awaiting it; `syncOnce()` admits the request and persists the Welcome before reporting the guest joined. The local adapter exposes no Promise that could make the remote `join_request_store` response wait for this work.
  implication: Immediate notification fixes the four-second polling delay but does not, by itself, make `join_request_store` and a following `welcome_take` atomic. The canonical client must tolerate the asynchronous admission window or the server contract must explicitly introduce a blocking acknowledgment.

- timestamp: 2026-08-04T21:34:00Z
  checked: `Coordinator.storeJoinRequest` and `ChatRoomSession.acceptJoinRequests` in the current worktree.
  found: `storeJoinRequest` stores the record, synchronously invokes subscribers, and returns; the subscriber begins but does not await `sync()`. The host's commit and `storeWelcome` happen later in `acceptJoinRequests`, and only a successful `storeWelcome` is recorded as a joined guest.
  implication: The prior polling-only root cause has an immediate signal fix in this worktree, but the notification remains intentionally asynchronous. The correct regression is bounded-latency admission without timer advancement, not an unsupported atomic ordering guarantee.

- timestamp: 2026-08-04T21:35:00Z
  checked: SBFL preconditions.
  found: The session state reports focused and full suites passing; no current deterministic failing test exists from which to compute a meaningful failing/passing coverage spectrum.
  implication: SBFL is skipped for this Bohrbug; execute the targeted reproduction regression instead.

- timestamp: 2026-08-04T21:40:00Z
  checked: `pnpm exec vitest run tests/unit/cordn-conformance.test.ts --reporter=dot`.
  found: All 18 conformance tests passed. The focused recovered-host regression receives and decrypts a valid Welcome within 500 ms after the request, without advancing the four-second steady-state timer.
  implication: The immediate same-tab notification path is live and proves bounded-latency admission; it does not change the documented asynchronous response ordering.

- timestamp: 2026-08-04T21:47:00Z
  checked: Hosted-room recovery adapter in `src/components/HostWorkspace.svelte`.
  found: Every successfully recovered hosted room calls `candidate.activateSteadyState()` before the selected/non-selected UI branch. The session is retained in `hostedRoomSessions`; only display attachment is conditional on selection.
  implication: The immediate same-tab admission subscriber remains active for recovered rooms regardless of which room is open, removing the recovery-lifecycle precondition that previously left pending Cordn requests unprocessed.

- timestamp: 2026-08-04T21:55:00Z
  checked: `pnpm exec vitest run tests/unit/cordn-conformance.test.ts tests/unit/contextvm-roundtrip.test.ts tests/unit/room-session-concurrency.test.ts --reporter=dot`.
  found: All 3 files and 31 tests passed. The ContextVM/Nostr transport test completed exact-KeyPackage admission, Welcome delivery, group join, and encrypted-message handling; expected relay fallback warnings were emitted by the test environment only.
  implication: The implementation satisfies the automated acceptance evidence for the original ordering failure. The remaining verification is the user-visible cordn.net workflow.

- timestamp: 2026-08-04T22:05:00Z
  checked: Human cordn.net verification after CAHMLS received a structured `at` response from `join_request_store`.
  found: The stable-identity requester issued `welcome_take` in the same second, received a structured `welcomes` response, and made no later observed Welcome fetch; cordn.net remained pending.
  implication: This directly falsifies the bounded-asynchronous-admission assumption. The canonical wire acknowledgement must provide an immediate Welcome guarantee for this sequence, or Cordn-compatible clients that perform one fetch remain pending.

- timestamp: 2026-08-04T22:20:00Z
  checked: Agent-authored direct canonical wire regression in `tests/unit/cordn-conformance.test.ts`.
  found: After awaiting `CoordinatorAdapter.storeJoinRequest` and immediately calling `CoordinatorAdapter.fetchPendingWelcomes` once, the requester received `welcomes: []`; the assertion expected one matching Welcome and failed at line 201.
  implication: The defect is reproducible without timer advancement, retries, relay transport, secrets, or test-only delays. The canonical handler acknowledgement boundary is conclusively too early for an auto-approving same-tab host.

- timestamp: 2026-08-04T22:32:00Z
  checked: The direct canonical wire regression after propagating subscriber completion through the coordinator and adapter.
  found: `join_request_store` now resolves only after the active same-tab host completed its synchronization; the one immediate `welcome_take` returned the matching Welcome. The target test passed with no timer advance, delay, retry, or polling.
  implication: The fix addresses the confirmed acknowledgement-order root cause while retaining all canonical wire schemas.

- timestamp: 2026-08-04T22:36:00Z
  checked: Focused adjacent suites: `cordn-conformance`, `cordn-browser-server`, `contextvm-roundtrip`, and `room-session-concurrency`.
  found: All 4 files and 44 tests passed. The ContextVM test emitted its known relay-fallback warnings only.
  implication: The immediate-admission boundary change preserves canonical server registration, exact KeyPackage admission, real ContextVM/Nostr delivery, and steady-state session behavior.

- timestamp: 2026-08-04T22:38:00Z
  checked: `pnpm exec tsc --noEmit` and `pnpm lint`.
  found: Both passed.
  implication: The awaitable same-tab callback types integrate cleanly with strict TypeScript and project lint rules.

- timestamp: 2026-08-04T22:45:00Z
  checked: `pnpm test -- --reporter=dot`.
  found: All 23 files and 246 tests passed. Test-environment relay fallback warnings remain expected.
  implication: The broader unit suite did not reveal a regression from awaiting active same-tab admission at the wire boundary.

- timestamp: 2026-08-04T22:48:00Z
  checked: Focused diff inspection, whitespace validation, and mutation-test configuration discovery.
  found: The implementation adds synchronization and does not delete or short-circuit behavior; `git diff --check` passed. No Stryker/mutation configuration or dependency is present.
  implication: The no-op/deletion signal passes. The mutation signal is unavailable and will be recorded as skipped; revert-and-reconfirm remains applicable via the agent-authored regression.

- timestamp: 2026-08-04T22:51:00Z
  checked: Targeted revert-and-reconfirm, with only the Promise handoff reversed and the agent-authored regression retained.
  found: The exact test returned to RED: one immediate `welcome_take` again received `welcomes: []` after `join_request_store`.
  implication: The regression is causally sensitive to this minimal handoff rather than a timing coincidence or unrelated working-tree change.

- timestamp: 2026-08-04T22:56:00Z
  checked: Restored handoff, exact regression, production build, and focused whitespace check.
  found: The one-shot immediate `welcome_take` regression returned GREEN again; production build and `git diff --check` passed. The only build output was the known third-party annotation and bundle-size warnings.
  implication: Fix-acceptance guardrail accepted: target_test=pass; mutation_check=skipped (no configured runner); no_op_deletion=pass; adjacent_tests=pass; revert_and_reconfirm=pass.

- timestamp: 2026-08-04T23:10:00Z
  checked: Existing canonical wire conformance fixture and the current coordinator/adapter handoff.
  found: The existing auto-approval test exercises `CoordinatorAdapter.storeJoinRequest()` followed by one `fetchPendingWelcomes()`. The adapter returns `structuredContent: { at: record.createdAt }`; `Coordinator.waitForJoinRequestNotifications()` returns `Promise.resolve()` when the stored request has no same-tab subscribers.
  implication: A no-subscriber case needs only a narrow adjacent test: valid published KeyPackage, no `ChatRoomSession`, exact `{ at }` assertion, then `welcome_take` asserting an empty queue. It should pass without production changes.

- timestamp: 2026-08-04T23:16:00Z
  checked: `pnpm exec vitest run tests/unit/cordn-conformance.test.ts -t "acknowledges an unsubscribed canonical join request" --reporter=dot`.
  found: The new contract passed (1 test, 19 skipped) in 6 ms while fake timers remained frozen. It received exactly `{ at: number }` from `join_request_store` and `{ welcomes: [] }` from the one subsequent `welcome_take`.
  implication: With a valid published KeyPackage but no same-tab join-request subscriber, the immediate-Welcome fix retains the non-blocking remote/no-host behavior and does not invent a Welcome.

- timestamp: 2026-08-04T23:19:00Z
  checked: `pnpm exec vitest run tests/unit/cordn-conformance.test.ts --reporter=dot`.
  found: All 20 conformance tests passed. The expected temporary Welcome-outbox persistence warning was emitted by its dedicated resilience test.
  implication: The no-subscriber contract coexists with the immediate same-tab admission, canonical wire names/shapes, KeyPackage selection, and durable Welcome delivery coverage.

- timestamp: 2026-08-04T23:24:00Z
  checked: `pnpm exec vitest run tests/unit/cordn-conformance.test.ts tests/unit/cordn-browser-server.test.ts tests/unit/contextvm-roundtrip.test.ts tests/unit/room-session-concurrency.test.ts --reporter=dot`.
  found: All 4 files and 45 tests passed. ContextVM emitted its known local relay connection/publish-retry warnings, and the dedicated outbox-resilience test emitted its expected persistence warning.
  implication: The immediate-Welcome path and the new prompt no-subscriber path are both preserved alongside canonical browser registration, real ContextVM/Nostr delivery, and hosted-room steady-state behavior.

## Eliminated

<!-- Append disproven hypotheses here. -->
