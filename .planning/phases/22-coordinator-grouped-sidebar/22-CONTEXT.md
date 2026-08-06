---
phase: 22-coordinator-grouped-sidebar
status: locked
requirements: [SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06]
---

# Phase 22 Context

## Locked decisions

- Preserve `Join from invite` as the first rail surface in its current location.
- Follow it with a dedicated local coordinator box containing name, runtime status, lifecycle controls, and settings.
- Put current hosted-room `Invite` and `Auto-approve` controls immediately after coordinator controls.
- Replace the selected-coordinator switcher with simultaneously visible coordinator cards. Local is always first; remote coordinators retain first-seen order.
- Use a lightweight fieldset treatment: one hairline border with the coordinator label crossing the line as a legend, not nested heavy panels.
- Only the local card has `+ Group`.
- Show five rooms per coordinator by default. `Show N more`/`Show less` expands only that card; an active room is never hidden.
- History is one collapsed-by-default section after active cards. Rotated local sessions, retired memberships, and explicit delete/leave actions feed it.
- History stores display-only tombstones (room identity, title, coordinator label/pubkey, reason, timestamp). It never stores keys, invites, MLS state, messages, or decrypted content.
- Persist first-seen ordering separately from mutable room activity. New coordinators and rooms append; state changes never reorder them.

## Non-goals

- Drag-and-drop manual ordering.
- Restoring or reopening an archived room from History.
- Changing room transport, coordinator protocol, or destructive confirmation semantics.
