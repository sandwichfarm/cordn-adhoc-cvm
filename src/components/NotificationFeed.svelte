<script lang="ts">
  import { tick } from "svelte";
  import { nostrSocialStore } from "../invites/nostr-social.svelte";
  import {
    notificationCenter,
    type FeedNotificationEntry,
  } from "../notifications/notification-center.svelte";

  interface Props {
    onNavigate: (href: string) => void;
  }

  const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

  let { onNavigate }: Props = $props();
  let open = $state(false);
  let pendingDismissId = $state<string | null>(null);
  let busyId = $state<string | null>(null);
  let actionError = $state("");
  let trigger: HTMLButtonElement | undefined = $state();
  let dialog: HTMLDivElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();
  let keepButton: HTMLButtonElement | undefined = $state();

  const unreadLabel = $derived(notificationCenter.unreadCount > 99 ? "99+" : String(notificationCenter.unreadCount));
  const bellName = $derived(notificationCenter.unreadCount > 0
    ? `Notifications, ${unreadLabel} unread`
    : "Notifications, no unread");
  const groupedEntries = $derived.by(() => groupEntries(notificationCenter.feed));

  function openFeed(): void {
    open = true;
    pendingDismissId = null;
    actionError = "";
    const renderedIds = notificationCenter.feed.map((entry) => entry.id);
    const markedUnread = notificationCenter.feed.filter((entry) => !entry.read).length;
    notificationCenter.markVisibleRead(renderedIds);
    void tick().then(() => closeButton?.focus());
    if (markedUnread > 0) actionError = `${markedUnread} ${markedUnread === 1 ? "notification" : "notifications"} marked read.`;
  }

  function close(): void {
    if (busyId) return;
    if (pendingDismissId) {
      keepInvitation();
      return;
    }
    open = false;
    actionError = "";
    void tick().then(() => trigger?.focus());
  }

  function liveInvitation(entry: FeedNotificationEntry) {
    if (entry.category !== "room_invite") return undefined;
    return nostrSocialStore.incomingInvites.find((invite) => invite.id === entry.key);
  }

  async function accept(entry: FeedNotificationEntry): Promise<void> {
    const invite = liveInvitation(entry);
    if (!invite) {
      actionError = "This invitation is no longer available.";
      return;
    }
    busyId = entry.id;
    actionError = "Opening invitation…";
    try {
      const target = new URL(invite.inviteUrl, window.location.origin);
      target.searchParams.set("autojoin", "1");
      nostrSocialStore.dismissInvite(invite.id);
      open = false;
      onNavigate(target.href);
    } catch {
      actionError = "Could not open this invitation. It is still available to review.";
    } finally {
      busyId = null;
    }
  }

  function beginDismiss(entry: FeedNotificationEntry): void {
    pendingDismissId = entry.id;
    actionError = "";
    void tick().then(() => keepButton?.focus());
  }

  function keepInvitation(): void {
    const dismissedId = pendingDismissId;
    pendingDismissId = null;
    void tick().then(() => document.getElementById(`dismiss-invitation-${dismissedId ?? ""}`)?.focus());
  }

  function confirmDismiss(entry: FeedNotificationEntry): void {
    const invite = liveInvitation(entry);
    notificationCenter.resolveInvitation(entry.key);
    if (invite) nostrSocialStore.dismissInvite(invite.id);
    pendingDismissId = null;
    actionError = "Invitation dismissed.";
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (pendingDismissId) {
        keepInvitation();
        return;
      }
      close();
      return;
    }
    if (event.key !== "Tab" || !dialog) return;
    const controls = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function groupEntries(entries: FeedNotificationEntry[]): Array<{ name: "Now" | "Today" | "Earlier"; entries: FeedNotificationEntry[] }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const nowCutoff = Date.now() - 60 * 60 * 1_000;
    const groups = new Map<"Now" | "Today" | "Earlier", FeedNotificationEntry[]>([
      ["Now", []],
      ["Today", []],
      ["Earlier", []],
    ]);
    for (const entry of entries) {
      const group = entry.createdAt >= nowCutoff ? "Now" : entry.createdAt >= todayStart.getTime() ? "Today" : "Earlier";
      groups.get(group)?.push(entry);
    }
    return [...groups.entries()]
      .filter(([, entries]) => entries.length > 0)
      .map(([name, entries]) => ({ name, entries }));
  }

  function entryTitle(entry: FeedNotificationEntry): string {
    if (entry.category === "room_invite") return "Room invitation";
    if (entry.category === "user_online") return `${entry.actor ?? "Someone"} is online`;
    if (entry.category === "new_message") return entry.room ? `New message in #${entry.room}` : "New message";
    return entry.action === "joined" ? "Guest joined" : "Guest waiting to join";
  }

  function entryDetail(entry: FeedNotificationEntry): string {
    if (entry.category === "room_invite") return entry.actor ? `From ${entry.actor}` : "From a trusted contact";
    if (entry.category === "new_message") return entry.actor ? `From ${entry.actor}` : "New encrypted activity";
    if (entry.category === "user_online") return "Available on CAHMLS";
    return entry.room ? `In #${entry.room}` : "Room access update";
  }

  function relativeTime(timestamp: number): string {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));
    if (seconds < 60) return "just now";
    if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
    return `${Math.floor(seconds / 86_400)}d ago`;
  }
</script>

<div class="notification-feed">
  <button
    bind:this={trigger}
    class="notification-feed-trigger"
    type="button"
    aria-label={bellName}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={openFeed}
  >
    <span aria-hidden="true">♢</span>
    {#if notificationCenter.unreadCount > 0}<span class="notification-feed-badge" aria-hidden="true">{unreadLabel}</span>{/if}
  </button>

  {#if open}
    <button class="notification-feed-backdrop" type="button" aria-label="Close notifications" onclick={close}></button>
    <div bind:this={dialog} class="notification-feed-panel" role="dialog" aria-modal="true" aria-label="Notifications" tabindex="-1" onkeydown={handleKeydown}>
      <header>
        <div>
          <h2>Notifications</h2>
          <p>{notificationCenter.unreadCount > 0 ? `${notificationCenter.unreadCount} unread` : "All caught up"}</p>
        </div>
        <button bind:this={closeButton} type="button" aria-label="Close notifications" onclick={close}>×</button>
      </header>

      <div class="notification-feed-body">
        {#if groupedEntries.length === 0}
          <div class="notification-feed-empty"><strong>No personal activity</strong><span>Relevant room and contact updates appear here.</span></div>
        {:else}
          {#each groupedEntries as group (group.name)}
            <section aria-label={group.name}>
              <h3>{group.name}</h3>
              {#each group.entries as entry (entry.id)}
                {@const invitation = liveInvitation(entry)}
                <article class:unread={!entry.read} aria-label={`${entryTitle(entry)}${entry.read ? "" : ", Unread"}`}>
                  <div class="notification-entry-copy">
                    <strong>{entryTitle(entry)}</strong>
                    {#if entry.category === "room_invite" && entry.room}<b>{entry.room}</b>{/if}
                    <span>{entryDetail(entry)}</span>
                    <small>{relativeTime(entry.createdAt)}</small>
                  </div>
                  {#if entry.category === "room_invite"}
                    {#if pendingDismissId === entry.id}
                      <div class="invitation-confirmation" role="group" aria-label={`Dismiss invitation to ${entry.room ?? "room"}`}>
                        <p>Dismiss this invitation? You can’t undo this.</p>
                        <div>
                          <button bind:this={keepButton} type="button" onclick={keepInvitation}>Keep invitation</button>
                          <button class="danger" type="button" onclick={() => confirmDismiss(entry)}>Dismiss invitation</button>
                        </div>
                      </div>
                    {:else if invitation}
                      <div class="invitation-actions">
                        <button class="accept" type="button" disabled={busyId === entry.id} onclick={() => void accept(entry)}>Accept invitation</button>
                        <button id={`dismiss-invitation-${entry.id}`} type="button" disabled={busyId === entry.id} onclick={() => beginDismiss(entry)}>Dismiss invitation</button>
                      </div>
                    {:else}
                      <span class="invitation-unavailable">Invitation unavailable</span>
                    {/if}
                  {/if}
                </article>
              {/each}
            </section>
          {/each}
        {/if}
      </div>
      <p class="notification-feed-status" aria-live="polite">{actionError}</p>
    </div>
  {/if}
</div>

<style>
  .notification-feed { position: relative; flex: 0 0 auto; }
  .notification-feed-trigger { position: relative; display: grid; width: 2.65rem; height: 2.65rem; place-items: center; border: 1px solid #293832; color: #91a59a; font-size: .85rem; }
  .notification-feed-trigger:hover, .notification-feed-trigger[aria-expanded="true"] { border-color: #496451; background: #101713; color: #dfffe7; }
  .notification-feed-trigger:focus-visible, .notification-feed-panel button:focus-visible { outline: 2px solid #7cf59d; outline-offset: 2px; }
  .notification-feed-badge { position: absolute; top: -.25rem; right: -.3rem; display: grid; min-width: 1rem; height: 1rem; place-items: center; background: #7cf59d; color: #071009; font-size: .45rem; font-weight: 700; }
  .notification-feed-backdrop { position: fixed; z-index: 69; inset: 0; cursor: default; }
  .notification-feed-panel { position: absolute; z-index: 70; top: calc(100% + .45rem); right: 0; width: min(26rem, calc(100vw - 1rem)); border: 1px solid #496451; background: #090e0b; box-shadow: 0 18px 48px rgb(0 0 0 / .62); }
  .notification-feed-panel header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #293832; padding: .8rem .9rem; }
  .notification-feed-panel h2 { color: #effff2; font-size: .85rem; font-weight: 680; }
  .notification-feed-panel header p, .notification-feed-status { margin-top: .2rem; color: #718277; font-size: .52rem; }
  .notification-feed-panel header button { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; color: #91a59a; font-size: 1rem; }
  .notification-feed-panel header button:hover { background: #162019; color: #effff2; }
  .notification-feed-body { max-height: min(32rem, calc(100dvh - 9rem)); overflow-y: auto; overscroll-behavior: contain; }
  .notification-feed-body section + section { border-top: 1px solid #202d25; }
  .notification-feed-body h3 { padding: .65rem .9rem .35rem; color: #718277; font-size: .5rem; letter-spacing: .14em; text-transform: uppercase; }
  article { display: flex; min-height: 4.4rem; align-items: center; justify-content: space-between; gap: .7rem; padding: .7rem .9rem; }
  article.unread { background: #101813; box-shadow: inset 2px 0 #7cf59d; }
  .notification-entry-copy { min-width: 0; }
  .notification-entry-copy strong, .notification-entry-copy b, .notification-entry-copy span, .notification-entry-copy small { display: block; }
  .notification-entry-copy strong { color: #d9ecde; font-size: .66rem; font-weight: 620; }
  .notification-entry-copy b { margin-top: .12rem; color: #e8f5eb; font-size: .7rem; font-weight: 500; }
  .notification-entry-copy span { margin-top: .14rem; color: #91a59a; font-size: .56rem; }
  .notification-entry-copy small { margin-top: .13rem; color: #617168; font-size: .48rem; }
  .invitation-actions, .invitation-confirmation > div { display: flex; flex: 0 0 auto; gap: .28rem; }
  .invitation-actions button, .invitation-confirmation button { min-height: 2.2rem; border: 1px solid #34483a; padding: .4rem .5rem; color: #c9ddd0; font-size: .53rem; }
  .invitation-actions .accept { border-color: #7cf59d; background: #7cf59d; color: #071009; font-weight: 700; }
  .invitation-confirmation { width: 100%; border-top: 1px solid #6d413d; padding-top: .55rem; }
  .invitation-confirmation p { margin-bottom: .45rem; color: #ffcac5; font-size: .55rem; }
  .invitation-confirmation .danger { border-color: #ffaaa3; color: #ffaaa3; }
  .invitation-unavailable { flex: 0 0 auto; color: #82958a; font-size: .5rem; }
  .notification-feed-status { min-height: 1.2rem; border-top: 1px solid #202d25; padding: .35rem .9rem; }
  .notification-feed-empty { padding: 1rem; }
  .notification-feed-empty strong, .notification-feed-empty span { display: block; }
  .notification-feed-empty strong { color: #d9ecde; font-size: .66rem; }
  .notification-feed-empty span { margin-top: .25rem; color: #718277; font-size: .56rem; }
  @media (max-width: 900px) {
    .notification-feed-panel { position: fixed; top: auto; right: .5rem; bottom: .5rem; left: .5rem; width: auto; max-height: calc(100dvh - 1rem); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
    .notification-feed-body { min-height: 0; max-height: none; }
  }
</style>
