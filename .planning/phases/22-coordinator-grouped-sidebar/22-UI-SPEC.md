---
phase: 22
slug: coordinator-grouped-sidebar
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-06
---

# Phase 22 — UI Design Contract

## Design system

Use existing Svelte 5 components, monospace typography, square geometry, and CAHMLS dark-green tokens. No component or icon dependency is added.

## Layout contract

The scrollable rail content is ordered: Join from invite, local coordinator runtime stack, active coordinator room cards, History, then sticky personal controls. The runtime card and selected hosted-room access controls form one visually attached stack with no gap or doubled border. That local stack remains visible while a room belonging to another coordinator is selected. Cards use `fieldset`/`legend` semantics and a single `#293832` hairline. The legend background matches the rail so the label creates a clean gap through the border.

Local runtime controls are not repeated in its room card. The runtime card shows a status dot, coordinator name, plain-language status, lifecycle action, and settings. Remote card legends show reachability and a short stable coordinator label. Local room card is first even when empty and exposes `+ Group`; remote cards follow persisted first-seen order.

## Density and reveal

- Rail section gap: 12px; card-to-card gap: 8px.
- Card inset: 4px 6px 6px; legend horizontal padding: 6px.
- Room row minimum height: 36px.
- Default visible rooms: five per coordinator. If the active room falls after five, include it in place of the fifth item so context is never hidden.
- Reveal copy: `Show {N} more`; collapse copy: `Show less`.

## Color and hierarchy

The rail remains `#0d1310`; cards and legends share that surface. Hairlines use `#293832`; active rows alone use `#17241b` and the green active mark. Status and unread colors retain existing semantic tokens. History uses lower-contrast `#718277` copy and no active treatment.

## Copywriting contract

| Surface | Copy |
|---|---|
| Local room action | `+ Group` |
| Empty local card | `No groups yet` / `Start the coordinator, then create a group.` |
| Empty remote card | `No active groups` |
| Reveal | `Show {N} more` / `Show less` |
| History summary | `History` plus item count |
| Empty history | History control is omitted |
| Reasons | `Coordinator key rotated`, `Deleted`, `Left`, `Identity retired` |

## UI considerations

| Category | Status | Resolution |
|---|---|---|
| Empty | covered | Local card persists with actionable empty copy; empty remote/history cards are omitted. |
| Loading | covered | Existing local recovery unavailable/busy states remain on exact rows without reordering. |
| Overflow | covered | Five-item cap and per-card reveal prevent unbounded rail growth; outer rail remains scrollable. |
| Long text | covered | Coordinator and room labels truncate with full `title`/accessible names retained. |
| Zero/one/many | covered | Cards support empty local, single-row, capped, expanded, and history states. |
| Compact viewport | backstop | Browser test proves drawer containment, focusable reveals, and no document overflow. |

## Checker sign-off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-06
