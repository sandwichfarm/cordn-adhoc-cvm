---
status: resolved
trigger: "I no longer see the loading page; it goes straight to the remembered chat while the coordinator is idle/connecting."
created: 2026-08-02
updated: 2026-08-02T09:49:00Z
---

# Debug Session: Startup screen bypassed

## Symptoms

- expected: When the host coordinator is idle or starting, the coordinator startup/loading page is visible. A remembered host room reopens only after the coordinator reaches running.
- actual: A persisted host room and its connecting chat render immediately, bypassing the startup/loading page while the coordinator remains idle.
- errors: No runtime error is visible; this is a deterministic render-state regression.
- timeline: Observed after remembered-channel restoration and host workspace changes.
- reproduction: Persist a host room as the last active channel, leave the coordinator stopped, then reopen or reload the host workspace.

## Current Focus

bug_class: bohrbug
reasoning_checkpoint:
  hypothesis: "A valid remembered local host room causes `room` and `session` to be set on mount; HostWorkspace has no shared local-readiness state, so its chat render predicate, running/reconnecting fallback, and local coordinator indicators can treat that room as ready before both coordinator and room connection are usable."
  confirming_evidence:
    - "The exact mount path calls `restoreHostChat()` before any status gate."
    - "The original template evaluates `room && session` before `coordinator.status !== 'running'`, and the first partial predicate fix only checks coordinator status."
    - "The agent-authored Playwright scenario remains idle after unlock and fails because `startup-ascii-field` is absent."
    - "`ChatRoomSession` initializes as `connecting` and sets `offline` after a failed room sync, proving a restored room has a direct readiness signal distinct from coordinator status."
  falsification_test: "With a valid persisted local host room and coordinator status `running` while `roomConnection` is `connecting` or `offline`, the UI must still show a loading stage and no host-message list; seeing the chat or an empty workspace disproves the proposed two-state gate."
  fix_rationale: "Require chat eligibility to include `roomConnection === 'connected'` and route a running coordinator with a reconnecting local room to an explicit startup-stage connection message, keeping the existing startup display for every non-running coordinator status."
  blind_spots: "This browser-level verification covers the local hosted-room UI contract; the independent remote/coordinator ChatRoute policy is not being changed in this task."
  candidate_causes:
    - "code: the chat predicate omits room-connection readiness, has no loading branch for a running coordinator with a reconnecting local room, and local status-dot state is not derived from coordinator plus room readiness."
    - "config: autostart could change the time spent idle, but the red test disables it and still reproduces the failure."
    - "data: a corrupt remembered room could produce a different failure, but the red test creates and reloads valid rooms."
  and_gate: "no — the normal persisted room is the trigger; the incomplete local render-readiness predicate alone causes both premature chat and the running/reconnecting empty-state fallthrough."
test: "Focused reachable and unreachable remembered-host-room Playwright scenarios both pass against the shared readiness gate."
expecting: "Root-level validation can rerun the full suite without changing this focused implementation."
next_action: "Root agent performs any remaining broader validation and obtains human workflow confirmation; do not alter the focused HostWorkspace fix unless a regression appears."

## Evidence

- timestamp: 2026-08-02T09:28:24Z
  checked: User screenshot and reported state labels.
  found: The shell shows COORDINATOR IDLE and Start while the remembered room renders as Connecting.
  implication: Room restoration is incorrectly winning over the coordinator startup/loading state.

- timestamp: 2026-08-02T09:31:00Z
  checked: Persistent debug knowledge base.
  found: No `.planning/debug/knowledge-base.md` exists; semantic MemPalace recall is unavailable in this runtime.
  implication: There is no prior resolution to seed as a hypothesis candidate.

- timestamp: 2026-08-02T09:31:00Z
  checked: Failure classification and common-bug-pattern map.
  found: The reported reload path is deterministic and is consistent with an invalid render-state transition / initialization-order precedence bug.
  implication: Classify as Bohrbug; use deterministic reproduction and direct branch inspection before considering timing or environment causes.

- timestamp: 2026-08-02T09:33:00Z
  checked: `HostWorkspace` mount and template branches.
  found: `onMount` executes `restoreHostChat()` before any lifecycle gating, while the chat template renders on `room && session`; coordinator state is only tested in the following `{:else if coordinator.status !== "running"}` branch.
  implication: A persisted host room sets both chat values while idle, so the lifecycle branch is unreachable and the startup UI is bypassed.

- timestamp: 2026-08-02T09:34:00Z
  checked: Host workspace diff, history, and test coverage setup.
  found: The regression is in the uncommitted remembered-room/workspace changes; the existing end-to-end scenario restores a room after an unlock but incorrectly asserts the chat is immediately visible. Vitest has no configured per-test coverage, so SBFL is skipped.
  implication: Converting that scenario into an idle-lifecycle precedence test is a focused, specified-oracle regression guard; source changes must be limited to the template branch predicate/order.

- timestamp: 2026-08-02T09:36:00Z
  checked: Agent-authored focused Playwright regression scenario before source changes.
  found: With a real persisted host room, reload, and unlock, the status badge is `idle` but `startup-ascii-field` is not found after 10 seconds.
  implication: The exact user-visible bypass is reproducible. The test oracle is specified (the lifecycle UI contract), and its state-boundary neighbors are idle, starting, and running.

- timestamp: 2026-08-02T09:36:00Z
  checked: Reported visual state during coordinator startup.
  found: The same bypass also occurs while the status is `starting`.
  implication: The fix and regression coverage must exclude the chat branch for every status other than `running`, not only `idle`.

- timestamp: 2026-08-02T09:37:00Z
  checked: Minimal code change.
  found: The host chat template branch now requires `room && session && coordinator.status === "running"`; the focused test checks idle, starting, and running lifecycle boundaries for a persisted valid host room.
  implication: The lifecycle branch has precedence for all non-running states while the remembered selected room remains available to render once the coordinator is running.

- timestamp: 2026-08-02T09:38:00Z
  checked: Focused Playwright regression scenario after the source change.
  found: `restores the last active host channel across sessions` passed in 3.9 seconds, including explicit idle, starting, and running assertions.
  implication: The targeted reproduction is fixed and the test has non-implicit coverage of both sides of the lifecycle predicate.

- timestamp: 2026-08-02T09:40:00Z
  checked: Adjacent lifecycle and repository validation.
  found: The focused persisted-room scenario and the independent start/stop lifecycle scenario both passed (2 Playwright tests, 12.0 seconds); `pnpm test` passed 20 files / 128 tests; `pnpm build` passed type checking and production bundling.
  implication: The lifecycle precedence change preserves the nearby startup path and does not break the project's unit or build gates.

- timestamp: 2026-08-02T09:41:00Z
  checked: Required local-host-room readiness contract.
  found: A same-coordinator hosted chat must remain hidden while its session is connecting or offline, and a running coordinator must show explicit loading status instead of an empty workspace until that local session is connected.
  implication: The partial lifecycle fix is insufficient; the final predicate must require `roomConnection === "connected"` and a dedicated running/reconnecting loading branch.

- timestamp: 2026-08-02T09:42:00Z
  checked: Required local coordinator status-indicator contract.
  found: The selected local/home coordinator dot must reflect both coordinator and local room readiness: green only for running plus connected, neutral while not ready, and amber/red for running plus offline; remote-dot behavior remains unchanged.
  implication: Finalize a shared derived local readiness/status value and apply it consistently to the main local dot and the home entry in the server menu.

- timestamp: 2026-08-02T09:43:00Z
  checked: `ChatRoomSession` connection state transitions and local status-dot implementation.
  found: A host session begins as `connecting`, becomes `offline` on sync errors, and changes to `connected` only after message synchronization. Both local coordinator dots are currently hard-coded green; remote dots have a separate class.
  implication: A single HostWorkspace-derived local status (`ready`, `neutral`, or `error`) can gate chat rendering, select the running/reconnecting loading branch, and style only local coordinator dots without changing remote semantics.

- timestamp: 2026-08-02T09:45:00Z
  checked: Agent-authored deterministic offline-local-room scenario before the connection-gate change.
  found: After changing only the remembered host room's relay URL to unreachable `ws://127.0.0.1:1`, the coordinator reaches `running` through its separate configured mock relay but `startup-ascii-field` disappears.
  implication: The coordinator-only partial gate still renders a local host chat before its room session is usable; the exact offline requirement is reproducible independently of remote ChatRoute behavior.

- timestamp: 2026-08-02T09:46:00Z
  checked: Shared local readiness implementation.
  found: `localRoomReady` now requires running coordinator, active session, and connected room; its derived local status controls the host-chat branch, running/reconnecting startup panel, and both local coordinator dots. Remote dot markup remains unchanged.
  implication: The same readiness condition now governs all user-visible local-room state. The chat composition controls remain connected-only and will be kept as a compile-safe constant inside the gated branch.

- timestamp: 2026-08-02T09:47:00Z
  checked: Focused reachable and unreachable restored-room scenarios after the shared readiness update.
  found: The reachable scenario passed. In the unreachable scenario, after coordinator running the startup field and room-connection panel remained visible and the host chat stayed hidden; the panel was still accurately `connecting` at the standard 10-second assertion deadline.
  implication: The render gate works for the connecting boundary. Extend only the bounded observation window to capture the subsequent offline/error-dot transition generated by the deliberately unreachable relay.

- timestamp: 2026-08-02T09:49:00Z
  checked: Deterministic offline-local-room scenario with a bounded offline observation window.
  found: The scenario passed in 14.6 seconds: coordinator reached running through its configured mock relay, the unreachable remembered local room transitioned to offline, `StartupSignalField` and the room-connection panel remained visible, the host message list remained hidden, and both local dots reported error.
  implication: The final readiness gate covers idle, starting, connecting, and offline local-host-room states; a separate reachable remembered-room scenario also confirms the chat appears once connected.

## Eliminated

## Resolution

- root_cause: "HostWorkspace treats a restored local room/session as ready without a shared coordinator-plus-room readiness state, causing premature chat rendering, an empty running/reconnecting fallback, and misleading local status dots."
- fix: "Gate local chat on a shared running-and-connected readiness condition; show a room-connection startup panel for running/connecting-or-offline local rooms; derive neutral/ready/error local coordinator dots while preserving remote dots."
- oracle_type: specified
- verification:
  focused_playwright:
    result: pass
    scenarios:
      - "reachable remembered host room: idle and starting show startup UI; chat appears after connection"
      - "unreachable remembered local host room: running retains startup UI and room-connection panel; chat remains hidden; local dots report error"
  source_build: pass via focused Playwright web-server production build
  repository_gates:
    result: pass
    checks:
      - "git diff --check"
      - "pnpm lint"
      - "pnpm test: 20 files / 128 tests"
      - "pnpm build"
      - "focused Playwright: 2 startup/readiness scenarios passed"
      - "adjacent remote-coordinator cached/offline scenario passed"
  mutation_check: skipped — no Stryker configuration or dependency exists
  broader_validation: completed by root agent
- files_changed:
  - src/components/HostWorkspace.svelte
  - tests/e2e/phase-one.spec.ts
