# Architecture Research

**Domain:** Browser-resident Nostr/MCP coordinator (single-page app, no backend)
**Researched:** 2026-06-23
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Svelte 5 UI Layer                         │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ LifecyclePanel   │  │ RelayConfigPanel │  │ ResourceMonitor│  │
│  │ (start/stop/     │  │ (add/remove/     │  │ (subs, rate,   │  │
│  │  destroy)        │  │  edit guard)     │  │  memory est.)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬────────┘  │
│           │                     │                    │            │
├───────────┴─────────────────────┴────────────────────┴───────────┤
│                   Coordinator State Machine (.svelte.ts)           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  CoordinatorStore: $state { status, config, stats, error } │   │
│  │  Actions: start() stop() destroy() enterEdit() exitEdit()  │   │
│  └────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                        Service Layer (.ts)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  KeyManager  │  │ KeyStorage   │  │  TransportFactory    │   │
│  │  (Uint8Array │  │  (AES-GCM +  │  │  (NostrServerTransp- │   │
│  │   zero-fill) │  │   PBKDF2)    │  │   ort instantiation) │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│               @contextvm/sdk Transport Layer                      │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  NostrServerTransport(signer, relayHandler)             │     │
│  │    ├── PrivateKeySigner(hexKey)                         │     │
│  │    └── ApplesauceRelayPool(urls[])                      │     │
│  └─────────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                  Nostr Network (WebSocket)                        │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐                  │
│  │  relay 1  │   │  relay 2  │   │  relay N  │                  │
│  └───────────┘   └───────────┘   └───────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `CoordinatorStore` | Reactive state + action dispatch; single source of truth | Class with `$state` fields in `.svelte.ts` |
| `StateMachine` | Pure transition logic for coordinator lifecycle; validates legal transitions | Plain `.ts` — no Svelte coupling |
| `KeyManager` | Holds live `Uint8Array` key; exposes zero-fill on destroy | Plain `.ts` class |
| `KeyStorage` | Encrypt/decrypt nsec to localStorage via Web Crypto | Plain `.ts` — PBKDF2 + AES-GCM |
| `TransportFactory` | Constructs `NostrServerTransport` with signer + relay pool | Plain `.ts` factory function |
| `LifecyclePanel` | Start / stop / destroy buttons; status badge | `.svelte` component |
| `RelayConfigPanel` | Relay URL list; edit-guard lock/unlock; add/remove | `.svelte` component |
| `ResourceMonitor` | Active subscription count; message rate; memory estimate | `.svelte` component |
| `App.svelte` | Root layout; wires panels together; no business logic | `.svelte` root |

## Recommended Project Structure

```
src/
├── coordinator/
│   ├── coordinator.svelte.ts     # reactive state singleton + action methods
│   ├── state-machine.ts          # pure transition table (Vitest-testable)
│   └── types.ts                  # CoordinatorStatus enum, CoordinatorState type
├── crypto/
│   ├── key-manager.ts            # Uint8Array lifecycle: generate, hold, zero-fill
│   └── key-storage.ts            # PBKDF2 + AES-GCM encrypt/decrypt to localStorage
├── config/
│   ├── config.svelte.ts          # relay config reactive state, edit-guard flag
│   └── config-validator.ts       # relay URL validation (pure, Vitest-testable)
├── components/
│   ├── LifecyclePanel.svelte     # start/stop/destroy UI
│   ├── RelayConfigPanel.svelte   # relay list with edit guard
│   └── ResourceMonitor.svelte    # stats display
├── lib/
│   └── transport.ts              # NostrServerTransport factory function
├── App.svelte                    # root, no logic
└── main.ts                       # Vite entry, mounts App
```

### Structure Rationale

- **`coordinator/`:** State machine and reactive store are co-located but separated: `state-machine.ts` has no Svelte dependency (pure function, Vitest-friendly), while `coordinator.svelte.ts` owns the `$state` and calls the machine.
- **`crypto/`:** Key security is isolated from coordinator logic so it can be audited independently. `key-manager.ts` never touches localStorage; `key-storage.ts` never holds the live key — single-responsibility enforces the security boundary.
- **`config/`:** Config validator is pure (testable). Config state is reactive but separate from coordinator state — the edit guard can be locked/unlocked without touching coordinator lifecycle.
- **`components/`:** Flat component list is intentional — this is a single-screen app. No nested component directories unless complexity grows.
- **`lib/transport.ts`:** Transport construction is isolated from the state store so tests can swap it for a mock without touching reactivity.

## Architectural Patterns

### Pattern 1: Class-Based Svelte 5 Rune Singleton

**What:** A class with `$state` property fields exported as a singleton from a `.svelte.ts` file. UI components import the singleton and read fields directly — no prop drilling, no context API.

**When to use:** Global coordinator state that multiple panels need — status, active relay list, stats.

**Trade-offs:** Simpler than context for a single-screen app; slightly harder to unit-test than a plain function, but the underlying state machine remains pure.

**Example:**
```typescript
// src/coordinator/coordinator.svelte.ts
class CoordinatorStore {
  status = $state<CoordinatorStatus>('idle');
  stats  = $state({ subscriptions: 0, messageRate: 0, memoryBytes: 0 });
  error  = $state<string | null>(null);

  async start(relays: string[], hexKey: string) {
    const next = transition(this.status, 'start');
    if (!next) return;
    this.status = next;
    // ... instantiate transport, connect
  }
}

export const coordinator = new CoordinatorStore();
```

### Pattern 2: Pure State Machine Transition Table

**What:** A plain TypeScript function `transition(current, event) → next | null` driven by a lookup table. `null` means illegal transition — caller ignores or surfaces an error.

**When to use:** Coordinator lifecycle (idle → starting → running → stopping → stopped → destroyed). Keeps guard logic out of action methods and makes all legal paths testable with Vitest without a DOM.

**Trade-offs:** More ceremony than ad-hoc status checks, but prevents impossible states (e.g., starting a running coordinator) without scattered `if` guards.

**Example:**
```typescript
// src/coordinator/state-machine.ts
type Status = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'destroyed';
type Event  = 'start' | 'started' | 'stop' | 'stopped' | 'destroy' | 'error';

const TABLE: Record<Status, Partial<Record<Event, Status>>> = {
  idle:     { start: 'starting', destroy: 'destroyed' },
  starting: { started: 'running', error: 'idle', destroy: 'destroyed' },
  running:  { stop: 'stopping', destroy: 'destroyed' },
  stopping: { stopped: 'stopped', error: 'stopped' },
  stopped:  { start: 'starting', destroy: 'destroyed' },
  destroyed: {},
};

export function transition(current: Status, event: Event): Status | null {
  return TABLE[current]?.[event] ?? null;
}
```

### Pattern 3: Web Crypto Key Lifecycle (Generate → Encrypt → Zero-Fill)

**What:** Keys live as `Uint8Array` in memory. Persistence is opt-in: the user provides a passphrase, PBKDF2 derives an AES-GCM key, and only the encrypted ciphertext is written to `localStorage`. On destroy, the in-memory array is zero-filled before GC can collect it.

**When to use:** The coordinator nsec must never leave the browser unencrypted, and the destroy action must be cryptographically clean.

**Trade-offs:** Slightly more complex than storing the raw hex string; non-negotiable for the security contract this project makes.

**Example:**
```typescript
// src/crypto/key-manager.ts
export class KeyManager {
  private key: Uint8Array | null = null;

  generate(): void {
    this.key = generateSecretKey(); // nostr-tools
  }

  hexKey(): string {
    if (!this.key) throw new Error('no key');
    return bytesToHex(this.key);
  }

  destroy(): void {
    this.key?.fill(0);
    this.key = null;
  }
}

// src/crypto/key-storage.ts
// PBKDF2 → CryptoKey → AES-GCM encrypt nsec hex → store {ciphertext, iv, salt}
export async function persistKey(hexKey: string, passphrase: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(hexKey),
  );
  localStorage.setItem('cordn:key', JSON.stringify({
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
  }));
}
```

### Pattern 4: Edit Guard for Config Mutations

**What:** Config state has an `editMode: boolean` flag. Relay URL mutations are only allowed when `editMode === true`. Entering edit mode is blocked while the coordinator is `running`. A confirm dialog is shown before editing while `stopped` (relay list wipe is irreversible).

**When to use:** Any user-facing config that could cause data loss if modified accidentally.

**Trade-offs:** One extra click — worth it. Prevents relay list wipe while a coordinator is live.

**Example:**
```typescript
// src/config/config.svelte.ts
class ConfigStore {
  relays   = $state<string[]>(['wss://relay.damus.io']);
  editMode = $state(false);

  enterEdit(coordinatorStatus: CoordinatorStatus) {
    if (coordinatorStatus === 'running') return; // blocked
    this.editMode = true;
  }

  exitEdit() { this.editMode = false; }
  addRelay(url: string) { if (this.editMode) this.relays.push(url); }
  removeRelay(url: string) { if (this.editMode) this.relays = this.relays.filter(r => r !== url); }
}

export const config = new ConfigStore();
```

## Data Flow

### Coordinator Start Flow

```
User clicks "Start"
    ↓
LifecyclePanel → coordinator.start()
    ↓
StateMachine.transition('idle', 'start') → 'starting'  [sets $state]
    ↓
KeyManager.generate()  OR  KeyStorage.loadKey(passphrase)
    ↓
TransportFactory.create(hexKey, relayUrls)
    → new PrivateKeySigner(hexKey)
    → new ApplesauceRelayPool(relayUrls)
    → new NostrServerTransport({ signer, relayHandler })
    ↓
transport.start()  [connects WebSockets, publishes announcement event]
    ↓
StateMachine.transition('starting', 'started') → 'running' [sets $state]
    ↓
ResourceMonitor polls stats via transport internals
```

### Coordinator Destroy Flow

```
User clicks "Destroy"
    ↓
coordinator.destroy()
    ↓
transport.close()          [disconnects WebSockets]
    ↓
KeyManager.destroy()       [key.fill(0); key = null]
    ↓
localStorage.removeItem('cordn:key')
    ↓
StateMachine.transition(current, 'destroy') → 'destroyed' [sets $state]
    ↓
UI shows "destroyed" state; no restart possible without page reload
```

### Key Persistence Flow (opt-in)

```
User enables persistence → prompted for passphrase
    ↓
KeyStorage.persistKey(coordinator.hexKey(), passphrase)
    ↓
PBKDF2(passphrase, salt, 100000 iters, SHA-256) → CryptoKey
    ↓
AES-GCM encrypt(hexKey bytes) → ciphertext
    ↓
localStorage.setItem('cordn:key', JSON.stringify({ciphertext, iv, salt}))

On next load:
localStorage.getItem('cordn:key') → JSON.parse → KeyStorage.loadKey(passphrase)
    ↓
PBKDF2(passphrase, stored salt) → CryptoKey → AES-GCM decrypt → hexKey
    ↓
KeyManager holds Uint8Array from hexToBytes(hexKey)
```

### State Reactivity Flow

```
coordinator.status ($state)
    ↓ (Svelte fine-grained reactivity — only components reading .status re-render)
LifecyclePanel reads coordinator.status → shows status badge + enabled/disabled buttons
RelayConfigPanel reads coordinator.status → disables edit when 'running'
ResourceMonitor reads coordinator.stats → updates counters
```

## Scaling Considerations

This is a single-user, single-tab browser app. Classical web scaling is irrelevant. The meaningful resource constraints are browser-specific:

| Concern | Browser Reality | Mitigation |
|---------|-----------------|------------|
| WebSocket connections | Browsers limit ~256 concurrent WS connections per tab | Keep relay list small (3-10); ApplesauceRelayPool manages pooling |
| Memory / key exposure | GC timing is non-deterministic | `Uint8Array.fill(0)` before nulling; short-lived CryptoKey for AES |
| Message throughput | High-frequency Nostr events block the main thread | Transport uses async queues internally; no blocking loops in UI |
| `localStorage` quota | Typically 5-10 MB per origin | Stored key blob is ~200 bytes; no concern |
| CI Playwright runtime | Playwright is slow; CI budget is 4 minutes | Mock relay via `ws` fixture; avoid live relay in tests |

## Integration Points

### @contextvm/sdk Integration

| Integration Point | How | Notes |
|-------------------|-----|-------|
| `NostrServerTransport` | Constructed in `lib/transport.ts`, not in UI components | Isolates transport from Svelte to keep it mockable |
| `PrivateKeySigner` | Accepts hex string; wraps to `Uint8Array` internally | Do not pass `Uint8Array` directly — use hex conversion |
| `ApplesauceRelayPool` | Accepts `string[]` of relay URLs | Replace with a custom `RelayHandler` for mock relay in Playwright fixtures |
| Tree-shaking | Import named exports only from `@contextvm/sdk` | Verify Vite build does not include `NostrClientTransport` or server-side Node transports; check bundle with `vite-bundle-visualizer` |

### Browser API Integration

| API | Use | Notes |
|-----|-----|-------|
| `crypto.subtle` | PBKDF2 key derivation + AES-GCM encrypt/decrypt | Always available in modern browsers; no polyfill needed |
| `crypto.getRandomValues` | Salt + IV generation | Never use `Math.random()` for cryptographic material |
| `localStorage` | Store encrypted key blob only; never plaintext | Key: `cordn:key`. Remove atomically on destroy. |
| `performance.memory` | Memory estimate for resource monitor | Non-standard; only in Chromium; feature-detect before use |
| WebSocket | Managed entirely by ApplesauceRelayPool / applesauce-relay | No direct WS usage in app code |

### Test Fixtures

| Boundary | Test Approach |
|----------|--------------|
| State machine transitions | Vitest unit tests on `state-machine.ts` — pure function, no DOM |
| Key manager zero-fill | Vitest: generate key, destroy, assert bytes are all 0 |
| Key storage encrypt/decrypt | Vitest with `@happy-dom/global-registrar` or jsdom for `crypto.subtle` |
| Config validator | Vitest: valid/invalid URL edge cases |
| E2E start/stop/destroy | Playwright with mock relay (`ws` WebSocket server in fixture) |
| E2E edit guard | Playwright: assert relay form is locked while coordinator is running |

## Anti-Patterns

### Anti-Pattern 1: Storing nsec in Plain localStorage

**What people do:** `localStorage.setItem('key', privateKey)` as a shortcut for persistence.

**Why it's wrong:** Any XSS on the page extracts the key permanently. localStorage has no access control.

**Do this instead:** PBKDF2 + AES-GCM with user-supplied passphrase; zero-fill memory key on destroy.

### Anti-Pattern 2: Svelte Stores Alongside Runes

**What people do:** Import `writable` from `svelte/store` in `.svelte.ts` files for coordinator state.

**Why it's wrong:** Svelte 5 runes and stores are two separate reactivity systems. Mixing them creates subtle subscription bugs and breaks the compiler's fine-grained update optimization.

**Do this instead:** `$state` on class fields in `.svelte.ts` files exclusively. If a third-party library needs a store, wrap it in a derived rune at the boundary.

### Anti-Pattern 3: Business Logic in .svelte Components

**What people do:** Put `transition()` calls, crypto operations, or transport construction inside `<script>` blocks.

**Why it's wrong:** Makes business logic untestable without a DOM; couples state machine to component lifecycle.

**Do this instead:** Components call methods on `coordinator` / `config` singletons and read reactive `$state`. No crypto, no state machine calls inside components.

### Anti-Pattern 4: Importing Entire @contextvm/sdk

**What people do:** `import * as sdk from '@contextvm/sdk'` or top-level barrel imports.

**Why it's wrong:** SDK exports `NostrClientTransport` and other pieces that may reference Node.js built-ins (`node:events`, `node:stream`). Vite will fail or bundle dead code.

**Do this instead:** Named imports only: `import { NostrServerTransport, ApplesauceRelayPool, PrivateKeySigner } from '@contextvm/sdk'`. Run `vite build` and check for Node polyfill warnings before shipping.

### Anti-Pattern 5: Reinitializing Transport Without Destroying Old One

**What people do:** Call `start()` again after `stop()` by creating a new transport instance without explicitly closing the previous one.

**Why it's wrong:** `ApplesauceRelayPool` keeps WebSocket connections open. Two instances on the same relays causes duplicate subscriptions and split state.

**Do this instead:** State machine enforces `stopped → starting` requires the previous transport's `close()` to have resolved. Transport reference is nulled after close before a new one is created.

## Sources

- [ContextVM SDK source — NostrServerTransport](https://github.com/ContextVM/sdk/blob/main/src/transport/nostr-server-transport.ts) — HIGH confidence (primary source)
- [ContextVM SDK source — BaseNostrTransport options](https://github.com/ContextVM/sdk/blob/main/src/transport/base-nostr-transport.ts) — HIGH confidence
- [ContextVM SDK source — PrivateKeySigner](https://github.com/ContextVM/sdk/blob/main/src/signer/private-key-signer.ts) — HIGH confidence
- [ContextVM SDK source — ApplesauceRelayPool](https://github.com/ContextVM/sdk/blob/main/src/relay/applesauce-relay-pool.ts) — HIGH confidence
- [Svelte 5 global state patterns — Mainmatter](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/) — HIGH confidence (current 2025 article, corroborates official docs)
- [Web Crypto API AES-GCM browser pattern](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — HIGH confidence (MDN)
- [AES-GCM browser encryption guide](https://miguelacm.es/en/blog/aes-256-encryption-browser) — MEDIUM confidence (verified against MDN)

---
*Architecture research for: browser-resident Nostr/MCP coordinator (Cordn Browser)*
*Researched: 2026-06-23*
