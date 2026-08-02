---
phase: 16
slug: resilient-rooms-recovery
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-02
---

# Phase 16 — UI Design Contract

> Visual and interaction contract for Room Navigation & Unread State (ROOM-01–03) and Coordinator Startup & Recovery (BOOT-01–03). Preserve the existing CAHMLS cypherpunk shell; Phase 17 owns startup-motion redesign.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — project is Svelte 5 + Vite, not a React shadcn target |
| Preset | not applicable |
| Component library | none; use existing Svelte components and native `<dialog>` |
| Icon library | none; use the existing text glyph treatment (`•••`, `×`, `#`, `→`) with accessible labels |
| Font | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` |

Existing visual authority: `src/app.css`, `WorkspaceNav.svelte`, `RoomActionsMenu.svelte`, `RoomRemovalDialog.svelte`, and `StartupSignalField.svelte`. Do not introduce a second visual language, a component package, or an icon package in this phase.

---

## Spacing Scale

Declared values (multiples of 4 only):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Badge-to-label gap, inline status-dot gap, menu separator inset |
| sm | 8px | Menu offset, compact row internals, button/icon gap |
| md | 16px | Default card, dialog, and startup-status padding |
| lg | 24px | Recovery-panel section spacing |
| xl | 32px | Major startup-panel separation |
| 2xl | 48px | Empty-state vertical breathing room |
| 3xl | 64px | Page-level recovery composition spacing |

Exceptions: All pointer-operable action triggers, dialog buttons, and coordinator/room rows have a 44px minimum hit area. Keep the existing larger room-row heights where present.

---

## Typography

Phase 16 additions use only these four sizes and two weights. Existing unchanged components may retain their current CSS until touched.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Metadata / status label | 8px | 600 | 1.25 |
| Navigation label / compact control | 10px | 400 | 1.4 |
| Body / dialog copy / error detail | 12px | 400 | 1.5 |
| Dialog and recovery heading | 18px | 600 | 1.2 |

Use uppercase with 0.08em letter spacing only for metadata/status labels. Room names, coordinator names, and recovery-room names remain sentence case and must not be transformed.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#030303` | App background and deepest field surface |
| Secondary (30%) | `#07100a` | Sidebar, menus, cards, dialog body, and recovery panel surfaces |
| Accent (10%) | `#7cf59d` | Selected-room inset, keyboard focus outline, completed recovery progress, confirmed reachable dot, and primary `Retry recovery` action |
| Recovering / warning | `#e4e78d` | Connecting/retrying dot, current recovery item, and non-terminal retry label |
| Neutral / cached | `#718277` | Cached or offline-but-readable status, subdued metadata, and inactive badges |
| Destructive | `#dc6f66` | Delete/leave confirmation action, deleted or terminally unavailable indicator, and destructive error border only |

Accent reserved for: the selected-room marker, a visible keyboard focus treatment, successful recovery completion, confirmed reachability, and the explicit recovery retry CTA. Green never indicates selection by itself, cached availability, or an in-progress connection. Selection stays visible with the row surface/inset even when the reachability dot is amber, gray, or destructive.

---

## Component and Interaction Contract

| Surface | Required contract |
|---------|-------------------|
| Sidebar room row | Keep the full row directly selectable. On pointer hover or `:focus-within`, reveal a trailing 44px three-dot button. The button is a separate control, stops pointer/click and keyboard activation propagation, and captures `{ coordinatorPubkey, roomId }` before opening its menu. It must not navigate or alter the active-room/read state. |
| Row action menu | Reuse the existing dark bordered menu treatment; right-align it to its row trigger with an 8px vertical offset. Its header shows `Room actions` and `# {roomName}`. It contains exactly one removal action for this phase: `Delete room` for the active local host, otherwise `Leave room`. Escape, outside click, or cancellation closes it and returns focus to the source trigger. |
| Removal dialog | Reuse `RoomRemovalDialog` and native modal behavior. The title names `# {roomName}`; the body names the coordinator/host and states cached/history impact. `Delete room` is destructive and irreversible; `Leave room` removes this device's membership/cache only. Disable both dialog controls while pending, expose an inline user-safe failure, and return focus to the captured row trigger after cancel. On success select the deterministic nearest remaining room; if none remains, select that coordinator's empty state. |
| Room unread badge | Render only when the exact room's unread count is greater than zero. Place it in the row’s trailing control cluster before the three-dot trigger; use a compact 16px-high neutral/green-tinted rectangular badge with tabular numerals. Display `1`–`99`, then `99+`; retain the full count in state and in the accessible name. Do not render a zero badge. |
| Coordinator unread badge | Render the sum of child-room unread counts in the coordinator heading using the same cap and accessible total. It is informational, never a clickable substitute for coordinator selection. |
| Coordinator selection | A coordinator row remains directly selectable. Immediately switch visible context, then open that coordinator’s valid remembered composite room; fall back to its first room, then its empty state. The selected row styling is independent of every connectivity color. |
| Reachability indicator | Use a 6–8px dot plus visible text where space permits: green only for confirmed reachable session, amber for connecting/recovering, neutral gray for cached/offline, and destructive red/square for deleted or terminally unavailable. Do not derive this state from the active row or coordinator transport alone. |
| Startup recovery surface | Keep the existing startup field/screen mounted until coordinator transport and all recoverable hosted rooms are successful. Add a stable `Restoring rooms` stage with current-room name and aggregate progress. Do not add GSAP/masking work in this phase. |

The startup recovery heading and current room name are the primary visual anchor. Aggregate progress is secondary, and the `Retry recovery` control appears only after terminal exhaustion; no other control competes with it in that state.

### Recovery state presentation

| State | Visible content | Controls / prohibition |
|-------|-----------------|------------------------|
| Zero hosted rooms | `Restoring rooms` then `No rooms to restore` with `0 of 0 rooms restored`; transition directly to ready. | No retry and no empty error. |
| Restoring | Eyebrow `Restoring rooms`; heading `Restoring # {roomName}`; progress text `{completed} of {total} rooms restored`; determinate progress bar. | Completed count is monotonic. Keep startup screen visible; no hosted chat, offline banner, or MCP error is rendered. |
| Retrying | Retain the same room and aggregate progress; status line `Reconnecting to # {roomName}` and subdued `Trying again…`. | Amber only; automatic retry remains in the startup surface with no user action required. |
| Exhausted failure | Heading `Couldn’t restore # {roomName}`; safe diagnostic line only (room name and generic connection status, never invite token, keys, messages, or MLS state). | Show `Retry recovery` as the primary CTA. Keep startup surface mounted; do not fall through to a disconnected local chat. |
| Recovered | Current item gains green completion treatment and progress advances once. | Reveal the local workspace only after all recoverable rooms have recovered. |

### Keyboard, focus, and announcements

- Every room row, three-dot trigger, menu item, coordinator row, dialog button, and retry button has a `#7cf59d` visible `:focus-visible` outline or equivalent 2px inset; hover styling is never the sole disclosure mechanism.
- Use `aria-haspopup="menu"`, `aria-expanded`, and an accessible name `More actions for # {roomName}` for each row action trigger. The menu retains its `menu` / `menuitem` semantics.
- The native dialog traps focus. Cancel, Escape, backdrop click, and its close button all preserve the frozen target and return focus to the original sidebar trigger. Pending state cannot be dismissed or double-submitted.
- Announce recovery stage changes and terminal recovery failure through one polite live region. Progress announcements are limited to stage/current-room changes and completion increments; retries do not repeatedly announce attempts.
- When a room first becomes unread, announce once: `New messages in # {roomName}`. Subsequent count increments update the badge/accessibility name without another live announcement. Reading the currently visible room is silent.
- All room, coordinator, host, and diagnostic strings wrap in dialogs/recovery copy; in compact navigation rows they truncate with ellipsis and expose the full text through the accessible name/title. The room switcher and dialog body scroll vertically rather than clipping content.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Retry recovery` |
| Coordinator empty-state heading | `No rooms for this coordinator` |
| Coordinator empty-state body | `Create a room or open a current invite to add one here.` |
| Recovery in progress | `Restoring # {roomName}` / `{completed} of {total} rooms restored` |
| Recovery retry | `Reconnecting to # {roomName}` / `Trying again…` |
| Recovery error | `Couldn’t restore # {roomName}. Check your connection, then retry recovery.` |
| Delete confirmation | `Delete # {roomName}?` — `This closes the room on your coordinator and permanently removes its invite, host keys, and cached history from this device. This cannot be undone.` |
| Leave confirmation | `Leave # {roomName}?` — `This removes your membership keys and cached history from this device. You’ll stop receiving messages and need a current invite to rejoin.` |
| Pending action labels | `Deleting…` / `Leaving…` |

Do not expose raw errors, relay URLs, keys, invite tokens, message contents, or internal coordinator/MCP terminology in recovery or removal errors.

---

## UI Considerations

Applicable state considerations resolved: 16 covered, 4 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Coordinator room collection | ✅ covered | A selected coordinator with zero valid rooms renders the documented coordinator empty-state copy and never routes to a stale remembered room. |
| populated | Coordinator room collection | ✅ covered | Rooms remain grouped by exact coordinator identity; selected styling and reachability dots are independent. |
| zero-one-many | Coordinator room collection and unread badges | ✅ covered | Zero renders no badge; one shows `1`; many sum at coordinator level and cap visual presentation at `99+` without dropping the stored exact count. |
| overflow | Room/coordinator collection | 🧪 backstop | Playwright proves long lists scroll within the switcher, while row names ellipsize rather than overflowing action/badge controls. |
| long-text | Room row, coordinator row, action-menu header | ✅ covered | Compact labels ellipsize; full room name remains in accessible labels/titles; dialog/recovery text wraps. |
| loading | Startup recovery surface | ✅ covered | The startup screen remains mounted with current-room and monotonic aggregate determinate progress until all recovery succeeds. |
| error | Startup recovery surface | ✅ covered | Transient timeout is retrying, not error; only exhausted recovery shows the documented named-room safe error and retry CTA. |
| populated | Startup recovery surface | 🧪 backstop | Playwright proves each deterministic hosted room advances the displayed completed/total progress without backward movement. |
| empty | Startup recovery surface | ✅ covered | Zero hosted rooms visibly complete `0 of 0 rooms restored` and continue without retry/error. |
| long-text | Recovery room name and diagnostic detail | ✅ covered | Room names wrap in startup/error surfaces; diagnostics are one safe summary line and never leak sensitive material. |
| form | Removal dialog pending submission | ✅ covered | Confirm/cancel controls disable while pending; a safe inline failure preserves the dialog and frozen exact target. |
| error | Removal dialog | 🧪 backstop | E2E covers a failed delete/leave: error remains inline, no navigation occurs, and duplicate submit is prevented. |
| long-text | Removal dialog | ✅ covered | Long room/host names wrap in the title/body; destructive content remains readable in the scrollable dialog body. |
| nav | Row contextual action trigger | ✅ covered | Hover/focus reveals a distinct trigger; activating it neither selects the row nor clears unread state. |
| error | Recovery/local chat boundary | 🧪 backstop | E2E asserts that startup/retry/exhausted-failure states never render a disconnected local hosted chat or offline banner. |
| overflow | Dialog and room switcher | ✅ covered | Dialog body and switcher use vertical scrolling within the viewport; no horizontal clipping or unbounded modal. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn is not initialized and this is a Svelte project |
| third-party | none | not applicable — no third-party registry blocks declared |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS (visual anchor clarified after checker FLAG)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-02
