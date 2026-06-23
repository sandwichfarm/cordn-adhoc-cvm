# Requirements: Cordn Browser

**Defined:** 2026-06-23
**Core Value:** A single browser tab acts as a fully functional, self-sovereign Cordn coordinator reachable over Nostr relays — no backend, no account, no installation.

## v1 Requirements

### Key Generation & Identity (KEYGEN)

- [ ] **KEYGEN-01**: On first load, app generates a unique secp256k1 keypair (nsec + npub) without user input
- [ ] **KEYGEN-02**: The generated npub is displayed in the UI as a truncated, copyable text field
- [ ] **KEYGEN-03**: Clicking the npub display copies the full pubkey hex to clipboard and shows confirmation
- [ ] **KEYGEN-04**: The nsec is never displayed in plaintext anywhere in the UI
- [ ] **KEYGEN-05**: The nsec is never written to localStorage without encryption

### Coordinator Lifecycle (COORD)

- [ ] **COORD-01**: Clicking "Start" transitions coordinator through `idle → starting → running`; Start button is disabled during transition
- [ ] **COORD-02**: Clicking "Stop" transitions coordinator through `running → stopping → idle`; Stop button is disabled during transition
- [ ] **COORD-03**: Destroy action stops the coordinator, zero-fills the in-memory key buffer, clears localStorage, and resets UI to initial state
- [ ] **COORD-04**: Coordinator uses `NostrServerTransport` from `@contextvm/sdk` initialized with the generated keypair and configured relay list
- [ ] **COORD-05**: State machine rejects invalid transitions (cannot start if running; cannot destroy while starting/stopping)
- [ ] **COORD-06**: Coordinator state is displayed as a visible status badge that updates reactively on every transition

### Cordn Coordinator Methods (CORDN)

- [ ] **CORDN-01**: Browser MCP server registers the Cordn coordinator method surface from upstream `src/server`
- [ ] **CORDN-02**: Browser coordinator can post and fetch MLS group messages through `msg_post` and `msg_fetch`
- [ ] **CORDN-03**: Browser coordinator enforces injected caller identity before handling coordinator methods
- [ ] **CORDN-04**: Browser coordinator uses browser-safe in-memory storage without bundling Node-only sqlite/runtime files

### Relay Configuration (RELAY)

- [ ] **RELAY-01**: User can add a relay URL to the relay list via a text input and confirm action
- [ ] **RELAY-02**: User can remove a relay URL from the relay list
- [ ] **RELAY-03**: User can toggle individual relays enabled/disabled without removing them from the list
- [ ] **RELAY-04**: Relay list inputs are read-only (non-interactive) whenever coordinator state is `starting`, `running`, or `stopping`
- [ ] **RELAY-05**: User must click an explicit "Edit configuration" button to unlock relay list editing when coordinator is `idle`
- [ ] **RELAY-06**: Each relay entry shows per-relay connection status (connected / disconnected / error) when coordinator is running
- [ ] **RELAY-07**: Relay URL input rejects entries that are not valid `ws://` or `wss://` URIs with an inline validation error

### Runtime Configuration (CONFIG)

- [ ] **CONFIG-01**: Announcement is exposed as a runtime option and defaults off
- [ ] **CONFIG-02**: Runtime configuration options are read-only whenever coordinator state is `starting`, `running`, or `stopping`
- [ ] **CONFIG-03**: Start uses the current runtime option snapshot when constructing `NostrServerTransport`

### Browser Limits (LIMIT)

- [ ] **LIMIT-01**: Maximum users is exposed as a runtime option with a hard browser cap
- [ ] **LIMIT-02**: Maximum users cannot be reduced below the active user count
- [ ] **LIMIT-03**: Invalid maximum-user values show an inline validation error and do not mutate the saved limit

### Key Persistence (PERSIST)

- [ ] **PERSIST-01**: Key persistence is disabled by default; coordinator works fully without it enabled
- [ ] **PERSIST-02**: Enabling persistence requires the user to enter a passphrase; key is not written until passphrase is confirmed
- [ ] **PERSIST-03**: Stored key is encrypted with AES-GCM using a key derived from the passphrase (PBKDF2 with ≥ 100,000 iterations or equivalent)
- [ ] **PERSIST-04**: On page load with a persisted encrypted key, app prompts for passphrase to decrypt before generating a new one
- [ ] **PERSIST-05**: Passphrase is never stored in localStorage, sessionStorage, or any other persistent browser storage
- [ ] **PERSIST-06**: Destroy action calls `localStorage.removeItem` for the encrypted key entry

### Coordinator Data Persistence (COORD-DATA)

- [ ] **COORD-DATA-01**: When persistence is enabled, Cordn coordinator method data is stored in browser SQLite-WASM backed storage
- [ ] **COORD-DATA-02**: Coordinator startup hydrates persisted Cordn state before registering browser MCP methods
- [ ] **COORD-DATA-03**: Disabling persistence or destroying the coordinator clears SQLite-WASM kvvfs records and fallback localStorage state

### Security (SEC)

- [ ] **SEC-01**: Destroy action calls `Uint8Array.fill(0)` on the in-memory key buffer before dereferencing it
- [ ] **SEC-02**: Key zero-fill and `localStorage.removeItem` execute in the same synchronous block (no await between them)
- [ ] **SEC-03**: No private key material (nsec, raw bytes, hex privkey) appears in `console.log`, `console.error`, or any error object
- [ ] **SEC-04**: Destroy action requires an explicit confirmation dialog before executing

### User Interface (UI)

- [ ] **UI-01**: App renders with a dark background, monospace font throughout, no CSS gradients, and no icon libraries (Unicode characters only)
- [ ] **UI-02**: Coordinator status badge is the primary visual element, prominently placed, and changes label and color on state transitions
- [ ] **UI-03**: Start, Stop, and Destroy are visually distinct actions; Destroy has destructive styling
- [ ] **UI-04**: Relay configuration panel displays a visible lock indicator when editing is not permitted
- [ ] **UI-05**: Edit configuration unlock state is re-evaluated on coordinator state change (running coordinator re-locks config even if unlock was active)
- [ ] **UI-06**: App renders without JavaScript errors on Chrome and Firefox latest stable

### Resource Telemetry (TELEMETRY)

- [ ] **TELEMETRY-01**: When coordinator is running, UI shows active WebSocket subscription count sourced from SDK or manual counter
- [ ] **TELEMETRY-02**: When coordinator is running, UI shows message rate (events processed per minute, rolling window)
- [ ] **TELEMETRY-03**: When coordinator is running on Chrome, UI shows a JS heap memory estimate from `performance.memory`; on other browsers the field reads "unavailable"
- [ ] **TELEMETRY-04**: Telemetry panel values reset to zero or hidden when coordinator is not in `running` state
- [ ] **TELEMETRY-05**: All telemetry values are labeled with "(est.)" or equivalent to indicate they are estimates
- [ ] **TELEMETRY-06**: Cordn adapter method activity and subscription lifecycle events feed the browser resource monitor

### Error Handling (ERR)

- [ ] **ERR-01**: Coordinator startup failure surfaces a visible error banner in the UI with the error message; state returns to `idle`
- [ ] **ERR-02**: Individual relay connection errors are shown inline in the relay list entry, not only in the browser console
- [ ] **ERR-03**: Wrong passphrase during key decryption shows an inline error message and leaves the key generation path open
- [ ] **ERR-04**: Invalid relay URL shows a field-level validation error without submitting the form
- [ ] **ERR-05**: Errors are dismissible by the user; dismissed errors do not reappear unless the triggering condition recurs

### Testing (TEST)

- [ ] **TEST-01**: Vitest unit tests cover all coordinator state machine transitions including invalid-transition rejection
- [ ] **TEST-02**: Vitest unit tests cover key encryption and decryption helpers, including wrong-passphrase error path
- [ ] **TEST-03**: Vitest unit tests cover relay URL validation (valid ws/wss URLs pass; http URLs and plain strings fail)
- [ ] **TEST-04**: Playwright e2e test covers the full start flow: page load → relay added → Start clicked → running badge visible
- [ ] **TEST-05**: Playwright e2e test covers relay config edit flow: unlock → add relay → relay appears → coordinator started → config locked
- [ ] **TEST-06**: Playwright e2e test covers coordinator stop flow: running → Stop clicked → idle badge visible
- [ ] **TEST-07**: Playwright e2e test covers destroy flow: running → Stop → Destroy clicked → confirm dialog → initial state restored

### CI/CD & Deployment (CICD)

- [ ] **CICD-01**: GitHub Actions workflow runs `lint → vitest → playwright` on every push and on pull requests targeting `main` or `master`
- [ ] **CICD-02**: Total CI workflow wall-clock time stays under 4 minutes on a standard GitHub-hosted runner
- [ ] **CICD-03**: GitHub Actions nsite deploy workflow triggers on successful CI for `main` or `master`
- [ ] **CICD-04**: nsite deploy uses `nsyte` CLI (via `nsite-action`) to publish the `vite build` output to Blossom + Nostr using `NSYTE_BUNKER_URL` and `NSYTE_RELAY` secrets
- [ ] **CICD-05**: `scripts/setup-secrets.sh` is executable and guides the user through setting `NSYTE_BUNKER_URL`, `NSYTE_RELAY`, and Blossom server URL as GitHub repository secrets
- [ ] **CICD-06**: Deploy workflow step is skipped (not failed) if secrets are absent, with a clear skip message

## v2 Requirements

### NIP-42 Relay Authentication

- **NIP42-01**: Coordinator handles `AUTH` challenge from relays that require NIP-42 authentication
- **NIP42-02**: UI surfaces which relays require auth and whether auth succeeded

### Key Import

- **IMPORT-01**: User can paste an existing nsec to use as the coordinator identity instead of generating a new one
- **IMPORT-02**: Imported nsec is validated (correct length, valid scalar) before being accepted

### Relay Diagnostics

- **DIAG-01**: Per-relay round-trip latency (ping time) is shown in the relay list when coordinator is running
- **DIAG-02**: Relay connection history (connected/disconnected events with timestamps) is accessible in an expandable panel

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side relay proxy | Defeats the browser-only premise; a backend is not a Cordn browser node |
| Multi-coordinator management | Multiplies state complexity before the single-coordinator UX is validated |
| MCP tool authoring UI | Coordinators proxy tools; they do not define them in this phase |
| Mobile-optimized layout | Desktop browser is the target; responsive is acceptable, mobile-first is not |
| Dark/light theme toggle | Cypherpunk aesthetic is fixed; theme toggle adds complexity with no value |
| QR code for pubkey | Mobile is out of scope; plain copyable text is sufficient |
| Real-time raw event log | Clutters minimal UI and can expose sensitive message content |
| OAuth or social login | No server, no accounts — Nostr keypair is the identity |
| SSR or adapter-node | Static site only; `vite build` output must be hostable from any CDN or nsite node |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| KEYGEN-01 | Phase 1 | Pending |
| KEYGEN-02 | Phase 1 | Pending |
| KEYGEN-03 | Phase 1 | Pending |
| KEYGEN-04 | Phase 1 | Pending |
| KEYGEN-05 | Phase 1 | Pending |
| COORD-01 | Phase 1 | Pending |
| COORD-02 | Phase 1 | Pending |
| COORD-03 | Phase 2 | Pending |
| COORD-04 | Phase 1 | Pending |
| COORD-05 | Phase 1 | Pending |
| COORD-06 | Phase 1 | Pending |
| CORDN-01 | Phase 5 | Pending |
| CORDN-02 | Phase 5 | Pending |
| CORDN-03 | Phase 5 | Pending |
| CORDN-04 | Phase 5 | Pending |
| COORD-DATA-01 | Phase 6 | Pending |
| COORD-DATA-02 | Phase 6 | Pending |
| COORD-DATA-03 | Phase 6 | Pending |
| RELAY-01 | Phase 1 | Pending |
| RELAY-02 | Phase 1 | Pending |
| RELAY-03 | Phase 1 | Pending |
| RELAY-04 | Phase 1 | Pending |
| RELAY-05 | Phase 1 | Pending |
| RELAY-06 | Phase 2 | Pending |
| RELAY-07 | Phase 1 | Pending |
| CONFIG-01 | Phase 4 | Pending |
| CONFIG-02 | Phase 4 | Pending |
| CONFIG-03 | Phase 4 | Pending |
| LIMIT-01 | Phase 4 | Pending |
| LIMIT-02 | Phase 4 | Pending |
| LIMIT-03 | Phase 4 | Pending |
| PERSIST-01 | Phase 2 | Pending |
| PERSIST-02 | Phase 2 | Pending |
| PERSIST-03 | Phase 2 | Pending |
| PERSIST-04 | Phase 2 | Pending |
| PERSIST-05 | Phase 2 | Pending |
| PERSIST-06 | Phase 2 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 2 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |
| UI-04 | Phase 1 | Pending |
| UI-05 | Phase 1 | Pending |
| UI-06 | Phase 1 | Pending |
| TELEMETRY-01 | Phase 3 | Pending |
| TELEMETRY-02 | Phase 3 | Pending |
| TELEMETRY-03 | Phase 3 | Pending |
| TELEMETRY-04 | Phase 3 | Pending |
| TELEMETRY-05 | Phase 3 | Pending |
| TELEMETRY-06 | Phase 7 | Pending |
| ERR-01 | Phase 1 | Pending |
| ERR-02 | Phase 2 | Pending |
| ERR-03 | Phase 2 | Pending |
| ERR-04 | Phase 1 | Pending |
| ERR-05 | Phase 1 | Pending |
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 1 | Pending |
| TEST-04 | Phase 1 | Pending |
| TEST-05 | Phase 1 | Pending |
| TEST-06 | Phase 1 | Pending |
| TEST-07 | Phase 2 | Pending |
| CICD-01 | Phase 1 | Pending |
| CICD-02 | Phase 1 | Pending |
| CICD-03 | Phase 3 | Pending |
| CICD-04 | Phase 3 | Pending |
| CICD-05 | Phase 3 | Pending |
| CICD-06 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 56 total
- Mapped to phases: 56
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-23*
*Last updated: 2026-06-23 after initial definition from PROJECT.md and feature research*
