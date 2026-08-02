# Phase 17: Full-Viewport Startup Motion - Pattern Map

**Mapped:** 2026-08-02  
**Files analyzed:** 5  
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/HostWorkspace.svelte` | component | event-driven | `src/components/HostWorkspace.svelte` | exact |
| `src/components/StartupSignalField.svelte` | component | transform | `src/components/StartupSignalField.svelte` | exact |
| `src/components/startup-signal-presentation.ts` | utility | transform | `src/coordinator/types.ts` | role-match |
| `tests/unit/startup-signal-presentation.test.ts` | test | transform | `tests/unit/state-machine.test.ts` | role-match |
| `tests/e2e/workspace-lifecycle.spec.ts` | test | request-response | `tests/e2e/workspace-lifecycle.spec.ts` | exact |

## Pattern Assignments

### `src/components/HostWorkspace.svelte` (component, event-driven)

**Analog:** `src/components/HostWorkspace.svelte`

This component is already the sole presentation boundary for coordinator startup truth. Extend its existing `StartupSignalField` import and startup-stage branch; do not move recovery actions or truth derivation into the field.

**Imports pattern** ([lines 1-32](../../src/components/HostWorkspace.svelte)):

```typescript
import { onDestroy, onMount, tick } from "svelte";
import type { CoordinatorStore } from "../coordinator/coordinator.svelte";
import type { HostedRoomRecoveryAdapter, HostedRoomRecoveryTarget } from "../coordinator/types";
// ... component imports from sibling files
import StartupSignalField from "./StartupSignalField.svelte";
```

**Derived state pattern** ([lines 128-150](../../src/components/HostWorkspace.svelte)):

```typescript
const localRoomReady = $derived(
  coordinator.status === "running"
    && coordinator.startupProgress.roomRecovery.state === "complete"
    && room !== null
    && session !== null
    && roomConnection === "connected"
);

const exhaustedRecoveryRoom = $derived.by(() => {
  const target = coordinator.exhaustedRoomRecoveryTarget;
  return target ? loadRoom(target.roomId, target.coordinatorPubkey) : null;
});
```

**Semantic progress and recovery-action pattern** ([lines 1502-1576](../../src/components/HostWorkspace.svelte)):

```svelte
<StartupSignalField />
...
<section
  class="startup-progress-panel"
  data-testid="startup-progress-panel"
  data-recovery-state={coordinator.startupProgress.roomRecovery.state}
  data-recovery-completed={coordinator.startupProgress.roomRecovery.completed}
  data-recovery-total={coordinator.startupProgress.roomRecovery.total}
  aria-label="Coordinator startup"
>
  <div class="startup-progress-track" role="progressbar"
    aria-valuenow={coordinator.startupProgress.phase === "restoring-rooms"
      ? coordinator.startupProgress.roomRecovery.total === 0 ? 100
        : Math.round((coordinator.startupProgress.roomRecovery.completed / coordinator.startupProgress.roomRecovery.total) * 100)
      : coordinator.startupProgress.percent}>
  </div>
  <footer><span role="status" aria-live="polite">...</span></footer>
  {#if coordinator.startupProgress.phase === "restoring-rooms" && coordinator.startupProgress.roomRecovery.state === "exhausted"}
    <div class="startup-recovery-actions">
      <button class="startup-primary" type="button" onclick={() => void coordinator.retryRoomRecovery()}>Retry recovery</button>
      {#if exhaustedRecoveryRoom}
        <button class="startup-danger" type="button" onclick={(event) => requestSidebarRoomRemoval(exhaustedRecoveryRoom!, event.currentTarget)}>Delete failed room</button>
      {/if}
    </div>
  {/if}
</section>
```

**Layout pattern** ([lines 1960-1983](../../src/components/HostWorkspace.svelte)):

```css
.startup-stage { position: relative; display: grid; height: 100%; place-items: center; overflow: hidden; padding: 2rem; background: ...; }
.startup-content { position: relative; z-index: 1; width: min(38rem, 100%); max-height: 100%; overflow-y: auto; text-align: center; }
.startup-progress-panel { width: min(32rem, 100%); margin: 1.25rem auto 0; background: rgb(8 14 10 / .82); padding: .8rem .9rem; text-align: left; backdrop-filter: blur(8px); }
```

Promote this established stage/content separation to the fixed viewport contract. Preserve the `data-testid`, live region, `progressbar`, retry call, and contextual removal route verbatim. The component should compute the projection once with `$derived` and pass it as a prop, while the normal chrome is hidden/inert for the same startup/stopping condition.

---

### `src/components/StartupSignalField.svelte` (component, transform)

**Analog:** `src/components/StartupSignalField.svelte`

**Imports and deterministic texture pattern** ([lines 1-18](../../src/components/StartupSignalField.svelte)):

```typescript
import { gsap } from "gsap";
import { onMount } from "svelte";

const columns = 210;
const rows = 112;
const glyphs = "        ....::::++++**xx0011##//\\\\";

function asciiField(seed: number): string { /* deterministic xorshift texture */ }
const textures = [asciiField(3), asciiField(11), asciiField(19), asciiField(29)];
let field: HTMLDivElement | undefined = $state();
```

**Scoped GSAP lifecycle pattern** ([lines 20-78](../../src/components/StartupSignalField.svelte)):

```typescript
onMount(() => {
  if (!field) return;
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const context = gsap.context(() => {
      gsap.set(".ascii-ring", { transformOrigin: "50% 50%" });
      gsap.to(".ring-outer", {
        scale: 1.035, opacity: .72, duration: 8.5,
        ease: "sine.inOut", repeat: -1, yoyo: true,
      });
    }, field);
    return () => context.revert();
  });
  return () => media.revert();
});
```

**Decorative markup and exact ring count** ([lines 81-87](../../src/components/StartupSignalField.svelte)):

```svelte
<div bind:this={field} class="signal-field" aria-hidden="true" data-testid="startup-ascii-field">
  <div class="field-glow"></div>
  <div class="ascii-bed"><pre class="ascii-texture">{textures[0]}</pre></div>
  <div class="ring-plane">
    <div class="ascii-ring ring-outer"><pre class="ascii-texture">{textures[1]}</pre></div>
    <div class="ascii-ring ring-middle"><pre class="ascii-texture">{textures[2]}</pre></div>
    <div class="ascii-ring ring-inner"><pre class="ascii-texture">{textures[3]}</pre></div>
  </div>
</div>
```

**Mask and pointer-isolation pattern** ([lines 90-159](../../src/components/StartupSignalField.svelte)):

```css
.signal-field { position: absolute; inset: 0; overflow: hidden; pointer-events: none; contain: strict; }
.ascii-ring { position: absolute; inset: 4%; overflow: hidden; opacity: .52;
  -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; -webkit-mask-size: 100% 100%;
  mask-position: center; mask-repeat: no-repeat; mask-size: 100% 100%; }
.ring-outer {
  -webkit-mask-image: radial-gradient(circle, transparent 0 47.1%, #000 47.45% 48.15%, transparent 48.5%);
  mask-image: radial-gradient(circle, transparent 0 47.1%, #000 47.45% 48.15%, transparent 48.5%);
}
```

Retain the single texture allocation and one mount-scoped GSAP/media owner. Add typed presentation input and update GSAP transform/opacity/mask CSS-property targets from effects; never write Svelte state in GSAP callbacks or recreate the texture array. Reduced motion must continue to have no nonessential timeline and render the same markup/static masks.

---

### `src/components/startup-signal-presentation.ts` (utility, transform)

**Analog:** `src/coordinator/types.ts`

There is no existing standalone browser-free presentation projector. The closest pure transformation is the typed recovery normalizer; copy its explicit typed-input/default/object-return style while keeping this module independent of GSAP, DOM, and store mutation.

**Type and pure transform pattern** ([lines 34-67](../../src/coordinator/types.ts)):

```typescript
export interface HostedRoomRecoveryProgress {
  state: "idle" | "restoring" | "retrying" | "exhausted" | "complete";
  completed: number;
  total: number;
  roomName: string | null;
  attempt: number;
  diagnostic: string;
}

export function createHostedRoomRecoveryProgress(
  input: Partial<HostedRoomRecoveryProgress> & Pick<HostedRoomRecoveryProgress, "state" | "completed" | "total">
): HostedRoomRecoveryProgress {
  const roomName = input.roomName ?? null;
  const diagnostic = input.diagnostic ?? ...;
  return { state: input.state, completed: input.completed, total: input.total, roomName, attempt: input.attempt ?? 0, diagnostic };
}
```

Import `CoordinatorStartupProgress` as a type from `../coordinator/types`; return a small immutable object containing only visual inputs (`phase`, recovery state, room name, completed/total, forward percentage and stable state). Preserve recovery values exactly. The utility must not import Svelte or GSAP.

---

### `tests/unit/startup-signal-presentation.test.ts` (test, transform)

**Analog:** `tests/unit/state-machine.test.ts`

**Imports and table-driven pure-function tests** ([lines 1-48](../../tests/unit/state-machine.test.ts)):

```typescript
import { describe, expect, test, vi } from "vitest";

import { isConfigLocked, transitionCoordinator } from "../../src/coordinator/state-machine";

describe("transitionCoordinator", () => {
  test.each([
    ["idle", "start", "starting"],
    ["starting", "started", "running"],
  ] satisfies Array<[CoordinatorStatus, CoordinatorEvent, CoordinatorStatus]>)(
    "%s + %s -> %s",
    (state, event, expected) => expect(transitionCoordinator(state, event)).toBe(expected),
  );
});
```

**Recovery truth fixture/assertion pattern** ([lines 50-83](../../tests/unit/state-machine.test.ts)):

```typescript
describe("hosted room recovery progress", () => {
  test("makes a zero-room recovery visibly complete before the coordinator becomes ready", () => {
    expect(createHostedRoomRecoveryProgress({ state: "complete", completed: 0, total: 0 }))
      .toMatchObject({ state: "complete", completed: 0, total: 0, roomName: null });
  });

  test("retains the exact current room and completed count for a retry", () => {
    expect(createHostedRoomRecoveryProgress({ state: "retrying", completed: 1, total: 2, roomName: "Project planning", attempt: 2 }))
      .toMatchObject({ state: "retrying", completed: 1, total: 2, roomName: "Project planning", attempt: 2, diagnostic: "Trying again…" });
  });
});
```

Use literal `CoordinatorStartupProgress` fixtures and direct function calls. Cover transport percent passthrough, forward room-ratio mapping including zero rooms, retry retaining completed work, and exhausted target stability. This test has no DOM or timer setup.

---

### `tests/e2e/workspace-lifecycle.spec.ts` (test, request-response)

**Analog:** `tests/e2e/workspace-lifecycle.spec.ts`

**Browser helper pattern for viewport ownership** ([lines 81-110](../../tests/e2e/workspace-lifecycle.spec.ts)):

```typescript
async function expectViewportOwned(page: import("@playwright/test").Page, viewport: { width: number; height: number }): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
  }))).toEqual({
    clientWidth: viewport.width, scrollWidth: viewport.width,
    clientHeight: viewport.height, scrollHeight: viewport.height,
    bodyWidth: viewport.width, bodyHeight: viewport.height,
  });
}

async function expectInsideViewport(locator: import("@playwright/test").Locator): Promise<void> {
  await expect.poll(() => locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 && bounds.left >= 0 && bounds.right <= window.innerWidth && bounds.bottom <= window.innerHeight;
  })).toBe(true);
}
```

**Existing startup recovery scenario pattern** ([lines 1896-1940](../../tests/e2e/workspace-lifecycle.spec.ts)):

```typescript
await page.reload();
await page.getByPlaceholder("passphrase", { exact: true }).fill("offline-host-room-passphrase");
await page.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();

await expect(page.getByTestId("startup-ascii-field")).toBeVisible();
await expect(page.getByTestId("host-message-list")).toBeHidden();
await page.getByRole("button", { name: "Start", exact: true }).click();
await expect(page.getByTestId("startup-progress-panel")).toBeVisible();
await expect(page.getByTestId("status-badge")).toHaveText("starting");
```

Extend existing lifecycle setup rather than creating another app fixture. Set each desktop viewport before triggering startup; assert fixed bounds and body/document dimensions through `expectViewportOwned`; inspect every `.ascii-ring` for its ASCII child, mask computed style, and no border/outline; then call `page.emulateMedia({ reducedMotion: "reduce" })` before loading a recovery state and assert that the status panel/progressbar/actions remain visible.

## Shared Patterns

### Recovery truth is read-only presentation input

**Sources:** `src/coordinator/types.ts` lines 34-67; `src/coordinator/coordinator.svelte.ts` lines 630-646  
**Apply to:** projection utility, `HostWorkspace.svelte`, tests

```typescript
async retryRoomRecovery(): Promise<void> {
  if (this.startupPromise) return this.startupPromise;
  if (this.status !== "starting" || this.startupProgress.roomRecovery.state !== "exhausted" || !this.running) return;
  // recovery transaction owns status/progress changes
}
```

The new presentation layer reads `CoordinatorStartupProgress`; it does not introduce a second retry state, mutation, timeout, or error interpretation.

### Component-scoped animation cleanup

**Source:** `src/components/StartupSignalField.svelte` lines 20-78  
**Apply to:** `StartupSignalField.svelte`

Use `gsap.matchMedia()` with a `gsap.context(..., field)` return cleanup and finish `onMount` with `media.revert()`. All selectors remain field-local through the context root.

### Semantic content stays above decorative DOM

**Source:** `src/components/HostWorkspace.svelte` lines 1502-1576; `src/components/StartupSignalField.svelte` lines 81-87  
**Apply to:** `HostWorkspace.svelte`, `StartupSignalField.svelte`

The field is `aria-hidden` and pointer-inert; the existing `role="progressbar"` and `role="status" aria-live="polite"` remain in `HostWorkspace` over the field.

### Browser layout assertions use polling and computed state

**Source:** `tests/e2e/workspace-lifecycle.spec.ts` lines 81-110  
**Apply to:** `tests/e2e/workspace-lifecycle.spec.ts`

Assert document dimensions and element bounds with `expect.poll`/`page.evaluate`, not timing-sensitive snapshots. Inspect computed mask/border/outline values in the same style for the true-mask requirement.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/startup-signal-presentation.ts` | utility | transform | No existing standalone presentation projector; `createHostedRoomRecoveryProgress` is the closest pure typed mapper. |
| `tests/unit/startup-signal-presentation.test.ts` | test | transform | No existing projection-specific unit suite; state-machine tests establish the closest direct pure-function convention. |

## Metadata

**Analog search scope:** `src/components`, `src/coordinator`, `tests/unit`, `tests/e2e`  
**Files scanned:** 7  
**Pattern extraction date:** 2026-08-02
