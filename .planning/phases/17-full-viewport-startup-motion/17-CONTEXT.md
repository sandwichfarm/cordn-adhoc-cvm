# Phase 17: Full-Viewport Startup Motion - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning
**Mode:** Autonomous decisions derived from the user's explicit visual direction

<domain>
## Phase Boundary

Turn the existing coordinator startup/recovery state into a full-viewport, GSAP-driven ASCII experience. This phase changes presentation and motion only: Phase 16 remains the source of truth for startup phases, room-recovery progress, retry, exhaustion, and safe recovery actions.

</domain>

<decisions>
## Implementation Decisions

### Viewport ownership
- While the local coordinator is starting or stopping, the startup experience owns the entire application viewport rather than remaining inside the normal chat column.
- The normal header, room rail, and chat chrome must not leave side gutters or compete with the startup experience during that transient state.
- Status, recovery progress, settings review, retry, and exhausted-room removal remain reachable inside the startup surface.
- The layout must stay contained at supported desktop widths and short viewports without document-level scrolling or clipped actions.

### ASCII field and masked rings
- A deterministic ASCII texture covers the full viewport edge to edge; it is not a centered decorative patch.
- Rings are true masks through which the ASCII field is revealed, with no independent border-circle substitute.
- Use GSAP for the living motion: layered drift, scale, rotation, opacity, and phase transitions should feel fluid and restrained rather than like a static pulse.
- The ring field should remain visually legible behind content through contrast masks and a calm focal zone, not by shrinking the animation away from the content.

### Progress-responsive motion
- Feed the rendered startup phase, percentage, and recovery state into the signal field instead of running an unrelated infinite animation.
- Progress changes should move the field forward perceptibly and monotonically while retry and exhaustion have distinct, truthful visual states.
- The progress panel remains the authoritative textual state; animation may reinforce it but never replace or contradict it.
- Transitions between transport startup, room restoration, retry, exhaustion, and completion should be smooth without delaying coordinator readiness.

### Accessibility and performance
- `prefers-reduced-motion: reduce` suppresses nonessential GSAP timelines and presents a stable full-viewport ASCII composition.
- Status and progress retain semantic progressbar/live-region behavior independent of the decorative field.
- Animation cleanup must be component-scoped and leak-free across repeated start/stop/retry cycles.
- Avoid per-frame Svelte state writes and excessive DOM churn; animate transforms, opacity, and mask-related CSS variables through GSAP.

### the agent's Discretion
- Exact glyph palette, number of masked layers, easing curves, and phase color modulation may be tuned to the existing restrained cypherpunk visual system.
- Compact/mobile behavior may simplify density while preserving readable progress; the milestone remains desktop-first.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/StartupSignalField.svelte` already imports GSAP, generates deterministic ASCII textures, and uses radial-gradient masks for three ring layers.
- `src/components/HostWorkspace.svelte` owns the startup stage, truthful progress panel, retry/delete actions, and the `startup-mode` class hook.
- `CoordinatorStore.startupProgress` exposes phase, percent, current room, aggregate completion, retry, and exhaustion state from the verified Phase 16 transaction.

### Established Patterns
- Svelte 5 runes and component-scoped `gsap.context()`/`gsap.matchMedia()` lifecycle cleanup are established.
- The operator shell uses dark monospace surfaces, low-contrast signal textures, green state color, and explicit reduced-motion media queries.
- Browser behavior is verified with Playwright against real rendered layout and computed styles; pure progress projection belongs in Vitest where practical.

### Integration Points
- Promote `startup-mode` to viewport-level layout ownership in `HostWorkspace.svelte`.
- Pass a small presentation projection of `coordinator.startupProgress` into `StartupSignalField.svelte`.
- Extend `tests/e2e/workspace-lifecycle.spec.ts` with full-viewport, progress-responsive, retry/exhaustion, and reduced-motion assertions.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly asked for ASCII visible across the whole page, rings formed as masks of that ASCII, and visibly richer GSAP motion.
- Preserve the existing startup screen rather than briefly exposing a connecting/disconnected chat while the local coordinator recovers.
- Keep the animation sophisticated but quiet enough that the progress text remains the focal information.

</specifics>

<deferred>
## Deferred Ideas

- Presence, notifications, invitations, and shell-control consolidation remain Phase 18.
- Grouped chat messages and streamlined reactions remain Phase 19.

</deferred>
