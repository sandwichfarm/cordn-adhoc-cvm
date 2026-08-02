---
phase: 16
slug: resilient-rooms-recovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + Playwright 1.61.0 |
| **Config file** | `playwright.config.ts`; Vitest uses the Vite/Svelte project setup |
| **Quick run command** | `pnpm exec vitest run tests/unit/room-navigation.test.ts tests/unit/room-session-concurrency.test.ts tests/unit/state-machine.test.ts` |
| **Full suite command** | `pnpm test && pnpm test:e2e` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused Vitest file(s) and matching Playwright grep for the behavior changed.
- **After every plan wave:** Run `pnpm lint && pnpm exec tsc --noEmit && pnpm test`.
- **Before `$gsd-verify-work`:** Run `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check`.
- **Max feedback latency:** 180 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | ROOM-01, ROOM-02 | T-16-01 | Composite room target remains immutable through confirmation and mutation | unit + e2e | `pnpm exec vitest run tests/unit/room-navigation.test.ts && pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "sidebar room actions|same-id sidebar removal"` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | ROOM-03 | T-16-02 | Unread state is isolated by exact coordinator and room identity | unit + e2e | `pnpm exec vitest run tests/unit/room-session-concurrency.test.ts tests/unit/room-navigation.test.ts` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 1 | BOOT-01, BOOT-02, BOOT-03 | T-16-03 | Only the active recovery generation may publish state or attach sessions | unit + e2e | `pnpm exec vitest run tests/unit/room-session-concurrency.test.ts tests/unit/state-machine.test.ts && pnpm exec playwright test tests/e2e/phase-one.spec.ts --grep "hosted-room recovery progress|does not render disconnected local chat during recovery"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `tests/unit/room-navigation.test.ts` with validated read-state, last-open composite identity, and exact sidebar-target removal tests.
- [ ] Extend `tests/unit/room-session-concurrency.test.ts` with receive classification and injected recovery retry/cancellation tests.
- [ ] Extend `tests/unit/state-machine.test.ts` for recovery progress and terminal transitions, or extract and test a small pure recovery reducer.
- [ ] Extend `tests/e2e/phase-one.spec.ts` with sidebar contextual action/focus, unread lifecycle, recovery progress/retry, and no-disconnected-local-chat assertions.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Keyboard focus restoration and hover/focus affordances are covered in Playwright rather than manual-only checks.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
