# Pitfalls Research

**Domain:** Browser-based Nostr coordinator (MCP over Nostr, browser-only, cryptographic key management)
**Researched:** 2026-06-23
**Confidence:** HIGH (browser crypto, Nostr, Svelte 5 runes, CI patterns are well-understood; nsyte/nsite deploy is newer, MEDIUM for that section)

---

## Critical Pitfalls

### Pitfall 1: Private Key Not Actually Zeroed After Destroy

**What goes wrong:**
Calling `key.fill(0)` on a `Uint8Array` and then setting the reference to `null` does not guarantee the bytes are evicted from memory. The V8 GC may keep a copy alive indefinitely. The destroy action appears complete but the key lives in heap until the next GC cycle (which may never come during the tab's lifetime).

**Why it happens:**
JavaScript has no destructor semantics. Developers assume `fill(0)` is equivalent to C `memset` followed by `free`, but the GC owns the memory — `fill(0)` just zeroes the array's logical view, not any internal copies V8 may have made during JIT compilation or hidden class transitions.

**How to avoid:**
- Use `Uint8Array` for all key material from the start (never `string` or `ArrayBuffer` slice without tracking the source)
- Call `fill(0)` on the typed array immediately before releasing the reference
- Pair with `localStorage.removeItem(KEY_STORAGE_KEY)` in the same synchronous block (not in a promise chain) so a crash between the two doesn't leave encrypted material in storage
- Accept that in-memory zeroing is best-effort; document this honestly in the UI ("key wiped from memory — restart browser for full guarantee")

**Warning signs:**
- Key stored as a `string` anywhere in the codebase (strings are immutable and cannot be zeroed)
- `destroy()` function is `async` with `await` between the `fill(0)` and the `removeItem` call
- Unit test for destroy checks only that `localStorage` is clear, not that the typed array was filled

**Phase to address:** Core key management implementation (Phase 1)

---

### Pitfall 2: `@contextvm/sdk` Pulls Node.js Built-ins into the Browser Bundle

**What goes wrong:**
The SDK was designed for Node.js-first environments. Vite will emit a hard build error (or worse, a silent runtime crash) when it encounters `import { createHash } from 'node:crypto'` or `import { EventEmitter } from 'events'` deep inside the SDK's dependency tree. Even if Vite polyfills some builtins, the polyfill behavior diverges from Node's, causing subtle bugs in encryption.

**Why it happens:**
Many Nostr libraries use the Node `crypto` module directly rather than the Web Crypto API (`globalThis.crypto.subtle`). Tree-shaking only works if the SDK is written with explicit browser/server split exports (`exports.browser` in package.json). A single SDK with only a main entry point will be pulled in wholesale.

**How to avoid:**
- Run `vite build --mode production` in the very first commit and check the output for `__vite_externalized` warnings or polyfill banners
- Check the SDK's `package.json` for a `browser` field or `exports` map with `browser` conditions before assuming tree-shaking will work
- If Node built-ins appear, add `resolve.alias` in `vite.config.ts` to redirect specific built-ins to browser-compatible shims (`buffer`, `events`, `process`) — but only the ones actually needed
- Audit with `npx vite-bundle-visualizer` or `npx rollup-plugin-visualizer` after the first build to catch unexpected Node modules

**Warning signs:**
- `vite build` emits warnings about externalized built-in modules
- Bundle size > 500 KB before any application code is added
- `process.env` references appear in the built output

**Phase to address:** Project scaffolding / first SDK integration (Phase 1)

---

### Pitfall 3: Svelte 5 Runes Mixed With Legacy Stores

**What goes wrong:**
Using `$: reactive` statements, `writable()` stores, or the `$store` shorthand alongside `$state`/`$derived`/`$effect` in the same component causes undefined reactivity. The compiler accepts mixed syntax but the runtime tracking diverges — a `$derived` that reads a writable store won't invalidate when the store changes, or vice versa.

**Why it happens:**
Svelte 5 runes and the legacy store contract are parallel systems maintained for backwards compatibility. Svelte 5 does not upgrade stores to runes automatically; it wraps them. A `$state` that holds a store reference and a rune that reads `.value` from it are in separate reactivity graphs.

**How to avoid:**
- Ban legacy stores entirely from day one — no `writable`, `readable`, `derived` from `svelte/store` in any `.svelte` or `.ts` file
- Use `$state` for all mutable reactive values, `$derived` for computed values, `$effect` for side effects
- Enable the Svelte ESLint plugin with `@sveltejs/eslint-plugin-svelte` rule `svelte/no-reactive-reassign` and add a custom lint rule banning the `svelte/store` import
- Run `npx svelte-check --tsconfig ./tsconfig.json` in CI; it catches many rune misuse patterns

**Warning signs:**
- Any `import { writable, readable, derived } from 'svelte/store'`
- `$:` reactive declarations in `.svelte` files
- State updates that only render correctly on forced re-mount

**Phase to address:** Project scaffolding (Phase 1) — enforce as a lint rule before any components are written

---

### Pitfall 4: WebSocket Connections Not Closed on Tab Unload

**What goes wrong:**
The coordinator's `NostrServerTransport` maintains open WebSocket connections. When the user closes the tab, Svelte's `$effect` cleanup runs only if the component is properly destroyed (it is NOT guaranteed on tab close). Relay connections remain open until the relay times out the connection, which can be 30–90 seconds. During that window, incoming encrypted messages are dropped silently, and the coordinator appears online to peers.

**Why it happens:**
`$effect` cleanup fires when the effect scope is destroyed — that happens on component unmount. But a browser tab close triggers `beforeunload` and then immediately kills the JavaScript context; the Svelte runtime doesn't have time to unmount components before the process ends.

**How to avoid:**
- Register a `window.addEventListener('beforeunload', () => coordinator.stop())` at app startup — this runs synchronously and gives the transport a chance to close WebSocket connections cleanly
- Do NOT use `async` in the `beforeunload` handler; browsers ignore promises from `beforeunload`
- For any coordinator state that must be flushed (e.g., clearing in-memory key on destroy), separate the "flush sync state" path from the "async cleanup" path and call the sync path from `beforeunload`

**Warning signs:**
- Coordinator tests show a relay still receiving messages after `stop()` is called
- Integration tests don't verify that relay connections close after the test flow
- Playwright `page.close()` in teardown causes flaky "connection reset" errors in the mock relay

**Phase to address:** Coordinator lifecycle implementation (Phase 1)

---

### Pitfall 5: `localStorage` Write Is Not Atomic for Key + Config

**What goes wrong:**
If the app writes the encrypted key and then the relay config as two separate `localStorage.setItem` calls and the tab crashes (or the user force-closes) between them, the state is inconsistent. On next load, the coordinator may try to use an encrypted key but find relay config missing, or a valid relay list but no key.

**Why it happens:**
`localStorage` has no transaction semantics. Each `setItem` call is independent. Browsers do flush `localStorage` synchronously on tab close in most cases, but a hard crash (OOM kill, OS sleep) can interrupt mid-sequence.

**How to avoid:**
- Serialize all persistent state into a single JSON blob and write it as one `setItem` call — one key per app in localStorage (e.g., `cordn:state`)
- On load, validate the blob has all required fields before using any of it; if validation fails, treat as corrupted and ask the user to re-enter their passphrase or start fresh
- Never split key material and config into separate storage keys

**Warning signs:**
- Multiple `localStorage.setItem` calls in the persistence code
- Load path doesn't validate presence of both key AND config before using either

**Phase to address:** Key persistence implementation (Phase 1)

---

### Pitfall 6: Relay List Edited While Coordinator Is Running

**What goes wrong:**
The `NostrServerTransport` is initialized with a relay list. If the UI allows the relay list to be mutated after the transport starts, the transport's internal pool does not automatically reconnect to new relays or disconnect from removed ones — the in-memory list and the active connections diverge silently. The coordinator appears to be using the new list but peers can only reach it on the old relays.

**Why it happens:**
Developers assume that mutating the reactive relay list propagates to the transport through reactivity. The transport was initialized with a snapshot of the list; it is not a live observer of the Svelte state.

**How to avoid:**
- The guarded config pattern in the requirements (`confirm-to-edit`) is the right call — enforce it strictly: config fields must be read-only when coordinator state is `running`
- Require a full stop → reconfigure → start cycle to change relay list
- Make the state machine enforce this: `RUNNING` state blocks all config mutations; transitioning to `STOPPED` is a prerequisite for entering `CONFIGURING` state

**Warning signs:**
- Relay URL input is editable in the DOM when coordinator is running
- State machine has no `CONFIGURING` state — just `running: true/false`
- E2e tests don't verify that relay inputs are disabled when coordinator is running

**Phase to address:** Coordinator state machine + GUI (Phase 1)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store coordinator state in a plain `$state` object instead of a typed state machine | Less boilerplate | Impossible to audit valid transitions; destroy/stop bugs appear in production | Never — state machine is small here |
| Use `string` type for nsec key material | Easy to pass around | Key cannot be zeroed on destroy; appears in stack traces and error messages | Never |
| Skip mock relay in Playwright; use a public relay | No fixture setup | Tests are flaky and slow; CI fails on relay downtime | Never |
| Inline Tailwind config in `vite.config.ts` instead of `tailwind.config.ts` | One less file | Tailwind v4's CSS-first config is incompatible with this pattern | Never — use v4 canonical config |
| `any` cast for SDK types that don't have browser-compatible typings | Unblocks progress | Type errors become runtime crashes | Acceptable in Phase 1 with a `// TODO:` comment; must be resolved before Phase 2 |
| Deploy manually to nsite instead of setting up CI secrets | Skip CI secret setup | Deploy is manual forever; human error in key handling | Acceptable for initial deploy validation; must be automated before shipping |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@contextvm/sdk` `NostrServerTransport` | Passing raw nsec hex string; SDK may expect `Uint8Array` or a specific key object format | Check SDK source for the exact type of the key parameter; test with a known keypair in unit tests before integrating with UI |
| Blossom upload via `nsyte` | Assuming Blossom servers allow browser `fetch` — many have restrictive CORS | `nsyte` runs in CI (Node.js), not in the browser; the browser never fetches Blossom directly in this architecture — don't add browser-side Blossom upload |
| GitHub Actions `nsite-action` | Committing `NSYTE_BUNKER_URL` to the repo (even in a branch) | Store bunker URL only in GitHub Secrets; the helper script must never write it to any file in the repo |
| Playwright with `vite preview` | Starting Playwright tests before `vite preview` is listening | Use `webServer.reuseExistingServer: false` and `webServer.waitForPort` in `playwright.config.ts` to block test start until server is ready |
| Nostr relay WebSocket (mock) | Using `ws` mock that closes connections immediately | Configure the mock relay to keep connections open for the duration of each test; close in the fixture teardown `afterEach` |
| Tailwind v4 with Svelte | Using Tailwind v3 `content` array in `tailwind.config.ts` | Tailwind v4 uses CSS `@source` directives — no JS config file needed; see Tailwind v4 + Vite integration docs |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Subscribing to all relay events in the browser without filtering | Memory grows unboundedly; tab eventually crashes or slows | Apply NIP-01 subscription filters scoped to the coordinator's pubkey; never subscribe with empty filters | Within minutes on a busy relay |
| Re-deriving keypair on every render | Subtle freeze on reactive updates that touch key state | Derive the keypair once on coordinator start; store it in a `$state` that is not reactive to UI inputs | Immediately visible on any input event |
| Storing full relay message history in `$state` | Memory grows; Svelte re-renders entire message list on each new message | Keep only a sliding window (e.g., last 100 messages) for the resource display; don't persist relay messages to state |  After ~1000 messages |
| Running `vite build` in the Playwright CI job | CI time > 4 minutes | Use `vite preview` against the already-built artifact from the `lint → build → test` pipeline; never re-build for e2e | Adds 30–60s per run, breaks CI budget |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting user-supplied relay URLs without validation | User can submit `ws://attacker.example.com`; coordinator sends encrypted traffic there — metadata leak at minimum | Validate URL scheme (`wss://` only in production), hostname, and port before adding to relay list; warn explicitly on `ws://` |
| Storing the raw nsec in localStorage without encryption | Key extracted by any XSS or browser extension with storage access | Always encrypt with `AES-GCM` + PBKDF2-derived key from user passphrase before any write to localStorage; never store plaintext |
| Using a weak PBKDF2 iteration count | Passphrase brute-force offline if localStorage is extracted | Use minimum 600,000 iterations (NIST SP 800-132 current recommendation); expose iteration count as a constant, not a magic number |
| Logging key material to the console during development | Key appears in browser DevTools console history | Never `console.log` any value derived from the nsec; use a debug flag that strips sensitive fields before logging |
| Importing `@contextvm/sdk` server-side transports into the browser bundle | Server transport code may open OS-level sockets or reference sensitive env vars | Import only `NostrServerTransport` explicitly; never do `import * from '@contextvm/sdk'`; verify with a bundle analysis step |
| NSYTE_BUNKER_URL leaking via CI logs | Deployment keypair compromised; attacker can publish to the nsite | Add `nsyte` secrets to GitHub Actions masked secrets; audit CI logs after first deploy run to confirm masking works |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback during coordinator startup | User clicks Start; nothing visible happens for 2–3 seconds while relay handshake completes; they click Start again, starting a second coordinator | Show a `STARTING` spinner state immediately on click; disable the button until state is `RUNNING` or `ERROR` |
| Destroy action without confirmation | User accidentally wipes key; key is not recoverable | Require a two-step confirm: first click shows "This will permanently delete your coordinator key. Confirm?" — second click executes |
| Showing nsec in plaintext in the UI | Key exposed to shoulder-surfing, screen recording, browser screenshots | Never display the raw nsec; show the npub (public key) for verification; if the user must see the nsec (backup), show it only in a modal with explicit "reveal" action |
| Relay status shown only as connected/disconnected | User doesn't know why a relay failed or whether messages are flowing | Show last-message timestamp per relay and a reconnection attempt counter; a relay "connected" with zero messages in 60 seconds is not working |
| Guarded config that silently ignores edits when running | User edits a relay URL while coordinator is running; save does nothing; user thinks it saved | Make config fields visually read-only (not just disabled) when running; show tooltip "Stop coordinator to edit configuration" |

---

## "Looks Done But Isn't" Checklist

- [ ] **Key destroy:** Verify with a unit test that the `Uint8Array` is filled with zeros after destroy, AND that `localStorage.getItem(KEY_STORAGE_KEY)` returns `null`
- [ ] **Relay validation:** Verify that `ws://` (non-TLS) URLs are rejected or warned — not just accepted silently
- [ ] **Coordinator start:** Verify that clicking Start twice does not create two active transports — button must be disabled while in `STARTING` state
- [ ] **vite build:** Verify the production build contains no `process.env` references and no `require()` calls — run `grep -r 'process.env\|require(' dist/`
- [ ] **Playwright CI:** Verify that the mock relay fixture closes connections in teardown — flaky "address in use" errors in CI mean it doesn't
- [ ] **nsite deploy:** Verify that `NSYTE_BUNKER_URL` appears as `***` in the Actions log — not just that the workflow runs
- [ ] **localStorage encryption:** Verify that the stored blob is not plaintext nsec — read back the raw `localStorage` value in a test and assert it is not a valid bech32 nsec
- [ ] **`vite preview` CI:** Verify tests run against the built artifact, not `vite dev` — `vite dev` has different module resolution and can mask bundling failures

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Node built-ins in bundle discovered post-launch | MEDIUM | Add Vite aliases for the specific modules; re-run build + deploy; no data loss |
| Key stored as string in an early commit | HIGH | Rotate all coordinator keypairs that ever existed; wipe localStorage for any user who ran that build; notify users |
| Legacy stores mixed with runes — subtle reactivity bug in production | HIGH | Requires component-by-component audit and rewrite; no quick patch |
| `beforeunload` teardown missing — relay connections left open | LOW | Add the handler; relay will reconnect on next start; no data loss |
| NSYTE_BUNKER_URL leaked in CI logs | HIGH | Rotate the bunker keypair immediately; revoke old secrets; re-run setup; audit who could have read the log |
| Playwright tests flaky due to no server-ready wait | LOW | Add `waitForPort` to `playwright.config.ts`; re-run CI |
| Tailwind v4 config in v3 format — styles silently dropped | LOW | Migrate to CSS `@source` directives per Tailwind v4 docs; no data loss |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Key not zeroed on destroy | Phase 1: key management | Unit test asserts `Uint8Array` is all zeros after destroy |
| SDK Node built-ins in bundle | Phase 1: scaffolding | `vite build` succeeds with no polyfill warnings; bundle analysis run |
| Svelte 5 runes/stores mixing | Phase 1: scaffolding | ESLint rule banning `svelte/store` imports; `svelte-check` in CI |
| WebSocket leak on tab close | Phase 1: coordinator lifecycle | Playwright test closes page and asserts mock relay saw clean disconnect |
| Non-atomic localStorage write | Phase 1: key persistence | Unit test simulates partial write; load path detects corruption |
| Relay list edit while running | Phase 1: state machine + GUI | E2e test asserts relay inputs are disabled in running state |
| Relay URL validation (XSS/metadata) | Phase 1: relay config panel | Unit test rejects `ws://`, non-URL, JS URI scheme |
| PBKDF2 iteration count | Phase 1: key persistence | Code review + constant defined in a single place with comment citing NIST |
| vite preview not ready in CI | Phase 2: CI setup | CI passes on first run without "connection refused" in Playwright output |
| nsite secret leaking in logs | Phase 2: deploy setup | First deploy CI run reviewed for masked output |

---

## Sources

- Nostr NIPs (NIP-01, NIP-04, NIP-44) — WebSocket subscription filters and encryption schemes
- Web Crypto API MDN documentation — `SubtleCrypto.deriveKey`, PBKDF2, AES-GCM
- NIST SP 800-132 — PBKDF2 iteration count guidance (600,000 minimum as of 2023)
- Svelte 5 runes migration guide — runes vs. stores incompatibility
- Vite browser build documentation — `resolve.alias`, `define`, and built-in module externalization
- Playwright `webServer` configuration docs — `waitForPort`, `reuseExistingServer`
- Tailwind v4 migration guide — CSS-first configuration, `@source` directives
- `@contextvm/sdk` v0.6.2 source (per project context) — transport initialization API
- GitHub Actions secrets masking docs — automatic masking of registered secrets in logs

---
*Pitfalls research for: browser-based Nostr coordinator (Cordn Browser)*
*Researched: 2026-06-23*
