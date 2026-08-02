# Phase 16: Resilient Rooms & Recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 16-resilient-rooms-recovery
**Areas discussed:** Contextual sidebar room actions, Unread semantics, Startup recovery state machine, Reachability and navigation truth
**Mode:** `--auto`; recommended options selected from the user's explicit prior feedback

---

## Contextual sidebar room actions

| Option | Description | Selected |
|--------|-------------|----------|
| Contextual row menu on hover/focus | Trailing three-dot trigger acts on that exact row without navigating first. | ✓ |
| Always-visible action on every row | Maximizes discovery but adds permanent visual noise. | |
| Actions only after opening the room | Preserves the current regression and fails ROOM-01. | |

**Auto-selected choice:** Contextual row menu on hover/focus.
**Notes:** Ownership determines Delete versus Leave; both require a contextual confirmation naming the room and coordinator.

---

## Unread semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Persisted per-room read cursor | Count only new inbound messages and clear only when visibly read. | ✓ |
| In-memory click-cleared counter | Simpler, but loses state and can clear unread accidentally. | |
| Unread dot only | Cannot satisfy the requested accurate count. | |

**Auto-selected choice:** Persisted per-room read cursor with visibility-aware clearing.
**Notes:** Counts are composite-room scoped, survive reloads, ignore initial hydration/own messages, and aggregate at coordinator level.

---

## Startup recovery state machine

| Option | Description | Selected |
|--------|-------------|----------|
| Gate workspace on completed local-room recovery | One startup transaction includes transport and each hosted room. | ✓ |
| Enter workspace after transport starts | Exposes the misleading disconnected-chat state the user rejected. | |
| Recover rooms after workspace renders | Makes progress fragmented and status contradictory. | |

**Auto-selected choice:** Gate the workspace on completed local-room recovery with bounded retries.
**Notes:** Current-room and aggregate progress remain on the startup screen; an actionable retry appears only after recovery is exhausted.

---

## Reachability and navigation truth

| Option | Description | Selected |
|--------|-------------|----------|
| Transport-derived status plus immediate selection | Green means reachable; every coordinator can be selected without refresh and restores its last valid room. | ✓ |
| Selection-derived green state | Conflates navigation highlight with online state. | |
| Cached coordinators appear green | Misrepresents offline coordinators as online. | |

**Auto-selected choice:** Transport-derived reachability with immediate coordinator switching and persisted last-room restoration.
**Notes:** Connecting is amber; offline/cached is gray; selection styling is independent.

## the agent's Discretion

- Exact bounded retry timings and deterministic timer injection.
- Read-watermark representation and `99+` presentation mechanics.
- Precise palette values and deterministic nearest-room selection after removal.

## Deferred Ideas

- GSAP/full-viewport startup motion (Phase 17).
- Consolidated notification controls (Phase 18).
- Grouped conversation presentation (Phase 19).
