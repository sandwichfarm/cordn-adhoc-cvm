# Phase 1 Plan: Core Foundation

**Status:** Complete
**Generated:** 2026-06-23

## Scope

Deliver a browser-only Cordn coordinator foundation:

- Vite 8, Svelte 5, TypeScript strict, Tailwind v4 project scaffold
- Generated Nostr coordinator identity exposed as copyable npub/public hex only
- Four-state coordinator lifecycle with invalid-transition guards
- Relay add/remove/toggle configuration with idle-only edit guard
- ContextVM `NostrServerTransport` startup using generated key and enabled relays
- Local mock-relay Playwright coverage for start/stop/config lock
- GitHub Actions CI and nsite deploy workflow scaffolding

## Implementation Notes

- `@contextvm/sdk` is pinned to `0.12.0` to satisfy the 7-day dependency cooldown.
- `nostr-tools` is pinned to `2.23.5` because `2.23.7` was published on 2026-06-22.
- `@contextvm/sdk/transport` and `@contextvm/sdk/signer` subpath imports are used.
- Vite aliases browser no-op shims for the SDK logger's guarded `fs` and `path` requires.
- Destroy UI and encrypted persistence remain Phase 2.

## Validation

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm run ci`
