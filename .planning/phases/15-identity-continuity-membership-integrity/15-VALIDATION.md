---
phase: 15
slug: identity-continuity-membership-integrity
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 15-01-01 | 01 | 0 | IDEN-01 | T-15-01 | Persisted anonymous material is strictly validated and corrupt data fails closed. | unit | `pnpm exec vitest run tests/unit/user-profile.test.ts` | ✅ extend | ⬜ pending |
| 15-01-02 | 01 | 1 | IDEN-01, IDEN-02 | T-15-02 | Reload restores one signer and rotation requires explicit confirmation. | unit + browser | `pnpm exec vitest run tests/unit/user-profile.test.ts && pnpm exec playwright test tests/e2e/nip07-session-restoration.spec.ts` | ✅ extend | ⬜ pending |
| 15-02-01 | 02 | 1 | IDEN-03 | T-15-03 | Rotation tears down sessions and old room authority before exposing the replacement signer. | unit + browser | `pnpm exec vitest run tests/unit/room-navigation.test.ts tests/unit/user-profile.test.ts && pnpm exec playwright test tests/e2e/stale-local-sessions.spec.ts` | ✅ extend | ⬜ pending |
| 15-02-02 | 02 | 1 | IDEN-04 | T-15-04 | Reconciliation and removal are scoped to `(coordinatorPubkey, roomId)`. | unit | `pnpm exec vitest run tests/unit/room-navigation.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `tests/unit/user-profile.test.ts` with durable anonymous record, corrupt-record recovery, and rotation-order cases.
- [ ] Extend `tests/unit/room-navigation.test.ts` with signer/pubkey mismatch, exhaustive alias purge, and same-room-id/different-coordinator cases.
- [ ] Extend `tests/e2e/nip07-session-restoration.spec.ts` with reload stability, confirmation dismissal, in-flight UI, atomic completion, and fresh-invite-after-rotation proof.

---

## Manual-Only Verifications

All Phase 15 behaviors have automated verification. Final visual review additionally checks the approved `15-UI-SPEC.md` at desktop and narrow viewport widths.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verification
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10 seconds for task sampling
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
