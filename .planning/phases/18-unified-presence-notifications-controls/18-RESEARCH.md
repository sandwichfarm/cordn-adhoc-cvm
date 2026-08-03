# Phase 18: Unified Presence, Notifications & Controls - Research

**Researched:** 2026-08-03
**Domain:** Browser-local personal presence, notifications, and trusted Nostr invitations in Svelte 5
**Confidence:** HIGH for the codebase plan; MEDIUM for browser-notification platform behavior

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Personal presence ownership

- **D-01:** Online, invisible, and offline are selected inside the user/profile menu; the standalone header presence control is removed.
- **D-02:** The active presence dot is attached to the avatar trigger and has an accessible textual status in the trigger/menu, not only a decorative color.
- **D-03:** Presence is personal availability/privacy state. Changing it must not start, stop, wake, or destroy the coordinator; `LifecyclePanel` remains the sole lifecycle owner.
- **D-04:** The existing validated `ConfigStore.presenceState` remains the durable selected state, and signed social publication continues through the existing Nostr social store when an eligible signer is active.

#### Notification settings and in-app feed

- **D-05:** A clearly labeled `Notification settings` action opens persisted category and cadence preferences. Merely opening settings never requests browser permission.
- **D-06:** A separate bell opens the in-app notification feed and shows an unread badge. Opening the feed marks currently visible entries read but does not resolve or remove actionable invitations.
- **D-07:** The in-app feed records relevant events independently of browser permission and desktop-category settings. Browser notifications are an optional projection of the same event stream.
- **D-08:** Desktop permission is requested only by an explicit `Enable desktop notifications` action inside settings. Existing validated cadence values and event-ID/category de-duplication remain authoritative.
- **D-09:** Desktop notifications are concise and grouped per cadence. Online-status notifications are enabled by default; message and invitation desktop categories are opt-in. The in-app feed can still show all relevant personal events.

#### Invitation consolidation and privacy

- **D-10:** Incoming private room invitations are actionable entries in the bell feed and reuse the existing trusted-sender validation plus same-shell accept/dismiss navigation path.
- **D-11:** Accepted or dismissed invitation event identifiers are suppressed across reloads for the relay replay window so handled invites do not reappear. Persist only privacy-minimal resolution identifiers and timestamps, never invite URLs or room secrets.
- **D-12:** Accepting or dismissing an invite is distinct from marking its feed entry read; unread state must not silently dispose of an actionable invitation.

#### Header and responsive ownership

- **D-13:** The command bar is visually divided into a personal cluster (avatar/presence, bell, `Notification settings`) and a host cluster (coordinator settings, lifecycle, management). Duplicate status/settings actions are removed.
- **D-14:** Host message-identity/badge editing is not part of the personal profile menu; it belongs with host/room administration.
- **D-15:** At compact widths, the existing host-tools drawer and bottom-sheet panel treatment remain the responsive owners. Every compact control retains an explicit accessible name even when its visible label is shortened.

### the agent's Discretion

- Exact feed-entry density, iconography, timestamp phrasing, empty-state copy, and visual separators may follow the existing restrained CAHMLS shell, provided the personal/host ownership boundary and accessible labels remain unmistakable.
- The feed may use a bounded local history appropriate for a browser-only application; eviction must never discard a still-pending invitation merely because it is old in the display list.

### Deferred Ideas (OUT OF SCOPE)

- Cross-device notification history remains a future requirement (NOTF-04).
- Grouped chat messages and reaction presentation remain Phase 19 work.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-01 | Presence options live in the profile dropdown. | Fold the current `PresenceControl` selection UI into `UserProfile`; retain `ConfigStore.presenceState` as selection state. [VERIFIED: codebase graph] |
| PRES-02 | Avatar shows accessible active presence. | Put the dot inside the avatar trigger and include the current status in its accessible name and menu's checked option. [VERIFIED: codebase graph] |
| INVITE-01 | Incoming room invitations are actionable personal notifications. | Make the bell feed resolve its live invitation action from `NostrSocialStore.incomingInvites` after existing followed-sender validation. [VERIFIED: codebase graph] |
| SHELL-01 | Personal and coordinator controls are visibly distinct. | Render explicit personal and host clusters in `HostWorkspace`; leave lifecycle operations in `LifecyclePanel`. [VERIFIED: codebase graph] |
| NOTF-01 | Labeled, persisted notification settings. | Retain the validated notification preferences store; refactor its trigger to `Notification settings` and remove permission prompting from open. [VERIFIED: codebase graph] |
| NOTF-02 | Separate bell, grouped feed, unread state, invitation actions. | Extend the notification store with a bounded, persisted read ledger and use a dedicated feed component. [VERIFIED: codebase graph] |
| NOTF-03 | Explicit desktop permission, cadence delivery, no duplicate bursts. | Preserve the existing category/key queue and cadence timer as the desktop projection only; request permission only from settings CTA. [VERIFIED: codebase graph] |

## Summary

Phase 18 is a browser-local state-composition change, not a new notification service. The repository already has the needed ingress points: `ConfigStore` validates and persists a personal presence selection; `NostrSocialStore` validates followed senders before retaining private invitations; and `NotificationCenterStore` validates preference records, groups delivery by cadence, and de-duplicates queued desktop events by category/key. The current defect is ownership: `PresenceControl` controls the coordinator lifecycle, `InviteInbox` is isolated, and `NotificationCenter` opens settings by first requesting permission. [VERIFIED: codebase graph]

Implement one in-app event ledger before the optional desktop projection. Producers record trusted/relevant events regardless of permission or category. The feed persists bounded display metadata and read state, while its desktop queue remains constrained by `active`, the category preference, and the existing cadence. Invitation capabilities remain only in the live trusted invitation object; a versioned resolution ledger persists only invitation ID plus resolution time for at least the current three-day Nostr replay query window. [VERIFIED: codebase graph]

The desktop API must remain secondary. The Notifications standard treats page-created notifications as non-persistent and advises that user agents need not keep them in a platform notification center; the browser's same-origin `tag` replacement behavior is useful for a concise cadence summary but cannot be the application's history. Notifications are a powerful feature with user-agent-controlled permission state, so the explicit in-settings opt-in is both the locked product contract and the durable platform-safe path. [CITED: https://notifications.spec.whatwg.org/] [CITED: https://www.w3.org/TR/permissions/]

**Primary recommendation:** Keep `NotificationCenterStore` as the single local event/desktop-delivery model, give it a separate `record()` path that always updates the feed, and put presence selection plus its accessible indicator in `UserProfile` without any call to coordinator lifecycle methods. [VERIFIED: codebase graph]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Presence selection and avatar status | Browser / Client | Nostr relay | The browser persists the personal preference; signed Nostr publication is a best-effort projection only when an eligible signer is connected. [VERIFIED: codebase graph] |
| In-app feed and unread badge | Browser / Client | — | Read state and bounded history are browser-local by phase scope; NOTF-04 explicitly defers synchronization. [VERIFIED: CONTEXT.md] |
| Browser desktop delivery | Browser / Client | Operating-system notification UI | The page creates non-persistent notifications after explicit permission and cadence grouping. [CITED: https://notifications.spec.whatwg.org/] |
| Invitation validation and action | Browser / Client | Nostr relay | The local social store decrypts/validates followed-sender envelopes, then the shell navigates through the existing same-shell redemption path. [VERIFIED: codebase graph] |
| Invitation replay suppression | Browser / Client | Nostr relay | The local resolution ledger rejects a handled ID before it can re-enter the live list during the store's relay replay subscription window. [VERIFIED: codebase graph] |
| Coordinator lifecycle and host administration | Browser / Client | — | `LifecyclePanel` remains the lifecycle owner; coordinator settings own host badge/message identity editing. [VERIFIED: codebase graph] |

## Project Constraints (from AGENTS.md)

- Preserve unrelated working-tree changes; multiple agents may share the checkout. [VERIFIED: AGENTS.md]
- Use Svelte 5 runes, strict TypeScript, browser-safe APIs, and existing component/state patterns; do not add Node-only runtime dependencies. [VERIFIED: AGENTS.md]
- Do not log, snapshot, fixture, or commit private keys, invitation secrets, or decrypted message material. [VERIFIED: AGENTS.md]
- Use `apply_patch` for intentional edits and run the narrowest relevant checks before the complete project gate. [VERIFIED: AGENTS.md]
- Retain the GSD requirement-to-evidence lifecycle, including separate plan checking and outcome verification. [VERIFIED: AGENTS.md]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte | 5.56.3 | Existing rune-based component/store reactivity. | `$state`, `$derived`, `$effect`, `SvelteMap`, and `SvelteSet` already implement every affected surface. [VERIFIED: package.json; codebase graph] |
| TypeScript | 5.9.3 | Strict types for persisted schemas, event categories, and component props. | Existing stores already validate browser-local records at the boundary. [VERIFIED: package.json; codebase graph] |
| Vitest | 4.1.9 | Deterministic store, persistence, cadence, and resolution tests. | Current notification tests use a `Notification` mock and fake timers. [VERIFIED: package.json; codebase graph] |
| Playwright | 1.61.0 | Rendered shell, accessible controls, compact drawer, and permission-flow proof. | Existing workspace tests already install a browser-notification mock and assert compact dialog bounds. [VERIFIED: package.json; codebase graph] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Browser Notifications API | Platform API | Optional desktop projection. | Only from the explicit settings CTA and only after `permission === "granted"`. [CITED: https://notifications.spec.whatwg.org/] |
| `nostr-tools` / existing NIP-44 envelope helpers | 2.23.5 / local | Existing private Nostr presence and invitation transport. | Continue the current trusted-sender ingress; do not introduce a second invite transport. [VERIFIED: package.json; codebase graph] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Browser-local in-app ledger | Remote notification backend | Out of scope: it would violate the browser-resident/no-backend milestone boundary and imply cross-device history. [VERIFIED: PROJECT.md; REQUIREMENTS.md] |
| Existing `NotificationCenterStore` | A third-party toast/feed package | Adds a dependency without solving this domain's trusted invite, persistence, cadence, or privacy constraints. [VERIFIED: codebase graph] |
| Current page `Notification` constructor | Service-worker persistent notifications | Requires an application/service-worker scope that this static-browser phase neither needs nor authorizes; current page notifications remain the optional projection. [CITED: https://notifications.spec.whatwg.org/] |

**Installation:** None. This phase adds no external package. [VERIFIED: package.json; CONTEXT.md]

## Architecture Patterns

### System Architecture Diagram

```text
signed Nostr envelope ──> NostrSocialStore
                             │ validate followed sender + payload
                             │ reject resolved ID before append
                             v
room/message/join sources ─> NotificationCenterStore.record(event)
                             │                 │
                             │                 ├──> bounded local feed + unread state
                             │                 │         │
                             │                 │         └──> bell / Feed UI
                             │                 │                  └──> live invite accept/dismiss
                             │                 │                           ├──> persist {id,resolvedAt}
                             │                 │                           └──> same-shell navigation
                             │                 │
                             └──> category/key desktop queue
                                       │ permission granted + enabled + category enabled
                                       v
                                   cadence summary ──> Browser Notification API

UserProfile ──> ConfigStore.presenceState ──> NostrSocialStore.setPresence()
      │                                                  (eligible signer only)
      └──> avatar dot + accessible current-status text

HostWorkspace: [personal cluster] || [host cluster]
                                     └── LifecyclePanel owns coordinator lifecycle
```

The event source must call `record()` before any desktop delivery decision. That preserves D-07 and makes browser notifications a lossy optional projection rather than the source of truth. [VERIFIED: CONTEXT.md; codebase graph]

### Recommended Project Structure

```text
src/
├── components/
│   ├── UserProfile.svelte            # profile + personal presence selection/status
│   ├── NotificationCenter.svelte     # settings trigger/panel only
│   ├── NotificationFeed.svelte       # bell, unread badge, local feed, invite actions
│   ├── CoordinatorSettings.svelte    # host message-identity/badge controls
│   └── HostWorkspace.svelte          # cluster composition and existing compact owner
├── invites/
│   └── nostr-social.svelte.ts        # trusted ingress + minimal resolution suppression
└── notifications/
    └── notification-center.svelte.ts # local event ledger, preferences, desktop queue
```

Delete `PresenceControl.svelte` and `InviteInbox.svelte` only after their state/action paths are migrated and coverage proves no visible duplicate trigger remains. [VERIFIED: codebase graph]

### Pattern 1: Record once, project twice

**What:** Add a notification-store `record(event)` operation that upserts the in-app feed/read state first, persists its bounded safe representation, then delegates to the current category/key cadence queue for desktop delivery. [VERIFIED: codebase graph]

**When to use:** Every existing producer: remote-message append, host join-request discovery/recovery, first online transition, and a validated incoming invite. [VERIFIED: codebase graph]

**Implementation shape:**

```ts
// Recommended local pattern; source of event is already trusted/classified.
record(event: CordnNotificationEvent): void {
  this.upsertFeed(event);              // independent of permission/preferences
  this.persist();
  this.enqueueDesktop(event);          // existing active/category/cadence gate
}
```

The desktop queue key remains `${event.category}:${event.key}`. A duplicate source event therefore cannot create another notification in the same cadence window, while a new occurrence can update its feed entry/read state without relying on the OS. [VERIFIED: codebase graph]

### Pattern 2: Live capability, durable resolution

**What:** Treat an invitation's `inviteUrl` as a live-only capability. Store it only in the current `IncomingNostrInvite` object after existing decryption and followed-sender validation; persist a handled-invite record shaped only as `{ id, resolvedAt }`. [VERIFIED: codebase graph]

**When to use:** Before adding an incoming invite, reject a non-expired resolved ID. On accept or dismiss, persist the resolution before removing the live object; acceptance then calls the current same-shell `autojoin=1` navigation. [VERIFIED: codebase graph]

**Why:** The current subscriber asks relays for the preceding three days, and its in-memory `seen` set resets on reload. Resolution must therefore survive reload, but retaining URLs/tokens would turn local notification history into a credential store. [VERIFIED: codebase graph]

### Pattern 3: Personal preference is not coordinator lifecycle

**What:** `HostWorkspace` owns the existing social-store connect/disconnect effect because it already has signer, coordinator descriptor, and relay props. `UserProfile` receives typed `presenceState` and an `onPresenceChange` callback that only changes the config/social presence. [VERIFIED: codebase graph]

**When to use:** Any profile menu presence selection, including anonymous users. Persist the selection for every user; publish only when a compatible signed signer is active, and explain the non-publication state in the menu. [VERIFIED: CONTEXT.md; codebase graph]

**Anti-patterns to avoid**

- **Coordinator-coupled presence:** Do not call `coordinator.start()`, `stop()`, `wake()`, or destroy methods from a presence handler. The current standalone control does this and directly violates D-03. [VERIFIED: codebase graph; CONTEXT.md]
- **Permission on panel open:** Do not call `requestPermission()` from opening settings or opening the bell. The old `openNotifications()` does exactly that and must be split. [VERIFIED: codebase graph; CONTEXT.md]
- **Persisting invite capabilities:** Do not serialize `inviteUrl`, relay payloads, room secrets, raw Nostr envelopes, or decrypted contents into feed/resolution storage. [VERIFIED: CONTEXT.md; AGENTS.md]
- **Reading equals resolving:** `markVisibleRead()` may set `readAt` on an invitation entry, but it must not call resolution, remove the invitation, or suppress replay. [VERIFIED: CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Desktop permission model | Custom permission state or prompt imitation | `Notification.permission` plus the existing `requestPermission()` wrapper. | Permission is user-agent controlled and can change outside the app. [CITED: https://notifications.spec.whatwg.org/] |
| Desktop burst grouping | Per-source timers | Existing `NotificationCenterStore` map plus one cadence timer. | It already validates cadence values, de-duplicates category/key events, cancels queued disabled categories, and uses one summary tag. [VERIFIED: codebase graph] |
| Private invitation transport/validation | A parallel invite endpoint or raw unverified payload parsing | Existing NIP-44 gift wrap helpers and `NostrSocialStore.receiveInvite`. | The existing path decrypts first and admits only followed senders. [VERIFIED: codebase graph] |
| Avatar/status accessibility | Decorative color-only indicator | Avatar trigger accessible name, visible status text in the menu, and semantic radio/menuitem choice state. | Color alone fails the locked accessibility contract. [VERIFIED: CONTEXT.md] |
| Compact sheet/drawer behavior | A new responsive overlay system | Existing `HostWorkspace` mobile-tools drawer and fixed bottom-sheet treatment. | Existing Playwright coverage already proves its inert, scrim, bounds, and no-overflow behavior. [VERIFIED: codebase graph] |

**Key insight:** The only new durable domain logic is a small, validated browser-local event/resolution schema. It is domain-specific and should be implemented beside the current stores, not hidden behind a generic package. [VERIFIED: codebase graph]

## Common Pitfalls

### Pitfall 1: Accidental permission prompts

**What goes wrong:** Opening settings calls `Notification.requestPermission()` and produces a browser prompt before the user elected desktop notifications. [VERIFIED: codebase graph]

**How to avoid:** Opening settings only synchronizes/render the current permission state. Only the `Enable desktop notifications` button calls the wrapper; denied and unsupported states offer safe explanatory copy. [VERIFIED: CONTEXT.md] [CITED: https://www.w3.org/TR/permissions/]

### Pitfall 2: Feed history disappears when desktop delivery is disabled

**What goes wrong:** Current `enqueue()` returns before retaining anything when permission/category is inactive, so turning desktop delivery off also suppresses activity from the only available UI. [VERIFIED: codebase graph]

**How to avoid:** Route all producers through feed-first `record()`; gate only `enqueueDesktop()`. Assert this in unit tests with default permission and disabled categories. [VERIFIED: CONTEXT.md; codebase graph]

### Pitfall 3: Handled invites replay after reload

**What goes wrong:** The current invite list and `seen` set are memory-only while social subscription intentionally replays recent events. [VERIFIED: codebase graph]

**How to avoid:** Validate a versioned resolution ledger, prune it only after a retention period no shorter than the subscription replay window, and check it before fetching profile/rendering/recording the invite. [VERIFIED: codebase graph]

### Pitfall 4: A feed mark-read consumes an invite

**What goes wrong:** Reusing `dismissInvite` for a feed-open action makes an unread-state update alter authority/actionability. [VERIFIED: CONTEXT.md]

**How to avoid:** Keep separate store methods with explicit names: `markVisibleRead(ids)` versus `resolveInvite(id, "accepted" | "dismissed")`; the latter alone writes resolution and removes the live invite. [VERIFIED: CONTEXT.md]

### Pitfall 5: Header regrouping strands controls at compact widths

**What goes wrong:** Adding nested clusters without adapting the existing five-column compact grid can hide personal controls or make an inert drawer focusable. [VERIFIED: codebase graph]

**How to avoid:** Keep the established host-tools drawer as compact ownership. Inside it, stack/segment personal then host controls, preserve the current scrim/inert behavior, and test every shortened visual label through its explicit accessible name. [VERIFIED: CONTEXT.md; codebase graph]

### Pitfall 6: Host identity remains in a personal menu

**What goes wrong:** Retaining `showHostIdentity` makes the profile menu own room-host message identity despite D-14. [VERIFIED: codebase graph; CONTEXT.md]

**How to avoid:** Move the existing badge label/emoji controls to `CoordinatorSettings` (or the existing management surface), preserve its `ConfigStore` validators, and remove all badge props/editor markup from `UserProfile`. [VERIFIED: codebase graph]

## Code Examples

### Safe invite-resolution record

```ts
interface ResolvedInviteRecord {
  version: 1;
  entries: Array<{ id: string; resolvedAt: number }>;
}

// Do not add inviteUrl, room secret, decrypted event, sender profile, or room title.
```

This is intentionally enough to suppress the existing replay source without reconstructing an invitation capability. Parse/validate it as strictly as the existing config and preference records, discard malformed entries, and bound/prune by `resolvedAt`. [VERIFIED: codebase graph; CONTEXT.md]

### Explicit browser-permission boundary

```ts
function openSettings(): void {
  notificationCenter.syncPermission();
  open = true; // Never request here.
}

async function enableDesktopNotifications(): Promise<void> {
  await notificationCenter.requestPermission(); // Called only by the explicit CTA.
}
```

The standard exposes `requestPermission()` on `Window`, while permissions remain controlled by the user agent; account for `default`, `granted`, `denied`, and unsupported runtime states. [CITED: https://notifications.spec.whatwg.org/] [CITED: https://www.w3.org/TR/permissions/]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One notification trigger opens preferences and prompts immediately. | Separate settings and feed; only an explicit settings CTA asks permission. | Phase 18. | Eliminates surprise prompting and permits a useful feed without desktop access. [VERIFIED: CONTEXT.md] |
| Desktop queue is the effective only event path. | Feed ledger is source of truth; desktop is optional grouped projection. | Phase 18. | Preserves relevant activity for denied/unsupported/disabled desktop notifications. [VERIFIED: CONTEXT.md] |
| Presence selection starts/stops coordinator. | Presence is personal config/social state; lifecycle stays in `LifecyclePanel`. | Phase 18. | Separates privacy/availability from host runtime authority. [VERIFIED: CONTEXT.md] |
| Private invite list is memory-only and isolated. | Bell feed contains current trusted invite actions plus durable minimal resolution suppression. | Phase 18. | Prevents handled replay without retaining credentials. [VERIFIED: CONTEXT.md; codebase graph] |

## Recommended File-Level Approach

| File | Change | Key implementation notes |
|------|--------|--------------------------|
| `src/notifications/notification-center.svelte.ts` | Extend, do not replace. | Version-migrate preferences to a validated record that also holds a bounded feed/read ledger; add feed-first `record`, `markVisibleRead`, unread-count derivation, and preserve the current category/key cadence queue as private desktop projection. No invitation URLs in persistence. [VERIFIED: codebase graph] |
| `src/invites/nostr-social.svelte.ts` | Add minimal resolution persistence and live-invite lookup/resolve methods. | Before `incomingInvites` append, reject resolved IDs; on accept/dismiss persist `{id,resolvedAt}` then remove live item. Reuse existing followed-sender check and same subscription window; do not persist `inviteUrl`. [VERIFIED: codebase graph] |
| `src/components/NotificationCenter.svelte` | Refactor to settings-only surface. | Trigger label is exactly `Notification settings`; opening only syncs current status. Retain category/cadence controls and make the explicit enable action the sole permission request caller. [VERIFIED: CONTEXT.md; codebase graph] |
| `src/components/NotificationFeed.svelte` | Add a separate bell/feed component. | Show unread badge, concise category-aware entries, current pending invitation actions, empty state, and timestamp copy. Opening marks currently rendered entries read but retains unresolved invitations. [VERIFIED: CONTEXT.md] |
| `src/components/UserProfile.svelte` | Absorb presence selector/status dot; remove host badge editor. | Add typed presence props/callback; avatar trigger's accessible name exposes current status and menu provides text/selection state. Leave identity flow untouched. [VERIFIED: codebase graph; CONTEXT.md] |
| `src/components/HostWorkspace.svelte` | Recompose header and own social connection effect/callback. | Render personal cluster (profile, bell, settings) separately from host cluster (coordinator settings, lifecycle, manage); retain the existing compact drawer/bottom-sheet owner. Do not couple presence to coordinator status. [VERIFIED: codebase graph; CONTEXT.md] |
| `src/components/CoordinatorSettings.svelte` | Move host badge/message identity editor here. | Reuse `config.hostBadgeLabel`, `config.hostBadgeEmoji`, and their existing validators; keep it behind existing coordinator settings editing rules. [VERIFIED: codebase graph] |
| `src/components/PresenceControl.svelte` | Remove after migration. | Its current lifecycle start/stop behavior must not survive in a dormant call path. [VERIFIED: codebase graph] |
| `src/components/InviteInbox.svelte` | Remove after invitation actions live in feed. | Preserve accept URL shaping and navigation semantics in a feed callback or shared helper. [VERIFIED: codebase graph] |
| `tests/unit/notification-center.test.ts` | Extend. | Prove feed survives permission/category-off, read/unread behavior, bounded eviction, category/key desktop dedupe, cadence summaries, and preference migration. [VERIFIED: codebase graph] |
| `tests/unit/nostr-invites.test.ts` | Extend or add focused helper tests. | Prove resolution persistence/validation/pruning, replay suppression, no serialized URL/token, followed-sender validation still precedes feed event creation, and accept/dismiss differ from read. [VERIFIED: codebase graph] |
| `tests/unit/config-store.test.ts` | Extend only if presence migration changes persistence calls. | Retain existing validated `online`/`invisible`/`offline` persistence behavior. [VERIFIED: codebase graph] |
| `tests/e2e/workspace-lifecycle.spec.ts` | Replace old notification/header helper assertions. | Prove no prompt on settings/feed open; prompt only via CTA; accessible avatar status; distinct clusters; feed invite actions; reload replay suppression; compact tool drawer bounds/names; lifecycle unaffected by presence. [VERIFIED: codebase graph] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A bounded history of 100 non-actionable feed entries is appropriate for this browser-only phase. | Recommended File-Level Approach | Low; change the bound without changing the privacy/control architecture. [ASSUMED] |
| A2 | Retaining resolved invitation IDs for seven days is a conservative bound above the current three-day replay query and accommodates short clock/reconnect variance. | Architecture Patterns | Low; the planner may instead retain exactly the replay window plus a documented margin. [ASSUMED] |

## Open Questions

1. **Exact local feed capacity and resolved-ID retention margin**
   - What we know: Feed capacity is agent discretion, and the current social subscription replays the preceding three days. [VERIFIED: CONTEXT.md; codebase graph]
   - What's unclear: The preferred UX retention duration is not a locked product decision.
   - Recommendation: Plan with 100 non-actionable entries and seven days of `{id,resolvedAt}` retention; never evict a pending live invite, and keep both constants named/tested. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Svelte/Vitest/Playwright commands | ✓ | v25.2.1 | — [VERIFIED: local environment] |
| pnpm | Package scripts and quality gates | ✓ | 10.17.1 | — [VERIFIED: local environment] |
| Playwright | Browser permission/accessibility/compact-layout evidence | ✓ | 1.61.0 | — [VERIFIED: local environment] |
| Vitest | Store/persistence/cadence tests | ✓ | 4.1.9 | — [VERIFIED: local environment] |
| Browser Notifications API | Optional desktop projection | browser-dependent | — | In-app feed remains fully functional. [CITED: https://www.w3.org/TR/permissions/] |

**Missing dependencies with no fallback:** None. [VERIFIED: local environment]

**Missing dependencies with fallback:** Browser notification support/permission may be unavailable, denied, or changed by the user agent; the in-app feed is the required fallback. [CITED: https://www.w3.org/TR/permissions/]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + Playwright 1.61.0. [VERIFIED: package.json; local environment] |
| Config file | `vite.config.ts` / Playwright configuration already used by repository scripts. [VERIFIED: package.json; codebase graph] |
| Quick run command | `pnpm test -- notification-center nostr-invites config-store` [VERIFIED: package.json] |
| Full suite command | `pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build && git diff --check` [VERIFIED: AGENTS.md; package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-01 | All presence choices live in profile; no standalone control remains. | Playwright | `pnpm test:e2e -- workspace-lifecycle` | ✅ extend |
| PRES-02 | Avatar dot/status is exposed to keyboard and screen reader users. | Playwright | `pnpm test:e2e -- workspace-lifecycle` | ✅ extend |
| INVITE-01 | Trusted incoming invite appears in bell feed; accept/dismiss use same-shell path. | unit + Playwright | `pnpm test -- nostr-invites && pnpm test:e2e -- workspace-lifecycle` | ✅ extend |
| SHELL-01 | Personal/host clusters and compact drawer remain reachable/named. | Playwright | `pnpm test:e2e -- workspace-lifecycle` | ✅ extend |
| NOTF-01 | Settings label and preference persistence without opening prompt. | unit + Playwright | `pnpm test -- notification-center && pnpm test:e2e -- workspace-lifecycle` | ✅ extend |
| NOTF-02 | Feed unread/read semantics and pending invite persistence. | unit + Playwright | `pnpm test -- notification-center nostr-invites && pnpm test:e2e -- workspace-lifecycle` | ✅ extend |
| NOTF-03 | Only explicit CTA requests permission; deduped cadence summary is delivered. | unit + Playwright | `pnpm test -- notification-center && pnpm test:e2e -- workspace-lifecycle` | ✅ extend |

### Sampling Rate

- **Per task commit:** Focused Vitest file(s) plus the directly affected Playwright case. [VERIFIED: AGENTS.md]
- **Per wave merge:** `pnpm lint && pnpm exec tsc --noEmit && pnpm test`. [VERIFIED: AGENTS.md; package.json]
- **Phase gate:** `pnpm test:e2e`, `pnpm build`, and `git diff --check` green before verification. [VERIFIED: AGENTS.md]

### Wave 0 Gaps

- [ ] Extend `tests/unit/notification-center.test.ts` with feed-first/no-permission, read semantics, persistence migration, capacity, and desktop dedupe cases. [VERIFIED: codebase graph]
- [ ] Extend `tests/unit/nostr-invites.test.ts` with resolution-ledger validation and replay-suppression cases that assert no URL/token is persisted. [VERIFIED: codebase graph]
- [ ] Extend `tests/e2e/workspace-lifecycle.spec.ts` with explicit permission, control separation, feed/action, reload suppression, and compact accessibility cases. [VERIFIED: codebase graph]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Keep NIP-07/NIP-46/anonymous identity boundaries intact; social publication requires the existing eligible signer check. [VERIFIED: codebase graph] |
| V3 Session Management | yes | Do not couple a personal presence change to coordinator start/stop/destroy session transitions. [VERIFIED: CONTEXT.md] |
| V4 Access Control | yes | Admit invitation data only after existing decrypt-and-followed-sender validation; accept continues through the existing invite redemption path. [VERIFIED: codebase graph] |
| V5 Input Validation | yes | Version/validate all localStorage records and reject malformed IDs/timestamps; preserve existing payload shape validation. [VERIFIED: codebase graph] |
| V6 Cryptography | yes | Reuse existing NIP-44 gift-wrap/decrypt helpers; do not parse, encrypt, or invent invitation cryptography in the feed. [VERIFIED: codebase graph] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invite capability retained in local history | Information disclosure | Persist only ID/timestamp resolution records; never URL, token, room secret, decrypted payload, or message content. [VERIFIED: CONTEXT.md; AGENTS.md] |
| Relay replay restores dismissed invite | Repudiation / replay | Check durable resolved ID before append; write resolution before removing live invitation. [VERIFIED: codebase graph] |
| Unfollowed/malformed envelope enters feed | Spoofing / tampering | Continue followed-sender gate and payload guard before profile fetch, live append, or `record`. [VERIFIED: codebase graph] |
| Browser permission prompt coercion | Elevation of privilege | Request only through the specifically labeled settings CTA; retain a functional in-app alternative. [VERIFIED: CONTEXT.md] [CITED: https://www.w3.org/TR/permissions/] |
| Presence action shuts down coordinator | Denial of service | No coordinator method may be reachable from `onPresenceChange`; lifecycle remains solely in `LifecyclePanel`. [VERIFIED: CONTEXT.md] |

## Sources

### Primary (HIGH confidence)

- Codebase-memory graph and source snippets — `NotificationCenterStore`, `NostrSocialStore`, `ConfigStore`, `HostWorkspace`, `UserProfile`, `PresenceControl`, `InviteInbox`, `CoordinatorSettings`, and related tests. [VERIFIED: codebase graph]
- `.planning/phases/18-unified-presence-notifications-controls/18-CONTEXT.md` — locked product decisions and phase boundary. [VERIFIED: CONTEXT.md]
- `AGENTS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, and Phase 15–17 context/UI contracts — project constraints and inherited shell/identity patterns. [VERIFIED: project planning documents]

### Secondary (MEDIUM confidence)

- [WHATWG Notifications API Standard](https://notifications.spec.whatwg.org/) — permission mapping, page notification lifetime, tag replacement, click behavior, and optional platform features. [CITED: https://notifications.spec.whatwg.org/]
- [W3C Permissions](https://www.w3.org/TR/permissions/) — notifications as a powerful feature; user-agent controlled permission state/lifetime. [CITED: https://www.w3.org/TR/permissions/]

### Tertiary (LOW confidence)

- None. [VERIFIED: research process]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all recommended dependencies are present in the checked-in manifest and used by the codebase. [VERIFIED: package.json; codebase graph]
- Architecture: HIGH — locked decisions align with direct current ingress, persistence, UI, and test seams. [VERIFIED: CONTEXT.md; codebase graph]
- Pitfalls: HIGH — each follows an existing behavior or a locked security/interaction constraint; browser API caveats are MEDIUM from current standards. [VERIFIED: codebase graph] [CITED: https://notifications.spec.whatwg.org/]

**Research date:** 2026-08-03
**Valid until:** 2026-09-02 for codebase findings; re-check browser-standard behavior if planning occurs after 30 days. [ASSUMED]
