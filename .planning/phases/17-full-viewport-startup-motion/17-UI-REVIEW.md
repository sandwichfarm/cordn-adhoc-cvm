# Phase 17 — UI Review

**Audited:** 2026-08-03 (final re-audit after `78634c2`)
**Baseline:** approved `17-UI-SPEC.md` design contract
**Screenshots:** captured at 1440×900, 768×1024, and 375×812 in `.planning/ui-reviews/17-reaudit-20260803-022158/`, with a final desktop/mobile capture in `.planning/ui-reviews/17-final-reaudit-20260803-022815/`. The running server was idle during direct capture; startup-state rendering was independently exercised through Playwright fixtures.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Exact empty/retry/exhaustion language and safe error suppression are retained. |
| 2. Visuals | 4/4 | Pane-scoped bed, three true texture masks, clear focal column, and shell usability all pass browser checks. |
| 3. Color | 4/4 | The stage is flat dominant ground; accent is reserved for the stated action/progress/focus/field roles. |
| 4. Typography | 4/4 | All startup breakpoints now use approved semantic roles and the two declared weights. |
| 5. Spacing | 4/4 | Standard, compact, and short-pane startup spacing all use the declared 4px scale. |
| 6. Experience Design | 4/4 | Truthful recovery, terminal settlement, reduced-motion parity, handoff, and shell interaction remain verified. |

**Overall: 24/24**

---

## Top Priority Fixes

No priority fixes remain. The prior gradient, accent, typography, and spacing findings are resolved at desktop and compact breakpoints.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS:** `HostWorkspace.svelte:1523-1528,1553-1579` retains `No rooms to restore`, `0 of 0 rooms restored`, `Trying again…`, exact exhausted-room guidance, `Retry recovery`, and `Delete failed room`.
- **PASS:** the startup browser scenarios reject raw relay, signer, protocol, and `MCP error` content (`workspace-lifecycle.spec.ts:520-523,630-640`).

### Pillar 2: Visuals (4/4)

- **PASS:** `.startup-stage` remains an absolute, inset-zero child of the positioned content pane; focal/panel widths are exactly `min(512px, calc(100% - 32px))` and `min(448px, 100%)` (`HostWorkspace.svelte:1965-1970`).
- **PASS:** one bed and exactly three pointer-inert, ASCII-bearing mask layers are rendered without border/outline/SVG-circle substitutes (`StartupSignalField.svelte:195-214,217-272`). The `startup` Playwright suite passed its pane/right-edge, mask, and shell-control checks.
- **PASS:** competing stage radial/grid decoration is removed: stage background computes to a flat color and `::before` has no content. The new visual-contract assertion checks both (`workspace-lifecycle.spec.ts:202-242`).

### Pillar 3: Color (4/4)

- **PASS:** the stage ground is `#101614`, panel is the specified dark translucent secondary surface, progress fill is solid `#7cf59d`, retry uses amber only on the progress value, and delete remains `#ffaaa3` (`HostWorkspace.svelte:1965,1970,1977-1980,1988-1990`).
- **PASS:** the kicker moved from accent to secondary `#66786d`; focus rings and the active retry control are the only startup UI uses of `#7cf59d`, while field highlights remain decorative (`HostWorkspace.svelte:1967,1987-1988,1994,1998`; `StartupSignalField.svelte:281-294`). Browser coverage confirms retry ring texture colors remain green.

### Pillar 4: Typography (4/4)

- **PASS:** at standard dimensions, the computed-contract assertion verifies 12px/600 label, 14px/400 body and progress value, 28px/600 current-status heading, 48px/600 display, and 14px/600 controls (`HostWorkspace.svelte:1967-1976,1985,1992`; `workspace-lifecycle.spec.ts:217-242`).
- **PASS:** compact startup now uses the approved 28px heading with a 4px top separation (`HostWorkspace.svelte:2074-2080`). `expectStartupCompactVisualContract` verifies the computed 28px value at the compact breakpoint (`workspace-lifecycle.spec.ts:245-271`), and the short-mobile startup flow passed.

### Pillar 5: Spacing (4/4)

- **PASS:** standard startup spacing is tokenized on the 4px scale: 16px stage/panel clearance, 24px group separation, 12px track/action separation, 8px compact gaps, and 4px detail separation (`HostWorkspace.svelte:1965-2004`). The browser contract check proves 24px panel margin, 16px panel padding, and 4px track height/12px margin.
- **PASS:** compact and short-pane overrides are now 4px-scale values only: 8px stage/panel clearance and gaps, 12px inline panel padding, 16px fact separation, and 4px short-pane footer separation (`HostWorkspace.svelte:2074-2089`). The compact visual-contract assertion verifies these computed values (`workspace-lifecycle.spec.ts:245-271`).

### Pillar 6: Experience Design (4/4)

- **PASS:** semantic progress, live status, retry gating, exhausted-room delete path, and immediate handoff remain coordinator-bound (`HostWorkspace.svelte:1535-1579`; `startup-signal-presentation.ts:16-34`). All 12 projection unit tests passed.
- **PASS:** terminal states kill the ambient timeline and settle using one-off GSAP transitions; reduced motion destroys ambient work and applies a static composition (`StartupSignalField.svelte:107-160`). The Playwright `startup` run passed all nine matching tests, including reduced motion, retry/exhaustion, delete confirmation, handoff, repeated cleanup, and shell usability.

---

## Registry Safety

Skipped: no `components.json` exists and the approved UI specification declares no third-party registry blocks.

---

## Files Audited

- `src/components/HostWorkspace.svelte`
- `src/components/StartupSignalField.svelte`
- `src/components/startup-signal-presentation.ts`
- `tests/e2e/workspace-lifecycle.spec.ts`
- `tests/unit/startup-signal-presentation.test.ts`
- `17-UI-SPEC.md`, prior `17-UI-REVIEW.md`, and `17-REVIEW-FIX.md`

## Verification Performed

- `pnpm exec vitest run tests/unit/startup-signal-presentation.test.ts` — 12 passed.
- `pnpm exec playwright test tests/e2e/workspace-lifecycle.spec.ts -g 'startup'` — 9 passed, including the short mobile viewport and compact computed-style assertions.
- Safe CLI screenshots captured at desktop, tablet, and mobile viewports; startup state was verified by the test fixtures because the existing dev server was idle.
