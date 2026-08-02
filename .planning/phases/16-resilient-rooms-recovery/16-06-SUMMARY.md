---
phase: 16-resilient-rooms-recovery
plan: 06
status: complete
completed: 2026-08-02
requirements:
  - BOOT-01
  - BOOT-02
  - BOOT-03
---

# Plan 16-06 Summary

Coordinator startup and room recovery now execute as one generation-owned public transaction. The injected `CoordinatorStoreRuntime` covers lease, transport, resource-monitor, retry-attempt, and wait boundaries while the production default delegates to the existing implementations. Concurrent starts share the transaction; stop/restart awaits stale work before replacement ownership; duplicate manual retries share one retained-progress recovery.

Hosted rooms are deduplicated and sorted by their exact composite identity. A malformed adapter key that previously collapsed multiple rooms into one target was corrected. Recovery preserves the locked three-attempt, 4000ms timeout, and 250ms/750ms delay policy, advances completion exactly once per room, and resumes manual recovery at the first incomplete target.

The browser startup surface exposes non-sensitive recovery state/count hooks and remains the sole rendered surface through restoration, retry, and exhaustion. Disconnected local hosted chat and its offline panel are no longer reachable; only successful exact-room connection reveals chat. Exhaustion presents one generic room-named retry action without internal signer, relay, invite, or storage details.

## Verification

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run tests/unit/state-machine.test.ts tests/unit/room-session-concurrency.test.ts -t "recovery|discarded room"` — 8 passed
- Multi-room retry/exhaustion Playwright regression repeated three times — 3 passed
- Focused recovery Playwright suite — 3 passed
- `pnpm build`
- `git diff --check`

## Commits

- `c297013` — `fix(16-06): make recovery transaction generation safe`

## Notes

- No retry timing or attempt-count policy changed.
- The browser fault injection is applied after unlock so a live pre-reload session cannot overwrite the controlled persisted-room fixture.
