# Phase 2 Plan: Security & Persistence

**Status:** Complete
**Generated:** 2026-06-23

## Scope

Deliver the Phase 2 security and persistence requirements:

- Encrypted optional key persistence using Web Crypto PBKDF2 + AES-GCM.
- Passphrase prompt on reload when an encrypted key exists.
- Wrong-passphrase inline error with a fresh-key escape path.
- Confirmed destroy flow that stops the coordinator, zero-fills key memory, clears storage, clears caches, and resets the UI.
- Per-relay connection status badges in the relay list.
- Unit and Playwright coverage for persistence and destroy behavior.

## Implementation Notes

- `src/crypto/key-storage.ts` owns the single persisted localStorage blob at `cordn:v1:persistence`.
- `PBKDF2_ITERATIONS` is set to `600_000`.
- `CoordinatorStore.destroy()` awaits transport stop first, then executes `keyManager.destroy()` and `keyStorage.clear()` in one synchronous block before any cache-cleanup awaits.
- Relay status is optimistic: enabled relays move `connecting -> connected` on start success and `error` on start failure.
- Relay config remains ephemeral; only the coordinator key is persisted.

## Validation

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm run ci`
- Rendered screenshot smoke at `/tmp/cordn-browser-phase2.png`
