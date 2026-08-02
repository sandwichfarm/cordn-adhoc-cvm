---
phase: 17
slug: full-viewport-startup-motion
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-02
---

# Phase 17 — UI Design Contract

> Visual and interaction contract for full-viewport coordinator startup and recovery. This phase preserves the verified Phase 16 recovery transaction and makes its live state the sole driver of the presentation.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | existing Svelte components and native semantic HTML |
| Icon library | none; existing text/operator glyph treatment |
| Font | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` |

Continue the restrained cypherpunk operator shell: dark, low-contrast surfaces; deliberately sparse bright-green signals; fine grid/ASCII texture; square corners; and no decorative gradients that compete with status text. No shadcn initialization is applicable because the project is Svelte, not React/Next/Vite.

---

## Viewport and Layering Contract

- Enter `startup-mode` while the local coordinator is `starting` or `stopping`, including room recovery, automatic retry, exhausted recovery, and the short handoff while a recovered local room opens.
- In `startup-mode`, the startup stage is the sole application viewport: `position: fixed; inset: 0; width: 100vw; height: 100dvh; overflow: hidden`. It must meet every viewport edge at supported desktop sizes (at minimum 1024×640, 1280×720, and 1440×900), with no room-rail, topbar, chat-column, or background gutter visible at either side.
- The normal workspace chrome is visually absent and non-interactive while this mode is active. Do not leave a blurred, clipped, or partially visible rail/header behind the stage. Keep dialogs opened from startup above the stage and focus-managed as dialogs.
- The ASCII field is an absolute, pointer-inert decorative layer at z-index 0. The readable content and all actions sit above it at z-index 1 in one centered focal column.
- The focal column is `min(512px, calc(100vw - 32px))`; the progress panel is `min(448px, 100%)`. Preserve at least 16px inline clearance. In short viewports, the focal column may scroll internally, but document/body scrolling is forbidden and every visible action must remain inside the stage.
- On completion, remove the startup stage as soon as the coordinator is ready; a visual transition may not defer readiness, status changes, focus restoration, or chat availability.

---

## Motion and Signal-Field Contract

### ASCII field and rings

- Render a deterministic monospace ASCII bed edge-to-edge across the entire startup viewport. It must remain visibly present at all four viewport edges; it is never a centered decorative patch.
- Render exactly one base ASCII bed plus three concentric reveal layers. Every visible ring is a masked copy of ASCII texture using `mask-image` and `-webkit-mask-image` radial-gradient bands. Ring containers have no `border`, `outline`, SVG stroke, or standalone circle fallback.
- Keep a calm, lower-density central focal zone behind the text. Use opacity, the existing dark translucent progress panel, and a subtle backdrop blur for contrast; do not shrink the field away from the content.
- Keep glyphs decorative and `aria-hidden`. The field must not create focus targets, announce state, or receive pointer input.

### State-responsive GSAP behavior

The signal field receives a compact projection of the existing startup truth: `phase`, `percent`, `roomRecovery.state`, `completed`, `total`, and current `roomName`. It does not own, infer, or mutate recovery state.

| Truthful state | Field response | Information rule |
|----------------|----------------|------------------|
| Transport startup (`percent` advances) | GSAP advances the bed/ring phase forward with restrained transform, opacity, rotation, and mask-position changes. Each newer percentage lands at a perceptibly later phase; do not reset the composition for a later step. | The textual label, percentage, and semantic progressbar remain authoritative. |
| Restoring rooms | Advance the same visual phase from `completed / total`; completed count and visible progress never visually move backward. The current-room label remains readable above the field. | Show exact current room and aggregate count from Phase 16. |
| Retrying | Hold completed recovery work, slow the drift, and introduce a brief amber signal modulation (`#e4e78d`) on the progress value only. Do not animate a false completion or surface a terminal-error treatment. | Keep `Trying again…`; no manual retry action appears during automatic retry. |
| Exhausted | Stop forward progression and settle the field into a stable, lower-energy composition. Preserve the existing red destructive affordance only for deleting the failed room; do not turn the whole field into an error alarm. | Show the exact failed-room statement and expose `Retry recovery` plus the existing contextual delete path. |
| Stopping / handoff | Ease current transforms and opacity to a stable resting state; do not add a competing exit flourish. | Preserve current stopping/opening copy and controls. |

- Use component-scoped `gsap.context()` and `gsap.matchMedia()`; kill/revert every timeline on destruction and on every start/stop/retry cycle.
- Animate compositor-friendly transforms, opacity, and CSS custom properties/mask-related properties. Do not make per-frame Svelte state updates, regenerate the ASCII strings, or churn DOM nodes.
- Motion is quiet: slow ambient cycles (roughly 5–15 seconds), phase transitions of 200–400ms with ease-out or sine easing, and no high-frequency pulse, flashing, shake, or sudden full-screen brightness change.

### Reduced motion

- Under `prefers-reduced-motion: reduce`, create no nonessential GSAP timeline. Render the same full-viewport ASCII bed and masked rings as a static composition; a new truthful state may update its stable CSS variables immediately, with no tween.
- The heading, current status, recovery count, progressbar, retry action, and delete action remain visible and semantically identical in reduced motion. Never use field motion as the only indication of progress, retry, exhaustion, readiness, or failure.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Progress-track details and inline label separation |
| sm | 8px | Compact panel and action gaps |
| md | 16px | Focal-column inline clearance and normal control spacing |
| lg | 24px | Progress panel / content-group separation |
| xl | 32px | Desktop stage padding and major content separation |
| 2xl | 48px | Large-screen focal-zone breathing room |
| 3xl | 64px | Maximum desktop visual separation only; never required to reveal status |

Exceptions: the thin progress track and ASCII glyph metrics are decorative measurements; controls retain existing accessible minimum hit-area conventions and are never made smaller to fit the motion composition.

---

## Typography

Use four semantic sizes and exactly two weights for new Phase 17 content. Existing compact shell micro-labels may remain where untouched; the ASCII field's 5–8px glyph metrics are decorative, not UI typography.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label | 12px | 600 | 1.2 |
| Body | 14px | 400 | 1.5 |
| Heading | 28px | 600 | 1.2 |
| Display | 48px | 600 | 1.1 |

Use `font-variant-numeric: tabular-nums` for percentages, steps, and room counts. Current-room names, labels, and diagnostics may wrap within the focal column; do not let a long room name overlap the numeric progress value or force viewport overflow.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#101614` | Full startup surface and primary dark field ground |
| Secondary (30%) | `#080e0a` | Translucent progress panel, contrast mask, and quiet field layers |
| Accent (10%) | `#7cf59d` | Progress-fill end state, active primary retry control, focus ring, and masked ASCII highlights |
| Destructive | `#ffaaa3` | `Delete failed room` treatment and destructive confirmation only |

Secondary status modulation: `#e4e78d` is reserved for the retrying progress value/state indicator; it is not a second CTA color. Accent is reserved for the four elements listed above—never for all controls, all text, or independent ring borders.

---

## Copywriting Contract

Retain Phase 16's verified language; Phase 17 must not replace truthful recovery copy with decorative or technical-error text.

| Element | Copy |
|---------|------|
| Primary CTA | `Retry recovery` (only after recovery is exhausted) |
| Automatic retry status | `Trying again…` |
| Empty state heading | `No rooms to restore` |
| Empty state body | `0 of 0 rooms restored` — startup continues without implying a failed recovery. |
| Error state | `Couldn’t restore # {roomName}. Check your connection, then retry recovery.` |
| Destructive confirmation | `Delete failed room`: retain the existing contextual `Delete #{roomTitle}?` confirmation and `This cannot be undone.` impact statement before removal. |

Never display raw relay URLs, protocol/MLS errors, signer errors, stack traces, or generic `MCP error` text in the startup surface.

---

## UI Considerations

Applicable state considerations resolved: 5 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | Startup stage, status panel, progressbar | ✅ covered | The full-viewport stage renders during startup and recovery while the semantic progressbar and live status present the current Phase 16 truth. |
| error | Exhausted recovery panel and recovery actions | ✅ covered | Exhaustion settles motion, retains the documented error copy, exposes `Retry recovery`, and preserves the contextual delete confirmation. |
| empty | Room-recovery status panel | ✅ covered | Zero recovery targets show the documented `No rooms to restore` heading and `0 of 0 rooms restored` without treating zero as an error. |
| partial | Room-recovery status panel and signal field | ✅ covered | Partially restored queues retain exact completed/total values, keep the current room visible, and advance the signal field from the same monotonic ratio without implying completion. |
| overflow | Startup focal column and progress panel | 🧪 backstop | At supported desktop and short viewport sizes, the stage owns the viewport with no document scroll; any needed scrolling is confined to the focal column and actions stay reachable. |
| long-text | Current-room label, live status, diagnostics, buttons | ✅ covered | Long room names and recovery text wrap within the focal column; progress numerals retain their own space and no label creates horizontal viewport overflow. |
| loading | Decorative ASCII field | 🧪 backstop | The full-edge ASCII bed and all three masked reveal layers are present during startup while the field remains pointer-inert and absent from the accessibility tree. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable — no shadcn or third-party registry is used |

---

## Verification Contract

- Playwright verifies the startup stage and ASCII field have a bounding box equal to the desktop viewport at 1024×640, 1280×720, and 1440×900; document dimensions equal the viewport and no normal shell gutter remains visible.
- Playwright verifies each ring layer has a `mask-image`/`-webkit-mask-image` and that no ring element has a visible CSS border or outline. The base bed and three ring layers must contain ASCII texture.
- Playwright verifies a changed progress/recovery state changes the field's exposed presentation state or computed transform/CSS variable while the panel's text, `aria-valuenow`, `aria-valuetext`, and recovery counts stay truthful and visible.
- Playwright verifies retry has no manual retry control until exhaustion; exhaustion shows the existing exact copy and actions; deleting a failed room still opens the contextual confirmation.
- Playwright emulates `prefers-reduced-motion: reduce` and verifies no nonessential field animation is running while the full-stage, live status, and semantic progressbar remain readable.
- Unit coverage proves the startup-progress-to-presentation projection is monotonic for increasing progress/completed rooms and identifies retry/exhausted states without reinterpreting recovery truth.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved by `gsd-ui-checker` on 2026-08-02
