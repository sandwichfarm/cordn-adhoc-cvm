# Phase 3: Telemetry & Deployment — Discussion Log

**Date:** 2026-06-23
**Mode:** Headless autonomous (no user present)

---

## Gray Areas Identified

### 1. Subscription Counter: SDK hook vs synthetic

**Options considered:**
- Hook `NostrServerTransport` internal events if exposed
- Maintain a manual synthetic counter

**Selected:** Attempt SDK event hook with a 10-line cap; fall back to synthetic 0 with "(est.)" label.

**Rationale:** Requirements explicitly allow "sourced from SDK or manual counter." STATE.md flags ApplesauceRelayPool as an unknown black box. The TELEMETRY-05 "(est.)" label is the spec's own escape hatch for this uncertainty.

---

### 2. Telemetry State Ownership: CoordinatorStore vs Separate Class

**Options considered:**
- Add `subscriptionCount`, `messageRate`, `memoryBytes` fields directly to `CoordinatorStore`
- Create a separate `ResourceMonitor` singleton class

**Selected:** Separate `ResourceMonitor` singleton in `src/coordinator/resource-monitor.svelte.ts`.

**Rationale:** `CoordinatorStore` is already 168 lines managing 6+ `$state` fields and async lifecycle. A separate singleton follows the established `keyStorage` / `transportFactory` pattern and keeps concerns separated.

---

### 3. Message Rate: Rolling Window Implementation

**Options considered:**
- Timestamp array (push timestamp per message, filter to last 60s)
- Bucket counter (12 × 5-second buckets, rotate on each tick)
- EMA decay per second

**Selected:** Timestamp array, 60-second window, 5-second update interval.

**Rationale:** 60s window = directly readable as events/min. Timestamp array is simple and bounded (reasonable message volumes for a browser coordinator). 5s interval avoids jitter without excessive CPU.

---

### 4. Deploy Pipeline: Build new vs verify existing

**Options considered:**
- Rebuild `deploy-nsite.yml` from scratch
- Verify the existing implementation

**Selected:** Verify existing — `deploy-nsite.yml` and `setup-secrets.sh` were already implemented in Phase 2. Plan 03-02 verifies correctness and git executable bit only.

**Rationale:** Both files exist and cover all CICD-03..06 requirements. Rebuilding would be churn.

---

### 5. ResourceMonitor Placement in App Layout

**Options considered:**
- Below `LifecyclePanel` (before RelayConfigPanel)
- Below `PersistencePanel` (at the bottom)
- Inside `LifecyclePanel`

**Selected:** Between `LifecyclePanel` and `RelayConfigPanel`.

**Rationale:** Telemetry is about coordinator runtime state — more closely related to lifecycle than to relay config. Placing it directly below the lifecycle control panel creates a logical grouping: start/stop → what's happening → config.

---

## Claude's Autonomous Decisions

All five gray areas were decided without user input (headless mode). No scope changes were introduced. All decisions stay within Phase 3's requirements.

## Deferred Items

- ApplesauceRelayPool reconnect tracking — SDK internals unknown; defer
- Relay config persistence — no requirement; defer
- Per-relay latency (DIAG-01) — v2 requirement; out of Phase 3 scope
