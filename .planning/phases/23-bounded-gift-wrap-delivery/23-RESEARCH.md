# Phase 23 Research — Bounded Gift-Wrap Delivery

## Root cause

`createRequiredRelayPool()` starts optional-local publication without awaiting it. ContextVM SDK `ApplesauceRelayPool.publish()` explicitly retries forever until its supplied `abortSignal` fires. The wrapper supplies no owned deadline and its `.catch()` is therefore unreachable while localhost is offline. Each four-second room sync can create more encrypted MCP requests and more immortal loops.

## Relevant existing behavior

- `RelayHandler.publish(event, { abortSignal })` already accepts standard browser `AbortSignal`.
- The SDK checks that signal between retry attempts and throws `Publish aborted`.
- Room sync already uses a `pendingSync` single-flight promise; regression coverage must prove timer ticks reuse it.
- `ChatRoomSession.stop()` closes its ContextVM client, which closes transports and disconnects relay handlers. A handler-owned controller set can convert that close into publication cancellation.
- The existing 12-second request timeout provides an upper bound: publication budgets should finish before it.

## Recommended design

Wrap SDK pools behind a lifecycle-owned bounded publisher. Link caller and disconnect signals, use deterministic outer retry delays and per-attempt abort deadlines, track every controller, and abort all on disconnect. Probe localhost with a short browser WebSocket handshake before publishing and cache only successful readiness briefly. Keep local fan-out detached from primary success but tracked and bounded. Expose injected pool/probe/timer seams for deterministic unit tests.

## Pitfalls

- `ApplesauceRelayPool.connect()` validates URLs but does not prove a socket is open.
- A timeout implemented only with `Promise.race()` leaks the underlying infinite SDK loop; it must abort the signal.
- Sharing one aborted lifecycle controller across a replacement handler makes the replacement unusable; replacement must construct a fresh handler.
- Multi-relay pool diagnostics cannot truthfully attribute a relay-specific ACK. Outcomes should distinguish per-URL attempt membership from aggregate primary acceptance.
