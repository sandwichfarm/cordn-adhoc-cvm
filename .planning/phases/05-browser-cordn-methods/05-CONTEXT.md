---
status: complete
---

# Phase 5: Browser Cordn Methods - Context

**Gathered:** 2026-06-23

## Problem

The browser app could start a `NostrServerTransport`, but the MCP server did not register Cordn's coordinator tool surface. That meant it was a reachable ContextVM server shell, not yet a functional Cordn CVM.

## Upstream Evidence

- Source: `https://github.com/Cordn-msg/cordn/tree/master/src/server`
- Fresh upstream clone checked at commit `1236d36`.
- Relevant upstream files:
  - `src/server/coordinatorMethods.ts`
  - `src/server/coordinatorServer.ts`
  - `src/server/rateLimit.ts`
  - `src/coordinator/coordinator.ts`
  - `src/coordinator/storage/inMemoryStorage.ts`
  - `src/contracts/index.ts`

## Decisions

- Vendor the browser-safe in-memory Cordn coordinator core under `src/cordn/`.
- Exclude Node-only sqlite runtime files.
- Use `ts-mls@2.0.0-rc.12` to match upstream's current Cordn source API.
- Add `@noble/ciphers@2.2.0` explicitly to satisfy the `ts-mls` peer dependency.
- Suppress default browser coordinator logs to preserve the no-console leak surface.
- Patch the upstream Node timer `unref` check so it is safe with numeric browser timer handles.

## Deferred

- sqlite-wasm or worker-relay persistence for coordinator data.
- Cross-tab or service-worker lifetime management.
- Remote push and live GitHub deployment.
