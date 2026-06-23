# Roadmap: Cordn Browser

## Overview

Cordn Browser is built in six phases: Phase 1 delivers a coordinator shell that starts, stops, and configures relays.
Phase 2 hardens the key lifecycle with encrypted persistence and a confirmed destroy action.
Phase 3 adds live resource telemetry and automates deployment via nsite/Blossom on every push to main.
Phase 4 closes explicit objective gaps around browser limits and guarded runtime options.
Phase 5 registers the real Cordn coordinator method surface in the browser.
Phase 6 persists Cordn coordinator method data in browser SQLite-WASM storage.
Phase 7 wires browser telemetry to real Cordn adapter activity.
Phase 8 makes deploy triggers match both common default branches and the current local branch.
Phase 9 adds workflow tests that lock deploy branch readiness against regression.

## Phases

- [x] **Phase 1: Core Foundation** - Working browser coordinator with key gen, lifecycle controls, relay config, cypherpunk UI, and CI test gate
- [x] **Phase 2: Security & Persistence** - Encrypted key persistence, confirmed destroy action, per-relay status, and persistence error handling
- [x] **Phase 3: Telemetry & Deployment** - Live resource monitoring and automated nsite/Blossom deployment pipeline
- [x] **Phase 4: Runtime Limits & Guarded Options** - Announcement option, maximum users browser cap, and active-user guard invariant
- [x] **Phase 5: Browser Cordn Methods** - Browser-safe Cordn coordinator core and MCP method registration
- [x] **Phase 6: Coordinator Persistence** - SQLite-WASM snapshot persistence for Cordn coordinator method data
- [x] **Phase 7: Adapter-Backed Telemetry** - Resource monitor updates from Cordn method activity and live subscriptions
- [x] **Phase 8: Deploy Branch Readiness** - CI and nsite deploy trigger on `main` and current `master`
- [x] **Phase 9: Workflow Guardrails** - Unit tests cover CI/deploy branch filters

## Phase Details

### Phase 1: Core Foundation
**Goal**: Users can open the app, generate a coordinator identity, configure relays, and start/stop a live Nostr/MCP coordinator — all without any persistence or backend
**Depends on**: Nothing (first phase)
**Requirements**: KEYGEN-01, KEYGEN-02, KEYGEN-03, KEYGEN-04, KEYGEN-05, COORD-01, COORD-02, COORD-04, COORD-05, COORD-06, RELAY-01, RELAY-02, RELAY-03, RELAY-04, RELAY-05, RELAY-07, SEC-03, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, ERR-01, ERR-04, ERR-05, TEST-01, TEST-03, TEST-04, TEST-05, TEST-06, CICD-01, CICD-02
**Success Criteria** (what must be TRUE):
  1. User opens app and sees a generated npub with a copyable truncated display — no setup required
  2. User adds a relay URL, clicks Start, and sees the status badge transition through `starting → running`
  3. User clicks Stop and sees the badge transition through `stopping → idle`
  4. Relay config inputs are visually locked while coordinator is in any non-idle state; an explicit unlock button is required to edit
  5. GitHub Actions CI pipeline runs lint → unit → Playwright on every push and completes in under 4 minutes
**Plans**: 5 plans

Plans:
- [x] 01-01: Project scaffolding — Vite 8, Svelte 5, TypeScript strict, Tailwind v4, ESLint (ban svelte/store), run vite build to confirm no Node built-in leaks
- [x] 01-02: State machine + key management — pure StateMachine.ts with Vitest coverage; KeyManager holding Uint8Array lifetime
- [x] 01-03: Coordinator store + transport — CoordinatorStore (.svelte.ts), TransportFactory, ConfigStore with edit guard locked on non-idle state
- [x] 01-04: UI components — LifecyclePanel, RelayConfigPanel (guarded), status badge, npub display, beforeunload WS cleanup
- [x] 01-05: Tests + CI — Vitest state machine + relay URL validation; Playwright start/stop/config-edit e2e; GitHub Actions lint→unit→playwright workflow
**UI hint**: yes

### Phase 2: Security & Persistence
**Goal**: The coordinator key can survive browser restarts via encrypted opt-in persistence, and the destroy action is fully confirmed and cryptographically clean
**Depends on**: Phase 1
**Requirements**: COORD-03, RELAY-06, PERSIST-01, PERSIST-02, PERSIST-03, PERSIST-04, PERSIST-05, PERSIST-06, SEC-01, SEC-02, SEC-04, ERR-02, ERR-03, TEST-02, TEST-07
**Success Criteria** (what must be TRUE):
  1. User can opt in to key persistence by entering and confirming a passphrase; key is written encrypted
  2. On next page load with a stored key, user is prompted for passphrase before a new key is generated
  3. Entering the wrong passphrase shows an inline error and leaves the new-key path available
  4. Destroy requires an explicit confirmation dialog; afterwards memory is zeroed, localStorage cleared, and UI resets to initial state
  5. Per-relay connection status (connected / disconnected / error) is visible inline in the relay list when coordinator is running
**Plans**: 3 plans

Plans:
- [x] 02-01: Key persistence — KeyStorage PBKDF2 + AES-GCM encrypt/decrypt; single-blob localStorage write; passphrase prompt UI; Vitest encryption tests
- [x] 02-02: Destroy flow + security hardening — confirm dialog, Uint8Array.fill(0) + localStorage.removeItem in one synchronous block, SEC-01/02/04
- [x] 02-03: Per-relay status + persistence error handling — RELAY-06 status display, ERR-02 inline relay errors, ERR-03 passphrase error, TEST-07 destroy e2e
**UI hint**: yes

### Phase 3: Telemetry & Deployment
**Goal**: Live resource metrics are visible when the coordinator is running, and deployment to Blossom/Nostr is fully automated on push to main
**Depends on**: Phase 2
**Requirements**: TELEMETRY-01, TELEMETRY-02, TELEMETRY-03, TELEMETRY-04, TELEMETRY-05, CICD-03, CICD-04, CICD-05, CICD-06
**Success Criteria** (what must be TRUE):
  1. When coordinator is running, user sees active subscription count, rolling message rate, and memory estimate (labeled as estimates; memory reads "unavailable" on non-Chrome)
  2. Telemetry panel values reset or hide when coordinator is not in `running` state
  3. Every push to main triggers an nsite deploy to Blossom/Nostr after all CI checks pass
  4. Deploy step skips gracefully with a clear log message when GitHub secrets are absent
  5. User can run `scripts/setup-secrets.sh` to be guided through adding all required GitHub secrets
**Plans**: 2 plans

Plans:
- [x] 03-01: Resource telemetry — ResourceMonitor component; subscription counter; message rate rolling window; performance.memory feature-detect; "(est.)" labels
- [x] 03-02: Deployment pipeline — GitHub Actions nsite deploy job gated on CI; nsyte CLI integration; setup-secrets.sh; CICD-06 skip-on-missing-secrets
**UI hint**: yes

### Phase 4: Runtime Limits & Guarded Options
**Goal**: The browser coordinator exposes explicit runtime options from the original objective and guards maximum-users edits against browser and active-user limits
**Depends on**: Phase 3
**Requirements**: CONFIG-01, CONFIG-02, LIMIT-01, LIMIT-02, LIMIT-03
**Success Criteria** (what must be TRUE):
  1. Announcement is visible as a runtime option and defaults off
  2. Maximum users is visible as a runtime option with a browser cap
  3. Runtime options are locked while the coordinator is running
  4. Maximum users cannot be reduced below active user count
  5. Transport startup receives the configured announcement setting
**Plans**: 1 plan

Plans:
- [x] 04-01: Runtime limits — announcement toggle, max-users input, active-user guard, transport option wiring, tests
**UI hint**: yes

### Phase 5: Browser Cordn Methods
**Goal**: The browser ContextVM server registers the upstream Cordn coordinator tool surface and backs it with browser-safe in-memory storage
**Depends on**: Phase 4
**Requirements**: CORDN-01, CORDN-02, CORDN-03, CORDN-04
**Success Criteria** (what must be TRUE):
  1. Browser server registers every upstream Cordn coordinator method name
  2. Browser adapter can post and fetch MLS group messages in-memory
  3. Coordinator start flow remains browser-runnable after method registration
  4. No Node-only sqlite/runtime modules are bundled into the browser app
**Plans**: 1 plan

Plans:
- [x] 05-01: Browser Cordn methods — contracts, in-memory coordinator, adapter, MCP tool registration, MLS message tests
**UI hint**: no

### Phase 6: Coordinator Persistence
**Goal**: Cordn method data survives browser reloads when persistence is enabled and is cleared by disable/destroy actions
**Depends on**: Phase 5
**Requirements**: COORD-DATA-01, COORD-DATA-02, COORD-DATA-03
**Success Criteria** (what must be TRUE):
  1. Persistent coordinator startup hydrates Cordn storage before registering methods
  2. Cordn group message state round-trips through a persisted browser snapshot
  3. Disabling persistence or destroying the coordinator removes SQLite-WASM kvvfs data and fallback localStorage state
  4. Browser runtime remains free of Node `Buffer` dependencies
  5. Full local CI passes
**Plans**: 1 plan

Plans:
- [x] 06-01: SQLite-WASM coordinator storage - snapshot persistence, startup hydration, destroy cleanup, browser base64, tests
**UI hint**: no

### Phase 7: Adapter-Backed Telemetry
**Goal**: Browser telemetry reflects real Cordn adapter operations and coordinator subscription counts
**Depends on**: Phase 6
**Requirements**: TELEMETRY-01, TELEMETRY-02
**Success Criteria** (what must be TRUE):
  1. Cordn method activity increments the browser message-rate window
  2. Group subscription start/end updates the displayed subscription count from the coordinator
  3. Existing SDK transport event telemetry remains as a fallback
  4. Unit tests cover operation and subscription telemetry callbacks
**Plans**: 1 plan

Plans:
- [x] 07-01: Adapter telemetry sink - operation callback, subscription count callback, monitor binding, tests
**UI hint**: no

### Phase 8: Deploy Branch Readiness
**Goal**: GitHub workflows are ready for either `main` or this repository's current `master` branch
**Depends on**: Phase 7
**Requirements**: CICD-01, CICD-03
**Success Criteria** (what must be TRUE):
  1. Pull request CI targets both `main` and `master`
  2. nsite deploy workflow runs after successful CI on both `main` and `master`
  3. Existing secret guard behavior remains unchanged
  4. Workflow syntax validates locally
**Plans**: 1 plan

Plans:
- [x] 08-01: Branch-ready workflows - add `master` to CI/deploy branch filters and validate workflow YAML
**UI hint**: no

### Phase 9: Workflow Guardrails
**Goal**: Local tests fail if CI/deploy workflow branch support regresses
**Depends on**: Phase 8
**Requirements**: CICD-01, CICD-03
**Success Criteria** (what must be TRUE):
  1. Unit tests assert CI pull request filters include `main` and `master`
  2. Unit tests assert nsite deploy workflow-run filters include `main` and `master`
  3. Existing deploy secret/action assertions remain covered
  4. Full local CI passes
**Plans**: 1 plan

Plans:
- [x] 09-01: Workflow guardrails - add unit coverage for CI/deploy branch filters
**UI hint**: no

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Foundation | 5/5 | Complete | 2026-06-23 |
| 2. Security & Persistence | 3/3 | Complete | 2026-06-23 |
| 3. Telemetry & Deployment | 2/2 | Complete | 2026-06-23 |
| 4. Runtime Limits & Guarded Options | 1/1 | Complete | 2026-06-23 |
| 5. Browser Cordn Methods | 1/1 | Complete | 2026-06-23 |
| 6. Coordinator Persistence | 1/1 | Complete | 2026-06-23 |
| 7. Adapter-Backed Telemetry | 1/1 | Complete | 2026-06-23 |
| 8. Deploy Branch Readiness | 1/1 | Complete | 2026-06-23 |
| 9. Workflow Guardrails | 1/1 | Complete | 2026-06-23 |
