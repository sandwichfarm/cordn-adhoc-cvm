# Phase 2: Security & Persistence - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 hardens the coordinator's key lifecycle: the user can opt in to encrypted key persistence (PBKDF2 + AES-GCM), the destroy action is fully confirmed and cryptographically clean (sync zero-fill + storage clear), per-relay connection status is visible inline in the relay list, and passphrase errors surface as inline feedback. After Phase 2, the coordinator can survive browser restarts and be safely wiped on demand.

**Requirements in scope:** COORD-03, RELAY-06, PERSIST-01..06, SEC-01, SEC-02, SEC-04, ERR-02, ERR-03, TEST-02, TEST-07

**Out of scope for Phase 2:**
- Resource telemetry (Phase 3)
- nsite deploy pipeline (Phase 3)
- NIP-42 relay authentication (v2)
- Key import from existing nsec (v2)

</domain>

<decisions>
## Implementation Decisions

### 1. KeyStorage: File Structure and API

**D-01:** New file `src/crypto/key-storage.ts` with a dedicated `KeyStorage` class. `KeyManager` gains a `static fromBytes(secretKey: Uint8Array): KeyManager` factory method (exposes the existing private constructor).

```typescript
// src/crypto/key-storage.ts
const STORAGE_KEY = 'cordn:v1:persistence';
export const PBKDF2_ITERATIONS = 600_000; // NIST SP 800-132 current recommendation

interface PersistedBlob {
  version: 1;
  pbkdf2Iterations: number;
  salt: string;       // base64url
  iv: string;         // base64url
  ciphertext: string; // base64url
}

export class KeyStorage {
  hasPersisted(): boolean
  async save(secretKey: Uint8Array, passphrase: string): Promise<void>
  async load(passphrase: string): Promise<Uint8Array>  // throws WrongPassphraseError
  clear(): void  // synchronous — no await
}

export const keyStorage = new KeyStorage();
```

**D-02:** `WrongPassphraseError` is a named class (`class WrongPassphraseError extends Error`) for catch-clause type narrowing in the passphrase prompt flow.

**D-03:** localStorage schema: single blob at key `cordn:v1:persistence`. Only the encrypted key is persisted in this blob. Superseded 2026-06-23: relay/runtime configuration now persists separately as non-secret browser config.

**D-04:** PBKDF2 at `600_000` iterations (NIST SP 800-132 current recommendation). This satisfies the `≥ 100,000` requirement (PERSIST-03) while meeting the security bar recommended in PITFALLS.md. Defined as a named constant, not a magic number.

**D-05:** Web Crypto API only (`crypto.subtle`) — no Node.js crypto. Key derivation: PBKDF2-SHA-256; encryption: AES-GCM 256-bit; salt: 16 random bytes; IV: 12 random bytes.

---

### 2. Passphrase Prompt Flow (PERSIST-04, ERR-03)

**D-06:** `CoordinatorStore` gets `loadState = $state<'prompting' | 'ready'>()` and `keyManager = $state<KeyManager | null>(null)`. On construction:
- If `keyStorage.hasPersisted()` is false: `this.keyManager = KeyManager.generate(); this.loadState = 'ready'`
- If `keyStorage.hasPersisted()` is true: `this.keyManager = null; this.loadState = 'prompting'`

All `CoordinatorStore` methods that touch `keyManager` use `this.keyManager!` (safe because the UI gates on `loadState === 'ready'`).

**D-07:** New component `PassphrasePrompt.svelte` — a full-screen overlay rendered in `App.svelte` when `coordinatorStore.loadState === 'prompting'`. It replaces the main UI entirely (not a modal layered on top). Contains: passphrase input, "Unlock" button, inline error for wrong passphrase (ERR-03), and "Generate a new key instead" button that calls `coordinatorStore.generateFreshKey()`.

**D-08:** `CoordinatorStore` methods added:
```typescript
async loadFromPassphrase(passphrase: string): Promise<void>
// On success: this.keyManager = KeyManager.fromBytes(bytes); this.loadState = 'ready'
// On WrongPassphraseError: sets this.passphraseError; does NOT change loadState

generateFreshKey(): void
// Clears storage, generates new KeyManager, sets loadState = 'ready'
```

---

### 3. Per-Relay Connection Status (RELAY-06, ERR-02)

**D-09:** Optimistic tracking model. `CoordinatorStore` gets:
```typescript
relayStatuses = $state<Record<string, RelayConnectionStatus>>({});
// type RelayConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'
```

Lifecycle:
- `start()` call: set all enabled relay URLs to `'connecting'`
- On `started` (transport connect resolves): set all to `'connected'`
- On `error` (transport connect throws): set all to `'error'`
- `stop()` / `destroy()`: reset all to `'idle'` / clear `{}`

**D-10:** During implementation, check if `NostrServerTransport` exposes relay pool events (e.g., connection/disconnection events on the transport object). If available, wire them to update `relayStatuses` per-relay. If not available, the optimistic model is sufficient for Phase 2.

**D-11:** `RelayConfigPanel.svelte` is extended to render per-relay status badge inline in each relay row. Status badge: `'idle'` = no badge; `'connecting'` = `⟳` yellow pulse; `'connected'` = `●` green; `'error'` = `✗` red. The badge only appears when coordinator is in `running` or `stopping` state.

---

### 4. Destroy Flow (COORD-03, SEC-01, SEC-02, SEC-04)

**D-12:** Destroy button is added to `LifecyclePanel.svelte` inline (no new component). A native `<dialog>` element provides the confirmation step (SEC-04). Dialog is opened with `.showModal()` on button click; user must confirm before execution.

**D-13:** Destroy is available only when `status === 'idle' || status === 'running'`. Button is disabled during `'starting'` and `'stopping'` (COORD-05). If `running` when confirmed, the sequence is: `stop()` (async) → synchronous destroy block.

**D-14:** The synchronous destroy block (SEC-02 — no `await` between operations):
```typescript
// In CoordinatorStore.destroy():
this.keyManager!.destroy();   // fill(0) on Uint8Array
keyStorage.clear();            // localStorage.removeItem — synchronous
// then:
this.keyManager = KeyManager.generate();
this.persistenceEnabled = false;
this.relayStatuses = {};
this.status = 'idle'; // via direct assignment, not a state machine event
this.error = null;
```

**D-15:** After destroy, the app immediately shows a fresh coordinator identity (new `KeyManager.generate()`). No `destroyed` state is added to the state machine. The app resets to the same initial state as a first-ever page load with no stored key.

---

### 5. Persistence Enable/Disable UI (PERSIST-01, PERSIST-02, PERSIST-05)

**D-16:** New component `PersistencePanel.svelte` placed below `RelayConfigPanel` in the main layout. It shows current persistence state:
- **Disabled:** "Key persistence is off — your coordinator identity resets on page reload." + "Enable persistence" button
- **Enabling:** inline expand form with passphrase + confirm passphrase inputs + "Save" button + "Cancel"
- **Enabled:** "Persistence enabled — key is encrypted in storage." + "Remove saved key" button

**D-17:** `CoordinatorStore` gets `persistenceEnabled = $state<boolean>(false)`. Set to `true` after `enablePersistence()` succeeds, `false` after `disablePersistence()` or `destroy()`.

```typescript
async enablePersistence(passphrase: string, confirmPassphrase: string): Promise<void>
// Validates passphrase === confirmPassphrase; calls keyStorage.save(); sets persistenceEnabled = true

disablePersistence(): void
// Calls keyStorage.clear(); sets persistenceEnabled = false
```

---

### Claude's Discretion

The following were decided autonomously (no user input available):

1. **600,000 PBKDF2 iterations (not 100,000):** Requirements say `≥ 100,000`; NIST currently recommends 600,000; PITFALLS.md cites 600,000 as the security bar. Using the higher value costs ~6x more CPU on each encrypt/decrypt (~600ms on modern hardware) but is negligible for a one-time operation. Named constant so it's easy to audit.

2. **No `destroyed` state in the state machine:** The requirements say "resets UI to initial state" — a fresh `idle` state with a new key is identical to initial state. Adding a `destroyed` state would require handling it everywhere `status` is read. Reset-to-idle is cleaner.

3. **`PassphrasePrompt` replaces the main UI (not an overlay modal):** The app is a single-screen tool; showing a passphrase prompt as a full-page replacement is less visually noisy than a modal. Stays consistent with the "no gradients, no decorative chrome" aesthetic.

4. **Superseded 2026-06-23:** Relay/runtime configuration now persists across page loads as non-secret browser config. Key material remains separately encrypted.

5. **Native `<dialog>` for confirm:** No third-party modal library; no custom overlay component. `<dialog>` is the browser-native confirm pattern, aligns with the cypherpunk minimal-dependency aesthetic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — COORD-03, RELAY-06, PERSIST-01..06, SEC-01, SEC-02, SEC-04, ERR-02, ERR-03, TEST-02, TEST-07 (Phase 2 requirements)

### Project Context
- `.planning/PROJECT.md` — constraints, out-of-scope, key decisions table
- `.planning/ROADMAP.md` — Phase 2 plan definitions (02-01, 02-02, 02-03)

### Prior Phase Context
- `.planning/phases/01-core-foundation/01-CONTEXT.md` — SDK import strategy, state machine shape, file structure, ESLint ban on svelte/store, established UI patterns

### Research
- `.planning/research/PITFALLS.md` — Pitfall 1 (key zero-fill), Pitfall 5 (non-atomic localStorage write), Security Mistakes table (PBKDF2 iteration count, AES-GCM)
- `.planning/research/ARCHITECTURE.md` — component responsibilities, singleton patterns
- `.planning/research/STACK.md` — exact package versions, Web Crypto API usage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/crypto/key-manager.ts` — `KeyManager` class with `destroy()` (fill(0) + null); needs `static fromBytes(secretKey: Uint8Array)` factory added in plan 02-01
- `src/coordinator/coordinator.svelte.ts` — `CoordinatorStore` with `start()`, `stop()`, `stopSync()`; Phase 2 extends this class (does not replace it)
- `src/coordinator/state-machine.ts` — `transitionCoordinator()` and `isConfigLocked()` remain unchanged in Phase 2
- `src/components/RelayConfigPanel.svelte` — relay row layout (grid: `grid-cols-[auto_1fr_auto]`) is extended with a 4th column for status badge
- `src/components/LifecyclePanel.svelte` — Destroy button + `<dialog>` added inline; color palette already established

### Established Patterns
- **Runes only:** `$state`, `$derived`, `$effect` — no `svelte/store` (ESLint-enforced)
- **Class singletons:** `coordinatorStore`, `configStore`, `transportFactory` — Phase 2 adds `keyStorage`
- **UI colors:** green `#87ff9f`, yellow `#f1f58f`, red `#ff8f8f`, gray `#6d746f`, background `#050805`; all new components must use this palette
- **Named imports from `@contextvm/sdk`:** never barrel import
- **Error display:** inline text in red `#ff8f8f`, not toast/popup; see `LifecyclePanel` error banner and `RelayConfigPanel` relay error

### Integration Points
- `CoordinatorStore` constructor: Phase 2 adds a `keyStorage.hasPersisted()` check before `KeyManager.generate()` — this is the only startup change
- `CoordinatorStore.start()`: extended to populate `relayStatuses` before calling `transportFactory.create()`
- `App.svelte`: adds conditional render — `{#if coordinatorStore.loadState === 'prompting'} <PassphrasePrompt /> {:else} ... main UI ... {/if}`
- `src/main.ts`: `beforeunload` handler already registered; no changes needed

</code_context>

<specifics>
## Specific Requirements

- **PBKDF2 constant name:** `PBKDF2_ITERATIONS` exported from `key-storage.ts` — Vitest tests must import and use this constant (not hardcode 600000)
- **WrongPassphraseError class:** named error class, not a generic `Error` with a message check — allows type-safe catch
- **SEC-02 enforcement:** The only `await` in the destroy flow may occur BEFORE the synchronous block (stopping the transport). Once `keyManager.destroy()` begins, no `await` until the synchronous block completes. The `keyStorage.clear()` call is synchronous (`localStorage.removeItem`).
- **`<dialog>` usage:** Use the native HTML `<dialog>` element with `.showModal()`. Do not simulate with `{#if showConfirm}` visibility toggling (no focus trap, no accessible modal semantics).
- **Relay status types:** `RelayConnectionStatus` type exported from `src/coordinator/types.ts` (not defined inline in the store)

</specifics>

<deferred>
## Deferred Ideas

- **ApplesauceRelayPool event wiring:** If `NostrServerTransport` exposes per-relay events, wire them to `relayStatuses`. This is a "bonus" during implementation — the optimistic model is the fallback. Full event-driven relay status belongs in Phase 3's `ResourceMonitor` work if needed.
- **Relay config persistence:** Persisting the relay list alongside the key would mean one fewer "re-add your relays" step for users. Deferred: no PERSIST-* requirement covers it; adds complexity to the blob schema; Phase 3 can add it if validated.
- **Passphrase strength indicator:** Visual feedback on passphrase quality. Deferred: no requirement; adds UI complexity; out of scope for Phase 2.
- **Key backup / nsec export:** Showing the nsec (in a reveal modal) so users can back it up before enabling persistence. Deferred: IMPORT-01/02 are v2 requirements; Phase 2 is about persistence only.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Security & Persistence*
*Context gathered: 2026-06-23*
