# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-23)

**Core value:** A single browser tab acts as a fully functional, self-sovereign Cordn coordinator reachable over Nostr relays — no backend, no account, no installation.
**Current focus:** Phase 1 — Core Foundation

## Current Position

Phase: 1 of 3 (Core Foundation)
Plan: 0 of 5 in current phase
Status: Ready to plan
Last activity: 2026-06-23 — Roadmap created from research summary and requirements

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:** No data yet

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Use `@contextvm/sdk` subpath imports (not barrel) to avoid bundling Node built-ins — validate with `vite build` on first commit
- Phase 1: Ban `svelte/store` via ESLint from day one; runes only
- Phase 2: PBKDF2 at ≥100,000 iterations (NIST SP 800-132 recommends 600k); single-blob localStorage write for key + config atomicity

### Pending Todos

None yet.

### Blockers/Concerns

- `@contextvm/sdk` 0.6.2 exact API surface (`NostrServerTransport` constructor, `PrivateKeySigner` key type) needs verification before writing TransportFactory in Phase 1 plan 01-03
- `ApplesauceRelayPool` reconnect behavior unknown — affects whether ResourceMonitor needs reconnect tracking (Phase 3)

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-23
Stopped at: Phase 1 context captured; ready to plan
Resume file: .planning/phases/01-core-foundation/01-CONTEXT.md
