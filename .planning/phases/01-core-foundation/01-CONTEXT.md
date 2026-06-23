# Phase 1 Context: Core Foundation

**Captured:** 2026-06-23
**Phase:** 1 of 3
**Status:** Ready to plan

---

## Domain

Phase 1 delivers a working browser coordinator: the user can open the app, see a generated Nostr identity, configure relay URLs, and start/stop a live `NostrServerTransport` — all in-memory, no persistence, no backend.

---

## Canonical Refs

- `.planning/REQUIREMENTS.md` — KEYGEN-01..05, COORD-01..02/04..06, RELAY-01..05/07, SEC-03, UI-01..06, ERR-01/04/05, TEST-01/03..06, CICD-01..02
- `.planning/research/ARCHITECTURE.md` — component responsibilities, data flow diagrams, singleton patterns
- `.planning/research/PITFALLS.md` — Node built-in leak, runes/store mixing, WS teardown, relay-list-while-running
- `.planning/research/STACK.md` — exact package versions, Tailwind v4 CSS-first config, Playwright `webServer` config
- `.planning/PROJECT.md` — constraints, out-of-scope, key decisions table

---

## Decisions

### 1. SDK Import Strategy

**Decision:** Named imports only from `@contextvm/sdk`; never barrel import.

```typescript
import { NostrServerTransport } from '@contextvm/sdk';
import { PrivateKeySigner } from '@contextvm/sdk';
import { ApplesauceRelayPool } from '@contextvm/sdk';
```

`TransportFactory` signature: `create(hexKey: string, relayUrls: string[]): NostrServerTransport`

The exact constructor shape — specifically whether `PrivateKeySigner` takes hex string or `Uint8Array` and what the second argument to `NostrServerTransport` is (options object vs. positional args) — **must be verified in plan 01-01** by running `vite build` against a minimal integration stub. Until verified, use a `// TODO: verify constructor API` comment in the stub. Do not guess.

**Why:** Pitfall 2 in PITFALLS.md — SDK was Node.js-first; barrel imports pull in `node:crypto`, `node:events`. Named imports enable tree-shaking. Subpath imports are the STATE.md Day 1 decision.

**Verification gate:** `vite build` in plan 01-01 must complete with zero polyfill warnings and zero `__vite_externalized` banners.

---

### 2. State Machine: Phase 1 Scope

**Decision:** Phase 1 state machine has exactly four states. No `destroyed` state.

```typescript
type CoordinatorStatus = 'idle' | 'starting' | 'running' | 'stopping';
type CoordinatorEvent  = 'start' | 'started' | 'stop' | 'stopped' | 'error';

const TABLE = {
  idle:     { start: 'starting' },
  starting: { started: 'running', error: 'idle' },
  running:  { stop: 'stopping' },
  stopping: { stopped: 'idle', error: 'idle' },
};
```

`stopped` transitions back to `idle` (not a separate `stopped` state) — keeps Phase 1 simple; the user can start again after stopping.

`KeyManager.destroy()` method IS implemented in Phase 1 with `Uint8Array.fill(0)` + null, but there is no Destroy button and no `destroyed` state until Phase 2. The method exists to satisfy `KeyManager` completeness and PITFALLS Pitfall 1 prevention from day one.

**Why:** COORD-03, SEC-01, SEC-02, SEC-04, SEC-04 are all Phase 2. Building the destroy UI in Phase 1 adds scope; the security-critical zero-fill logic belongs in `KeyManager` regardless, so stub the method now.

---

### 3. Playwright Mock Relay

**Decision:** Minimal NIP-01 WebSocket server using the `ws` npm package as a Playwright global fixture.

Minimum behavior the mock must implement:
1. Accept WebSocket connections (keeps them open)
2. Parse incoming JSON; respond to `["REQ", subId, ...filters]` with `["EOSE", subId]`
3. Accept `["CLOSE", subId]` silently
4. Accept `["EVENT", ...]` with `["OK", eventId, true, ""]`
5. On fixture teardown (`afterEach`), close the server — not just individual connections

The mock listens on a fixed port (e.g., `8765`) configurable via `process.env.MOCK_RELAY_PORT`. Playwright `webServer` config uses `vite preview` (not `vite dev`) against the pre-built artifact.

**Why:** PITFALLS "never" list bans public relays (flaky, slow, CI budget). The mock only needs enough NIP-01 to let `ApplesauceRelayPool` see itself as connected and `NostrServerTransport` to transition to `running`. If the SDK needs more protocol coverage, discover it during implementation and extend the mock — do not over-engineer up front.

---

### 4. App Layout + UI Structure

**Decision:** Single-column layout, three sections.

```
┌─────────────────────────────────┐
│  CORDN BROWSER    [npub display]│  ← header (flex row)
├─────────────────────────────────┤
│         ● RUNNING               │  ← status badge (large, centered, primary)
│   [  START  ]  [  STOP  ]       │  ← lifecycle buttons (below badge)
│   error banner (if any)         │
├─────────────────────────────────┤
│  RELAY CONFIGURATION  [🔒 LOCK] │  ← relay config panel header
│  wss://relay.example.com  [×]  │
│  [+ Add relay URL]   [EDIT]     │
└─────────────────────────────────┘
```

Tailwind base: `bg-black text-green-400 font-mono min-h-screen p-4`

Status badge colors:
- `idle` → `text-gray-500`
- `starting` / `stopping` → `text-yellow-400` (with pulsing animation)
- `running` → `text-green-400`

Lock indicator: Unicode `⊘` (locked) / `✎` (editable) in the relay panel header — no icon library.

Phase 1 has no Destroy button — that's Phase 2.

**Default relay list:** Start with one default relay: `wss://relay.damus.io` pre-populated in `ConfigStore`. This gives the user something to work with immediately.

**Why:** Requirements mandate status badge as primary visual element (UI-02). Single-column keeps DOM complexity minimal for a single-screen app. Unicode characters replace icons (UI-01).

---

### 5. `beforeunload` Teardown

**Decision:** Register a synchronous `beforeunload` handler in `main.ts` at app startup.

```typescript
// main.ts — after mounting App
window.addEventListener('beforeunload', () => {
  coordinator.stopSync(); // synchronous path only — no await
});
```

`CoordinatorStore` exposes `stopSync(): void` that calls `transport?.close()` directly (the WebSocket `close()` method, not an async coordinator stop). This is separate from the async `stop()` action that drives state machine transitions.

**Why:** Pitfall 4 in PITFALLS.md — `$effect` cleanup is not guaranteed on tab close. `beforeunload` runs synchronously. Browsers ignore promises from `beforeunload` handlers, so the sync path must not use `await`.

---

### 6. File Structure (Phase 1 Target)

```
src/
├── coordinator/
│   ├── coordinator.svelte.ts   # CoordinatorStore class singleton
│   ├── state-machine.ts        # pure transition(status, event) function
│   └── types.ts                # CoordinatorStatus, CoordinatorEvent
├── crypto/
│   └── key-manager.ts          # KeyManager: generate, hexKey(), destroy()
├── config/
│   ├── config.svelte.ts        # ConfigStore: relays, editMode, enterEdit/exitEdit
│   └── config-validator.ts     # validateRelayUrl(url): string | null
├── lib/
│   └── transport.ts            # TransportFactory.create(hexKey, relayUrls)
├── components/
│   ├── LifecyclePanel.svelte   # status badge + start/stop buttons + error banner
│   ├── RelayConfigPanel.svelte # relay list + edit guard
│   └── NpubDisplay.svelte      # truncated copyable npub
├── App.svelte                  # layout root, no business logic
└── main.ts                     # Vite entry, mounts App, registers beforeunload
```

No nested component directories. No `KeyStorage` in Phase 1 (persistence is Phase 2).

---

### 7. ESLint Ban on `svelte/store`

**Decision:** ESLint rule banning `svelte/store` imports must be in the initial ESLint config committed in plan 01-01.

Use `no-restricted-imports` rule:
```json
{ "no-restricted-imports": ["error", { "paths": [{ "name": "svelte/store" }] }] }
```

**Why:** Pitfall 3 in PITFALLS.md — mixed runes/stores causes undefined reactivity. Enforcing at lint time prevents the pattern from entering the codebase even as a "quick fix" during implementation.

---

## CI Budget

Phase 1 target: lint → vitest → playwright in under 4 minutes.

- Vitest: < 30s (pure function tests, no DOM)
- `vite build` (done once, artifact reused by Playwright): < 60s
- Playwright (3 e2e flows against mock relay + `vite preview`): < 90s
- Lint: < 30s

Total: ~3.5 minutes. If Playwright exceeds budget, reduce browser count to Chromium-only.

---

## Deferred to Phase 2

- Destroy action + confirm dialog (COORD-03, SEC-01, SEC-02, SEC-04)
- Key persistence (PERSIST-*)
- Per-relay connection status inline (RELAY-06)
- Passphrase prompt on page load
- Wrong passphrase error (ERR-03)

---

## Claude's Discretion (Headless Mode)

The following were decided autonomously (no user input available):

1. **`stopped` → `idle` (no separate `stopped` state):** Keeps Phase 1 state machine minimal; restart path doesn't require a new state. If Phase 2 needs it for post-destroy UX, it can be added then.

2. **Default relay `wss://relay.damus.io`:** Well-known, stable public relay. Good for dev/demo without requiring user setup on first load.

3. **Mock relay port `8765`:** Arbitrary but clear; avoids common ports (3000, 8080). Configurable via env var if needed.

4. **`stopSync()` vs reusing `stop()`:** The async `stop()` drives state machine transitions that trigger Svelte reactivity. `beforeunload` needs a raw synchronous path. Two separate methods are cleaner than forcing async code through a sync gate.

5. **No `ResourceMonitor` component in Phase 1:** TELEMETRY-* requirements are all Phase 3. The component directory will have 3 components: `LifecyclePanel`, `RelayConfigPanel`, `NpubDisplay`. `ResourceMonitor` is built in plan 03-01.
