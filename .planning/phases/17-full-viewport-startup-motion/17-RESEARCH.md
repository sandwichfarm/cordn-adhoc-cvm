# Phase 17: Content-Pane Startup Motion - Research

**Researched:** 2026-08-02
**Domain:** Svelte 5 browser UI, GSAP animation lifecycle, CSS masking, and Playwright verification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Content-pane ownership
- While the local coordinator is starting or stopping, the startup experience owns the entire workspace content pane, not the entire browser viewport.
- The global header and room rail remain visible and usable. The startup stage replaces only the content pane and must fill that pane from its left edge to its right edge without the previously uncovered right portion.
- Status, recovery progress, settings review, retry, and exhausted-room removal remain reachable inside the startup surface.
- The stage sizes itself from the content container (`inset: 0; width: 100%; height: 100%` inside that positioned pane), not from `100vw`, `100dvh`, or a fixed viewport overlay. It must not introduce document-level scrolling or clipped actions.

#### ASCII field and masked rings
- A deterministic ASCII texture covers the full content pane edge to edge; it is not a centered decorative patch and may not stop around two-thirds of the pane width.
- Rings are true masks through which the ASCII field is revealed, with no independent border-circle substitute.
- Use GSAP for the living motion: layered drift, scale, rotation, opacity, and phase transitions should feel fluid and restrained rather than like a static pulse.
- The ring field should remain visually legible behind content through contrast masks and a calm focal zone, not by shrinking the animation away from the content.

#### Progress-responsive motion
- Feed the rendered startup phase, percentage, and recovery state into the signal field instead of running an unrelated infinite animation.
- Progress changes should move the field forward perceptibly and monotonically while retry and exhaustion have distinct, truthful visual states.
- The progress panel remains the authoritative textual state; animation may reinforce it but never replace or contradict it.
- Transitions between transport startup, room restoration, retry, exhaustion, and completion should be smooth without delaying coordinator readiness.

#### Accessibility and performance
- `prefers-reduced-motion: reduce` suppresses nonessential GSAP timelines and presents a stable content-pane-filling ASCII composition.
- Status and progress retain semantic progressbar/live-region behavior independent of the decorative field.
- Animation cleanup must be component-scoped and leak-free across repeated start/stop/retry cycles.
- Avoid per-frame Svelte state writes and excessive DOM churn; animate transforms, opacity, and mask-related CSS variables through GSAP.

### the agent's Discretion
- Exact glyph palette, number of masked layers, easing curves, and phase color modulation may be tuned to the existing restrained cypherpunk visual system.
- Compact/mobile behavior may simplify density while preserving readable progress; the milestone remains desktop-first.

### Deferred Ideas (OUT OF SCOPE)
- Presence, notifications, invitations, and shell-control consolidation remain Phase 18.
- Grouped chat messages and streamlined reactions remain Phase 19.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOTION-01 | The startup ASCII field fills the workspace content container edge to edge at every supported desktop size without leaving the right portion uncovered. | Keep startup ownership in the positioned content pane; render the stage and its base bed with `position: absolute; inset: 0; width: 100%; height: 100%`, and assert equality with the content-pane bounds (including the right edge) at 1024×640, 1280×720, and 1440×900. [VERIFIED: REQUIREMENTS.md + UI-SPEC.md] |
| MOTION-02 | Startup rings are true masks/reveals of the ASCII field and are animated with GSAP rather than independent static border circles. | Preserve the existing ASCII copies, apply radial-gradient `mask-image` and `-webkit-mask-image` to exactly three ring containers, and scope GSAP transforms/CSS-variable tweens to the field. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image] [CITED: https://gsap.com/docs/v3/GSAP/gsap.context%28%29/] |
| MOTION-03 | Startup motion remains smooth, responds to progress state, and honors `prefers-reduced-motion` without hiding status or progress information. | Derive presentation-only state from `CoordinatorStartupProgress`; use GSAP media-aware lifecycle cleanup, preserve the existing `progressbar` and live status, and test reduced-motion emulation. [VERIFIED: codebase graph + source] [CITED: https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/] [CITED: https://playwright.dev/docs/api/class-page] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Prefer the codebase-memory graph for code discovery; use `rg` only for literal/config gaps. [VERIFIED: AGENTS.md]
- Preserve unrelated working-tree changes; do not revert other agents' work. [VERIFIED: AGENTS.md]
- Use Svelte 5 runes, strict TypeScript, browser-safe APIs, and established component/state patterns; do not introduce Node-only runtime dependencies. [VERIFIED: AGENTS.md]
- Do not expose private keys, invite secrets, or decrypted message material in logs, errors, snapshots, fixtures, or commits. [VERIFIED: AGENTS.md]
- Use `apply_patch` for intentional edits and run the relevant lint, type-check, test, browser, build, and diff checks before shipping. [VERIFIED: AGENTS.md]

## Summary

Phase 17 is a presentation integration, not a recovery rewrite. `CoordinatorStore.startupProgress` already supplies a typed phase, percent, and hosted-room recovery record; `HostWorkspace` already renders the authoritative progressbar/live status and the exhausted recovery actions. The plan should retain this transaction verbatim and pass a compact, derived presentation object to `StartupSignalField`. [VERIFIED: codebase graph + source]

The existing field already has one base ASCII bed, three ASCII ring copies, radial-gradient masks, GSAP, `aria-hidden`, and reduced-motion gating. The required change is to keep the stage inside the positioned workspace content pane, fill that pane completely (including its right edge), retain the usable global header and room rail, and replace the unrelated ambient-only behavior with state-driven GSAP target updates. CSS gradients are valid mask images, and GSAP contexts provide scoped revert cleanup. [VERIFIED: codebase graph + source] [VERIFIED: CONTEXT.md + UI-SPEC.md] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image] [CITED: https://gsap.com/docs/v3/GSAP/gsap.context%28%29/]

**Primary recommendation:** Keep the current `CoordinatorStartupProgress` as the single source of truth; add a pure projection helper plus a field-local GSAP controller, and make `HostWorkspace` mount one pane-scoped startup stage inside the positioned content container only while the startup surface is needed. Keep global header and room-rail interaction available. [VERIFIED: codebase graph + source] [VERIFIED: CONTEXT.md + UI-SPEC.md]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Recovery truth, retry, exhaustion, and completion | API / Backend | Browser / Client | `CoordinatorStore` owns the startup transaction and exact room-recovery state; the UI must consume it without mutation. [VERIFIED: codebase graph + source] |
| Visual-progress projection | Browser / Client | — | A pure mapping of typed coordinator progress to visual targets belongs at the presentation boundary and must not alter recovery behavior. [VERIFIED: codebase graph + source] |
| Content-pane startup composition and interaction preservation | Browser / Client | — | The positioned content pane owns the absolute stage and its internal focal-column scrolling; the surrounding header and room rail remain visible, usable, and outside the stage. [VERIFIED: UI-SPEC.md] |
| ASCII masking and motion | Browser / Client | — | CSS masking and GSAP transforms operate entirely on decorative, pointer-inert DOM layers. [VERIFIED: codebase graph + source] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image] |
| Regression proof | Browser / Client | — | Vitest can prove pure projection behavior and Playwright can inspect rendered bounds, semantics, media emulation, and computed mask styles. [VERIFIED: codebase graph + source] [CITED: https://playwright.dev/docs/api/class-page] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `svelte` | 5.56.3 installed | Component composition, runes, DOM lifecycle | The repository is a Svelte 5 app and its existing startup components use runes and `onMount`; do not add a second UI framework. [VERIFIED: package.json + codebase source] [CITED: https://svelte.dev/docs/svelte/lifecycle-hooks] |
| `gsap` | 3.15.0 installed | Scoped, compositor-friendly field motion and reduced-motion-aware setup | Existing `StartupSignalField` imports it; `gsap.context()` can scope and revert created animations, and `gsap.matchMedia()` supports media-query setup and revert. [VERIFIED: package.json + codebase source] [CITED: https://gsap.com/docs/v3/GSAP/gsap.context%28%29/] [CITED: https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/] |
| Native CSS masking | browser platform | Reveal ASCII copies through three radial-gradient ring masks | `mask-image` accepts CSS gradients and determines visible areas from mask opacity; use both standard and WebKit-prefixed declarations required by the UI contract. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.9 installed | Pure projection regression tests | Test monotonic mapping and retry/exhausted identity without mounting or timing animation. [VERIFIED: package.json + vite.config.ts] |
| `@playwright/test` | 1.61.0 installed | Desktop layout, computed-style, action, and reduced-motion verification | Emulate `reducedMotion`, set the three required desktop viewports, compare stage/field bounds to the content-pane rectangle, and inspect masks, shell usability, and semantic state. [VERIFIED: package.json + playwright.config.ts + UI-SPEC.md] [CITED: https://playwright.dev/docs/api/class-page] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing GSAP | CSS keyframes alone | CSS keyframes suit static ambient effects, but cannot cleanly coordinate phase/retry/exhaustion target updates and component-scoped cleanup required by the approved contract. [VERIFIED: UI-SPEC.md] |
| CSS radial-gradient masks | SVG strokes or border circles | SVG/borders would violate the locked requirement that each visible ring is a masked ASCII reveal, not an independent circle. [VERIFIED: UI-SPEC.md] |
| Pure local projection | Adding state to `CoordinatorStore` | Store changes would unnecessarily risk the verified Phase 16 startup transaction; visual state is derived-only. [VERIFIED: codebase graph + source] |

**Installation:** None. This phase uses installed dependencies only; do not change `package.json` or the lockfile. [VERIFIED: package.json + UI-SPEC.md]

**Version verification:** Registry checks returned GSAP 3.15.0, Svelte 5.56.8, and Playwright 1.62.1 as current, while the project intentionally pins 3.15.0, 5.56.3, and 1.61.0 respectively. No upgrade is in scope. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
CoordinatorStore.startupProgress (truth)
              |
              v
HostWorkspace -------------------------> existing semantic panel
  |                                         |- live status
  | compact immutable projection             |- progressbar + aria values
  v                                         |- retry/delete only when exhausted
StartupSignalField
  |- base deterministic ASCII bed
  |- 3 masked ASCII ring copies
  |- GSAP context/media lifecycle
  |           |
  |           +--> regular motion: transform/opacity/CSS custom-property targets
  |           +--> reduced motion: static CSS variables, no nonessential timeline
  v
positioned workspace content pane
  |- pane-scoped startup stage (`position: absolute; inset: 0`)
  |     |- pointer-inert ASCII bed reaches all pane edges
  |     |- focal column may scroll internally on short panes
  |     +--> dialogs opened from the stage remain above it
  |
  +--> global header and room rail stay visible, enabled, and usable
```

### Recommended Project Structure

```text
src/
├── components/
│   ├── HostWorkspace.svelte                 # position content pane and mount pane-scoped stage
│   ├── StartupSignalField.svelte             # own decorative DOM, CSS masks, GSAP lifecycle
│   └── startup-signal-presentation.ts        # pure progress-to-visual projection
tests/
├── unit/startup-signal-presentation.test.ts  # monotonic/retry/exhausted projection cases
└── e2e/workspace-lifecycle.spec.ts           # rendered stage, masks, recovery, reduced-motion checks
```

### Pattern 1: Presentation Projection Is Pure and Monotonic

**What:** Export a small typed function that accepts only `CoordinatorStartupProgress` and returns visual inputs such as `progress`, `state`, `phase`, `roomName`, and stable CSS-variable values. It must have no timers, DOM access, GSAP access, store mutation, or error interpretation. [VERIFIED: codebase graph + source]

**When to use:** Call it in `HostWorkspace` with `coordinator.startupProgress`, then pass the result to `StartupSignalField`. Unit-test it directly. [VERIFIED: codebase graph + source]

**Required mapping:** Use the coordinator percent for transport stages. For `restoring-rooms`, derive the visual forward position from the room ratio in the remaining startup interval (for example `85 + ratio * 15`); use `1` when `total === 0`. Preserve completed work during `retrying`, and freeze the target during `exhausted`. This keeps a single startup pass forward without changing the panel's existing room-count `aria` values. [VERIFIED: codebase source] [VERIFIED: UI-SPEC.md]

```typescript
// Source: project CoordinatorStartupProgress contract and approved UI-SPEC
export function projectStartupSignal(progress: CoordinatorStartupProgress) {
  const recovery = progress.roomRecovery;
  const roomRatio = recovery.total === 0 ? 1 : recovery.completed / recovery.total;
  const forwardPercent = progress.phase === "restoring-rooms"
    ? 85 + roomRatio * 15
    : progress.percent;

  return {
    phase: progress.phase,
    recoveryState: recovery.state,
    roomName: recovery.roomName,
    forwardPercent,
    completed: recovery.completed,
    total: recovery.total,
  };
}
```

### Pattern 2: Field-Local Lifecycle, Not Per-Frame Svelte State

**What:** Bind a field root, create all selector-based GSAP work within the component scope, and explicitly revert the lifecycle owner at destruction and before replacing it for a new start/stop/retry configuration. Use the projection only to issue target updates; animate transform, opacity, and CSS custom properties rather than writing Svelte state from GSAP callbacks. [CITED: https://gsap.com/docs/v3/GSAP/gsap.context%28%29/] [CITED: https://svelte.dev/docs/svelte/lifecycle-hooks] [VERIFIED: UI-SPEC.md]

**When to use:** Every startup field mount and every projection lifecycle transition. The existing component already scopes animation to its bound root and returns cleanup from `onMount`; preserve that ownership boundary. [VERIFIED: codebase source]

```typescript
// Source: GSAP context + matchMedia documentation
const context = gsap.context(() => {
  const media = gsap.matchMedia();
  media.add({ reduce: "(prefers-reduced-motion: reduce)" }, ({ conditions }) => {
    if (conditions.reduce) {
      gsap.set(root, staticSignalVariables(signal));
      return;
    }
    timeline = gsap.timeline().to(rings, animatedSignalTargets(signal));
  });
  return () => media.revert();
}, root);

onDestroy(() => context.revert());
```

### Pattern 3: Pane-Scoped Stage With Internal Overflow Ownership

**What:** Make the normal workspace content pane the positioned containing block, then render the startup stage inside it with `position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden`. Give only the focal content column `overflow-y: auto` on short panes. Do not use `position: fixed`, `100vw`, `100dvh`, browser-viewport measurements, or document-level interaction isolation. [VERIFIED: CONTEXT.md + UI-SPEC.md]

**When to use:** While coordinator status is `starting` or `stopping`, including recovery retry, exhaustion, and local-room handoff; remove it immediately when the running/attached session condition is met. The header and room rail remain available throughout. [VERIFIED: CONTEXT.md + UI-SPEC.md] [VERIFIED: codebase source]

### Anti-Patterns to Avoid

- **Animating recovery truth:** Do not add animation state to `CoordinatorStore`, synthesize status copy, or update progress from GSAP callbacks. The store's phase/recovery object remains authoritative. [VERIFIED: codebase graph + source]
- **Static/bordered circles:** Do not use borders, outlines, SVG strokes, or standalone circles as ring substitutes. Each ring container must reveal an ASCII copy through both mask declarations. [VERIFIED: UI-SPEC.md]
- **A centered texture plane:** Do not retain a `vmin`-sized field as the only visible texture. The base bed must occupy the entire content-pane stage, including the right edge; rings may remain centered as masked layers. [VERIFIED: CONTEXT.md + UI-SPEC.md]
- **Viewport takeover:** Do not promote the stage to a fixed viewport overlay or hide, blur, cover, inert, or `aria-hide` the global header or room rail. The stage is only a child of the positioned content pane. [VERIFIED: CONTEXT.md + UI-SPEC.md]
- **Per-frame Svelte writes:** Do not drive `$state` from GSAP's ticker or regenerate the ASCII strings on recovery updates. Update DOM transforms/CSS properties only. [VERIFIED: UI-SPEC.md]
- **Delayed readiness:** Do not wait for an exit timeline before the coordinator becomes usable or before focus is restored. [VERIFIED: UI-SPEC.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animation scheduling and teardown | Custom `requestAnimationFrame` loop / manual tween registry | Installed GSAP with scoped context and media handling | GSAP contexts collect created animations for revert cleanup, avoiding repeated-cycle leaks. [CITED: https://gsap.com/docs/v3/GSAP/gsap.context%28%29/] |
| Ring reveal effect | SVG/border circle renderer | CSS `mask-image` plus `-webkit-mask-image` radial-gradient bands applied to ASCII copies | CSS masks can use gradients to reveal/hide element pixels, matching the locked true-reveal requirement. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image] |
| Recovery state machine | New visual retry/timeout state | Existing Phase 16 `CoordinatorStore` state and actions | Existing code already models `restoring`, `retrying`, `exhausted`, `complete`, retries, and exact failed-room removal. [VERIFIED: codebase graph + source] |
| Browser-motion emulation | Custom `matchMedia` test shim | Playwright `page.emulateMedia({ reducedMotion })` | The official API directly emulates `prefers-reduced-motion` values. [CITED: https://playwright.dev/docs/api/class-page] |

**Key insight:** The difficult behavior—correct recovery truth and cleanup-safe timing—already has platform/library support. Phase code should assemble those seams instead of creating a parallel state machine or animation loop. [VERIFIED: codebase graph + source]

## Common Pitfalls

### Pitfall 1: The field fills only a centered patch of the content pane
**What goes wrong:** The stage remains pane-scoped, but an ASCII bed or its parent uses a constrained/vmin width and leaves the content pane's right portion uncovered (the reported roughly two-thirds-width defect). [VERIFIED: CONTEXT.md + UI-SPEC.md]

**Why it happens:** A field intended as a decorative center plane is allowed to define the visible background extent instead of being an absolute `inset: 0` layer inside its pane-scoped stage. [VERIFIED: codebase source + CONTEXT.md]

**How to avoid:** Make the content pane `position: relative`; mount the stage and base bed as `position: absolute; inset: 0; width: 100%; height: 100%`; keep rings as layered masks, not field-sizing containers. At every supported viewport, compare both stage and field bounding boxes to the actual content pane, asserting x/y/width/height and right-edge equality within 1px. [VERIFIED: UI-SPEC.md]

**Warning signs:** The stage or field right edge is less than the content pane right edge, a width is based on `vmin`/viewport units, or a screenshot shows an uncovered right portion. A visible and interactive header/rail is expected, not a failure. [VERIFIED: CONTEXT.md + UI-SPEC.md]

### Pitfall 2: Pane scope is accidentally promoted to viewport takeover
**What goes wrong:** The stage uses `position: fixed`, `100vw`, `100dvh`, viewport measurements, or a high global z-index and covers the header or room rail. [VERIFIED: CONTEXT.md + UI-SPEC.md]

**Why it happens:** “Full” is interpreted as browser-wide rather than as the full workspace content container. [VERIFIED: CONTEXT.md]

**How to avoid:** Use the content pane as the only geometry reference; keep the stage absolute within it and preserve the shell regions without `hidden`, `inert`, `aria-hidden`, overlay capture, or blur. Test that header and room-rail controls remain visible and can receive pointer/keyboard interaction during startup. [VERIFIED: UI-SPEC.md]

**Warning signs:** A stage box starts at viewport x/y instead of the content-pane x/y, its dimensions equal `window.innerWidth`/`innerHeight` rather than the pane rectangle, or a shell control becomes covered or disabled. [VERIFIED: UI-SPEC.md]

### Pitfall 3: Progress changes reset the field
**What goes wrong:** Recreating an infinite timeline whenever phase data changes snaps transforms back to initial values and can make a later recovery step look earlier. [VERIFIED: UI-SPEC.md]

**Why it happens:** Ambient animations are created once today and have no distinction between a baseline loop and a progress target. [VERIFIED: codebase source]

**How to avoid:** Keep one field lifecycle per mount, retain a monotonic forward target for normal/room-restoration updates, and only change the active timeline/tween targets for retry or exhausted state. [VERIFIED: UI-SPEC.md]

**Warning signs:** A later `percent` has a lower exposed presentation value, room completion appears to drop, or a retry falsely looks complete. [VERIFIED: UI-SPEC.md]

### Pitfall 4: Reduced motion stops semantics along with motion
**What goes wrong:** The reduced-motion branch hides the field and unintentionally removes the live status/progress panel or its updates. [VERIFIED: UI-SPEC.md]

**Why it happens:** Decorative and semantic state are co-located in the startup stage. [VERIFIED: codebase source]

**How to avoid:** Keep the field `aria-hidden` and pointer-inert; leave the existing status role, progressbar, aria values, retry, and delete actions outside its animation control. Render a static masked composition rather than no composition. [VERIFIED: codebase source] [VERIFIED: UI-SPEC.md]

**Warning signs:** `page.emulateMedia({ reducedMotion: "reduce" })` removes the progressbar, hides retry/delete, or leaves a GSAP tween active. [CITED: https://playwright.dev/docs/api/class-page]

### Pitfall 5: Mask tests prove only declarations, not a real reveal
**What goes wrong:** A test only checks for a class name; implementation could replace masks with borders while retaining the class. [VERIFIED: UI-SPEC.md]

**Why it happens:** CSS visual semantics are easy to fake with a static outline. [VERIFIED: UI-SPEC.md]

**How to avoid:** Check all three ring elements contain their own ASCII `<pre>`, computed unprefixed or WebKit mask image is not `none`, and computed `border`/`outline` are not used as the ring effect. [VERIFIED: UI-SPEC.md]

**Warning signs:** Ring markup lacks a texture child, either mask property is `none`, or a visible border appears. [VERIFIED: UI-SPEC.md]

## Code Examples

Verified patterns from official sources:

### Component destruction cleanup

```typescript
// Source: https://svelte.dev/docs/svelte/lifecycle-hooks
onMount(() => {
  const context = gsap.context(() => {
    // scoped GSAP setup
  }, field);

  return () => context.revert();
});
```

`onMount` runs after a component mounts and a synchronous returned function runs when it unmounts. [CITED: https://svelte.dev/docs/svelte/lifecycle-hooks]

### CSS radial-gradient mask reveal

```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image */
.ascii-ring {
  -webkit-mask-image: radial-gradient(circle, transparent 0 47%, #000 47.5% 48%, transparent 48.5%);
  mask-image: radial-gradient(circle, transparent 0 47%, #000 47.5% 48%, transparent 48.5%);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
```

### Playwright reduced-motion assertion

```typescript
// Source: https://playwright.dev/docs/api/class-page
await page.emulateMedia({ reducedMotion: "reduce" });
await expect(page.getByTestId("startup-progress-panel")).toBeVisible();
await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", /\d+/);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Component-wide before/after update hooks | Targeted Svelte runes effects and `onMount`/`onDestroy` lifecycle cleanup | Svelte 5 | Keep animation setup focused on the field DOM and projection inputs rather than global component updates. [CITED: https://svelte.dev/docs/svelte/lifecycle-hooks] |
| Unscoped animation cleanup | GSAP context and `matchMedia` revert cleanup | GSAP 3.11+ | Repeated mount, retry, and preference changes can restore affected inline animation state. [CITED: https://gsap.com/docs/v3/GSAP/gsap.context%28%29/] [CITED: https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/] |

**Deprecated/outdated:** Do not use Svelte 4 `beforeUpdate`/`afterUpdate` in this runes component; Svelte documents them as deprecated in Svelte 5 runes code. [CITED: https://svelte.dev/docs/svelte/lifecycle-hooks]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | None. All implementation recommendations are constrained by current project code, the approved UI contract, or official documentation. | — | — |

## Open Questions

None. The UI contract resolves the behavior, copy, desktop sizes, mask count, and reduced-motion rule. Exact easing/glyph tuning remains explicitly delegated implementation discretion. [VERIFIED: CONTEXT.md + UI-SPEC.md]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vite, Vitest, Playwright, TypeScript | ✓ | v25.2.1 | — |
| pnpm | Repository scripts | ✓ | 10.17.1 | — |
| GSAP | Startup field motion | ✓ | 3.15.0 installed | Static reduced-motion composition only; not a replacement for normal mode. [VERIFIED: package.json] |
| Vitest | Projection unit tests | ✓ | 4.1.9 | — [VERIFIED: local CLI] |
| Playwright Chromium runner | Browser/layout/reduced-motion tests | ✓ | 1.61.0 | — [VERIFIED: local CLI + playwright.config.ts] |

**Missing dependencies with no fallback:** None. [VERIFIED: local CLI]

**Missing dependencies with fallback:** None. [VERIFIED: local CLI]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + Playwright 1.61.0 [VERIFIED: local CLI] |
| Config file | `vite.config.ts` (Vitest) and `playwright.config.ts` (Chromium, preview server) [VERIFIED: codebase source] |
| Quick run command | `pnpm test -- tests/unit/startup-signal-presentation.test.ts` and `pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` [VERIFIED: package.json] |
| Full suite command | `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check` [VERIFIED: AGENTS.md + package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOTION-01 | At 1024×640, 1280×720, and 1440×900, the pane-scoped startup stage and base ASCII bed equal the positioned workspace content pane's x/y/width/height within 1px; each right edge equals the content-pane right edge within 1px; header and room rail remain usable. [VERIFIED: UI-SPEC.md] | Playwright integration | `pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` | ✅ extend existing [CITED: https://playwright.dev/docs/api/class-locator#locator-bounding-box] |
| MOTION-02 | Exactly three ring layers each contain ASCII texture and computed standard/WebKit mask; no ring border/outline substitutes. | Playwright integration | `pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` | ✅ extend existing |
| MOTION-03 | Increasing transport/room recovery progress maps forward; retry preserves completion, exhaustion settles; reduced motion retains readable semantics with no nonessential timeline. | Vitest unit + Playwright integration | `pnpm test -- tests/unit/startup-signal-presentation.test.ts`; `pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` | ❌ Wave 0 unit file; ✅ extend existing E2E |

### Sampling Rate

- **Per task commit:** `pnpm test -- tests/unit/startup-signal-presentation.test.ts` for projection changes; `pnpm test:e2e -- tests/e2e/workspace-lifecycle.spec.ts` after rendered-stage changes. [VERIFIED: package.json]
- **Per wave merge:** `pnpm lint && pnpm exec tsc --noEmit && pnpm test`. [VERIFIED: AGENTS.md + package.json]
- **Phase gate:** Full suite green before `$gsd-verify-work`. [VERIFIED: AGENTS.md]

### Wave 0 Gaps

- [ ] `tests/unit/startup-signal-presentation.test.ts` — proves the pure forward projection for phase percent, room completion, retry, and exhausted state (MOTION-03).
- [ ] `src/components/startup-signal-presentation.ts` — contains the browser-independent projection exported for unit coverage (MOTION-03).
- [ ] Extend `tests/e2e/workspace-lifecycle.spec.ts` — at each desktop viewport, compare content-pane/stage/field x/y/width/height and right edges within 1px; prove the header and rail remain usable; then cover masks/no-border, recovery action truth, and `page.emulateMedia({ reducedMotion: "reduce" })` (MOTION-01, MOTION-02, MOTION-03).

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set `workflow.security_enforcement` to `false`. [VERIFIED: .planning/config.json]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase does not change identity, signer, or authentication flows. [VERIFIED: CONTEXT.md] |
| V3 Session Management | no | This phase consumes existing startup state and does not persist or alter sessions. [VERIFIED: CONTEXT.md] |
| V4 Access Control | yes | Keep retry and failed-room deletion bound to the existing coordinator methods and contextual confirmation; do not introduce a parallel visual action path. [VERIFIED: codebase source] |
| V5 Input Validation | yes | Treat room/status strings as text interpolation only; do not introduce `{@html}`, URL-derived CSS, or unbounded selector construction. [VERIFIED: codebase source] |
| V6 Cryptography | no | The phase does not create, transport, log, or modify cryptographic material. [VERIFIED: CONTEXT.md] |

### Known Threat Patterns for the browser UI stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Decorated status becomes a second state machine | Tampering | Derive visual inputs read-only from `CoordinatorStartupProgress`; retain the existing semantic panel and coordinator methods. [VERIFIED: codebase graph + source] |
| Room name rendered as executable markup or CSS | Tampering | Keep ordinary Svelte text interpolation; do not use `{@html}` or inject names into selectors/styles. [VERIFIED: codebase source] |
| Leaked timelines after retry/mount cycles | Denial of Service | Scope GSAP animation setup and call revert cleanup on component destruction/reconfiguration. [CITED: https://gsap.com/docs/v3/GSAP/gsap.context%28%29/] |
| Motion suppresses recovery action/status | Denial of Service | Keep field decorative, `aria-hidden`, pointer-inert, and separate from controls and live semantics. [VERIFIED: codebase source] [VERIFIED: UI-SPEC.md] |

## Sources

### Primary (HIGH confidence)

- Project source via codebase-memory graph and targeted source inspection — `CoordinatorStore.startupProgress`, recovery transitions, `HostWorkspace`, `StartupSignalField`, current unit tests, and workspace lifecycle E2E. [VERIFIED: codebase graph + source]
- [Approved Phase 17 UI contract](17-UI-SPEC.md) — content-pane geometry, masks, motion, shell usability, accessibility, copy, and verification requirements. [VERIFIED: UI-SPEC.md]
- [GSAP context documentation](https://gsap.com/docs/v3/GSAP/gsap.context%28%29/) — scoped animation collection and revert cleanup. [CITED: https://gsap.com/docs/v3/GSAP/gsap.context%28%29/]
- [GSAP matchMedia documentation](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/) — media-query conditions and revert behavior. [CITED: https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/]
- [Svelte lifecycle documentation](https://svelte.dev/docs/svelte/lifecycle-hooks) — mount/unmount cleanup and runes lifecycle. [CITED: https://svelte.dev/docs/svelte/lifecycle-hooks]
- [MDN mask-image documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image) — gradient mask behavior. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image]
- [Playwright Page API](https://playwright.dev/docs/api/class-page) — reduced-motion emulation and viewport access. [CITED: https://playwright.dev/docs/api/class-page]
- [Playwright Locator API](https://playwright.dev/docs/api/class-locator#locator-bounding-box) — rendered element bounding boxes for comparing the content pane, stage, and field. [CITED: https://playwright.dev/docs/api/class-locator#locator-bounding-box]

### Secondary (MEDIUM confidence)

- Research-plan cache digests — official GSAP, Svelte, MDN, and Playwright sources fetched after Context7/CLI fallback was unavailable. [CITED: official documentation URLs above]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency is already installed and the package/official documentation was checked. [VERIFIED: package.json + npm registry]
- Architecture: HIGH — directly traced through the current coordinator, workspace, field, and tests. [VERIFIED: codebase graph + source]
- Pitfalls: HIGH — derived from existing layout/animation seams and explicit UI contract prohibitions. [VERIFIED: codebase source + UI-SPEC.md]

**Research date:** 2026-08-02
**Valid until:** 2026-09-01 (stable project-local integration and established browser APIs).
