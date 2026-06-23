---
status: complete
---

# Phase 7 Plan: Adapter-Backed Telemetry

## Goal

Make browser telemetry reflect real Cordn server activity instead of relying only on generic SDK transport events.

## Tasks

- Add an optional telemetry sink interface to `CoordinatorAdapter`.
- Notify the sink when Cordn methods record operations.
- Notify the sink when group subscriptions start and end.
- Bind `ResourceMonitor` to the adapter on start and detach on stop.
- Add unit tests for operation and subscription telemetry callbacks.

## Stop Condition

Cordn method activity drives the message-rate window, subscription counts come from the coordinator, and targeted unit tests pass.
