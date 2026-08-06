# Phase 23 Context — Bounded Gift-Wrap Delivery

## Locked outcomes

- Optional `ws://localhost:4870` fan-out must be best-effort, readiness-gated, and independently bounded; it may never delay a healthy remote path.
- Every publication must have an explicit attempt and elapsed-time budget and share lifecycle cancellation with its owning relay handler.
- Room/session and coordinator shutdown must abort pending publication work.
- Existing four-second polling remains, but its current single-flight invariant must be retained and directly tested across unresolved publications.
- Diagnostics contain routing metadata only: relay URL, event ID, kind, logical operation, attempt, elapsed time, and outcome. Payload, tags containing secrets, decrypted messages, invite tokens, and keys are excluded.
- Both kind `1059` and kind `21059`, multi-relay delivery, reconnect, and canonical Cordn interoperability remain supported.

## Implementation discretion

- Exact retry delays and per-attempt deadlines, provided the total fits below the existing 12-second coordinator request deadline.
- Readiness probe implementation and short-lived positive caching.
- Diagnostic callback shape and test seams, provided production APIs remain browser-safe.

## Non-goals

- Changing the room polling cadence or replacing ContextVM transport.
- Patching installed `node_modules` or depending on Node-only cancellation APIs.
- Logging encrypted payloads or secret-bearing tags.
