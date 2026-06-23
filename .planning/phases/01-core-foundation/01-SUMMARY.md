# Phase 1 Summary: Core Foundation

**Status:** Complete
**Completed:** 2026-06-23

## Delivered

- Svelte 5 + Vite + Tailwind app scaffold with strict TypeScript and ESLint.
- Browser-generated secp256k1 coordinator key via `nostr-tools`, with npub display and public-hex copy.
- Pure coordinator state machine covering `idle`, `starting`, `running`, and `stopping`.
- Browser coordinator store that starts a ContextVM `NostrServerTransport` through a minimal MCP server.
- Relay configuration panel with add/remove/toggle, URL validation, explicit edit unlock, and non-idle lock.
- Minimal dark monospace UI with no gradients and no icon libraries.
- Playwright mock NIP-01 relay and e2e coverage for identity, start, config lock, stop, and validation error paths.
- CI workflow for lint, unit, build, and Playwright.
- nsite deploy workflow using `sandwichfarm/nsite-action@v0.5.1`, gated on successful CI and skipped when secrets are absent.
- `scripts/setup-secrets.sh` helper for deploy secrets.

## Remaining

- Phase 2: encrypted key persistence, confirmed destroy flow, per-relay status, and persistence error handling.
- Phase 3: live telemetry and production deploy verification with real repository secrets.
- Bundle-size warning remains due the ContextVM SDK payload; browser build compatibility is clean.
