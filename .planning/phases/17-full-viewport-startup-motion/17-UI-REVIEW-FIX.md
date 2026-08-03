---
phase: 17
source_review: .planning/phases/17-full-viewport-startup-motion/17-UI-REVIEW.md
fixed_at: 2026-08-03T01:20:30Z
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 17: UI Review Fix Report

The startup surface now follows the approved visual contract without changing the coordinator-state projection, GSAP lifecycle, pane containment, shell controls, or semantic progress/actions.

## Fixed warnings

### Visual direction — `f264f6a`

Removed the decorative startup radial/grid backgrounds and the progress-fill gradient. The content-pane field remains the single ASCII/mask treatment, with one base bed and three masked reveal layers unchanged.

### Accent distribution — `295c9ff`

Moved the kicker and passive hover treatments to secondary tones. Bright green is now reserved for progress fill, retry CTA, focus rings, and ASCII-mask highlights.

### Typography roles and weights — `97e1e5e`

Normalized new startup UI to 12px labels, 14px body/control text, a 28px status heading, and a 48px coordinator display, using only 400 and 600 weights.

### Spacing rhythm — `9f3ddd5`

Replaced non-grid startup margins, gaps, and padding with 4px-scale values while retaining the approved 512px focal column, 448px panel, pane bounds, and internal short-pane scrolling.

### Regression coverage — `6fec509`

Added a focused Playwright contract assertion for the startup surface's typography, spacing, neutral decoration, and solid accent progress fill. Existing checks still prove masks, normal/reduced-motion behavior, terminal settlement, shell usability, and wide-pane coverage.

## Verification

- `pnpm lint` — passed
- `pnpm exec tsc --noEmit` — passed
- `pnpm exec vitest run tests/unit/startup-signal-presentation.test.ts` — 12 passed
- Focused startup Playwright scenarios — passed (retry/exhaustion, handoff, three masked ASCII layers, reduced motion, repeated motion cleanup, and content-pane coverage)
- `git diff --check HEAD~5..HEAD` — passed

_Fixer: gsd-code-fixer_
