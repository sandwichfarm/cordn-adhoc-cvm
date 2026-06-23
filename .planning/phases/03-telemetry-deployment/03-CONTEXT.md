# Phase 3: Telemetry & Deployment - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers two independent capabilities: live resource telemetry visible when the coordinator is running (subscription count, message rate, memory estimate), and a fully automated nsite/Blossom deployment pipeline triggered on CI-green pushes to main. After Phase 3, the app is feature-complete and self-deploying.

**Requirements in scope:** TELEMETRY-01, TELEMETRY-02, TELEMETRY-03, TELEMETRY-04, TELEMETRY-05, CICD-03, CICD-04, CICD-05, CICD-06

**Out of scope for Phase 3:**
- Per-relay round-trip latency diagnostics (v2 DIAG-01)
- Raw event log display (explicitly out of scope in PROJECT.md)
- NIP-42 relay authentication (v2)
- Key import from nsec (v2)
- ApplesauceRelayPool reconnect tracking beyond what Phase 2 already handles

</domain>

<decisions>
## Implementation Decisions

### 1. Telemetry State Ownership

**D-01:** A separate `ResourceMonitor` class in `src/coordinator/resource-monitor.svelte.ts` owns all telemetry `$state` runes. `CoordinatorStore` does not gain telemetry fields — it calls `resourceMonitor.start(transport)` after `this.running` is set in `start()`, and `resourceMonitor.stop()` at the top of `stop()`.

Rationale: follows the established singleton pattern (`keyStorage`, `transportFactory`, `coordinatorStore` are all separate singletons). Keeps `CoordinatorStore` focused on lifecycle; telemetry is an observational concern.

```typescript
// src/coordinator/resource-monitor.svelte.ts
export class ResourceMonitor {
  subscriptionCount = $state(0);
  messageRate     = $state(0);          // events per minute, rolling 60-second window
  memoryBytes     = $state<number | null>(null); // null = unavailable

  start(transport: RunningTransport): void
  stop(): void
}

export const resourceMonitor = new ResourceMonitor();
```

**D-02:** `CoordinatorStore.start()` integration point:
```typescript
// after: this.status = transitionCoordinator(this.status, "started");
resourceMonitor.start(this.running!);
```

**D-03:** `CoordinatorStore.stop()` integration point — call `resourceMonitor.stop()` before clearing `this.running`:
```typescript
// At the top of stop():
resourceMonitor.stop();
```

---

### 2. Subscription Counter

**D-04:** Manual synthetic counter: `subscriptionCount` is tracked by inspecting `NostrServerTransport` events, if available. At `start()`, attempt to hook `transport.transport` (the `NostrServerTransport` instance) for `'subscription'`-like events using the pattern:

```typescript
const nt = transport.transport as NostrServerTransport & {
  on?: (event: string, handler: () => void) => void;
};
if (typeof nt.on === 'function') {
  nt.on('subscribed', () => { this.subscriptionCount++ });
  nt.on('unsubscribed', () => { this.subscriptionCount = Math.max(0, this.subscriptionCount - 1) });
}
```

If `NostrServerTransport` does not expose these events (opaque internal API), `subscriptionCount` remains at 0 — the "(est.)" label (TELEMETRY-05) makes this acceptable. Do NOT add more than 10 lines probing the SDK interface. If not obviously exposed, accept 0 and move on.

Rationale: STATE.md flags "ApplesauceRelayPool reconnect behavior unknown" — the SDK is a black box. A synthetic counter satisfying TELEMETRY-01 is valid; the "(est.)" label is the specification's own escape hatch.

---

### 3. Message Rate — Rolling Window

**D-05:** Timestamp-array rolling window, 60-second window, 5-second update interval.

```typescript
private messageTimes: number[] = [];
private rateTimer: ReturnType<typeof setInterval> | null = null;

// On each observed message event (or via a proxy hook):
private recordMessage(): void {
  this.messageTimes.push(Date.now());
}

// On interval tick (every 5s):
private updateRate(): void {
  const cutoff = Date.now() - 60_000;
  this.messageTimes = this.messageTimes.filter(t => t > cutoff);
  this.messageRate = this.messageTimes.length; // events in last 60s = events/min
}
```

If message events are not hookable from the SDK, `messageRate` stays at 0. Acceptable per TELEMETRY-05 ("(est.)" label).

**D-06:** Hook for message events — try `transport.transport` for `'message'`, `'event'`, or `'request'` events using the same optional-chaining pattern from D-04. If none found, skip — do not add artificial polling.

---

### 4. Memory Estimate

**D-07:** Feature-detect `performance.memory` at read time, not at module load:

```typescript
private readMemory(): void {
  const mem = (performance as Performance & {
    memory?: { usedJSHeapSize: number }
  }).memory;
  this.memoryBytes = mem?.usedJSHeapSize ?? null;
}
```

`memoryBytes = null` means the component shows "unavailable" (TELEMETRY-03). `memoryBytes` is updated on the same 5-second interval as `messageRate`.

---

### 5. ResourceMonitor Component

**D-08:** New `src/components/ResourceMonitor.svelte` component. Placed in `App.svelte` directly below `LifecyclePanel.svelte`, inside the same conditional block: only rendered when `coordinatorStore.status === 'running'` (TELEMETRY-04).

```svelte
{#if coordinatorStore.status === 'running'}
  <ResourceMonitor />
{/if}
```

**D-09:** Component layout — three rows, monospace, cypherpunk aesthetic (no borders, no box shadows, consistent with existing components):

```
TELEMETRY
subscriptions   {resourceMonitor.subscriptionCount} (est.)
msg rate        {resourceMonitor.messageRate} /min (est.)
memory          {memDisplay}
```

Where `memDisplay` = formatted MB (e.g., `42.3 MB (est.)`) or `unavailable`.

Colors: values in green `#87ff9f`; "unavailable" in gray `#6d746f`; label row in gray `#6d746f`; header `TELEMETRY` in white.

---

### 6. Deploy Pipeline

**D-10:** `.github/workflows/deploy-nsite.yml` already exists and is complete. It satisfies CICD-03, CICD-04, CICD-05, CICD-06:
- Triggers via `workflow_run` on CI success on `main` (CICD-03)
- Uses `sandwichfarm/nsite-action@v0.5.1` with `NBUNK_SECRET`, `NSYTE_RELAYS`, `BLOSSOM_SERVER_URLS` (CICD-04 — `NBUNK_SECRET` is the correct nbunksec format for nsite-action)
- Skip-on-missing-secrets via `steps.secrets.outputs.ready` conditional on every step (CICD-06)
- `scripts/setup-secrets.sh` prompts for all four secrets including optional `NSITE_NAME` (CICD-05)

**D-11:** Plan 03-02 verification checklist:
1. Confirm `scripts/setup-secrets.sh` is executable (`git ls-files --error-unmatch scripts/setup-secrets.sh` and `chmod +x`)
2. Confirm the workflow triggers correctly (test with a dry push or workflow dispatch)
3. No structural changes to `deploy-nsite.yml` needed

---

### Claude's Discretion

The following were decided autonomously (headless session — no user input available):

1. **Separate `ResourceMonitor` singleton vs. fields in `CoordinatorStore`:** Chose separate singleton. `CoordinatorStore` is already 168 lines; adding 4+ reactive telemetry fields plus interval management would make it harder to reason about. Separation matches the pattern already used by `keyStorage` and `transportFactory`.

2. **Synthetic counter vs. SDK event hook:** Requirements say "sourced from SDK or manual counter" — both are valid. Given the SDK is a black box and STATE.md explicitly flags this uncertainty, decided to attempt SDK event hooks with a 10-line cap, then accept 0 with "(est.)" label. This avoids fragile introspection while remaining honest about estimates.

3. **60-second rolling window (not 30s or 5s):** A 60-second window aligns with the "per minute" display unit, making the display value directly readable: N events in the window = N events/min. No division needed.

4. **5-second update interval (not 1s):** 1s would be too jittery for a low-volume coordinator. 5s is smooth and low-CPU. Component reads `resourceMonitor.messageRate` reactively via Svelte runes; interval only updates the underlying state.

5. **Deploy pipeline is complete:** `deploy-nsite.yml` and `setup-secrets.sh` were both implemented during Phase 2 as preparatory work. Plan 03-02 verifies correctness and confirms git executable bit, but does not rebuild.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TELEMETRY-01..05, CICD-03..06 (Phase 3 requirements)

### Project Context
- `.planning/PROJECT.md` — constraints, tech stack, out-of-scope items
- `.planning/ROADMAP.md` — Phase 3 plan definitions (03-01, 03-02)

### Prior Phase Context
- `.planning/phases/02-security-persistence/02-CONTEXT.md` — established patterns, `RelayConnectionStatus` optimistic model, singleton pattern, UI color palette, `CoordinatorStore` extension points
- `.planning/phases/01-core-foundation/01-CONTEXT.md` — SDK import strategy, runes-only constraint, ESLint ban on svelte/store

### Existing Implementation (read before planning)
- `src/coordinator/coordinator.svelte.ts` — `CoordinatorStore.start()` / `stop()` integration points for `resourceMonitor`
- `src/lib/transport.ts` — `RunningTransport` interface (exposes `transport: NostrServerTransport` directly)
- `.github/workflows/deploy-nsite.yml` — already-complete deploy pipeline
- `scripts/setup-secrets.sh` — already-complete secret setup guide

</canonical_refs>

<code_context>
## Existing Code Insights

### Integration Points for ResourceMonitor
- `CoordinatorStore.start()` (line 84–103): call `resourceMonitor.start(this.running!)` after line 96 (`this.status = transitionCoordinator(this.status, "started")`)
- `CoordinatorStore.stop()` (line 105–110): call `resourceMonitor.stop()` before line 108 (`this.relayStatuses = {}`)
- `CoordinatorStore.destroy()` (line 121–128): `stop()` is already called, so `resourceMonitor.stop()` is covered transitively

### SDK Access Pattern
- `RunningTransport.transport` is the raw `NostrServerTransport` instance
- The transport object is created via `new NostrServerTransport({...})` and is accessible after `server.connect(transport)` resolves
- Attempt event hooks via optional duck-typed `.on()` — if absent, accept the synthetic 0 default

### Established UI Patterns (from Phase 2 CONTEXT.md)
- Colors: green `#87ff9f`, yellow `#f1f58f`, red `#ff8f8f`, gray `#6d746f`, background `#050805`
- No icon libraries; Unicode only
- Runes API only: `$state`, `$derived`, `$effect` — no `svelte/store`
- Named imports from `@contextvm/sdk` subpaths — never barrel import
- New singletons exported as `const name = new ClassName()` at end of file

### App.svelte Layout Order (current)
1. `NpubDisplay`
2. `LifecyclePanel`
3. `RelayConfigPanel`
4. `PersistencePanel`
→ Phase 3 adds `ResourceMonitor` between `LifecyclePanel` and `RelayConfigPanel` (telemetry is closer to the lifecycle control than config)

</code_context>

<deferred>
## Deferred Ideas

- **ApplesauceRelayPool reconnect tracking:** If SDK exposes per-relay reconnect events, wire them to the subscription counter or relay status. Deferred because the SDK internals are unknown and Phase 2 already established that optimistic status is acceptable.
- **Relay config persistence:** Carry relay URLs across page loads alongside the encrypted key. No PERSIST-* requirement covers it; deferred to a future validation cycle.
- **Per-relay latency (ping time):** DIAG-01 is a v2 requirement; Phase 3 does not include it.

</deferred>

---

*Phase: 3-Telemetry & Deployment*
*Context gathered: 2026-06-23*
*Mode: headless autonomous — all decisions made by Claude*
