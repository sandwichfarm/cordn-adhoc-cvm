---
phase: 17
slug: content-pane-startup-motion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + Playwright 1.61.0 |
| **Config file** | `vite.config.ts`; `playwright.config.ts` |
| **Quick run command** | `pnpm test -- tests/unit/startup-signal-presentation.test.ts` |
| **Full suite command** | `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused unit or Playwright command named by that task.
- **After every plan wave:** Run `pnpm lint && pnpm exec tsc --noEmit && pnpm test`.
- **Before `$gsd-verify-work`:** The full suite must be green.
- **Max feedback latency:** 180 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 0 | MOTION-03 | T-17-01 | Presentation state is a read-only projection of coordinator recovery truth. | unit | `pnpm test -- tests/unit/startup-signal-presentation.test.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | MOTION-01 | — | Startup fills the workspace content pane through its exact right edge while the global header and room sidebar remain visible and usable. | integration | `pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` | ✅ extend | ⬜ pending |
| 17-01-03 | 01 | 1 | MOTION-02 | T-17-02 | Three pointer-inert mask layers reveal ASCII without border substitutes. | integration | `pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` | ✅ extend | ⬜ pending |
| 17-01-04 | 01 | 1 | MOTION-03 | T-17-03 | Progress advances monotonically, retry retains completed work, and exhausted state settles. | unit + integration | `pnpm test -- tests/unit/startup-signal-presentation.test.ts && pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` | ❌ W0 + ✅ extend | ⬜ pending |
| 17-01-05 | 01 | 1 | MOTION-03 | T-17-04 | Reduced motion preserves readable status and suppresses nonessential timelines. | integration | `pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/startup-signal-presentation.ts` — browser-independent startup presentation projection for MOTION-03.
- [ ] `tests/unit/startup-signal-presentation.test.ts` — forward-only progress, retry, exhaustion, and reduced-motion projection coverage for MOTION-03.
- [ ] Extend `tests/e2e/workspace-lifecycle.spec.ts` — content-pane edge equality at supported desktop sizes, visible and usable shell controls, true masks, recovery truth, and reduced-motion coverage for MOTION-01 through MOTION-03.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Feedback latency < 180 seconds.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
