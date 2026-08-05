---
status: complete
phase: 6
---

# Phase 6 Context: Coordinator Persistence

## Problem

Phase 5 registered the Cordn method surface but kept method data in memory.
That left the original browser-coordinator objective incomplete when persistence was enabled because method state disappeared after reload.

## Constraints

- Browser runtime only: no Node sqlite module, no `Buffer`, and no backend process.
- Cordn storage APIs are synchronous after coordinator construction, so persisted state must be hydrated before startup.
- Destroy must still clear key material synchronously before any asynchronous browser cache cleanup.
- No new broad storage abstraction unless it directly supports persistence.

## Chosen Shape

- Add SQLite-WASM as the browser persistence engine, using its kvvfs localStorage backing for static-site compatibility.
- Persist a versioned `InMemoryCoordinatorStorage` snapshot rather than porting every upstream table into SQL in this phase.
- Keep a localStorage snapshot fallback if SQLite-WASM initialization fails.
- Clear both the fallback key and SQLite-WASM kvvfs localStorage keys on disable/destroy.

## Non-Goals

- OPFS worker storage and cross-tab locking.
- Encrypted-at-rest Cordn method data beyond existing MLS ciphertext and encrypted coordinator key persistence.
- Remote push or live nsite deployment.
