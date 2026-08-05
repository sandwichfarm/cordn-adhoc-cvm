# Discussion Log: Phase 1 — Core Foundation

**Date:** 2026-06-23
**Mode:** Headless (autonomous — no user present)
**Areas:** All 5 gray areas auto-selected and resolved

---

## Area 1: SDK Import Strategy

**Options considered:**
- A) Named imports only from `@contextvm/sdk` (e.g., `import { NostrServerTransport } from '@contextvm/sdk'`)
- B) Barrel import (`import * as sdk from '@contextvm/sdk'`)
- C) Subpath imports (e.g., `import { NostrServerTransport } from '@contextvm/sdk/transport'`)

**Selected:** A — Named imports, with `vite build` verification gate in plan 01-01.

**Notes:** Option B risks pulling Node built-ins (Pitfall 2). Option C would be ideal but SDK subpath structure is unverified. Option A is safe baseline; if named imports still cause Node leaks, subpath imports or aliases are the fallback discovered during plan 01-01.

---

## Area 2: State Machine Scope

**Options considered:**
- A) `idle | starting | running | stopping` (Phase 1 only, no `destroyed`)
- B) Full state machine including `destroyed` from day one
- C) `idle | starting | running | stopping | stopped` (separate stopped state)

**Selected:** A — four states, `stopped` event returns to `idle`.

**Notes:** `destroyed` is Phase 2 scope. `KeyManager.destroy()` method is stubbed in Phase 1 as security discipline. Option C (separate `stopped` state) adds no value for Phase 1 since there's no post-stop, pre-restart UI distinction needed.

---

## Area 3: Playwright Mock Relay

**Options considered:**
- A) Minimal NIP-01 `ws` server: accept connections, respond to REQ with EOSE, accept EVENT/CLOSE
- B) Full NIP-01 compliant mock with subscription filter matching and event routing
- C) Use live public relay (e.g., `wss://relay.damus.io`) in CI

**Selected:** A — minimal mock sufficient to make `NostrServerTransport` believe it is connected.

**Notes:** Option C is explicitly a "never" in PITFALLS.md (flaky, slow). Option B over-engineers for what e2e tests need to verify — the tests verify coordinator state transitions and UI behavior, not relay protocol compliance.

---

## Area 4: App Layout

**Options considered:**
- A) Single column: header → status badge → controls → relay config
- B) Two column: status/controls left, relay config right
- C) Card-based layout with modal for relay config

**Selected:** A — single column.

**Notes:** Single-screen app with minimal complexity. The requirements mandate "no CSS gradients, no icon libraries" and monospace font — a simple vertical stack matches the cypherpunk aesthetic better than a two-column layout. B and C add DOM complexity without UX benefit for a single-screen tool.

---

## Area 5: `beforeunload` Integration Point

**Options considered:**
- A) Register in `main.ts` after `mount()`, call `coordinator.stopSync()` synchronously
- B) Register inside `App.svelte` `$effect` cleanup
- C) Register inside `LifecyclePanel.svelte` `onMount`

**Selected:** A — `main.ts` registration.

**Notes:** `$effect` cleanup (Option B) is not guaranteed on tab close — exactly what Pitfall 4 warns against. Option C couples teardown to a component that might not be mounted. `main.ts` runs once at startup and is the right place for global lifecycle handlers.

---

## Deferred Ideas

- Per-relay latency display → Phase 3 / v2 (DIAG-01)
- nsec import flow → v2 (IMPORT-01, IMPORT-02)
- NIP-42 relay auth → v2 (NIP42-01, NIP42-02)
- Resource monitor → Phase 3 (TELEMETRY-*)
- Destroy button UI → Phase 2 (COORD-03)

---

## Claude's Discretion Summary

All five areas were decided without user input (headless mode). Decisions favor minimal complexity for Phase 1, strict security discipline from day one (ESLint ban, KeyManager.destroy() stub, Uint8Array), and fast CI (minimal mock relay, vite preview reuse). Every decision has a clear Phase 2 handoff point.
