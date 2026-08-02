---
status: complete
---

# Phase 11 Context: Subscription Limit Truthfulness

## Boundary

The browser app already exposes `maxUsers`, but the only live count available in the current browser adapter is active
coordinator subscriptions. Cordn MLS group membership remains opaque in encrypted upstream messages, so the UI must not claim
that the guard is authoritative user membership.

## Decision

Use active subscriptions as the browser-enforceable limit floor and label it as such everywhere visible. Preserve the existing
browser cap and max-users quota wiring.

## Deferred

Authoritative group-member guard remains deferred until Cordn exposes decrypted membership state or a reliable membership
projection suitable for the browser coordinator.
