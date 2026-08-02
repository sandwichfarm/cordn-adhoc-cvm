---
phase: 15
slug: identity-continuity-membership-integrity
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 with jsdom; Playwright 1.61.0 |
| **Config file** | `vite.config.ts`; `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run tests/unit/user-profile.test.ts tests/unit/room-navigation.test.ts` |
| **Full suite command** | `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check` |
| **Estimated runtime** | Quick: ~5 seconds; full: ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run tests/unit/user-profile.test.ts tests/unit/room-navigation.test.ts`
- **After every plan wave:** Run `pnpm lint && pnpm exec tsc --noEmit && pnpm test`
- **Before `$gsd-verify-work`:** Run `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check`
- **Max feedback latency:** 10 seconds for task-level sampling

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 0 | IDEN-01 | T-15-01 | Persisted anonymous material is strictly validated and corrupt data fails closed. | unit | `pnpm exec vitest run tests/unit/user-profile.test.ts` | ✅ | ✅ green |
| 15-01-02 | 01 | 1 | IDEN-01, IDEN-02 | T-15-02 | Reload restores one signer and rotation requires explicit confirmation. | unit + browser | `pnpm exec vitest run tests/unit/user-profile.test.ts && pnpm exec playwright test tests/e2e/nip07-session-restoration.spec.ts` | ✅ | ✅ green |
| 15-02-01 | 02 | 1 | IDEN-03 | T-15-03 | Rotation tears down sessions and old room authority before exposing the replacement signer. | unit + browser | `pnpm exec vitest run tests/unit/room-navigation.test.ts tests/unit/user-profile.test.ts && pnpm exec playwright test tests/e2e/stale-local-sessions.spec.ts` | ✅ | ✅ green |
| 15-02-02 | 02 | 1 | IDEN-04 | T-15-04 | Reconciliation and removal are scoped to `(coordinatorPubkey, roomId)`. | unit + browser | `pnpm exec vitest run tests/unit/room-navigation.test.ts && pnpm exec playwright test tests/e2e/identity-rotation-behavior.spec.ts tests/e2e/identity-prohibitions.spec.ts tests/e2e/identity-ui-review.spec.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Extend `tests/unit/user-profile.test.ts` with durable anonymous record, corrupt-record recovery, and rotation-order cases.
- [x] Extend `tests/unit/room-navigation.test.ts` with signer/pubkey mismatch, exhaustive alias purge, and same-room-id/different-coordinator cases.
- [x] Extend browser coverage with reload stability, confirmation dismissal, in-flight UI, atomic completion, fresh-invite-after-rotation proof, corrupt recovery, authenticated-identity isolation, and responsive UI contracts.

---

## Manual-Only Verifications

All Phase 15 behaviors have automated verification. Final visual review additionally checks the approved `15-UI-SPEC.md` at desktop and narrow viewport widths.

The focused Phase 15 browser gate completed with 13/13 passing checks across `identity-rotation-behavior.spec.ts`, `identity-prohibitions.spec.ts`, and `identity-ui-review.spec.ts`. The project unit gate completed with 170/170 passing tests; lint, TypeScript, and production build also passed. Three pre-existing full-suite browser failures remain assigned to later milestone phases and do not exercise Phase 15 identity requirements.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verification
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 10 seconds for task sampling
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-02

---

## Validation Audit Trail

| Audit Date | Requirements | Gaps | Resolved | Escalated | Result |
|------------|--------------|------|----------|-----------|--------|
| 2026-08-02 | IDEN-01–IDEN-04 | 0 | 0 | 0 | Nyquist-compliant; all requirement behaviors have automated coverage. |
