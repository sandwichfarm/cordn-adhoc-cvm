---
status: complete
---

# Phase 6 Plan: Coordinator Persistence

## Goal

Persist Cordn coordinator method data in the browser when persistence is enabled, without changing the browser-only runtime contract.

## Tasks

- Add SQLite-WASM dependency and browser storage adapter.
- Teach `InMemoryCoordinatorStorage` to export and hydrate a versioned snapshot.
- Replace Node `Buffer` base64 helpers with browser-safe APIs.
- Wire `TransportFactory` to hydrate storage before coordinator startup when persistence is enabled.
- Clear coordinator persistence when the user disables persistence or destroys the coordinator.
- Add tests for snapshot round-trip and browser base64 behavior.

## Stop Condition

Cordn message state round-trips through a persistent storage snapshot, destroy clears persisted coordinator state, and full local CI passes.
