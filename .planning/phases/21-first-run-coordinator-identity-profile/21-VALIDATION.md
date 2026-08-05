---
phase: 21
slug: first-run-coordinator-identity-profile
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-05
---

# Phase 21 — Validation Strategy

> Nyquist sampling contract for first-run identity, coordinator naming, public profile publication, and canonical-client resolution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + Playwright 1.61.0 |
| **Config file** | `vite.config.ts`; `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run tests/unit/config-store.test.ts tests/unit/state-machine.test.ts tests/unit/coordinator-profile.test.ts tests/unit/contextvm-roundtrip.test.ts` |
| **Full suite command** | `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check` |
| **Estimated runtime** | ~300 seconds |

## Sampling Rate

- **Before every task edit:** Run `git status --short` and `git diff -- <task target files>`; preserve compatible in-progress Phase 18 shell/profile work and stop on an incompatible overlapping hunk per D-17 and D-18.
- **After every task commit:** Run the focused automated command named by the task and `pnpm exec tsc --noEmit` for production-code tasks.
- **After every wave merge:** Run `pnpm lint && pnpm exec tsc --noEmit && pnpm test`.
- **Before the Plan 21-05 live checkpoint:** Run the full suite command; the manual check cannot substitute for repository-controlled evidence.
- **Before phase verification:** Re-run the full suite plus the live cordn.net checkpoint and evidence-file check.
- **Interop contingency:** If an execution deviation touches `src/cordn/`, coordinator methods/contracts, or chat admission/wire paths, also run `pnpm check:upstream && pnpm test:upstream-interop`.
- **Max focused-feedback latency:** 180 seconds; full phase feedback may take ~300 seconds.

## Requirement Verification Map

| Requirement | Observable behavior | Automated evidence | Manual evidence | Status |
|-------------|---------------------|--------------------|-----------------|--------|
| SETUP-01 | A fresh install chooses an existing supported signer path or durable anonymous identity before any coordinator start control or side effect is reachable. | `pnpm exec vitest run tests/unit/state-machine.test.ts && pnpm exec playwright test tests/e2e/first-run-coordinator-profile.spec.ts -g "anonymous|identity choices|autostart" --workers=1` | None; automated UI and store evidence is authoritative. | ⬜ pending |
| SETUP-02 | Identity precedes a normalized non-empty editable name; authenticated profile prefill and anonymous default follow the locked precedence. | `pnpm exec vitest run tests/unit/config-store.test.ts && pnpm exec playwright test tests/e2e/first-run-coordinator-profile.spec.ts -g "invalid name|authenticated prefill|anonymous" --workers=1` | None. | ⬜ pending |
| SETUP-03 | Completion/name survive reload, meaningful legacy names migrate once, and default/blank/malformed records still require setup. | `pnpm exec vitest run tests/unit/config-store.test.ts tests/unit/state-machine.test.ts && pnpm exec playwright test tests/e2e/first-run-coordinator-profile.spec.ts -g "reload|migration|no flash" --workers=1` | None. | ⬜ pending |
| SETUP-04 | Settings saves a local rename immediately, republishes without identity replacement, and truthfully requires restart for constructor-static initialize metadata. | `pnpm exec playwright test tests/e2e/coordinator-profile-settings.spec.ts -g "rename publishes|restart applies|invalid name|retry" --workers=1` | Plan 21-05 observes the initial and renamed labels in canonical cordn.net across explicit restart/reconnect. | ⬜ pending |
| PROFILE-01 | A valid coordinator-key kind-0 is attempted on every configured shareable relay; at least one acknowledgement succeeds, and a fresh transport advertises the configured server name. | `pnpm exec vitest run tests/unit/coordinator-profile.test.ts tests/unit/contextvm-roundtrip.test.ts && pnpm exec playwright test tests/e2e/coordinator-profile-settings.spec.ts -g "rename publishes|relay acknowledgement" --workers=1` | Plan 21-05 verifies canonical cordn.net resolves the selected label over a real shareable relay. | ⬜ pending |
| PROFILE-02 | Existing safe metadata survives, total relay failure retains the local name/running coordinator and exposes retry, and no secret material enters UI/evidence. | `pnpm exec vitest run tests/unit/coordinator-profile.test.ts tests/unit/state-machine.test.ts && pnpm exec playwright test tests/e2e/coordinator-profile-settings.spec.ts -g "failure|retry|metadata" --workers=1` | Plan 21-05 confirms unchanged public coordinator identity and records only approved public evidence. | ⬜ pending |

## Plan Task Mapping

| Task ID | Wave | Requirements | Evidence introduced or sampled | Automated command |
|---------|------|--------------|--------------------------------|-------------------|
| 21-01-01 | 1 | SETUP-01, SETUP-02, SETUP-03 | Name normalization, atomic completion, legacy migration, and a start guard before any side effect. | `pnpm exec vitest run tests/unit/config-store.test.ts tests/unit/state-machine.test.ts` |
| 21-01-02 | 1 | PROFILE-01 | Configured name in a real MCP initialize round trip and next-transport rename behavior. | `pnpm exec vitest run tests/unit/contextvm-roundtrip.test.ts tests/unit/config-store.test.ts` |
| 21-02-01 | 2 | PROFILE-01, PROFILE-02 | Metadata merge/signature, all-target invocation, one-or-more acknowledgement success, total failure, zeroization, and cleanup. | `pnpm exec vitest run tests/unit/coordinator-profile.test.ts` |
| 21-02-02 | 2 | SETUP-03, SETUP-04, PROFILE-02 | Persist-first completion/rename, total-failure retry state, unchanged runtime/key, and retry against current relays. | `pnpm exec vitest run tests/unit/state-machine.test.ts tests/unit/coordinator-profile.test.ts` |
| 21-03-01 | 3 | SETUP-01, SETUP-02, SETUP-03, PROFILE-02 | Anonymous first run, invalid name, no setup flash, legacy/reload behavior, autostart defense, and publication-failure guided start. | `pnpm exec playwright test tests/e2e/first-run-coordinator-profile.spec.ts -g "anonymous|invalid name|reload|migration|autostart|publication failure" --workers=1` |
| 21-03-02 | 3 | SETUP-01, SETUP-02 | Shared NIP-07/NIP-46 choices, race-safe profile prefill, durable anonymous continuity, identity separation, and Phase 18 shell/profile ownership regression. | `pnpm exec playwright test tests/e2e/first-run-coordinator-profile.spec.ts tests/e2e/nip07-session-restoration.spec.ts tests/e2e/identity-ui-review.spec.ts --workers=1` |
| 21-04-01 | 3 | SETUP-04, PROFILE-01 | Explicit rename, signed kind-0 on every configured test target, immediate local/public update, restart-required UI, and next-transport label. | `pnpm exec playwright test tests/e2e/coordinator-profile-settings.spec.ts -g "rename publishes|restart applies|invalid name" --workers=1` |
| 21-04-02 | 3 | SETUP-04, PROFILE-02 | Mixed acknowledgement success, total-failure retry, retained local/runtime identity, secret-safe copy, focus, and responsive behavior. | `pnpm exec playwright test tests/e2e/coordinator-profile-settings.spec.ts -g "mixed acknowledgement|failure|retry|responsive|accessibility" --workers=1` |
| 21-05-01 | 4 | SETUP-04, PROFILE-01, PROFILE-02 | Blocking live canonical-client observation after all automated gates. | `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check` before the checkpoint |
| 21-05-02 | 4 | SETUP-04, PROFILE-01, PROFILE-02 | Dated secret-safe live evidence record or explicit failure record for gap closure. | `test -s .planning/phases/21-first-run-coordinator-identity-profile/21-LIVE-INTEROP-EVIDENCE.md` |

## Wave 0 Requirements

- [ ] Extend `tests/unit/config-store.test.ts` for normalization, atomic completion, reset, all legacy classifications, runtime revision, and next-options snapshots.
- [ ] Extend `tests/unit/state-machine.test.ts` for pre-side-effect setup refusal, persist-first save, all-relay failure, retry, unchanged key/runtime, and current-relay targeting.
- [ ] Extend `tests/unit/contextvm-roundtrip.test.ts` for a configured non-default initialize name and next-transport rename behavior.
- [ ] Create `tests/unit/coordinator-profile.test.ts` for defensive merge, coordinator-key signature, every-target invocation, mixed acknowledgement success, total failure, zeroization, and pool cleanup.
- [ ] Create `tests/e2e/first-run-coordinator-profile.spec.ts` for first-run sequencing, supported identities, authenticated prefill, anonymous continuity, reload/migration, autostart, focus, and responsive shell integration.
- [ ] Create `tests/e2e/coordinator-profile-settings.spec.ts` and extend `tests/e2e/mock-relay.ts` for explicit rename, multi-relay acknowledgement permutations, retry, restart-required truth, next-transport name, accessibility, and secret-safe observation.

## Manual-Only Verification

Plan 21-05 is intentionally manual because a mocked relay and local ContextVM client cannot prove current canonical cordn.net behavior over the public network. The checkpoint records date, tested commit, public relay domains, abbreviated public coordinator identifier or public event IDs, exact initial/renamed labels, restart boundary, unchanged identity, and pass/fail. It must not retain invite capabilities, QR images, storage dumps, full keys, bunker material, decrypted content, raw errors, or secret-bearing screenshots.

## Validation Sign-Off

- [x] Every requirement maps to automated evidence; the external canonical-client boundary additionally maps to a blocking manual checkpoint.
- [x] Every implementation task has a focused automated command or a full-gate prerequisite.
- [x] Sampling continuity forbids three consecutive tasks without automated verification.
- [x] Dirty-worktree sampling protects the independent Phase 21 / in-progress Phase 18 integration boundary.
- [x] No watch-mode flags are used.
- [x] `nyquist_compliant: true` is set in frontmatter.
- [ ] Wave 0 coverage is implemented and green.
- [ ] Live canonical-client evidence is approved and recorded.

**Approval:** draft — implementation, automated gates, and live interoperability checkpoint pending.
