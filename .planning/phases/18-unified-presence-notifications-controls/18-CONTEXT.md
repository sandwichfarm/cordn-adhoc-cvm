# Phase 18: Unified Presence, Notifications & Controls - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Unify personal presence, notification settings, in-app notifications, and incoming room invitations into coherent personal controls while keeping coordinator lifecycle and host administration visibly and behaviorally separate. This phase reorganizes and completes the existing browser-local surfaces; it does not add a notification backend, cross-device history, or new coordinator lifecycle capabilities.

</domain>

<decisions>
## Implementation Decisions

### Personal presence ownership
- **D-01:** Online, invisible, and offline are selected from a compact, separate presence dropdown in the pinned personal footer; presence does not occupy the global header or inflate the profile panel.
- **D-02:** The active presence dot is attached to the avatar trigger and has an accessible textual status in the trigger/menu, not only a decorative color.
- **D-03:** Presence is personal availability/privacy state. Changing it must not start, stop, wake, or destroy the coordinator; `LifecyclePanel` remains the sole lifecycle owner.
- **D-04:** The existing validated `ConfigStore.presenceState` remains the durable selected state, and signed social publication continues through the existing Nostr social store when an eligible signer is active.

### Notification settings and in-app feed
- **D-05:** A clearly labeled `Notification settings` action opens persisted category and cadence preferences. Merely opening settings never requests browser permission.
- **D-06:** A separate bell opens the in-app notification feed and shows an unread badge. Opening the feed marks currently visible entries read but does not resolve or remove actionable invitations.
- **D-07:** The in-app feed records relevant events independently of browser permission and desktop-category settings. Browser notifications are an optional projection of the same event stream.
- **D-08:** Desktop permission is requested only by an explicit `Enable desktop notifications` action inside settings. Existing validated cadence values and event-ID/category de-duplication remain authoritative.
- **D-09:** Desktop notifications are concise and grouped per cadence. Online-status notifications are enabled by default; message and invitation desktop categories are opt-in. The in-app feed can still show all relevant personal events.
- **D-19:** The notification feed exposes an accessible `Clear all` action. It clears persisted feed entries and unread state only; it never accepts, dismisses, or writes resolution state for a live invitation.

### Invitation consolidation and privacy
- **D-10:** Incoming private room invitations are actionable entries in the bell feed and reuse the existing trusted-sender validation plus same-shell accept/dismiss navigation path.
- **D-11:** Accepted or dismissed invitation event identifiers are suppressed across reloads for the relay replay window so handled invites do not reappear. Persist only privacy-minimal resolution identifiers and timestamps, never invite URLs or room secrets.
- **D-12:** Accepting or dismissing an invite is distinct from marking its feed entry read; unread state must not silently dispose of an actionable invitation.

### Header and responsive ownership
- **D-13:** The global header stays sparse: CAHMLS brand and live message rate on the left, with the `Manage` workspace toggle as the only host action on the right. Active-room identity, room-sync copy, and redundant coordinator-runtime labels are removed from the header.
- **D-14:** Host message-identity/badge editing is not part of the personal profile menu; it belongs with host/room administration.
- **D-15:** Personal identity, a separate compact presence selector, the notification bell, and `Notification settings` are pinned in a modern account footer at the bottom of the room sidebar. The profile panel excludes the long Nostr `about` field and remains contained by the rail/viewport. All menus retain the established compact bottom-sheet behavior and explicit accessible names.
- **D-16:** Coordinator settings, start/stop, and destroy belong to the selected local coordinator heading in the sidebar. Runtime state is communicated once through its status dot; start/stop use compact cassette-style triangle/square controls with accessible names.
- **D-17:** `Join from invite` is a full-width primary utility at the top of the sidebar. The obsolete sidebar statistics panel is removed; only the live message rate moves beside the CAHMLS brand.

### the agent's Discretion
- Exact feed-entry density, iconography, timestamp phrasing, empty-state copy, and visual separators may follow the existing restrained CAHMLS shell, provided the personal/host ownership boundary and accessible labels remain unmistakable.
- The feed may use a bounded local history appropriate for a browser-only application; eviction must never discard a still-pending invitation merely because it is old in the display list.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone requirements
- `.planning/REQUIREMENTS.md` — Locks PRES-01, PRES-02, INVITE-01, SHELL-01, and NOTF-01 through NOTF-03.
- `.planning/ROADMAP.md` — Defines the Phase 18 goal, success criteria, dependency, and phase boundary.
- `.planning/PROJECT.md` — Defines the browser-resident, self-sovereign product constraint.

### Prior interaction contracts
- `.planning/phases/15-identity-continuity-membership-integrity/15-CONTEXT.md` — Preserves identity continuity and the distinction between anonymous and signed identities.
- `.planning/phases/17-full-viewport-startup-motion/17-UI-SPEC.md` — Establishes shell containment, accessible control behavior, and the restrained visual system carried into Phase 18.

No external specifications are required; the milestone requirements and decisions above are authoritative.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/UserProfile.svelte`: Existing avatar trigger, accessible personal menu, profile presentation, and compact bottom-sheet behavior.
- `src/components/PresenceControl.svelte`: Compact footer-owned presence dropdown with durable social state and no coordinator lifecycle side effects.
- `src/components/NotificationCenter.svelte`: Existing preference UI shell to split into labeled settings and a feed trigger.
- `src/notifications/notification-center.svelte.ts`: Versioned preference persistence, cadence validation, queued-event de-duplication, and grouped browser delivery.
- `src/components/InviteInbox.svelte`: Existing trusted invitation accept/dismiss UX and same-shell navigation behavior.
- `src/invites/nostr-social.svelte.ts`: Existing followed-sender ingress validation, private presence publication, and incoming-invite source.
- `src/components/LifecyclePanel.svelte`: Sole owner for start, stop, wake, destroy, and lifecycle status.

### Established Patterns
- Svelte reactive stores persist versioned browser-local preferences and expose components through typed props/actions.
- Header menus become fixed, scrollable bottom sheets at compact widths; focus and accessible trigger names are already covered by Playwright.
- Notification producers already exist for room messages, host join requests, contact-online events, and private invitations.
- Current notification enqueueing is browser-permission-gated; Phase 18 must separate durable in-app recording from optional desktop projection.

### Integration Points
- `src/components/HostWorkspace.svelte`: Distribute global, coordinator, invite, and personal controls to the header and sidebar owners defined above.
- `src/components/UserProfile.svelte`: Keep the avatar presence dot, remove embedded presence options, omit the long Nostr `about` field, and remove host-specific badge editing.
- `src/components/NotificationCenter.svelte` and notification store: Separate feed, settings, permission, unread, persistence, and cadence responsibilities.
- `src/components/InviteInbox.svelte` and `src/invites/nostr-social.svelte.ts`: Feed invitation actions through the existing validated redemption path and durable resolution suppression.
- `tests/unit/notification-center.test.ts`, `tests/unit/config-store.test.ts`, `tests/unit/nostr-invites.test.ts`, `tests/e2e/workspace-lifecycle.spec.ts`, and `tests/e2e/identity-ui-review.spec.ts`: Extend existing behavioral and accessibility coverage rather than creating SDLC-named source/test files.

</code_context>

<specifics>
## Specific Ideas

- Presence belongs inside the avatar dropdown, with the status dot physically attached to the avatar.
- `Notification settings` must be a plainly labeled action; the bell is a separate in-app feed, not another settings icon.
- Room invitations should be discoverable within the personal notification experience rather than living in an awkward isolated popover.
- Personal controls and coordinator/host controls should read as two different ownership groups because they live at opposite ends of the sidebar, not because the header is divided into busy clusters.
- Notification bursts should collapse into short cadence summaries rather than overwhelming the user.

</specifics>

<deferred>
## Deferred Ideas

- Cross-device notification history remains a future requirement (NOTF-04).
- Grouped chat messages and reaction presentation remain Phase 19 work.

</deferred>

---

*Phase: 18-unified-presence-notifications-controls*
*Context gathered: 2026-08-03*
