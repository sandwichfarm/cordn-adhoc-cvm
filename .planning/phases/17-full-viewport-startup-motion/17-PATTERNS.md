# Phase 17: Content-Pane Startup Motion - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 5
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/HostWorkspace.svelte` | component | event-driven | `src/components/HostWorkspace.svelte` content-pane grid and startup branch | exact |
| `src/components/StartupSignalField.svelte` | component | transform | `src/components/StartupSignalField.svelte` | exact |
| `src/components/startup-signal-presentation.ts` | utility | transform | `src/components/startup-signal-presentation.ts` | exact |
| `tests/unit/startup-signal-presentation.test.ts` | test | transform | `tests/unit/startup-signal-presentation.test.ts` | exact |
| `tests/e2e/workspace-lifecycle.spec.ts` | test | request-response | `tests/e2e/workspace-lifecycle.spec.ts` pane-alignment helper | exact |

## Pattern Assignments

### `src/components/HostWorkspace.svelte` (component, event-driven)

**Analog:** its existing content-pane grid at `src/components/HostWorkspace.svelte` lines 1462-1478 and 1814-1818.

The startup stage belongs inside `data-testid="host-chat"`, which is the second column of the established `host-layout` grid. Reuse this exact container relationship; it is the authoritative layout analog for a surface that fills the pane all the way to its right edge while retaining the header and room rail.

**Content-pane grid pattern** (lines 1462-1478, 1814-1818):

```svelte
<section class="host-chat min-h-0 min-w-0 overflow-hidden bg-[#101614]" data-testid="host-chat">
  {#if embeddedChatActive}
    <ChatRoute embedded ... />
  {:else if ...}
    <!-- pane-owned content goes here -->
  {/if}
</section>
```

```css
.host-layout {
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
}
.host-chat { width: 100%; max-width: 100%; }
```

**Startup branch and semantic panel pattern** (lines 1508-1585):

```svelte
<div class="startup-stage">
  <StartupSignalField signal={startupSignal} />
  <div class="startup-content">
    <section class="startup-progress-panel" data-testid="startup-progress-panel">
      <div class="startup-progress-track" role="progressbar" ...></div>
      <footer><span role="status" aria-live="polite">...</span></footer>
      {#if coordinator.startupProgress.roomRecovery.state === "exhausted"}
        <button class="startup-primary" type="button" onclick={() => void coordinator.retryRoomRecovery()}>Retry recovery</button>
        <button class="startup-danger" type="button" onclick={(event) => requestSidebarRoomRemoval(exhaustedRecoveryRoom!, event.currentTarget)}>Delete failed room</button>
      {/if}
    </section>
  </div>
</div>
```

**Pane-scoped geometry to apply** (replace stale lines 1973-1976 recommendations):

```css
.host-chat { position: relative; }
.startup-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 2rem;
}
.startup-content {
  position: relative;
  z-index: 1;
  width: min(512px, calc(100% - 32px));
  max-height: calc(100% - 32px);
  overflow-y: auto;
}
```

Do not use the currently stale `startupViewportOwned`/`viewport-owned` branch, `position: fixed`, `100vw`, `100dvh`, or global-shell `aria-hidden`, `inert`, `visibility`, and pointer suppression. Header and rail remain rendered, enabled, and interactive; only the normal body in `host-chat` is replaced.

### `src/components/StartupSignalField.svelte` (component, transform)

**Analog:** `src/components/StartupSignalField.svelte` lines 29-112 and 116-228.

**Lifecycle, reduced-motion, and cleanup pattern** (lines 32-113):

```typescript
onMount(() => {
  if (!field) return;
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const context = gsap.context(() => {
      gsap.set(".ascii-ring", { transformOrigin: "50% 50%" });
      gsap.to(".ring-outer", { scale: 1.035, opacity: .72, duration: 8.5, ease: "sine.inOut", repeat: -1, yoyo: true });
    }, field);
    return () => context.revert();
  });
  return () => media.revert();
});
```

Keep GSAP component-scoped. On changing truthful presentation values, update transforms, opacity, and mask-related custom properties without creating Svelte state writes inside GSAP callbacks. Preserve the static identical field under reduced motion, and clean up timelines for mount/unmount and start/stop/retry cycles.

**Decorative field and true-mask pattern** (lines 116-143, 176-202):

```svelte
<div bind:this={field} class="signal-field" aria-hidden="true" data-testid="startup-ascii-field">
  <div class="ascii-bed"><pre class="ascii-texture">{textures[0]}</pre></div>
  <div class="ring-plane">
    <div class="ascii-ring ring-outer"><pre class="ascii-texture">{textures[1]}</pre></div>
    <div class="ascii-ring ring-middle"><pre class="ascii-texture">{textures[2]}</pre></div>
    <div class="ascii-ring ring-inner"><pre class="ascii-texture">{textures[3]}</pre></div>
  </div>
</div>
```

```css
.signal-field { position: absolute; inset: 0; overflow: hidden; pointer-events: none; contain: strict; }
.ascii-ring { position: absolute; inset: 4%; overflow: hidden; opacity: .52;
  -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; -webkit-mask-size: 100% 100%;
  mask-position: center; mask-repeat: no-repeat; mask-size: 100% 100%; }
.ring-outer { -webkit-mask-image: radial-gradient(circle, transparent 0 47.1%, #000 47.45% 48.15%, transparent 48.5%);
  mask-image: radial-gradient(circle, transparent 0 47.1%, #000 47.45% 48.15%, transparent 48.5%); }
```

The `signal-field` fills the stage through `inset: 0`; retain one base bed and exactly three masked copies. Do not add border/outline/SVG circle substitutes. The deterministic texture allocation at lines 12-30 remains one-time and pane-size-independent.

### `src/components/startup-signal-presentation.ts` (utility, transform)

**Analog:** `src/components/startup-signal-presentation.ts` lines 1-38.

**Typed, pure presentation projection** (lines 17-38):

```typescript
export function projectStartupSignal(
  progress: CoordinatorStartupProgress,
  status: CoordinatorStatus,
): StartupSignalPresentation {
  const total = clamp(progress.roomRecovery.total, 0, Number.MAX_SAFE_INTEGER);
  const completed = clamp(progress.roomRecovery.completed, 0, total);
  const roomRatio = total === 0 ? 1 : completed / total;
  const forwardPercent = progress.phase === "restoring-rooms"
    ? 85 + roomRatio * 15
    : clamp(progress.percent, 0, 100);
  return { phase: progress.phase, recoveryState: progress.roomRecovery.state, completed, total,
    roomName: progress.roomRecovery.roomName, forwardPercent,
    mode: status === "stopping" ? "resting" : "active" };
}
```

Keep this a browser-free projection of coordinator truth. Preserve phase, retry/exhaustion state, room name, counts, and monotonic forward value; it must not own retry state, mutate the coordinator, import GSAP, or infer readiness.

### `tests/unit/startup-signal-presentation.test.ts` (test, transform)

**Analog:** `tests/unit/startup-signal-presentation.test.ts` lines 6-63.

**Literal fixture and table-driven projection pattern** (lines 6-24, 43-55):

```typescript
function progress(overrides: Partial<CoordinatorStartupProgress> = {}): CoordinatorStartupProgress {
  return { phase: "connecting-relays", percent: 60, roomRecovery: { state: "idle", completed: 0, total: 0, roomName: null, attempt: 0, diagnostic: "" }, ...overrides };
}

test.each([[0, 0, 100], [1, 4, 88.75], [4, 4, 100]])(
  "maps room recovery %i of %i into the final startup interval",
  (completed, total, forwardPercent) => expect(projectStartupSignal(progress({ ... } as CoordinatorStartupProgress), "starting").forwardPercent).toBe(forwardPercent),
);
```

Test the projection only: transport pass-through, zero-room completion, increasing room recovery, retry retaining completed count, exhausted state preservation, and stopping/resting. No DOM or timeline harness is needed.

### `tests/e2e/workspace-lifecycle.spec.ts` (test, request-response)

**Analog:** `tests/e2e/workspace-lifecycle.spec.ts` lines 126-142, `expectEmbeddedChatFillsHostPane`.

**Actual-pane bounds helper** (lines 126-142):

```typescript
await expect.poll(() => page.evaluate(() => {
  const pane = document.querySelector<HTMLElement>('[data-testid="host-chat"]');
  const route = pane?.querySelector<HTMLElement>('[data-testid="chat-route"]');
  if (!pane || !route) return false;
  const paneBounds = pane.getBoundingClientRect();
  const routeBounds = route.getBoundingClientRect();
  const aligned = (left: number, right: number) => (
    Math.abs(left - paneBounds.left) <= 1 && Math.abs(right - paneBounds.right) <= 1
  );
  return aligned(routeBounds.left, routeBounds.right);
})).toBe(true);
```

Extend this helper for `.startup-stage` and `[data-testid="startup-ascii-field"]`: compare their left/top/right/bottom to `host-chat`, explicitly including the right edges. Assert computed stage geometry is `absolute`, `inset: 0`, and `width`/`height` resolve to the pane; never compare the stage to browser viewport dimensions. At desktop widths 1024, 1280, and 1440, also assert header and `invite-panel` are visible, not inert/`aria-hidden`, and usable during startup. Preserve checks for semantic progressbar/live region, retry/exhaustion actions, masks, and reduced-motion static field.

## Shared Patterns

### Content-pane ownership

**Sources:** `src/components/HostWorkspace.svelte` lines 1462-1478 and 1814-1818; `tests/e2e/workspace-lifecycle.spec.ts` lines 126-142.
**Apply to:** `HostWorkspace.svelte`, `StartupSignalField.svelte`, and browser checks.

The `host-chat` grid cell is the content pane. It already provides the exact full-width/right-edge contract used by embedded chat. Give it `position: relative`; mount the absolute startup stage within it. The global header and rail are sibling shell regions, never startup-owned.

### Read-only recovery projection and semantics

**Sources:** `src/components/startup-signal-presentation.ts` lines 17-38; `src/components/HostWorkspace.svelte` lines 1515-1585.
**Apply to:** projection, field, and tests.

Pass only the compact projection into the decorative field. The progress panel remains the source of user-visible status, progressbar, live state, retry, and exhausted-room removal.

### Scoped decoration and motion

**Source:** `src/components/StartupSignalField.svelte` lines 32-113 and 116-228.
**Apply to:** `StartupSignalField.svelte`.

The field is `aria-hidden`, pointer-inert, and absolutely fills its positioned pane stage. Use `gsap.context` and `gsap.matchMedia`; reduced motion renders the same masks without timelines.

## No Analog Found

None. The repository already contains exact analogs for pane ownership, presentation projection, deterministic masked texture, scoped GSAP, and pane-bound browser assertions.

## Metadata

**Analog search scope:** `src/components`, `src/coordinator`, `tests/e2e`, `tests/unit`
**Files scanned:** 8
**Pattern extraction date:** 2026-08-02
