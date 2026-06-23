# Cordn Browser

## What This Is

A ContextVM/Cordn coordinator that runs entirely in the browser — no server required. It exposes MCP tool capabilities to the Nostr network via `@contextvm/sdk` relay transport, presenting a minimal Svelte 5 GUI for key management, relay configuration, and coordinator lifecycle control. Anyone can open the page and become a Cordn node.

## Core Value

A single browser tab acts as a fully functional, self-sovereign Cordn coordinator reachable over Nostr relays — no backend, no account, no installation.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Browser-resident coordinator using `@contextvm/sdk` `NostrServerTransport`
- [ ] Auto-generated coordinator keypair (nsec stored in memory; optional encrypted localStorage persistence)
- [ ] Relay configuration panel — add/remove/toggle Nostr relay URLs, guarded behind a confirm-to-edit pattern
- [ ] Coordinator start/stop/destroy lifecycle — destroy wipes key + state from memory and storage
- [ ] Browser resource limit display — show active subscription count, message rate, memory estimate
- [ ] Browser runtime limits — announcement default off, maximum users cap, active-user guard for max-users edits
- [ ] Minimal cypherpunk GUI with Svelte 5 + Vite + Tailwind (dark, monospace, no gradients, no icons except Unicode)
- [ ] Unit tests (Vitest) covering coordinator state machine and key persistence helpers
- [ ] Playwright e2e tests covering start, config edit, stop, destroy flows
- [ ] GitHub Actions CI workflow: lint → unit → Playwright
- [ ] GitHub Actions nsite deploy workflow via `nsyte` to Blossom + Nostr on push to `main`
- [ ] Helper script (`scripts/setup-secrets.sh`) to guide user through adding GitHub secrets for nsite deploy

### Out of Scope

- Server-side relay or proxy — the whole point is browser-only; a backend defeats it
- Multi-coordinator management in one tab — adds complexity without validating the core first
- Paid relay authentication (NIP-42) — defer until basic relay connectivity is proven
- MCP tool authoring UI — coordinators proxy tools; they don't define them in this phase
- Mobile-optimized layout — desktop browser is the target; responsive is acceptable, not required

## Context

- **ContextVM SDK** (`@contextvm/sdk`) is the transport layer. `NostrServerTransport` wraps a Nostr keypair and relay list to present an MCP server endpoint over the network. It handles encryption, serialization, and relay management internally.
- **nsite/nsyte** deploys static builds (Vite output) to Blossom file storage, publishing the root manifest as a Nostr event. The `nsite-action` GitHub Action handles CI deploy; it requires `NSYTE_BUNKER_URL` and `NSYTE_RELAY` secrets plus a Blossom server URL.
- **Key persistence**: the coordinator nsec must never leave the browser unencrypted. Persistence is opt-in; when enabled, the key is encrypted with a user-supplied passphrase before writing to `localStorage`. The destroy action must zero-fill the in-memory key buffer and call `localStorage.removeItem` atomically.
- **Guarded config**: relay URLs and persistence settings are read-only by default; the user must explicitly click "Edit configuration" to unlock the form, preventing accidental relay list wipes while the coordinator is running.
- **Test strategy**: Vitest for pure functions (key derivation, state machine transitions, config validation). Playwright for the rendered app (can't unit-test WebSocket + Nostr relay interactions without a live relay, so Playwright uses a mock relay via `ws` in a fixture).

## Constraints

- **Tech stack**: Svelte 5 (runes API), Vite, Tailwind v4, TypeScript strict — no exceptions; this is the baseline the deploy pipeline expects
- **Browser APIs only**: no Node.js built-ins at runtime; `@contextvm/sdk` must be imported in a way that tree-shakes server-side transports
- **No bundled private key**: the keypair is always generated at runtime or decrypted from user-supplied storage — never hardcoded or committed
- **Deploy target**: static site (no SSR, no adapter-node) — `vite build` output must be hostable from any CDN or nsite Blossom node
- **CI budget**: keep total CI time under 4 minutes; Playwright tests run headless against `vite preview`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `@contextvm/sdk` as transport, not raw Nostr libraries | SDK already abstracts relay pooling, NIP-04/44 encryption, and MCP framing — building from raw `nostr-tools` would duplicate that work | — Pending |
| Svelte 5 runes over stores | Runes are the canonical Svelte 5 reactivity model; stores are legacy; new code should not mix them | — Pending |
| Vitest + Playwright, no Storybook | Storybook adds build complexity for a single-screen app; Playwright covers visual regression well enough for this scope | — Pending |
| nsyte for deploy, not Vercel/Netlify | Project ethos is decentralized hosting; nsite/Blossom aligns with the Nostr-native stack | — Pending |
| Destroy zeroes key in memory | Browser GC timing is non-deterministic; explicit zeroing reduces the window for key extraction from heap snapshots | — Pending |

---
*Last updated: 2026-06-23 after initial project definition*
