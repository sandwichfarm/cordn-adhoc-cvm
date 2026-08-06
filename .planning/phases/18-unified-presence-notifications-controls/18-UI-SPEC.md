---
phase: 18
slug: unified-presence-notifications-controls
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-03
---

# Phase 18 — UI Design Contract

> Visual and interaction contract for unified personal presence, notification settings, in-app activity, and trusted room invitations. This phase retains the restrained CAHMLS operator shell and makes ownership boundaries obvious; it does not add a notification service or a second visual system.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — existing manual Svelte component styling with Tailwind v4 base import |
| Preset | not applicable — this is a Svelte 5/Vite project, not a React shadcn target |
| Component library | existing local Svelte components and native semantic HTML |
| Icon library | none — retain existing Unicode/operator glyph treatment with explicit accessible names |
| Font | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` |

Continue the approved CAHMLS language: flat near-black/green surfaces, thin muted-green dividers, square corners, compact monospace metadata, and sparse bright-green signal. Do not introduce cards with rounded corners, gradients, icon packages, toast notifications, or a separate page for personal controls. The existing header and its compact drawer/bottom-sheet pattern remain the shell owner.

| Source | Contract decisions applied |
|--------|----------------------------|
| `18-CONTEXT.md` | D-01 through D-15: personal presence ownership, separate bell/settings roles, invitation semantics, host separation, and compact behavior. |
| `18-RESEARCH.md` | Feed-first event model, trusted live invitations, optional desktop projection, persisted minimal resolution ledger, and existing test seams. |
| `REQUIREMENTS.md` / `ROADMAP.md` | PRES-01/02, INVITE-01, SHELL-01, and NOTF-01/02/03 success conditions. |
| `15-UI-SPEC.md`, `17-UI-SPEC.md`, `17-UI-REVIEW.md` | Existing operator tokens, labelled controls, focus behavior, content containment, no-gradient restraint, and reduced-motion discipline. |
| Current `UserProfile`, `NotificationCenter`, `InviteInbox`, and `HostWorkspace` | Existing profile menu, 44px compact controls, desktop popover / compact fixed-sheet treatment, scrim, `inert`, and focus patterns. |

---

## Spacing Scale

Declared values (multiples of 4 only):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Presence-dot offset, badge inset, inline metadata separation, feed-row sub-gaps |
| sm | 8px | Trigger/menu offset, cluster internal gaps, compact action gaps, entry padding increments |
| md | 16px | Panel sections, standard row padding, desktop cluster separation |
| lg | 24px | Feed/settings section breaks and panel body rhythm |
| xl | 32px | Desktop panel and empty-state breathing room |
| 2xl | 48px | Large empty-state vertical breathing room only |
| 3xl | 64px | Not required by Phase 18 controls; preserve only for existing shell composition |

Exceptions: all pointer-operable header triggers, menu options, feed actions, settings toggles, and sheet close controls have a minimum 44px block hit area. The attached presence dot is decorative geometry (6–8px) and does not reduce the avatar trigger’s hit area. Desktop dividers are 1px visual rules, not spacing tokens.

---

## Typography

Use only these four semantic sizes and exactly the two declared weights for new or touched Phase 18 UI. Existing untouched shell microcopy may remain unchanged until it is edited.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Metadata / timestamp / cluster label | 10px | 400 | 1.3 |
| Body / control / feed detail | 12px | 400 | 1.5 |
| Feed item title / section emphasis | 14px | 600 | 1.4 |
| Panel heading | 18px | 600 | 1.2 |

Use uppercase with the existing 0.08–0.12em tracking only for compact metadata, category labels, and timestamps. Use `font-variant-numeric: tabular-nums` for unread counts and relative timestamps. Room titles, person names, and presence names remain sentence case; never uppercase or truncate a title in a way that hides which room an invitation concerns.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#030303` | Workspace ground, header field, and surrounding scrim |
| Secondary (30%) | `#09100c` | Profile menu, feed/settings panels, bottom sheets, quiet rows, and cards |
| Accent (10%) | `#7cf59d` | Active avatar-presence dot, unread badge/count, selected presence choice, explicit `Enable desktop notifications` CTA, accepted primary invitation action, and visible keyboard focus |
| Warning | `#e4e78d` | Restart-required pip and non-terminal notification-status guidance only |
| Destructive | `#ffaaa3` | Confirmed invitation dismissal, destructive confirmation copy, and terminal user-safe error text |

Accent reserved for: the six elements explicitly listed above. It is never the default color for every header control, every feed row, all status dots, or passive timestamps. Presence state is always also named in text; green is not the only representation of online. Use muted `#718277`/`#82958a` for inactive/invisible/offline details and `#293832`/`#496451` for dividers and quiet borders.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Enable desktop notifications` — only in Notification settings while browser permission is `default` |
| Feed empty heading | `No personal activity` |
| Feed empty body | `Invites, room updates, and contact activity will appear here.` |
| Settings empty/unsupported state | `Desktop notifications are not available in this browser. Your in-app activity feed still works.` |
| Error state | `Couldn’t update notification settings. Your previous choices are still in effect. Try again.` |
| Invitation action failure | `Couldn’t open this room. The invitation is still available. Try again.` |
| Destructive confirmation | `Dismiss invitation?` — `This removes the invitation from this device and it will not reappear during the relay replay window.` Actions: `Keep invitation` and `Dismiss invitation`. |

Use these exact status strings:

- Avatar/status trigger: `Open profile. Presence: Online`, `Open profile. Presence: Invisible`, or `Open profile. Presence: Offline`; replace `Open` with `Close` while expanded.
- Presence options: `Online` / `Visible privately to followers`; `Invisible` / `Do not publish your availability`; `Offline` / `Do not publish your availability`. Without an eligible signer, append the visible helper `Saved on this device. Connect a signer to share it.` Do not disable any personal preference choice for lack of a signer.
- Settings trigger: exactly `Notification settings`; its accessible name is identical at every breakpoint.
- Bell trigger: `Open notifications, {n} unread` or `Open notifications, no unread`.
- Feed heading: `Notifications`; unread sublabel: `{n} unread` or `All caught up`.
- Invitation entry: `Room invitation`; metadata `From {senderName}`; primary action `Accept invitation`; secondary action `Dismiss invitation`.
- Permission states: `Desktop notifications are off`, `Desktop notifications are enabled`, and `Notifications are blocked by your browser. Change the browser setting, then reopen Notification settings.`

Never show raw invite URLs, room secrets, decrypted envelope data, relay URLs, signer errors, stack traces, or `MCP error` text in any profile, settings, feed, confirmation, or live region.

---

## Phase 18 Surface and Interaction Contract

### Shell ownership and hierarchy

The selected room content pane remains the workspace's primary visual anchor. Controls are distributed by durable context instead of collected into a dense command bar.

| Surface | Accessible owner | Contents in order | Visual contract |
|---------|------------------|-------------------|-----------------|
| Global header | `Workspace navigation` | CAHMLS brand with coordinator status dot; live message rate; `Manage` toggle | No active-room avatar/title, room-sync label, coordinator runtime word, lifecycle control, account control, or statistics card. `Manage` aligns to the header edge with a full-height left divider. |
| Sidebar top | `Join from invite` | One full-width invite redemption trigger | First actionable sidebar item, flat and high-contrast enough to scan without adding a card stack. |
| Selected local coordinator heading | `Coordinator controls` | Coordinator identity/status; settings; triangle start or square stop; destroy | Runtime state appears once through the named status dot. Glyph controls keep explicit accessible labels and destructive confirmation. Remote coordinators never receive local lifecycle/destructive actions. |
| Sidebar footer | `Personal controls` | Avatar/profile with attached presence dot; separate compact presence selector; bell/feed; plainly labelled `Notification settings` | Pinned to the bottom, compact and modern, with one quiet top divider. Profile/presence/feed/settings menus open upward on desktop and use established bottom sheets at compact widths. |

- Remove the old header-level presence owner, duplicate lifecycle/status surfaces, the header room-context cluster, and the sidebar `ResourceMonitor` panel. The only statistic retained is message rate beside the brand.
- Move host message identity/badge editing to coordinator administration (`CoordinatorSettings`); remove it completely from `UserProfile`.
- Presence actions never start, stop, wake, destroy, or otherwise mutate coordinator lifecycle. `LifecyclePanel` remains the behavior owner but renders its compact controls inside the coordinator heading.
- At 900px and below the sidebar remains the contextual owner. The existing rail toggle exposes `Join from invite`, coordinator controls, rooms, and the pinned personal footer; profile/presence/feed/settings retain their viewport-contained bottom-sheet treatment.

### Profile menu and personal presence

- Keep `UserProfile` as the first personal trigger. Attach the 6–8px dot inside the avatar’s positioned box at its lower-right edge; the trigger accessible name carries the state. The profile panel omits the Nostr `about` field and is no wider than its sidebar owner.
- The avatar trigger remains a 44px-or-larger button with `aria-haspopup="dialog"`, `aria-expanded`, and the exact status-bearing accessible name from Copywriting. On desktop it may retain avatar/name/auth summary; compact layout may show only the avatar and dot, never an unlabeled icon.
- The separate footer presence dropdown uses equivalent buttons carrying `role="radio"` and `aria-checked`. Each option includes its named dot and title without explanatory prose. The selected option has a quiet secondary row fill plus an accent border/indicator; do not rely on the dot alone.
- Selecting a presence option from the separate footer dropdown updates local state immediately, closes back to its trigger, and announces `Presence set to {state}.` through a polite live region. If publishing cannot occur, retain the selected state; do not display an error or imply the coordinator is stopped.
- Preserve profile identity, rotation, and signer behavior from Phase 15. Long display names and public-key summaries ellipsize in one line; menu prose wraps. The panel is `width: min(22rem, calc(100vw - 24px))` on desktop.

### Notification settings

- `NotificationCenter` becomes settings-only. Its visible and accessible trigger is exactly `Notification settings`; it does not use a bell glyph as its sole label. Opening it only calls permission synchronization/rendering; it must never call `Notification.requestPermission()`.
- Desktop settings open as the existing right-aligned dark panel below the trigger, `width: min(24rem, calc(100vw - 16px))`. It has `role="dialog"`, `aria-modal="true"`, labelled heading `Notification settings`, 44px labelled close button, Escape/backdrop close, focus containment, and focus return to its trigger.
- Settings panel order is fixed: heading; desktop-status block; explicit permission CTA or desktop master switch; category preferences; cadence selection; error/live-status region. Use 1px separators between blocks and 16px standard padding.
- While permission is `default`, show the exact primary CTA `Enable desktop notifications`; this is the sole UI path that may request browser permission. While it is `granted`, show the persisted `Desktop notifications` switch. While `denied`, show the documented recovery copy and no spoofed retry/prompt control. While unsupported, show the documented unsupported copy. In all states, retain in-app feed availability and preference context.
- Categories are labelled `People coming online`, `New messages`, `Room invites`, and `Join requests`. Keep online enabled by default and the other desktop categories opt-in. Category switches are disabled/visually muted when desktop delivery is off but remain readable. Cadence select label is `Group updates`; choices are `Every 5 sec`, `Every 15 sec`, `Every 30 sec`, and `Every minute`.
- Persisted choices update without a page-level toast. Show a polite inline status only when an operation is in flight or fails. Do not place feed controls or invitation actions in settings.

### Bell and in-app notification feed

- Add a separate `NotificationFeed` bell button directly after the avatar. Use the existing Unicode/operator glyph style but provide the exact accessible bell name. Its unread badge is a compact, non-pill 16px-high square/rectangular counter at the trigger’s upper-right; render `1`–`99`, then `99+`. Do not render a zero badge.
- The bell opens a `role="dialog"` panel titled `Notifications`, independent of browser permission. On desktop it is right-aligned beneath the bell and `width: min(26rem, calc(100vw - 16px))`; on compact it uses the bottom-sheet contract below. The panel has labelled close control, Escape/backdrop close, focus containment, and restores focus to the bell on close.
- Panel structure: header with title and unread sublabel; scrollable feed body; optional inline confirmation/footer. The body has `max-height: min(32rem, calc(100dvh - 144px))`, `overflow-y: auto`, and `overscroll-behavior: contain`. Keep the header and any pending invitation confirmation visible; do not create document-level horizontal or vertical overflow.
- Group persisted feed entries under `Now`, `Today`, and `Earlier` according to local time. Within each group, render newest first. A normal entry has a category label, 14px concise title, one 12px privacy-safe detail line, 10px relative timestamp, and an explicit unread treatment (secondary row fill plus `Unread` text in the accessible name). Do not expose message bodies in desktop or in-app entry detail.
- Same category/key records update their one existing feed entry rather than adding duplicate rows. Feed capacity defaults to 100 non-actionable entries; evict oldest read/non-actionable records first. A live pending invitation is never evicted solely because it is old.
- On opening the feed, mark the entries visible in its rendered list as read, recompute the bell badge, and announce `{n} notifications marked read.` when `n > 0`. This operation only changes read state. It must not call invitation accept/dismiss, remove a pending invitation, or write an invitation-resolution record.
- Empty feed renders the exact empty heading/body. Loading/reconciliation retains the last safe local feed while new events arrive; do not replace it with a spinner. A malformed persisted record is discarded silently and leaves the feed functional; any surfaced persistence failure uses the documented safe error copy.

### Invitation entries

- A trusted incoming private invitation renders as a dedicated, actionable feed entry, not as a generic collapsed activity summary. It contains sender avatar, `Room invitation`, room title, `From {senderName}`, relative timestamp, and its two named actions. The sender key may be available only as a truncated accessible detail; never show a URL/token.
- `Accept invitation` is the primary accent action. Disable only that entry’s actions while navigation/resolution is pending, announce progress politely, write resolution before removing the live invite, and route through the existing same-shell `autojoin=1` path. On an actionable failure, restore the entry/actions and show the documented safe error.
- `Dismiss invitation` starts the inline confirmation described in Copywriting; it is not a one-click close glyph. Confirmation focus begins on `Keep invitation`; Escape/backdrop returns to the intact invitation. Confirming dismissal writes only the privacy-minimal `{id, resolvedAt}` ledger entry before removing the live invite/feed action. Do not persist invite URLs, secrets, raw envelopes, sender profiles, or decrypted content.
- Accepted and dismissed IDs remain suppressed across reloads for at least seven days (the default retained margin above the current three-day relay replay window). A previously resolved ID must not be fetched into the feed, become unread, or re-enter the live invitation list.

### Compact sidebar and bottom-sheet contract

- At 900px and below, keep `HostWorkspace` as the responsive owner: `Open room browser`, its full-page scrim, `aria-controls`, `aria-expanded`, `aria-hidden`, and `inert` behavior gate the contextual sidebar. The closed sidebar cannot receive focus or pointer input.
- The sidebar is `width: min(22rem, calc(100vw - 42px))`, remains inside viewport bounds, and presents invite entry, coordinator/rooms, then the pinned personal footer in one reading order. Each compact trigger stays at least 44px high and keeps its full accessible name even when represented by a glyph.
- A profile, presence, feed, or settings panel opened from that drawer becomes a fixed bottom sheet: `left/right/bottom: 8px`, `max-height: calc(100dvh - 16px)`, dark secondary surface, 1px border, body-only vertical scrolling, and `overscroll-behavior: contain`. It sits above the drawer scrim and must not be clipped by the header. Its close action remains visible/reachable at short heights.
- Opening a personal bottom sheet leaves the header and room rail visually intact behind the appropriate scrim but focus-inert. Closing the sheet returns focus to its originating compact trigger. On reduced motion, sheets/rails may appear/disappear without transitions; state, focus, and readability remain identical.

### Accessibility, overflow, and non-goals

#### Sidebar overlay gap-closure supplement (2026-08-06)

- All floating surfaces initiated inside the sidebar use one shared viewport-level overlay primitive backed by the browser top layer. A floating panel may retain its semantic DOM ownership but must not participate in or be clipped by the rail's layout while open.
- The primitive owns portal placement, fixed positioning, 8px viewport gutters, trigger-relative alignment, vertical flipping when the preferred side lacks space, live repositioning on resize/scroll, and an internally scrollable maximum height.
- Profile, presence, notification feed, notification settings, and room-actions surfaces use this contract. Full-screen destructive or setup dialogs may retain their existing top-level modal implementation when they already escape sidebar containment.
- Compact surfaces retain the approved 8px-inset bottom-sheet presentation. Desktop surfaces remain visually anchored to their initiating control without being constrained to the sidebar width.
- Moving a surface to the viewport layer must preserve its role/name, Escape and backdrop close, focus containment where already required, focus return, keyboard order, and scoped visual styling.
- Regression evidence must measure each open panel against the viewport at desktop, tablet, phone, and short-height sizes and prove that no ancestor with clipping contains the rendered panel.

- Every control has a specific accessible name. Do not use a glyph, colored dot, unread count, or visual cluster separation as the only label. Use `aria-live="polite"` only for state changes, not for every rendered feed row.
- All dialogs/sheets have a programmatic title, close control, Escape/backdrop behavior unless a destructive confirmation is pending, focus containment, and focus return. The inline invitation confirmation is the only destructive confirmation in this phase.
- Preserve visible 2px accent focus ring with at least 2px offset. Do not rely on hover to reveal the only available action; keyboard focus reaches every feed action and the separate presence selector.
- Long sender/room names wrap in the feed’s text column; metadata can ellipsize after retaining an accessible full name. Action labels never truncate. Feed scrolling is vertical only; the panel and command bar must never produce horizontal viewport overflow.
- No cross-device history, browser-prompt imitation, service worker, email/SMS/push backend, notification search/filtering, mass clear, or Phase 19 grouped-chat/reaction UI is in scope.

---

## UI Considerations

Applicable state considerations resolved: 11 covered, 5 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Notification feed | ✅ covered | The feed shows the canonical `No personal activity` heading/body rather than a blank popover. |
| loading | Profile presence options, settings, invitation actions | ✅ covered | Selection persists immediately; permission/action controls expose busy state through disabled entry controls and polite status without blocking unrelated controls. |
| error | Settings, invitation action, local feed persistence | ✅ covered | Permission, unsupported browser, update failure, and invitation navigation use documented user-safe copy with a recovery path; raw implementation errors remain hidden. |
| populated | Notification feed | ✅ covered | Entries are grouped as Now/Today/Earlier, newest first, with concise category-aware structure and a readable unread treatment. |
| partial | Notification feed and invitation entry | ✅ covered | Feed remains useful if browser delivery is unavailable/disabled; pending invitation state stays separately actionable even after read state changes. |
| overflow | Desktop feed/settings panels and compact bottom sheets | 🧪 backstop | Body-only scrolling, viewport-constrained dimensions, no horizontal overflow, and reachable close/actions are proven at compact and short heights. |
| zero-one-many | Unread badge and feed header | ✅ covered | Zero hides badge and reads `All caught up`; singular/plural accessible text and `99+` display preserve the exact count in the accessible name. |
| long-text | Sender names, room names, settings labels, cluster controls | 🧪 backstop | Room/sender content wraps or ellipsizes safely while action labels and accessible names remain intact and the command bar does not overflow. |
| empty | Incoming invitations | ✅ covered | No invitation-specific panel remains; empty invitations are represented by the canonical feed empty state. |
| loading | Feed open/read transition | ✅ covered | Opening marks currently rendered events read without hiding entries, resolving invitations, or displaying an indeterminate spinner. |
| error | Browser notification permission | ✅ covered | `default`, `granted`, `denied`, and unsupported states retain an in-app alternative and only the explicit CTA can invoke permission. |
| populated | Sparse header and contextual sidebar | ✅ covered | Header, invite utility, coordinator controls, and personal footer each have one owner with no duplicate runtime or room context. |
| overflow | Compact room sidebar | 🧪 backstop | Existing scrim/inert/bounds pattern is retained; invite-first and personal-footer order plus fixed-sheet containment are browser-tested. |
| long-text | Avatar trigger and presence menu | 🧪 backstop | Status text remains accessible, display/key summary ellipsizes, and radio detail wraps without widening the menu. |
| zero-one-many | Feed eviction/history | 🧪 backstop | Unit coverage proves capacity pruning never evicts a pending invitation and accepted/dismissed IDs do not replay across reload. |
| long-text | Feed action labels | ✅ covered | `Accept invitation`, `Dismiss invitation`, and confirmation labels stay fully visible and keyboard reachable. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable — project is Svelte, `components.json` is absent, and no shadcn or third-party registry block is used (checked 2026-08-03) |

---

## Verification Contract

- Playwright verifies at desktop width (at least 1280px) that the header contains brand/status, live rate, and Manage only; `Join from invite` is first in the rail; local coordinator controls are in the selected coordinator heading; and the pinned personal footer contains profile, separate presence, bell, and exact `Notification settings` controls.
- Playwright verifies no header-level presence or invite-inbox trigger remains, host badge/message identity editing and long profile `about` content are absent from `UserProfile`, and coordinator settings exposes the host-only badge editing surface.
- Playwright verifies the avatar trigger has an attached status-dot element and exposes `Presence: {state}` in its accessible name; the separate footer trigger opens a labelled presence radio group, reports the active choice programmatically, and lets keyboard users select online/invisible/offline. Changing any choice leaves coordinator lifecycle status/actions unchanged.
- Playwright verifies opening `Notification settings` and the bell makes zero `Notification.requestPermission()` calls. Only clicking the exact `Enable desktop notifications` CTA makes one call; denied/unsupported states show the specified safe copy and the feed remains usable.
- Playwright verifies persisted desktop category/cadence controls read back after reload, online is enabled by default, other desktop categories are opt-in, and all relevant events still appear in the in-app feed when desktop permission is default/denied, desktop delivery is disabled, or a category is disabled.
- Playwright verifies the bell reports its unread count, opens the separate labelled feed, shows grouped Now/Today/Earlier rows newest first, and opening it marks rendered rows read while preserving a pending invitation and its actions. Zero unread hides the visual badge and exposes `no unread` / `All caught up` text.
- Playwright verifies a trusted invitation appears only in the bell feed with sender/room/action labels, `Accept invitation` follows same-shell `autojoin=1` navigation, and `Dismiss invitation` requires the specified confirmation. Marking it read alone cannot remove it.
- Unit tests verify event/category-key upsert and desktop cadence de-duplication; feed-first recording independent of permission; 100-entry non-actionable capacity; a pending invitation survives eviction; read does not resolve; resolution stores only ID/timestamp; malformed records are rejected; and resolved invitations remain suppressed during the seven-day retention window/reload replay.
- Playwright verifies compact 900px, 768×1024, and 375×812 layouts: `Open room browser` controls an inert closed rail, invite entry precedes room context and the personal footer follows it, every glyph retains its full accessible name, and profile/presence/feed/settings open as viewport-contained bottom sheets with reachable close/actions and no horizontal overflow.
- Playwright verifies 375×520 or comparable short-height compact layout: sheet body—not document—is scrollable; title/close/action controls remain reachable. Test with `prefers-reduced-motion: reduce` confirms no motion is required to identify open/closed, unread, selected-presence, or permission state.
- Browser style assertions verify representative Phase 18 controls use only the declared 10/12/14/18px hierarchy, weights 400/600, 4px spacing scale, `#7cf59d` only in its reserved roles, and `#ffaaa3` only after invitation dismissal reaches confirmation.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** APPROVED
