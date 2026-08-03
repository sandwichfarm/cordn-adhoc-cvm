# Phase 17 — UI Review

**Audited:** 2026-08-03  
**Baseline:** approved `17-UI-SPEC.md` design contract  
**Screenshots:** captured at desktop (1440×900), tablet (768×1024), and mobile (375×812) in `.planning/ui-reviews/17-20260803-021101/`. The direct CLI captures show the idle shell, not a synthetic recovery fixture; startup-state visual evidence was therefore supplied by the focused Playwright scenarios below.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Startup/retry/exhaustion and empty-state copy matches the contract and avoids raw operational errors. |
| 2. Visuals | 3/4 | Pane-scoped field, exactly three true masked ASCII rings, and shell preservation are proven; extra decorative gradients diverge from the deliberately no-gradient visual direction. |
| 3. Color | 2/4 | Required ground/panel/accent/destructive colors are present, but the accent is also used for the kicker and decorative grid, outside its four declared uses. |
| 4. Typography | 2/4 | The new startup UI uses ad-hoc rem/clamp sizes and 650/700 weights instead of the specified four pixel sizes and two weights. |
| 5. Spacing | 2/4 | Correct 16px pane clearance is present, but new startup gaps and padding use several non-4px values. |
| 6. Experience Design | 4/4 | Startup/retry/exhaustion/reduced-motion/handoff flows, semantic progress, actions, and shell controls are all exercised successfully. |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **WARNING — Normalize the startup typography tokens** — the central status and controls render below the specified 12px/14px semantic sizes, weakening readability during recovery — replace the new `.startup-*` type sizes with the contract's 12px label, 14px body, 28px heading, and 48px display roles, using only 400 and 600 weights.
2. **WARNING — Put startup spacing back on the 4px scale** — panel/action rhythm uses 8.8px, 11.2px, 20px, and 22.4px values, so recovery content will not align predictably with the declared system — change these to 8/12/16/24/32px equivalents.
3. **WARNING — Restrict accent and remove competing decoration** — the bright green is spent on a kicker and grid while the stage also adds radial/grid gradients — reserve `#7cf59d` for the progress end state, retry CTA/focus ring, and masked highlights; use secondary tones for the kicker/grid or remove the latter.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS — specific contract evidence:** `HostWorkspace.svelte:1523-1528,1553-1559,1566-1579` renders `No rooms to restore`, `Trying again…`, the exact exhausted-room guidance, `Retry recovery`, and `Delete failed room`. `workspace-lifecycle.spec.ts:582-609` proves retry is absent during automatic retry, exhaustion exposes the exact copy, and recovery can proceed.
- **PASS — safe operational language:** the same browser scenario rejects protocol, signer, relay URL, and generic error leakage (`workspace-lifecycle.spec.ts:595-597`).

### Pillar 2: Visuals (3/4)

- **PASS — specific structural evidence:** `StartupSignalField.svelte:166-170,175-185` supplies one pointer-inert ASCII bed plus exactly three texture-bearing masked layers. `workspace-lifecycle.spec.ts:2003-2071` passed, checking masks, no border/outline/SVG-circle substitute, active normal motion, and usable header/rail controls.
- **PASS — pane containment:** `.startup-stage` is absolute/inset-zero and its readable column/panel match the required `min(512px, calc(100% - 32px))` and `min(448px, 100%)` values (`HostWorkspace.svelte:1965-1971`). The focused test passed at the contract's desktop bounds and asserts the field reaches the host-pane right edge.
- **WARNING — no-gradient direction violated:** the stage adds a radial background and a grid made from linear gradients (`HostWorkspace.svelte:1965-1966`) despite the design-system instruction to avoid decorative gradients competing with status text. The implementation remains coherent, but it is not a strict contract match.

### Pillar 3: Color (2/4)

- **PASS — core palette evidence:** the stage ground is `#101614`, panel is translucent `rgb(8 14 10 / .82)`, retry amber is restricted to `.startup-progress-value.retrying`, and destructive treatment is `#ffaaa3` (`HostWorkspace.svelte:1965,1971,1978-1982,1989-1991`). The browser test also confirms retry ring textures remain green (`workspace-lifecycle.spec.ts:579-582`).
- **WARNING — accent distribution is too broad:** `#7cf59d` is used by the decorative kicker (`HostWorkspace.svelte:1968`) and stage-grid gradients (`:1966`) in addition to the declared progress/focus/CTA/masked-highlight purposes. This violates the explicit accent reservation and dilutes the progress/action focal signal.

### Pillar 4: Typography (2/4)

- **WARNING — contract token mismatch:** new Phase 17 text renders at `.48rem` (7.68px), `.54rem` (8.64px), `.6rem` (9.6px), `.72rem` (11.52px), and a `clamp(1.8rem, 4vw, 3.4rem)` heading (28.8–54.4px), rather than the specified 12/14/28/48px roles (`HostWorkspace.svelte:1968-1987`).
- **WARNING — weight mismatch:** new field and startup UI uses weights 650 and 700 (`StartupSignalField.svelte:250-258`; `HostWorkspace.svelte:1968,1975-1976,1989`) rather than the contract's two weights, 400 and 600. This makes state labels especially small and dense during recovery.

### Pillar 5: Spacing (2/4)

- **PASS — containment/clearance evidence:** `HostWorkspace.svelte:1967` preserves the specified 32px total inline deduction and constrains overflow to the focal column. The pane-bounds and no-document-overflow browser assertions passed.
- **WARNING — non-scale values:** the new stage uses 22.4px kicker margin, 9.6px heading margin, 20px panel margin, 12.8px/14.4px panel padding, 8.8px footer/action spacing, and 11.2px action padding (`HostWorkspace.svelte:1968-1993`). Those values are not multiples of the required 4px scale.

### Pillar 6: Experience Design (4/4)

- **PASS — truthful state/action coverage:** semantic progress and live status remain independent from decoration (`HostWorkspace.svelte:1535-1565`); retry only appears after exhaustion and delete routes to the contextual confirmation (`:1566-1579`). The focused browser run passed retry/exhaustion, exact-session handoff, and repeated cleanup scenarios.
- **PASS — motion/accessibility parity:** `StartupSignalField.svelte:111-126` creates a static reduced-motion composition without an ambient timeline, while `workspace-lifecycle.spec.ts:2073-2101` passed after confirming unchanged presentation variables/transform plus readable progress, status, and usable shell controls.
- **PASS — terminal settlement:** terminal/resting states destroy the ambient timeline and settle through one-off tweens (`StartupSignalField.svelte:128-151`); the exhaustion test verifies a static field. `projectStartupSignal` is a pure coordinator-state projection (`startup-signal-presentation.ts:16-34`), confirmed by 12 focused unit tests.

---

## Registry Safety

Skipped: `components.json` is absent and the approved UI specification declares no third-party registry blocks.

---

## Files Audited

- `src/components/HostWorkspace.svelte`
- `src/components/StartupSignalField.svelte`
- `src/components/startup-signal-presentation.ts`
- `src/app.css`
- `tests/e2e/workspace-lifecycle.spec.ts`
- `tests/unit/startup-signal-presentation.test.ts`
- `17-UI-SPEC.md`, `17-CONTEXT.md`, `17-01-PLAN.md`, `17-02-PLAN.md`, both summaries, `17-REVIEW.md`, `17-REVIEW-FIX.md`, and `17-VERIFICATION.md`

## Verification Performed

- `pnpm exec vitest run tests/unit/startup-signal-presentation.test.ts` — 12 passed.
- `pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g 'startup (signal follows retry and exhaustion truth|reduced motion stays static and readable|motion cleans up across repeated recovery cycles|handoff keeps actions reachable|uses exactly three masked ASCII reveals|covers every supported content pane)'` — 4 matched scenarios passed; the current test titles matching this expression exercised retry/exhaustion, handoff, masks, and reduced motion.
- CLI screenshots captured at the three stated viewports. They show the current idle shell; startup-state geometry and interactions are covered by the passing Playwright fixtures rather than an unsupported direct state injection into the running dev server.
