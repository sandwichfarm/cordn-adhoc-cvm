---
status: diagnosed
trigger: "Diagnose the Phase 17 verification gaps recorded in .planning/phases/17-full-viewport-startup-motion/17-VERIFICATION.md: (1) reduced-motion ring-plane transform changes during static sample, (2) retry/exhaustion and handoff scenarios fail because second room create dialog cannot open, (3) repeated cleanup test fails because Stop remains running. Determine product bug vs test orchestration using current code through 6ae3948. Do not modify production/source/tests."
created: 2026-08-03T00:59:56+01:00
updated: 2026-08-03T02:29:00+01:00
goal: find_root_cause_only
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

bug_class: bohrbug
hypothesis: "Two independent deterministic product defects in StartupSignalField explain all three Phase 17 gaps: reduced mode derives ring-plane transforms from live progress, and normal-mode startup reads context before const context is initialized when a newly mounted field receives a settled signal."
test: "Focused Playwright reproductions plus a reduced-motion counterfactual and development-server pageerror stack mapping."
expecting: "Confirmed: reduced transform changes exactly; normal mounted settled field emits a context TDZ; the same create/Stop flow succeeds in reduced mode without that error."
next_action: "Return diagnosis-only report to the parent agent; do not modify production code or tests."

reasoning_checkpoint:
  hypothesis: "Reduced mode transforms are non-static because it sets rotation and scale from live signal values; normal startup fails because media.add invokes updateTargets during gsap.context construction and the settled branch reads context before the const assignment completes."
  confirming_evidence:
    - "Reduced-motion browser run changed .ring-plane from matrix(0.982739, -0.0894362, ...) to matrix(0.986584, 0.020666, ...) after 650ms."
    - "Development-server probe emitted Cannot access 'context' before initialization, mapped to StartupSignalField updateTargets while normal media initialization invoked it for a settled field."
    - "The valid second New room click and valid Stop click fail only in normal mode; the otherwise identical reduced-mode Stop flow reached idle immediately with no pageerror."
  falsification_test: "If reduced mode had held transform constant, or if normal mode with the same first-room flow had no context TDZ and still failed to create/stop, these causes would be false."
  fix_rationale: "Use immutable visual values for the reduced branch and make the GSAP context variable initialized before callbacks can read it (or defer initial update until after context assignment). This removes each causal mechanism without weakening behavioral assertions."
  blind_spots: "No fix was applied in this diagnosis-only session, so the full retry/exhaustion assertions have not yet run green."
  candidate_causes:
    - "code: StartupSignalField's reduced progress-derived transform and normal-mode context temporal-dead-zone"
    - "test-orchestration: createRoom could be targeting a disabled/unavailable action or asserting too early"
    - "environment: browser motion preference or build artifact could differ from source"
  and_gate: "no — reduced motion's visual defect and normal-mode TDZ are independent OR causes; the latter alone accounts for second-room and Stop failures."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "With reduced motion enabled, the startup ring-plane transform remains static during the verifier sample. Retry/exhaustion and handoff scenarios can open a second room-create dialog after completing the first workflow. Repeated cleanup completes and leaves Stop no longer running."
actual: "The verifier observed a reduced-motion ring-plane transform change during a static sample; retry/exhaustion and handoff scenarios could not open the second room-create dialog; the repeated cleanup scenario timed out because Stop remained running."
errors: "Phase 17 verification gaps as recorded in 17-VERIFICATION.md; exact errors pending report inspection."
reproduction: "Run the exact Phase 17 verification scenarios and commands documented in 17-VERIFICATION.md against code through 6ae3948."
started: "Detected during Phase 17 verification after commit 6ae3948."

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "Retry/exhaustion and handoff fail because createRoom uses a disabled, hidden, or not-yet-actionable New room control."
  evidence: "Trace resolved the exact New room button, waited for it to be visible/enabled/stable, performed the click, then immediately observed no dialog."
  timestamp: 2026-08-03T01:43:00+01:00

- hypothesis: "CoordinatorStore.stop or the cleanup assertion independently causes Stop to remain running."
  evidence: "The exact create/Stop workflow in reduced motion changed running to idle immediately and raised no error; normal motion alone raised the StartupSignalField TDZ and then left status running."
  timestamp: 2026-08-03T02:22:00+01:00

- hypothesis: "A change after 6ae3948 caused the reported failures."
  evidence: "6ae3948..HEAD changes only one field teardown call and a test wait location; both offending branches are byte-for-byte present at baseline lines 65, 105-110, 118, and 160-173."
  timestamp: 2026-08-03T02:29:00+01:00

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-03T00:59:56+01:00
  checked: "Git history and working tree"
  found: "HEAD is a2839ee; the requested code boundary is commit 6ae3948; 17-VERIFICATION.md and related review documents are untracked user artifacts."
  implication: "Investigation must preserve user artifacts and attribute behavior to the source state at 6ae3948, not later uncommitted planning files."

- timestamp: 2026-08-03T01:03:00+01:00
  checked: ".planning/phases/17-full-viewport-startup-motion/17-VERIFICATION.md and .planning/debug/knowledge-base.md"
  found: "The verifier recorded three deterministic browser failures: reduced-motion transform changes after 650ms; two multi-room scenarios fail at createRoom before their assertions; and cleanup fails because Stop leaves status-badge running for 10 seconds. No knowledge-base entry exists."
  implication: "The initial evidence supports separate motion, test-setup, and lifecycle candidates. Each must be reproduced independently; the current report does not establish a shared root cause."

- timestamp: 2026-08-03T01:08:00+01:00
  checked: "codebase-memory graph: StartupSignalField, HostWorkspace, CoordinatorStore start/stop/recovery symbols"
  found: "The graph confirms the relevant source files and coordinator transition surface: StartupSignalField.svelte, HostWorkspace.svelte, and CoordinatorStore.stop/startGeneration/retryRoomRecovery/setRoomRecoveryProgress. The graph snapshot's surrounding source for some symbols is stale or truncated, so it cannot establish exact current behavior."
  implication: "Graph discovery narrowed the path without supplying proof. Exact source and runtime observations are required before accepting any candidate."

- timestamp: 2026-08-03T01:15:00+01:00
  checked: "src/components/StartupSignalField.svelte and 6ae3948..HEAD diff"
  found: "At 6ae3948 and HEAD, updateTargets' reduced branch calls gsap.set('.ring-plane', { rotation: (forward - 85) * .08, scale: .94 + energy * .06 }). It runs both on media preference setup and on every signal update. The only later field change removes destroyAmbient from teardown; it does not affect this branch."
  implication: "Reduced motion has no tween, but it is not static: coordinator progress produces discrete transform changes. This directly predicts the reported changed computed matrix and is a product defect present at 6ae3948."

- timestamp: 2026-08-03T01:23:00+01:00
  checked: "Exact baseline E2E helper/tests, HostWorkspace guards, and CoordinatorStore stop/recovery implementation"
  found: "At 6ae3948, createRoom falls back to clicking New room without first requiring it to be enabled or requiring coordinator status running. HostWorkspace disables New room unless coordinator.status is running. CoordinatorStore.stop increments generation, aborts the start controller, awaits active startup, then transitions to idle; recoverHostedRooms checks generation and the abort signal after every awaited operation."
  implication: "The multi-room setup has an unverified control precondition. The Stop implementation appears cancellation-aware, so the cleanup failure must be reproduced to distinguish a UI handler/order defect from a coordinator bug."

- timestamp: 2026-08-03T01:27:00+01:00
  checked: "Focused reduced-motion Playwright test"
  found: "The failure reproduced exactly: before matrix(0.982739, -0.0894362, 0.0894362, 0.982739, -345.688, -345.688); after 650ms matrix(0.986584, 0.020666, -0.020666, 0.986584, -345.688, -345.688)."
  implication: "The transform changes under reduced motion in an isolated browser run. This falsifies any explanation based solely on stale ambient GSAP tweens; the reduced branch's live signal-derived gsap.set is sufficient and must be changed."

- timestamp: 2026-08-03T01:34:00+01:00
  checked: "Focused retry/exhaustion Playwright test and its error-context DOM snapshot"
  found: "The test reliably fails at the second createRoom dialog assertion. At failure, coordinator status is running, one hosted room exists, New room is rendered, and the main pane reports Opening local room / Room connecting. No create-room-dialog is in the DOM."
  implication: "This is a test-orchestration failure before any retry/exhaustion behavior. A disabled-control explanation is not supported by the captured state; the opening-local-room handoff is the relevant competing transition."

- timestamp: 2026-08-03T01:43:00+01:00
  checked: "Focused retry/exhaustion Playwright trace with snapshots"
  found: "For the second creation, Playwright resolved <button title='New room' aria-label='New room'>, explicitly waited until it was visible, enabled, and stable, targeted it, and completed the click. The immediately following DOM snapshot still has no create-room-dialog. The same New room path opened the first dialog earlier in the test."
  implication: "The control's availability and pointer dispatch are proven. The failure cannot be fixed honestly by loosening the dialog assertion or merely adding a wait; the code must explain why the second valid command is ignored."

- timestamp: 2026-08-03T01:52:00+01:00
  checked: "Isolated Playwright runtime probe: start, create first room, then click enabled New room while Opening local room is visible"
  found: "Before and after the second click, status was running and New room.disabled was false, but create-room-dialog was absent immediately and after 300ms. The browser emitted pageerror: Cannot access 'u' before initialization."
  implication: "The second creation is not a test orchestration defect. The valid UI command triggers a TDZ runtime exception when the dialog renders. Mapping the compiled symbol is now the only remaining causal step."

- timestamp: 2026-08-03T02:02:00+01:00
  checked: "Isolated browser probe against Vite development server with full pageerror stack; source at 6ae3948"
  found: "The runtime error is Cannot access 'context' before initialization in StartupSignalField.svelte. The no-preference matchMedia callback synchronously invokes updateTargets(signal) while gsap.context is still assigning const context. With a resting/settled signal, updateTargets reads context.getTweens() at baseline line 118 before the assignment returns."
  implication: "This is a precise TDZ product defect present at 6ae3948. It explains why a first room in Opening local room/settled presentation poisons later UI interactions, blocking both multi-room setup scenarios before their intended assertions."

- timestamp: 2026-08-03T02:09:00+01:00
  checked: "Focused cleanup Playwright test and trace"
  found: "The cleanup case reproduces: Playwright completes a valid exact Stop click, but status-badge remains running for 10 seconds. The test stops before it can report its captured pageerrors."
  implication: "The failure is not a locator timeout. We must observe the lifecycle immediately around Stop to determine whether the event handler executes at all or CoordinatorStore.stop blocks."

- timestamp: 2026-08-03T02:15:00+01:00
  checked: "Isolated normal-motion Stop probe after creating one room"
  found: "The compact Stop control was enabled. After its successful click, status remained running immediately, after 100ms, and after 1s. The only captured page error was the StartupSignalField context TDZ."
  implication: "CoordinatorStore.stop is not observed to enter its synchronous stopping transition in the poisoned normal-motion UI. A reduced-motion counterfactual is needed to determine whether that error is causal rather than merely correlated."

- timestamp: 2026-08-03T02:22:00+01:00
  checked: "Reduced-motion counterfactual: identical start, create-first-room, enabled Stop workflow"
  found: "With reduced motion emulated, Stop was enabled and status changed from running to idle immediately, remained idle at 100ms and 1s, and no pageerror occurred."
  implication: "The TDZ in the normal StartupSignalField branch is necessary for the cleanup failure. CoordinatorStore.stop and the cleanup test's Stop expectation are exonerated; the minimal fix belongs in StartupSignalField initialization."

- timestamp: 2026-08-03T02:29:00+01:00
  checked: "Focused handoff test, 6ae3948 source, and 6ae3948..HEAD diff"
  found: "Handoff independently fails at the same second createRoom dialog expectation (baseline test lines 1968-1969 → helper line 289). Both offending field branches already exist at 6ae3948; later commits do not alter them."
  implication: "Retry/exhaustion and handoff share the normal-mode field TDZ root cause, while the reduced-motion transform issue is a separate product defect. All verifier gaps are deterministic Bohrbugs present at the requested boundary."

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "1. Reduced-motion product defect: StartupSignalField line 108 assigns ring-plane rotation and scale from changing coordinator progress, so the composition is not static. 2. Normal-motion product defect: StartupSignalField line 118 reads const context inside gsap.context's synchronous media callback before line 65 completes the assignment when the first local room mounts the field in a settled state. The resulting TDZ ReferenceError blocks later New room and Stop UI commands."
fix: "1. In the reduced branch, use a fixed ring-plane transform and fixed visual field variables rather than forwardPercent/energy-derived transform or mask state. 2. Declare an initialized/optional GSAP context before registering matchMedia callbacks (or defer the initial update until after gsap.context returns), so a settled initial signal cannot read a temporal-dead-zone binding. Keep the existing E2E assertions; add a regression assertion for the first-room normal-motion pageerror-free path."
verification: "Reproduced reduced transform failure; retry/exhaustion and handoff both fail at second createRoom; cleanup reproduces after successful Stop click. Development-server stack mapped the TDZ. The reduced-motion counterfactual made Stop reach idle immediately with zero pageerrors."
files_changed: []
