---
status: complete
---

# Phase 3 Plan: Telemetry & Deployment

## Goal

Expose live browser resource estimates while the coordinator is running and verify the existing nsite deploy path is gated on green CI and clear missing-secret behavior.

## Scope

- Add a `ResourceMonitor` singleton for subscription count, rolling message rate, and browser memory estimate.
- Render a telemetry panel only while coordinator status is `running`.
- Reset telemetry state on coordinator stop, startup failure, and destroy.
- Cover telemetry with unit tests and Playwright e2e assertions.
- Guard the deploy workflow with tests for CI-success trigger, missing-secret skip message, action version, and helper executable bit.

## Out Of Scope

- Per-relay latency diagnostics.
- Raw event log display.
- NIP-42 authentication.
- Key import.
- New deployment dependencies or workflow rewrites.

## Validation

- `pnpm run ci`
- `bash -n scripts/setup-secrets.sh`
- `git diff --check`
- Privacy/style scan for key leaks, console leaks, gradients, and `svelte/store`
- Live Playwright smoke against a mock relay with screenshot
