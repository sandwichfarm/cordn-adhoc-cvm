---
phase: 21-first-run-coordinator-identity-profile
plan: "01"
subsystem: coordinator-setup
tags: [svelte, typescript, localstorage, contextvm, nostr, vitest]
requires:
  - phase: 17-full-viewport-startup-motion
    provides: completed startup/recovery transaction baseline
provides:
  - explicit durable setup completion and Unicode-safe coordinator-name normalization
  - side-effect-free coordinator startup preflight
  - configured MCP and Nostr server identity on new transport construction
affects: [first-run-onboarding, coordinator-settings, coordinator-startup, cordn-client-discovery]
tech-stack:
  added: []
  patterns: [validated persisted setup marker, immutable construction-time transport identity, pre-transaction setup guard]
key-files:
  created: []
  modified:
    - src/config/config.svelte.ts
    - src/coordinator/coordinator.svelte.ts
    - src/lib/transport.ts
    - tests/unit/config-store.test.ts
    - tests/unit/state-machine.test.ts
    - tests/unit/contextvm-roundtrip.test.ts
decisions:
  - Persist a normalized coordinator name and explicit setup marker atomically; only a meaningful non-default legacy name may infer completion once.
  - Reject incomplete setup before CoordinatorStore creates a startup transaction or emits a startup side effect.
  - Treat MCP/serverInfo name as constructor-static and expose a changed config snapshot only to a later transport construction.
metrics:
  duration: 15min
  completed: 2026-08-05
  tasks_completed: 2
  files_changed: 6
status: complete
---

# Phase 21 Plan 01: First-Run Coordinator Identity Profile Summary

Coordinator setup is now an enforceable, durable runtime contract: a normalized name plus explicit completion marker must exist before startup, and every new ContextVM transport advertises that configured name during initialize.

## Accomplishments

- Added Unicode-code-point-safe name normalization, explicit completion, reset behavior, defensive persisted-marker decoding, and one-time legacy migration for meaningful names only.
- Guarded `CoordinatorStore.start()` before generation, controller, status, lock, relay, log, lease, transport, monitor, or identity side effects; the explicit safe rejection is `Complete coordinator setup before starting.`
- Passed one immutable configured name snapshot into both `McpServer` and `NostrServerTransport.serverInfo`, proven through a real mock-relay MCP initialize round trip.
- Preserved the existing Phase 18 relay, hosted-room recovery, and interoperability hunks in the shared worktree.

## Verification

- `pnpm exec vitest run tests/unit/config-store.test.ts tests/unit/state-machine.test.ts tests/unit/contextvm-roundtrip.test.ts` — passed (47 tests).
- `pnpm exec vitest run tests/unit/config-store.test.ts tests/unit/contextvm-roundtrip.test.ts -t "configured coordinator name|setup|coordinator options"` — passed (10 selected tests).
- `pnpm exec tsc --noEmit` — passed.
- `pnpm lint` — passed.
- `git diff --check` — passed.

## Task Commits

No task commits were created. All five shared Task 1 files already contained unrelated in-progress Phase 18 hunks before this executor started; staging whole paths would have absorbed other agents' work. The Plan 01 hunks remain intentionally unstaged for the phase integrator to commit safely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking compatibility] Preserved direct legacy factory callers while making browser options strict**
- **Found during:** Task 2 type verification
- **Issue:** Existing external interoperability tests construct `TransportFactory` options directly without a name, so making `BrowserCoordinatorOptions.coordinatorName` required caused the repository type check to fail outside this plan's owned files.
- **Fix:** Kept `BrowserCoordinatorOptions.coordinatorName` required for browser configuration and added a narrow legacy overload at the transport boundary that preserves the historic `cordn-browser` fallback only for those direct callers. ConfigStore-created transports always receive the normalized configured name.
- **Files modified:** `src/lib/transport.ts`
- **Verification:** focused real initialize test and `pnpm exec tsc --noEmit` passed.
- **Commit:** uncommitted shared-worktree handoff.

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** Restored type-safe compatibility without weakening the browser setup/start or configured-identity contract.

## Integration Note

The guard is intentionally active before the Phase 21 onboarding UI exists. Until Plan 03 wires its setup surface, an incomplete installation's visible Start control rejects explicitly and leaves coordinator status `idle`, `error` `null`, debug log empty, relay status empty, and lease/transport/resource-monitor calls at zero.

## Self-Check: PASSED

- All six owned implementation and test files exist.
- The focused tests, full owned unit set, type check, lint, and whitespace check passed.
- No task commit hash is claimed because shared-worktree isolation made a safe atomic commit unavailable.
