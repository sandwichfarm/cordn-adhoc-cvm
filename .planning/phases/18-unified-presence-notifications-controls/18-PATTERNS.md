# Phase 18: Unified Presence, Notifications & Controls - Pattern Map

**Mapped:** 2026-08-03  
**Files classified:** 13 source/component/test files  
**Analogs found:** 13 / 13

## File Classification

| New/modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `src/components/HostWorkspace.svelte` | shell component/controller | event-driven | its command bar at lines 1101-1169 | exact |
| `src/components/UserProfile.svelte` | personal-control component | event-driven | its existing trigger/menu at lines 142-284 | exact |
| `src/components/PresenceControl.svelte` (remove) | component | event-driven | `UserProfile.svelte` menu sections | migration target |
| `src/components/NotificationCenter.svelte` | settings component | request-response | its dialog/settings body at lines 57-114 | exact |
| `src/components/NotificationFeed.svelte` (new) | personal feed component | event-driven | `InviteInbox.svelte` entries at lines 27-58 | role/data-flow match |
| `src/components/InviteInbox.svelte` (remove) | popover component | event-driven | new `NotificationFeed.svelte` | migration target |
| `src/notifications/notification-center.svelte.ts` | browser-local store | pub-sub + batch | its preference/cadence queue at lines 32-156 | exact |
| `src/invites/nostr-social.svelte.ts` | trusted Nostr ingress/service | pub-sub | `receiveInvite()` at lines 238-258 | exact |
| `src/config/config.svelte.ts` | durable config store | CRUD/browser persistence | `setPresenceState()` + persisted boundary at lines 169-173, 214-294 | exact |
| `src/components/CoordinatorSettings.svelte` / host-admin surface | host-admin component | request-response | current HostWorkspace settings entry and config setters | role match |
| `tests/unit/notification-center.test.ts` | unit test | batch/persistence | existing mock Notification + fake timers | exact |
| `tests/unit/nostr-invites.test.ts` | unit test | trusted ingress | egress/ingress validation checks | exact |
| `tests/e2e/workspace-lifecycle.spec.ts`, `tests/e2e/identity-ui-review.spec.ts` | browser tests | event-driven UI | shell helpers, Notification mock, profile helper | exact |

## Pattern Assignments

### `src/components/HostWorkspace.svelte` — command-bar composition

**Analog:** `src/components/HostWorkspace.svelte:1101-1169`

Use the existing responsive ownership arrangement: the top bar renders the room-browser toggle, the utilities container is inert while the compact host drawer is closed, and the lifecycle/manage controls are siblings rather than children of a personal dialog.

```svelte
<div
  id="host-tools"
  class:open={mobileToolsOpen}
  class="host-utilities"
  aria-label="Host tools"
  aria-hidden={compactViewport && !mobileToolsOpen}
  inert={compactViewport && !mobileToolsOpen}
>
  <!-- personal controls currently live here -->
</div>
<LifecyclePanel {coordinator} compact onStart={wakeCoordinator} ... />
```

**Apply:** retain `mobileToolsOpen`, `aria-controls`, `aria-expanded`, `inert`, and the existing scrim. Replace the undifferentiated utility sequence with two labelled group wrappers: `Personal controls` contains `UserProfile`, bell/feed, and exact text `Notification settings`; `Host controls` contains coordinator settings, `LifecyclePanel`, and Manage. Do not mount `PresenceControl` or `InviteInbox` after migration.

**Pitfall:** `HostWorkspace` is 2,102 lines. Keep all new state close to its current command-bar state and reuse `compactViewport` instead of adding a competing breakpoint/store. It is also the shell owner, not the lifecycle owner.

### `src/components/UserProfile.svelte` — profile-owned presence

**Analog:** `src/components/UserProfile.svelte:142-284`, with menu/identity lifecycle at `47-140`.

```svelte
<button
  class="user-trigger"
  type="button"
  aria-label={`${open ? "Close" : "Open"} profile for ${userProfileStore.displayName}`}
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={() => open ? closeMenu() : open = true}
>
  <img src={userProfileStore.avatarUrl} alt="" onerror={avatarFallback} />
  <span class="user-copy">...</span>
</button>
```

**Apply:** attach the visual status dot inside this avatar trigger and include `Presence: {state}` in its accessible name. Add a labelled radio-style presence section inside the existing `role="dialog"` menu. Preserve the existing identity bootstrap guard (`initialized && !recoveryRequired`), NIP-07/NIP-46 cancellation, Escape handling, and compact sheet CSS pattern.

**Presence action seam:** use config first, then social projection only:

```ts
config.setPresenceState(state);
await nostrSocialStore.setPresence(state, descriptor);
```

`ConfigStore.setPresenceState()` (`src/config/config.svelte.ts:169-173`) is idempotent and durable. `NostrSocialStore.setPresence()` (`src/invites/nostr-social.svelte.ts:150-160`) clears/restarts the online heartbeat and safely returns without a signer/pool.

**Hard boundary:** do **not** retain the current `PresenceControl.selectPresence()` behavior (`src/components/PresenceControl.svelte:42-57`), which calls `coordinator.stop()` or `coordinator.start()`. Presence must never wake, start, stop, or destroy a coordinator.

**Host-identity removal:** remove `showHostIdentity`, badge props, `emojiPickerOpen`, and the Message identity block (`UserProfile.svelte:247-284`) from this personal component. Preserve host badge state in `ConfigStore`; expose editing only through the host/coordinator admin surface.

### `src/components/PresenceControl.svelte` — removal/decoupling

**Analog:** the three choices and state classes at `src/components/PresenceControl.svelte:64-88`.

Copy only the option labels, dot semantics, and authenticated-online copy into `UserProfile`. Delete the standalone component/import/markup once the menu has absorbed them. There must be no stale `PresenceControl` test selector or header trigger.

### `src/components/NotificationCenter.svelte` — settings only

**Analog:** its current `role="dialog"` preference panel at `57-114` and lifecycle listeners at `12-26`.

```ts
function syncPermission(): void {
  notificationCenter.syncPermission();
}

onMount(() => {
  document.addEventListener("visibilitychange", syncPermission);
  window.addEventListener("focus", syncPermission);
});
```

**Apply:** retain permission synchronization and `notificationCenter` preference setters. Make its external trigger exactly `Notification settings`; opening it only synchronizes/render state and must not invoke `requestPermission()`. Keep the explicit in-dialog `Enable desktop notifications` CTA as the sole permission call site, and retain unsupported/denied safe copy.

**Pitfall:** the current `openNotifications()` (`27-40`) violates phase contract by requesting permission before it opens. Remove that branch rather than hiding it behind another trigger.

### `src/components/NotificationFeed.svelte` (new) — bell/feed + action rows

**Analog:** `src/components/InviteInbox.svelte:27-58` for a positioned trigger, unread count, sender image, and per-row buttons; `NotificationCenter.svelte:57-114` for fixed backdrop/dialog and Escape close behavior.

```svelte
{#each nostrSocialStore.incomingInvites as invite (invite.id)}
  <article>
    <img src={invite.fromAvatar} alt="" />
    <div>...</div>
    <div class="invite-actions">
      <button class="accept" type="button" onclick={() => accept(invite.id, invite.inviteUrl)}>Accept</button>
      <button type="button" aria-label={`Dismiss invite to ${invite.roomTitle}`}>×</button>
    </div>
  </article>
{/each}
```

**Apply:** make the bell a distinct, labelled personal control with a badge derived from unread ledger entries. On opening, call a store `markVisibleRead()`/equivalent; that action changes only read state. Feed entries group by local time bucket and render newest first. Use the trusted live invite object only to supply sender/room/action data; do not place an invite URL or secret in the persisted feed record.

**Accept seam:** copy `InviteInbox.accept()` (`8-14`) exactly in behavior: add `autojoin=1`, resolve the invite, close, then `onNavigate(target.href)`. A dismiss must first open/complete an explicit confirmation as required by the UI spec, then resolve it.

### `src/components/InviteInbox.svelte` — removal/migration

**Analog:** its `accept()` function and sender `npub` fallback (`8-24`).

Move these safe display/action behaviors into `NotificationFeed`; do not keep the old isolated envelope trigger in the header. `nostrSocialStore.dismissInvite()` currently removes only the live in-memory object, so feed resolution must add durable suppression before/alongside that call.

### `src/notifications/notification-center.svelte.ts` — feed-first event ledger and optional desktop projection

**Analog:** `NotificationCenterStore` in the same file, especially its versioned persistence (`147-183`), category/key queue (`110-115`), cadence rescheduling (`100-108`), and grouped desktop flush (`117-135`, `185-224`).

```ts
enqueue(event: CordnNotificationEvent): void {
  this.syncPermission();
  if (!this.active || !this.categories[event.category]) return;
  this.queued.set(`${event.category}:${event.key}`, event);
  if (this.timer === null) this.timer = setTimeout(() => this.flush(), this.cadenceMs);
}
```

**Apply:** refactor this public producer seam into feed-first recording followed by optional desktop queueing. Keep `category:key` upsert de-duplication and `ALLOWED_CADENCES`; add versioned, validated persisted feed/read/resolution structures at the existing localStorage boundary. Feed recording must happen regardless of Notification API support, permission, master enablement, or desktop category setting. Desktop queueing remains gated by `active` and its category.

**Persistence boundary:** persist only event display metadata that is safe and necessary (category, stable key, actor/room labels, timestamp/read state) plus resolution `{ id, resolvedAt }`; validate every field like `readPreferences()` does. Bound ordinary history (100 entries per UI spec) but protect live pending invitations from capacity eviction. Reject malformed stored data without throwing.

**Desktop boundary:** preserve `flush()`'s single `tag: "cordn-grouped-updates"` and its concise `summarize()` output. The feed is canonical history; desktop notification is a best-effort projection.

### `src/invites/nostr-social.svelte.ts` — trusted ingress and resolution suppression

**Analog:** `NostrSocialStore.receive()` (`209-219`) and `receiveInvite()` (`238-258`).

```ts
if (!shouldAcceptInvite(sender, this.following) || !isInvitePayload(value)) return;
if (this.incomingInvites.some((invite) => invite.id === value.id)) return;
// profile lookup, then append live invite object
notificationCenter.enqueue({ category: "room_invite", key: value.id, actor: fromName, room: value.roomTitle });
```

**Apply:** retain the decrypt/validation/followed-sender gates, profile lookup fallback, and live `incomingInvites` capability record. Before appending/re-recording, query the notification resolution ledger by ID and a seven-day retention cutoff; resolved IDs must be ignored across reload/replay. Call the feed-first store producer after validation. Resolution should be an explicit method coordinating persisted ID/timestamp with removal from `incomingInvites`.

**Security boundary:** `receive()` intentionally discards invalid or undecryptable envelopes. Keep that silent. Never serialize `inviteUrl`/room secret into notifications, logs, errors, snapshots, or unit fixtures.

### `src/config/config.svelte.ts` — durable personal choice, not lifecycle signal

**Analog:** `PersistedConfig` fields (`19-30`), `setPresenceState()` (`169-173`), `persistConfig()` (`214-238`), and strict `readPersistedConfig()` normalization (`260-294`).

Keep `presenceState` inside this existing config record and preserve its default `invisible`. No schema migration is required merely to move the UI. The presence setter must remain restart-neutral (`commit()` without `restartRequired`), and Phase 18 must not use it to choose a lifecycle start label.

### Host badge admin surface

**Analog:** config’s host badge setters at `155-167` plus HostWorkspace’s existing prop wiring at `1127-1134`.

Move that wiring out of `UserProfile` into the coordinator/room admin surface only. Do not change the persisted `hostBadgeLabel`/`hostBadgeEmoji` shape or message protocol sanitization in this phase; this is an ownership relocation, not a credential or message-format migration.

## Producer and Ownership Boundaries

| Producer | Existing producer seam | Phase 18 responsibility |
|---|---|---|
| online contact | `NostrSocialStore.receivePresence()` at `221-236` | record feed event for first online transition; desktop projection stays category-gated |
| incoming invitation | `NostrSocialStore.receiveInvite()` at `238-258` | record feed event after trust validation; retain live action capability; suppress resolved replay |
| new message | `src/chat/room-store.ts:373,418,568` | preserve producer call sites; they must record feed even when desktop messages are disabled |
| join request | `ChatRoomSession` notification calls in `room-store.ts` | preserve host-only event semantics; record + optional desktop projection |
| coordinator lifecycle | `LifecyclePanel.svelte` | sole owner of start/stop/destroy; never invoked from profile/presence |

## Responsive and Accessibility Pattern

**Sources:** `HostWorkspace.svelte:1101-1169`, `UserProfile.svelte:142-284`, `NotificationCenter.svelte:57-114`, `tests/e2e/workspace-lifecycle.spec.ts:2080-2220`.

- Keep each trigger’s explicit `aria-label`, `aria-haspopup`, `aria-expanded`, and labelled dialog/sheet.
- At compact widths reuse the host utilities drawer plus scrim/inert handling. Do not render a second hidden desktop control just to satisfy layout.
- The profile/feed/settings overlays must be viewport-contained and have a scrollable body at short height. Reuse the current fixed scrim + bounded dialog pattern instead of document scrolling.
- Status color is supplementary; the avatar trigger/menu must expose textual state and checked selection to keyboard/screen-reader users.

## Test Pattern Assignments

### `tests/unit/notification-center.test.ts`

**Analog:** mock `Notification` and fake-timer lifecycle at `1-116`.

Extend the same isolated-store style for: feed-first recording while permission is default/denied or desktop categories disabled; category/key upsert; cadence one-notification behavior; bounded eviction; pending invite retention; `markRead` vs `resolve`; validation rejection; persisted resolution/replay suppression. Continue restoring global Notification and timers in `afterEach`.

### `tests/unit/config-store.test.ts`

**Analog:** persistence/reload assertions at `23-59`.

Keep a focused assertion that online/invisible/offline persists with no `runtimeRevision` change. Any moved badge edit surface should retain the existing config persistence assertions, not invent an extra storage key.

### `tests/unit/nostr-invites.test.ts`

**Analog:** trusted ingress/egress checks at `33-48`.

Add tests around validated payload/resolution suppression without including real invite URLs in persisted notification fixtures. Existing encrypted-envelope test proves why decrypted payloads must remain out of logs/snapshots.

### `tests/e2e/identity-ui-review.spec.ts`

**Analog:** `openIdentityMenu()` at `6-15` and current permission/persistence scenario at `79-115`.

Extend the helper rather than duplicating selectors: assert avatar accessible name contains presence, radio selection works without lifecycle transition, the profile has no message-identity editor, and settings opens without permission calls. Update the existing notification test to click `Notification settings` first, then exact `Enable desktop notifications`.

### `tests/e2e/workspace-lifecycle.spec.ts`

**Analogs:** `MockNotification` at `839-853`, room navigation helper at `367-373`, compact tool/bounded dialog coverage at `2080-2220`.

Add shell-level assertions for distinct labelled personal/host groups; standalone presence/invite controls absent; bell unread badge/feed grouping; read without resolution; invitation accept same-shell `autojoin=1`; confirmed dismissal; compact drawer ordering/inertness; sheet bounds/no overflow/reduced-motion state readability.

## No Analog Found

| File/capability | Why no exact analog | Planning guidance |
|---|---|---|
| `NotificationFeed.svelte` | Current app has separate invite popover and settings dialog, not one canonical feed | Compose `InviteInbox` row actions with `NotificationCenter` dialog/scrim, backed by store-owned ledger |
| persisted invitation resolution ledger | Existing invitation list is only memory-resident | Put schema/validation in notification store; Nostr store remains trusted live ingress and calls explicit resolve API |

## Metadata

**Graph-first discovery:** architecture + `HostWorkspace`, `UserProfile`, `PresenceControl`, `NotificationCenter`, `NostrSocialStore`, `LifecyclePanel`, `NotificationCenterStore`, `ConfigStore` graph queries/snippets; then literal searches for producer call sites/test selectors.  
**Primary source analogs:** 8  
**Primary test analogs:** 4
