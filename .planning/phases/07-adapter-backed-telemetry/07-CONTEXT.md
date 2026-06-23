---
status: complete
phase: 7
---

# Phase 7 Context: Adapter-Backed Telemetry

## Problem

The resource monitor listened for generic SDK transport events.
That kept the UI plausible, but Cordn method activity and coordinator subscription counts were already known inside the adapter.
They were not explicitly connected to the browser telemetry panel.

## Constraints

- Keep the SDK transport event binding as a fallback because SDK event names can still provide useful runtime signals.
- Do not expose request metadata, client private keys, or raw message bytes in telemetry.
- Keep telemetry observational. It must not affect Cordn method behavior or rate limiting.
- Active user membership is not exposed by current Cordn data because MLS membership lives inside opaque messages.

## Chosen Shape

- Add a small `CoordinatorTelemetrySink` to `CoordinatorAdapter`.
- Emit operation callbacks from the existing `recordOperation` path.
- Emit subscription count callbacks after subscribe/unsubscribe using `Coordinator.getActiveSubscriptionCount()`.
- Bind `ResourceMonitor` to the adapter when the coordinator starts and detach it on stop/destroy.
