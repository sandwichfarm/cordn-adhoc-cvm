---
status: complete
---

# Phase 4: Objective Gap Closure - Context

**Gathered:** 2026-06-23

## Why This Phase Exists

The initial three-phase milestone covered the local plan, but the original user objective includes broader requirements that were not represented explicitly:

- Some configuration options should remain editable with guards.
- Number of supported users must not be reducible below the current chat/user count.
- Browser execution needs imposed limits such as maximum users.
- Announcement must be an explicit start option, defaulting off.
- Full Cordn server functionality must match the upstream `src/server` surface.

## Evidence

Upstream `https://github.com/Cordn-msg/cordn/tree/master/src/server` contains server files including `coordinatorServer.ts`, `coordinatorMethods.ts`, `runtimeConfig.ts`, and `rateLimit.ts`.

The current browser implementation already starts a `NostrServerTransport`, but it still lacks upstream Cordn coordinator method registration for tools such as `kp_publish`, `welcome_store`, `msg_post`, and `msg_sub`.

## Slice Chosen

This phase closes the contained browser config/limits gap without pretending to complete upstream method parity:

- Add runtime options for announcement and maximum users.
- Default announcement off.
- Enforce a hard browser max-users cap.
- Track active user count in config state for future Cordn adapter updates.
- Prevent lowering max users below active user count.
- Pass announcement and max-users options into transport creation.

## Deferred

- Browser-local Cordn coordinator method adapter and storage.
- sqlite-wasm or worker-relay backed state persistence.
- Real active user count derived from actual Cordn group membership.
- Remote push and live GitHub deployment.
