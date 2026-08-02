---
status: complete
---

# Phase 5 Plan: Browser Cordn Method Registration

## Goal

Turn the browser ContextVM server from a transport shell into a Cordn coordinator by registering the upstream coordinator tool surface and backing it with in-memory browser-safe storage.

## Tasks

- Add upstream Cordn contracts, in-memory coordinator storage, coordinator core, rate limiter, MLS codec helpers, and method adapter.
- Wire `TransportFactory` to instantiate the coordinator, adapter, abuse limits, and method registration before connecting the Nostr transport.
- Keep browser runtime compatibility by avoiding Node-only sqlite/runtime imports and shimming fallback `crypto`.
- Add tests proving all Cordn methods are registered and `msg_post`/`msg_fetch` work through the adapter.
- Keep the Playwright start/stop flow green.

## Stop Condition

The browser MCP server registers all upstream Cordn coordinator tools, can post/fetch an MLS group message through the adapter, and the full local CI path passes.
