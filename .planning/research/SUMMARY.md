# Project Research Summary

**Project:** Cordn Browser — browser-resident Nostr/MCP coordinator
**Domain:** Static SPA, browser-only Nostr coordinator with MCP-over-Nostr transport
**Researched:** 2026-06-23
**Confidence:** HIGH

## Executive Summary

Cordn Browser is a novel product: a browser tab that functions as a reachable Nostr/MCP coordinator with zero backend dependency. The entire coordinator lifecycle — keypair management, relay pooling, MCP framing, and encrypted key persistence — runs client-side via `@contextvm/sdk` and the Web Crypto API. There are no direct competitors and no established UX pattern to copy from; the closest mental model is a VPN client toggle (one big on/off action with config underneath).

The recommended approach is a minimal Svelte 5 + Vite 8 SPA using only runes (no legacy stores), with a pure TypeScript state machine driving the coordinator lifecycle. `@contextvm/sdk 0.6.2` handles all Nostr relay pooling, NIP-04/44 encryption, and MCP framing — building from raw `nostr-tools` would duplicate that work and risk protocol divergence. Key material must live as `Uint8Array` throughout its lifetime so it can be zero-filled on destroy; persistence is opt-in AES-256-GCM encrypted via PBKDF2 with user passphrase.

The three risks that could sink the project are: (1) `@contextvm/sdk` pulling Node.js built-ins into the browser bundle — catch this on the very first `vite build`; (2) Svelte 5 rune/store mixing — ban `svelte/store` imports via ESLint from day one; (3) raw nsec written to `localStorage` — enforce AES-GCM encryption as a hard invariant before any persistence code is merged.

## Key Findings

### Recommended Stack

Svelte 5 runes compile to minimal JS with no runtime overhead — ideal for a single-screen SPA. `@contextvm/sdk 0.6.2` is pinned by the project spec and is the only runtime dependency beyond browser built-ins. Tailwind v4 uses a CSS-first config (no `tailwind.config.js`) that pairs cleanly with the `@tailwindcss/vite` plugin. Deployment via `nsyte` to Blossom/Nostr via GitHub Actions CI aligns the distribution ethos with the product ethos.

**Core technologies:**
- **Svelte 5 ≥5.46.4**: UI framework — runes API only, no legacy stores
- **Vite 8 ^8.0.0**: Build tool — required by `@sveltejs/vite-plugin-svelte` v7+
- **TypeScript 5 (strict)**: Type safety — runes are fully TypeScript-aware
- **`@contextvm/sdk` 0.6.2**: MCP-over-Nostr transport — `NostrServerTransport`, `PrivateKeySigner`, `ApplesauceRelayPool`
- **Web Crypto API (built-in)**: AES-256-GCM + PBKDF2 — no library needed for key encryption
- **Tailwind v4 + `@tailwindcss/vite`**: Utility CSS — CSS-first config via `@import "tailwindcss"`
- **Vitest ^4.1.9**: Unit tests for pure functions (state machine, key helpers, config validator)
- **`@playwright/test` ^1.61.0**: E2E tests against `vite preview` with mock relay fixture
- **`nsyte` v0.27.2 (Deno)**: Deploys static build to Blossom/Nostr in CI

### Expected Features

**Must have (table stakes):**
- Key generation — without an identity, nothing works
- Coordinator start / stop — the core loop must be togglable
- Running status indicator + relay connectivity feedback — users must know the coordinator is live
- Relay configuration panel (guarded edit) — relay list required before starting
- npub / pubkey display — MCP clients need this to connect
- Destroy action — critical for security-conscious users; builds trust
- Error surfacing — silent failures are worse than visible errors
- Encrypted key persistence — opt-in; essential for usability across browser restarts
- CI workflow (lint → unit → Playwright) — gates correctness before every push
- nsite deploy — aligns distribution with product ethos

**Should have (competitive differentiators):**
- Resource telemetry (subscription count, message rate, memory estimate)
- Import existing nsec — defer until demand signal exists
- Relay latency display — add once basic connectivity is stable

**Defer to v2+:**
- Multi-coordinator management — validate v1 UX first
- MCP tool authoring UI — separate product surface
- NIP-42 paid relay auth — wait for user-reported relay rejection
- Mobile-optimized layout — desktop browser is the target

### Architecture Approach

The app is organized into four layers: Svelte 5 UI components that read reactive `$state` singletons; a coordinator state store (`.svelte.ts`) that dispatches to a pure TypeScript state machine; service layer classes (`KeyManager`, `KeyStorage`, `TransportFactory`) with no Svelte dependency; and `@contextvm/sdk` transport below. Business logic never lives inside `.svelte` components — components only call methods on exported singletons and render reactive state.

**Major components:**
1. `CoordinatorStore` (`.svelte.ts`) — reactive state + action dispatch; single source of truth
2. `StateMachine` (`.ts`) — pure `transition(current, event) → next | null` lookup table; Vitest-testable
3. `KeyManager` / `KeyStorage` (`.ts`) — separate responsibilities: live `Uint8Array` lifetime vs. PBKDF2+AES-GCM persistence
4. `ConfigStore` (`.svelte.ts`) — relay list + edit-guard flag; locked when coordinator is `running`
5. `TransportFactory` (`.ts`) — constructs `NostrServerTransport`; isolated for test mocking
6. `LifecyclePanel`, `RelayConfigPanel`, `ResourceMonitor` (`.svelte`) — UI only; no business logic

### Critical Pitfalls

1. **Key not actually zeroed on destroy** — always use `Uint8Array` (never `string`) for key material; call `fill(0)` synchronously before nulling; `localStorage.removeItem` in the same synchronous block as zero-fill
2. **`@contextvm/sdk` pulls Node.js built-ins into the browser bundle** — run `vite build` on the first commit and check for polyfill warnings; audit with bundle visualizer; use subpath imports (`@contextvm/sdk/transport`) not barrel imports
3. **Svelte 5 runes + legacy stores mixed** — ban `svelte/store` imports via ESLint rule from day one; `svelte-check` in CI catches rune misuse
4. **WebSocket connections not closed on tab unload** — add synchronous `window.addEventListener('beforeunload', () => coordinator.stop())` at app startup; `beforeunload` handler must be synchronous
5. **Non-atomic `localStorage` write for key + config** — serialize all persistent state into one JSON blob in a single `setItem` call; never split key and config across separate keys
6. **Relay list mutated while coordinator is running** — state machine must enforce: `RUNNING` state blocks all config mutations; transport initialized with snapshot of relay list, not a live observer

## Implications for Roadmap

### Phase 1: Core Foundation
**Rationale:** All coordinator features share the state machine and key lifecycle as prerequisites. Nothing else can be built without these working correctly and securely — especially since key storage bugs require keypair rotation to fix.
**Delivers:** A working, testable coordinator that can start, stop, and be destroyed
**Addresses:** Key generation, coordinator start/stop, status indicator, destroy action, error surfacing, relay config panel (guarded), npub display
**Avoids:** Pitfalls 1 (key not zeroed), 3 (rune/store mix), 4 (WS leak), 5 (non-atomic write), 6 (relay edit while running)

**Sub-tasks:**
- Project scaffolding: Vite 8 + Svelte 5 + TypeScript strict + Tailwind v4; ban `svelte/store` via ESLint; run `vite build` to validate no Node built-in leaks (Pitfall 2)
- Pure state machine (`state-machine.ts`) with Vitest tests for all legal transitions
- `KeyManager` class: generate, hold as `Uint8Array`, zero-fill on destroy
- `KeyStorage` class: PBKDF2 + AES-GCM encrypt/decrypt; single-key `localStorage` write
- `TransportFactory`: construct `NostrServerTransport` from `@contextvm/sdk/transport`
- `CoordinatorStore`: wire state machine + key manager + transport factory
- `ConfigStore`: relay list + edit guard locked when `running`
- UI components: `LifecyclePanel`, `RelayConfigPanel` (read-only when running), status badge
- Relay URL validation (reject `ws://`, non-URL inputs)
- `beforeunload` handler for clean WebSocket disconnect

### Phase 2: Persistence & Observability
**Rationale:** Persistence requires the key lifecycle to be proven correct first (Phase 1). Resource telemetry requires the coordinator to be running (Phase 1 output). These features add usability without changing core architecture.
**Delivers:** Key survives browser restart; users see live coordinator health
**Uses:** `KeyStorage` AES-GCM (Phase 1 output), `CoordinatorStore.stats` `$state`
**Implements:** `ResourceMonitor` component; encrypted key opt-in persist/load flow with passphrase prompt

**Sub-tasks:**
- Opt-in key persistence UI: passphrase prompt on first save; auto-load on next page open
- Destroy flow: confirm dialog → transport.close() → key.fill(0) → localStorage.removeItem (atomic)
- `ResourceMonitor`: subscription count, message rate, `performance.memory` estimate (feature-detect; Chromium-only)

### Phase 3: CI/CD & Deployment
**Rationale:** CI enforces the correctness invariants from Phase 1-2 before shipping. Deploy can't be set up without a working build (Phase 1). These are operational concerns, not product features.
**Delivers:** Automated quality gate + live nsite/Blossom deployment on push to `main`
**Uses:** Vitest (unit), Playwright (e2e with mock `ws` relay fixture), `nsyte` (Deno, CI only)

**Sub-tasks:**
- Playwright config: `webServer` pointing to `vite preview`, `waitForPort`, mock relay via `ws` fixture
- E2E tests: start/stop/destroy flow; assert relay inputs disabled while running; assert localStorage blob is not plaintext nsec
- GitHub Actions: `lint → vitest → playwright` jobs; separate deploy job on `main` push
- `nsyte` CI setup: `NSYTE_BUNKER_URL` in GitHub Secrets; verify CI log masking after first run

### Phase Ordering Rationale

- **Phase 1 before Phase 2**: Key lifecycle correctness is a hard prerequisite for persistence — a key storage bug requires user keypair rotation. Validate the in-memory path fully before adding the disk path.
- **Phase 1 before Phase 3**: CI tests validate Phase 1-2 correctness; you can't write meaningful E2E tests without the feature flows to test.
- **State machine before UI**: Components that read coordinator state must have valid state to read. The pure state machine is also the fastest thing to Vitest-test, so building it first gives rapid feedback.
- **Scaffolding `vite build` validation in Phase 1, not Phase 3**: Node built-in leak (Pitfall 2) is catastrophic if discovered late — the entire bundle strategy may need to change. Catch it on commit 1.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (key persistence):** PBKDF2 iteration count (600,000 per NIST SP 800-132); exact `localStorage` blob schema; passphrase UX pattern
- **Phase 3 (nsyte deploy):** `nsyte ci` bunker key generation workflow; GitHub Actions masked secret verification; Blossom server CORS behavior

Phases with standard patterns (skip research):
- **Phase 1 (state machine):** Well-documented pattern; Vitest test examples exist; no unknowns
- **Phase 1 (Svelte 5 rune singletons):** Canonical pattern in Svelte 5 docs and community articles
- **Phase 3 (Playwright CI):** `webServer` + `waitForPort` is standard config; mock `ws` fixture is documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm/GitHub; `@sveltejs/vite-plugin-svelte` v7 + Vite 8 compatibility confirmed |
| Features | HIGH | Requirements well-defined in PROJECT.md; domain is narrow and technical |
| Architecture | HIGH | SDK source read directly (not just docs); Svelte 5 rune patterns corroborated by current community articles |
| Pitfalls | HIGH | Browser crypto, Svelte 5, CI patterns are well-understood; nsyte/nsite deploy is MEDIUM (newer tool) |

**Overall confidence:** HIGH

### Gaps to Address

- **`@contextvm/sdk` exact API surface**: The SDK's `NostrServerTransport` constructor signature and `PrivateKeySigner` key type (hex string vs. `Uint8Array`) need verification against v0.6.2 source before `TransportFactory` is written. Risk: low (source is public), but don't assume.
- **`ApplesauceRelayPool` reconnect behavior**: Does the pool auto-reconnect on relay drop, or does the app need to handle reconnect? This affects whether `ResourceMonitor` needs reconnect-attempt tracking.
- **`performance.memory` availability**: Non-standard, Chromium-only. Feature-detect before use; decide on fallback label ("unavailable in this browser") during Phase 2.
- **nsyte `0.27.2` CI workflow**: The Deno-based deploy tool is newer; the exact GitHub Actions step sequence for `nsyte ci` secret generation needs verification against `sandwichfarm/nsyte` docs during Phase 3.

## Sources

### Primary (HIGH confidence)
- `PROJECT.md` — authoritative requirements and context
- [ContextVM SDK source](https://github.com/ContextVM/sdk) — `NostrServerTransport`, `PrivateKeySigner`, `ApplesauceRelayPool` source
- [@sveltejs/vite-plugin-svelte releases](https://github.com/sveltejs/vite-plugin-svelte/releases) — v7.1.2 Vite 8 + Svelte ≥5.46.4 compatibility
- [@tailwindcss/vite on npm](https://www.npmjs.com/package/@tailwindcss/vite) — v4.3.1, June 2026
- [nsyte GitHub](https://github.com/sandwichfarm/nsyte) — v0.27.2, CI deploy pattern
- [Vitest releases](https://github.com/vitest-dev/vitest/releases) — v4.1.9
- [Web Crypto API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — AES-GCM + PBKDF2

### Secondary (MEDIUM confidence)
- [Mainmatter: Global state in Svelte 5](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/) — class-based rune singleton pattern
- [ContextVM SDK GitHub](https://github.com/contextvm/ts-sdk) — subpath exports, browser env logging (partial API docs)

### Tertiary (LOW confidence / needs validation)
- NIST SP 800-132 — PBKDF2 iteration count recommendation (600,000 minimum as of 2023); apply during Phase 2 implementation

---
*Research completed: 2026-06-23*
*Ready for roadmap: yes*
