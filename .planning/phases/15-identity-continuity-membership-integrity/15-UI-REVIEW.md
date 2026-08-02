---
phase: 15
slug: identity-continuity-membership-integrity
status: complete
audited: 2026-08-02
baseline: 15-UI-SPEC.md
screenshots: captured
overall_score: 24/24
re_audit_commit: 2f70709
---

# Phase 15 — UI Review

**Audited:** 2026-08-02
**Baseline:** approved `15-UI-SPEC.md` design contract
**Re-audit:** source commit `2f70709`
**Screenshots:** captured at desktop and 375×812 mobile shell; the updated confirm/recovery states are additionally verified by focused Playwright checks.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Approved copy is exact for normal/retryable failures, while post-boundary recovery deliberately avoids the false unchanged-state claim. |
| 2. Visuals | 4/4 | Dialog hierarchy, terminal surface, 44px labelled close affordance, and CAHMLS shell lockup meet the contract. |
| 3. Color | 4/4 | Open trigger uses the reserved accent, busy status is secondary, and destructive fill remains confined to final actions. |
| 4. Typography | 4/4 | Affected identity menu and dialog now use only the locked 10/12/14/18px hierarchy and weights. |
| 5. Spacing | 4/4 | Updated controls and dialog layout use the 4px spacing scale and specified responsive bounds. |
| 6. Experience Design | 4/4 | Initialization gating, focus/dismissal behavior, busy/recovery states, and anonymous-only method isolation are proven. |

**Overall: 24/24**

---

## Top 3 Priority Fixes

None. The prior warnings are resolved by `2f70709`; no actionable Phase 15 UI fix remains.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS — Recoverable failure uses the exact canonical error.** `IdentityRotationDialog` owns the approved string and displays it with `role="alert"` after a retryable failure (`src/components/IdentityRotationDialog.svelte:16, 41-49, 86`). The focused browser test verifies the exact text and retry-enabled recovery CTA (`tests/e2e/identity-ui-review.spec.ts:144-165`).
- **PASS — Post-boundary distinction is safe.** If confirmation becomes recovery after crossing the durable boundary, the dialog suppresses the unchanged-state claim (`src/components/IdentityRotationDialog.svelte:45-49`); browser coverage confirms recovery has no alert or dismiss action (`tests/e2e/identity-ui-review.spec.ts:122-142`). Primary CTA, empty state, impact wording, recovery copy, busy labels, and completion announcement remain contract-exact (`src/components/IdentityRotationDialog.svelte:20-22, 68, 76, 80-92`; `src/components/UserProfile.svelte:124-128, 201-203`).

### Pillar 2: Visuals (4/4)

- **PASS — Established dialog structure is restored.** The native modal has header/body/footer structure and a labelled 44px close affordance only in the dismissable confirm variant (`src/components/IdentityRotationDialog.svelte:54-95, 101-116`). Focused browser coverage measures the control at ≥44px and verifies focus returns to the trigger (`tests/e2e/identity-ui-review.spec.ts:58-82`).
- **PASS — Responsive shell evidence.** Desktop and 375px captures show no CAHMLS camel/wordmark clipping. The dialog constrains its width/height, keeps header content shrinkable, and wraps body content (`src/components/IdentityRotationDialog.svelte:98-108`); menu summary fields retain ellipsis behavior (`src/components/UserProfile.svelte:323-328`).

### Pillar 3: Color (4/4)

- **PASS — Accent map now follows the contract.** The selected trigger has `#87ff9f` border (`src/components/UserProfile.svelte:313-315`), visible focus remains 2px accent (`src/components/IdentityRotationDialog.svelte:121`), and the non-destructive action is the allowed accent-hover surface (`src/components/IdentityRotationDialog.svelte:117-120`).
- **PASS — Busy state is secondary, destructive state is explicit.** Live status uses muted secondary `#91a59a`, while the destructive confirmation uses `#dc6f66`/`#ffaaa3` (`src/components/IdentityRotationDialog.svelte:112-120`). Browser coverage confirms the live computed color and disabled close state while rotating (`tests/e2e/identity-ui-review.spec.ts:84-120`).

### Pillar 4: Typography (4/4)

- **PASS — Locked scale is applied.** The dialog uses 10px utility, 12px body/button, 14px impact, and 18px heading styles (`src/components/IdentityRotationDialog.svelte:103-116`). The affected profile menu has been normalized to the same sizes and declared weights/line-heights (`src/components/UserProfile.svelte:318-336`); Playwright verifies representative rendered sizes (`tests/e2e/identity-ui-review.spec.ts:62-67`).

### Pillar 5: Spacing (4/4)

- **PASS — New spacing is on the declared grid.** Header/body use 16px, footer gap 8px/padding 12px, buttons meet the 44px minimum with 12px/16px padding, and error padding is 12px (`src/components/IdentityRotationDialog.svelte:101-116`). Affected menu spacing is normalized to 4/8/12/16px values (`src/components/UserProfile.svelte:313-336`).
- **PASS — Narrow-height/width protection is present.** The dialog retains `width: min(29rem, calc(100vw - 1rem))`, `max-height: calc(100dvh - 1rem)`, and body-only scrolling (`src/components/IdentityRotationDialog.svelte:98-108`).

### Pillar 6: Experience Design (4/4)

- **PASS — Initialization and method isolation are correct.** The profile trigger is withheld until the identity is initialized and remains absent in recovery (`src/components/UserProfile.svelte:159-176`); malformed-identity browser coverage proves it never flashes (`tests/e2e/identity-ui-review.spec.ts:25-56`). Rotation remains only within the anonymous branch (`src/components/UserProfile.svelte:190-203, 236-245`).
- **PASS — Dialog behavior meets all state requirements.** Confirm default focus is `Keep current identity`; all controls disable during busy work; Escape/backdrop dismissal is rejected while busy or recovering; recovery has only `Create new identity` (`src/components/IdentityRotationDialog.svelte:24-30, 60-62, 70-72, 85-92`). The test suite covers focus return, busy lock, non-dismissable post-boundary recovery, and retryable recovery (`tests/e2e/identity-ui-review.spec.ts:58-165`).

---

## Registry Safety

Registry audit: skipped — `components.json` is absent and `15-UI-SPEC.md` declares no third-party registry.

---

## Files Audited

- `15-UI-SPEC.md`, prior `15-UI-REVIEW.md`
- `src/components/IdentityRotationDialog.svelte`
- `src/components/UserProfile.svelte`
- `src/components/RoomRemovalDialog.svelte`, `src/components/WorkspaceNav.svelte`
- `tests/e2e/identity-ui-review.spec.ts`, `tests/e2e/nip07-session-restoration.spec.ts`, `tests/e2e/stale-local-sessions.spec.ts`, `tests/unit/user-profile.test.ts`
