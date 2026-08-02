---
status: resolved
trigger: "The UI says running in three places and offline in two places; the messages are contradictory and show a regression."
created: 2026-08-01
updated: 2026-08-01T20:36:00Z
---

# Debug Session: Contradictory status labels

## Symptoms

- expected: Show one unambiguous coordinator runtime state and, only when useful, one explicitly scoped room connection state. A selected hosted room should not appear offline while its local coordinator is running without a real connectivity failure.
- actual: With a running coordinator, selected hosted room, and management open, the interface repeats Running three times and Offline twice across the top bar, rail, and summary.
- errors: No explicit runtime error is visible.
- timeline: Regression observed after the global navigation, room connection, and management status surfaces were combined.
- reproduction: Start the local coordinator, create/select a hosted room, open management, and inspect the global header, channel rail, and management summary.

## Current Focus

- bug_class: bohrbug
- hypothesis: The contradictory labels arise because HostWorkspace renders one coordinator runtime state on three surfaces and treats the distinct ChatRoomSession connection state as coordinator state in its messages; neither state derives from the other.
- test: Verify the status-contract regression test and the existing coordinator lifecycle test after the presentation-only fix.
- expecting: Both tests pass; the global runtime remains functional and the new scoped status contract remains enforced.
- next_action: Resolved; monitor the status contract during future navigation changes.

reasoning_checkpoint:
  hypothesis: "HostWorkspace and WorkspaceNav create contradictory status labels because coordinator.status and ChatRoomSession.status.connection are independently rendered as unscoped coordinator states."
  confirming_evidence:
    - "HostWorkspace renders coordinator.status in the channel rail and management summary while LifecyclePanel owns the global coordinator controls."
    - "ChatRoomSession sets connection=offline only in its transport-error catch, but HostWorkspace and ChatRoute render that value as Coordinator offline; WorkspaceNav displays it as unscoped Offline."
    - "The existing host/guest delivery E2E test passed, proving the normal selected-host-room path reaches connected while the coordinator is running."
  falsification_test: "If a hosted session still displays Offline after these text/surface changes while its ChatRoomSession never enters offline, or if the delivery E2E fails, the defect is a state/transport issue rather than presentation conflation."
  fix_rationale: "Render the coordinator runtime only in the compact lifecycle control, remove its duplicates from the rail and management summary, and label room-session state as Room connection everywhere it is shown."
  blind_spots: "Live desktop-browser inspection is unavailable without Accessibility permission; real relay faults still correctly produce an explicitly scoped room-offline state."
  candidate_causes:
    - "code: independent coordinator and room-session status renders use overlapping, unscoped wording"
    - "environment: a real relay/client transport failure can set the room session offline, but it cannot explain repeated running labels"
    - "data: persisted rooms may restore a prior session, but status is initialized connecting and only becomes offline in the session error path"
  and_gate: "no — the unscoped duplicate render alone accounts for the contradictory presentation; an actual transport failure is not required."

## Evidence

- timestamp: 2026-08-01T00:05:00Z
  checked: .planning/debug/knowledge-base.md and semantic/code graph search for runtime, room session, and connection status
  found: No debug knowledge base exists. The graph identifies separate CoordinatorStatus/StatusSnapshot types and ChatRoomSession methods including handleOnline and markServerOnline.
  implication: There is no known-pattern shortcut; the initial hypothesis has distinct coordinator and room-session state sources to compare.

- timestamp: 2026-08-01T00:10:00Z
  checked: Literal Running/Offline labels in application source and coordinator/room store definitions
  found: HostWorkspace owns roomConnection and displays Coordinator offline when it is offline. WorkspaceNav displays an unscoped room connection label plus an online coordinator status. CoordinatorStore.status is a distinct local runtime state; ChatRoomSession status is set offline after a sync failure and connected only when markServerOnline is called.
  implication: The reported contradiction is reproducible from independently rendered status channels; distinguishing host-path session behaviour from UI duplication is the next discriminating check.

- timestamp: 2026-08-01T00:20:00Z
  checked: HostWorkspace, WorkspaceNav, ChatRoomSession, ChatCoordinatorClient, relay pool, existing unit tests, and browser snapshots
  found: HostWorkspace starts a ChatRoomSession for every selected hosted room and supplies its connection to WorkspaceNav. The session marks Offline only after an actual client exception, but HostWorkspace calls that state Coordinator offline. In the same render path, coordinator.status is displayed by LifecyclePanel, the channel rail, and the management summary. Existing browser tests cover successful host-room messaging and coordinator-offline recovery, but do not assert the status-label contract.
  implication: The code contains both identified presentation defects. A narrow browser run is needed to determine whether the reported Offline is a session transport failure or only an ambiguous label.

- timestamp: 2026-08-01T00:20:00Z
  checked: SBFL preconditions
  found: SBFL skipped: no failing automated test reproduces the label regression, so no failing/passing coverage spectrum exists.
  implication: Proceed with direct deterministic reproduction and targeted regression coverage.

- timestamp: 2026-08-01T00:30:00Z
  checked: Live browser accessibility inspection
  found: Browser automation is unavailable because macOS Accessibility permission is not granted to Orca. The existing snapshot files show coordinator-offline startup states but not the reported running-hosted-room combination.
  implication: Do not infer live UI state from stale snapshots; use the isolated Playwright flow as the direct executable observation.

- timestamp: 2026-08-01T00:35:00Z
  checked: Existing Playwright host/guest delivery flow
  found: The selected-host-room delivery test passed: the host received a guest message and the guest received host messages through the running coordinator. The broader test invocation was manually stopped after that relevant test had passed, leaving unrelated later tests interrupted.
  implication: The normal local host path reaches ChatRoomSession.connected. The reported regression is not a required transport failure and is explained by the independent, misleading status presentation.

- timestamp: 2026-08-01T00:40:00Z
  checked: New status-contract test before the fix
  found: It failed as expected because coordinator-runtime-status did not exist in the compact lifecycle control.
  implication: The test directly captures the missing unambiguous global runtime label and is a valid regression guard.

- timestamp: 2026-08-01T00:50:00Z
  checked: Focused Playwright coordinator lifecycle and status-contract tests after the fix
  found: Both passed. The build step (including TypeScript no-emit checking) also passed. The new test verifies Coordinator running in the top control, no running label in the rail, three management summary cards, and Room synced after selecting a hosted room.
  implication: The fix preserves coordinator lifecycle behaviour and verifies the reported status contract end-to-end in Chromium.

- timestamp: 2026-08-01T20:36:00Z
  checked: Adjacent idle/startup states, desktop and 390px mobile layouts, lint, unit suite, and focused viewport E2E coverage
  found: The redundant center lifecycle chip was removed, idle/busy/running colors are state-specific, both inspected layouts remain viewport-contained, lint passed, all 128 unit tests passed, and the three focused viewport/status tests passed.
  implication: The single-owner status model remains clear outside the original running-management reproduction and does not reintroduce page scrolling on mobile.

## Eliminated

- hypothesis: The selected hosted room necessarily has a stale or false offline transport state while the local coordinator is running.
  evidence: The host/guest delivery E2E path passed with a selected hosted room, and the session code assigns offline only in the client-operation error handler.
  timestamp: 2026-08-01T00:35:00Z

## Resolution

- root_cause: Coordinator runtime and room-session connection are independently rendered with overlapping, unscoped labels: the rail and management summary duplicate the runtime status, while a room-session failure is labelled as coordinator offline.
- fix: Added the single visible Coordinator {status} runtime label to LifecyclePanel, removed runtime duplicates from the channel rail and management summary, and renamed all room-session status copy to Room connection/Room so it cannot be read as coordinator runtime state.
- verification:
  target_test: { result: pass, command: "CI=1 pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep 'starts, locks relay configuration, and stops|separates the coordinator runtime from the selected room connection'" }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker configuration was identified during this bounded investigation." }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false, evidence: "The diff adds scoped labels and a regression test while removing only duplicate presentation surfaces; it does not short-circuit runtime or session behaviour." }
  adjacent_tests: { result: pass, suites_run: ["coordinator lifecycle E2E", "status-contract E2E", "TypeScript no-emit via Playwright webServer build"] }
  revert_and_reconfirm: { result: not_run, reason: "The shared worktree contains unrelated uncommitted changes; reverting multi-file UI hunks in this handoff would risk overwriting concurrent work." }
  guardrail_verdict: pass
- files_changed:
  - src/components/LifecyclePanel.svelte
  - src/components/WorkspaceNav.svelte
  - src/components/HostWorkspace.svelte
  - src/components/ChatRoute.svelte
  - tests/e2e/phase-one.spec.ts
