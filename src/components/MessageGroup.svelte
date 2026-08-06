<script lang="ts">
  import { tick } from "svelte";
  import type { ChatEmojiShortcut } from "../chat/protocol";
  import { parseInviteMessage, type ChatInvite, type RoomHostIdentity } from "../chat/invite";
  import type { ReactionSummary, StoredMessage } from "../chat/room-store";
  import { createPubkeyAvatar } from "../identity/user-profile.svelte";
  import MessageReactions from "./MessageReactions.svelte";
  import MessageTimestamp from "./MessageTimestamp.svelte";
  import { viewportOverlay } from "../lib/viewport-overlay";

  export interface ParticipantRoomChoice {
    coordinatorPubkey: string;
    roomId: string;
    title: string;
    coordinatorLabel: string;
  }

  interface Props {
    messages: StoredMessage[];
    viewerPubkey: string;
    reactionsFor: (messageId: string) => ReactionSummary[];
    pickerOpenMessageId: string | null;
    disabled?: boolean;
    idPrefix: "host" | "guest";
    onTogglePicker: (messageId: string) => void;
    onClosePicker: (messageId: string) => void;
    onToggleReaction: (messageId: string, emoji: ChatEmojiShortcut) => void | Promise<void>;
    onSetReaction: (messageId: string, emoji: ChatEmojiShortcut) => void | Promise<void>;
    onJoinInvite: (invite: ChatInvite) => void;
    participantRooms?: ParticipantRoomChoice[];
    onMention?: (participantPubkey: string, displayName: string) => void;
    onInviteToRoom?: (participantPubkey: string, room: ParticipantRoomChoice) => Promise<void>;
  }

  let {
    messages,
    viewerPubkey,
    reactionsFor,
    pickerOpenMessageId,
    disabled = false,
    idPrefix,
    onTogglePicker,
    onClosePicker,
    onToggleReaction,
    onSetReaction,
    onJoinInvite,
    participantRooms = [],
    onMention,
    onInviteToRoom,
  }: Props = $props();

  const first = $derived(messages[0]);
  const mine = $derived(first?.sender === viewerPubkey);
  const host = $derived(Boolean(first?.badgeLabel || first?.badgeEmoji));
  const fallbackAvatar = $derived(first ? createPubkeyAvatar(first.sender) : "");
  let actionTrigger = $state<HTMLButtonElement>();
  let menuOpen = $state(false);
  let chooserOpen = $state(false);
  let invitePendingRoom = $state<string | null>(null);
  let actionError = $state("");
  let actionStatus = $state("");

  const participantName = $derived(first?.name || "anon");

  async function openMenu(): Promise<void> {
    if (mine || !first) return;
    chooserOpen = false;
    actionError = "";
    actionStatus = "";
    menuOpen = true;
    await tick();
    document.getElementById(`${idPrefix}-participant-mention-${first.sender}`)?.focus();
  }

  function closeSurface(restoreFocus = true): void {
    menuOpen = false;
    chooserOpen = false;
    invitePendingRoom = null;
    if (restoreFocus) void tick().then(() => actionTrigger?.focus());
  }

  async function mentionParticipant(): Promise<void> {
    if (!first || !onMention) return;
    menuOpen = false;
    onMention(first.sender, participantName);
  }

  async function openChooser(): Promise<void> {
    menuOpen = false;
    chooserOpen = true;
    actionError = "";
    await tick();
    document.getElementById(`${idPrefix}-participant-room-${participantRooms[0]?.coordinatorPubkey}-${participantRooms[0]?.roomId}`)?.focus();
  }

  async function sendRoomInvite(room: ParticipantRoomChoice): Promise<void> {
    if (!first || !onInviteToRoom || invitePendingRoom) return;
    const key = `${room.coordinatorPubkey}:${room.roomId}`;
    invitePendingRoom = key;
    actionError = "";
    actionStatus = "";
    try {
      await onInviteToRoom(first.sender, room);
      actionStatus = `Invite sent to ${participantName}.`;
      closeSurface(false);
      await tick();
      actionTrigger?.focus();
    } catch {
      actionError = "Couldn’t send the invite. Check the room connection and try again.";
      invitePendingRoom = null;
    }
  }

  function handleSurfaceKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeSurface();
  }

  function useFallback(event: Event): void {
    (event.currentTarget as HTMLImageElement).src = fallbackAvatar;
  }

  function useInviteFallback(event: Event, pubkey: string): void {
    (event.currentTarget as HTMLImageElement).src = createPubkeyAvatar(pubkey);
  }

  function inviteHost(invite: ChatInvite): RoomHostIdentity {
    return invite.host ?? {
      name: "Unknown host",
      pubkey: invite.coordinatorPubkey,
    };
  }

  function inviteCoordinatorName(invite: ChatInvite): string {
    return invite.coordinatorName?.trim()
      || `Coordinator ${invite.coordinatorPubkey.slice(0, 6)}…${invite.coordinatorPubkey.slice(-4)}`;
  }
</script>

{#if first}
  <section
    class:mine
    class:host
    class="message-streak"
    data-testid="message-streak"
    data-sender={first.sender}
    data-message-count={messages.length}
    aria-label={`${first.name || "anon"}, ${messages.length} ${messages.length === 1 ? "message" : "messages"}`}
  >
    <img class="streak-avatar" data-testid="message-avatar" src={first.avatar || fallbackAvatar} alt="" onerror={useFallback} />
    <div class="streak-content">
      <div class="streak-author" data-testid="message-author">
        {#if mine}
          <strong>{participantName}</strong>
          {#if host}
            <span class="message-badge" data-testid="message-badge">
              {#if first.badgeEmoji}<span aria-hidden="true">{first.badgeEmoji}</span>{/if}
              {first.badgeLabel || "host"}
            </span>
          {/if}
        {:else}
          <button
            bind:this={actionTrigger}
            class="participant-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={menuOpen || chooserOpen}
            aria-label={`Actions for ${participantName}`}
            title={participantName}
            onclick={() => void openMenu()}
          >
            <strong>{participantName}</strong>
            {#if host}
              <span class="message-badge" data-testid="message-badge">
                {#if first.badgeEmoji}<span aria-hidden="true">{first.badgeEmoji}</span>{/if}
                {first.badgeLabel || "host"}
              </span>
            {/if}
          </button>
        {/if}
      </div>
      <div class="streak-messages">
        {#each messages as message (message.id)}
          {@const reactions = reactionsFor(message.id)}
          {@const sharedInvite = parseInviteMessage(message.content)}
          {@const mentionedViewer = Boolean(message.recipientPubkeys?.includes(viewerPubkey.toLowerCase()))}
          <article class:host class:mentioned={mentionedViewer} class={`message-bubble ${idPrefix === "host" ? "host-message" : "message"}`} data-testid="message-bubble" data-message-id={message.id}>
            {#if mentionedViewer}<span class="mentioned-you" data-testid="mentioned-you">Mentioned you</span>{/if}
            {#if sharedInvite}
              {@const sharedHost = inviteHost(sharedInvite)}
              {@const groupName = sharedInvite.title || "Chat"}
              {@const coordinatorName = inviteCoordinatorName(sharedInvite)}
              <button
                class="shared-invite-action"
                type="button"
                aria-label={`Join ${groupName} on ${coordinatorName} by ${sharedHost.name}`}
                onclick={() => onJoinInvite(sharedInvite)}
              >
                <span class="shared-invite-copy">Join <strong>{groupName}</strong> on <strong>{coordinatorName}</strong></span>
                <span class="shared-invite-host">
                  <span>by</span>
                  <img src={sharedHost.avatar || createPubkeyAvatar(sharedHost.pubkey)} alt="" onerror={(event) => useInviteFallback(event, sharedHost.pubkey)} />
                  <span>{sharedHost.name}</span>
                </span>
              </button>
            {:else}
              <p>{message.content}</p>
            {/if}
            <MessageTimestamp createdAt={message.createdAt} pending={message.pending} />
            <MessageReactions
              messageId={message.id}
              authorName={message.name}
              {reactions}
              pickerOpen={pickerOpenMessageId === message.id}
              canReact={message.sender !== viewerPubkey}
              {disabled}
              {idPrefix}
              onTogglePicker={() => onTogglePicker(message.id)}
              onClosePicker={() => onClosePicker(message.id)}
              onToggleReaction={(emoji) => onToggleReaction(message.id, emoji)}
              onSetReaction={(emoji) => onSetReaction(message.id, emoji)}
            />
          </article>
        {/each}
      </div>
    </div>
  </section>

  {#if menuOpen && !mine}
    <div
      class="participant-menu"
      role="dialog"
      tabindex="-1"
      aria-label={`Actions for ${participantName}`}
      use:viewportOverlay={{ anchor: actionTrigger, preferredSide: "above", align: mine ? "end" : "start", compactSheetBelow: 520 }}
      onkeydown={handleSurfaceKeydown}
    >
      <button id={`${idPrefix}-participant-mention-${first.sender}`} type="button" onclick={() => void mentionParticipant()}>Mention</button>
      <button type="button" onclick={() => void openChooser()}>Invite to room</button>
      <button type="button" disabled aria-describedby={`${idPrefix}-participant-follow-guidance-${first.sender}`}>Follow on Nostr</button>
      <p id={`${idPrefix}-participant-follow-guidance-${first.sender}`} class="participant-guidance">Sign in to follow people on Nostr.</p>
      <div class="participant-divider" aria-hidden="true"></div>
      <button type="button" disabled>Highlight</button>
      <button type="button" disabled>Ignore</button>
    </div>
  {/if}

  {#if chooserOpen && !mine}
    <div
      class="participant-chooser"
      role="dialog"
      tabindex="-1"
      aria-label={`Invite ${participantName} to a room`}
      use:viewportOverlay={{ anchor: actionTrigger, preferredSide: "above", align: mine ? "end" : "start", compactSheetBelow: 520 }}
      onkeydown={handleSurfaceKeydown}
    >
      <h2>Invite {participantName} to a room</h2>
      {#if participantRooms.length === 0}
        <strong>No other active rooms</strong>
        <p>Join or create another active room before sending an invite.</p>
      {:else}
        <div class="participant-room-list" aria-busy={invitePendingRoom !== null}>
          {#each participantRooms as room (`${room.coordinatorPubkey}:${room.roomId}`)}
            {@const key = `${room.coordinatorPubkey}:${room.roomId}`}
            <button
              id={`${idPrefix}-participant-room-${room.coordinatorPubkey}-${room.roomId}`}
              type="button"
              disabled={invitePendingRoom !== null}
              onclick={() => void sendRoomInvite(room)}
            >
              {#if invitePendingRoom === key}Sending invite…{:else}<span>{room.title}</span><small>{room.coordinatorLabel}</small>{/if}
            </button>
          {/each}
        </div>
      {/if}
      {#if actionError}<p class="participant-action-error" role="status">{actionError}</p>{/if}
    </div>
  {/if}
  {#if actionStatus}<p class="participant-action-status" role="status">{actionStatus}</p>{/if}
{/if}

<style>
  .message-streak { display: grid; width: max(60%, 18rem); max-width: min(88%, 44rem); grid-template-columns: 2rem minmax(0, 1fr); align-items: end; gap: .6rem; margin: 0 0 .8rem; }
  .message-streak.mine { margin-left: auto; grid-template-columns: minmax(0, 1fr) 2rem; }
  .streak-avatar { grid-column: 1; width: 2rem; height: 2rem; border: 1px solid rgb(124 245 157 / .16); background: #0b0e0d; object-fit: cover; }
  .mine .streak-avatar { grid-column: 2; opacity: .72; }
  .streak-content { grid-column: 2; min-width: 0; }
  .mine .streak-content { grid-column: 1; grid-row: 1; }
  .streak-author { display: flex; min-width: 0; align-items: center; gap: .4rem; margin: 0 0 .2rem; }
  .mine .streak-author { justify-content: flex-end; }
  .streak-author strong { overflow: hidden; color: #b9fac8; font-size: .7rem; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
  .mine .streak-author strong { color: #7f9387; }
  .message-badge { display: inline-flex; user-select: text; align-items: center; gap: .22rem; border: 1px solid #41664b; background: rgb(124 245 157 / .07); padding: .12rem .32rem; color: #93dba4; font-size: .48rem; font-weight: 680; letter-spacing: .09em; line-height: 1.15; text-transform: uppercase; }
  .participant-trigger { display: inline-flex; min-width: 0; max-width: 100%; align-items: center; gap: .4rem; border: 1px solid transparent; padding: .18rem .26rem; color: inherit; text-align: left; }
  .participant-trigger:hover, .participant-trigger:focus-visible, .participant-trigger[aria-expanded="true"] { border-color: #7cf59d; background: #101a13; outline: 2px solid transparent; outline-offset: 2px; }
  .participant-trigger:focus-visible { outline-color: #7cf59d; }
  .participant-menu, .participant-chooser { box-sizing: border-box; display: grid; width: min(18rem, calc(100vw - 1rem)); gap: .5rem; border: 1px solid #405348; background: #0c120f; padding: .5rem; color: #dfffe7; box-shadow: 0 .75rem 2rem rgb(0 0 0 / .38); }
  .participant-menu > button, .participant-room-list > button { display: grid; min-height: 2.75rem; width: 100%; align-items: center; border: 1px solid transparent; padding: .55rem .65rem; color: #dfffe7; text-align: left; }
  .participant-menu > button:hover:not(:disabled), .participant-menu > button:focus-visible, .participant-room-list > button:hover:not(:disabled), .participant-room-list > button:focus-visible { border-color: #7cf59d; background: #14241a; outline: 2px solid #7cf59d; outline-offset: 2px; }
  .participant-menu > button:disabled { cursor: not-allowed; color: #82958a; opacity: .8; }
  .participant-guidance, .participant-chooser p { margin: -.25rem .65rem .15rem; color: #82958a; font-size: .62rem; line-height: 1.45; }
  .participant-divider { height: 1px; margin: .1rem 0; background: #293832; }
  .participant-chooser h2 { color: #effff2; font-size: .78rem; font-weight: 700; }
  .participant-chooser > strong { color: #b9fac8; font-size: .72rem; }
  .participant-room-list { display: grid; max-height: 16rem; gap: .35rem; overflow-y: auto; overscroll-behavior: contain; }
  .participant-room-list > button { gap: .16rem; border-color: #293832; }
  .participant-room-list small { color: #82958a; font-size: .58rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .participant-action-error { margin: 0; color: #ffaaa3; font-size: .62rem; line-height: 1.45; }
  .participant-action-status { position: fixed; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .streak-messages { display: grid; gap: .18rem; }
  .message-bubble { position: relative; z-index: 0; min-width: 5rem; border: 0; background: #1a241e; padding: .48rem .72rem .72rem; color: #dce8df; }
  .message-bubble:hover, .message-bubble:focus-within, .message-bubble:has(:global(.picker-open)) { z-index: 4; }
  .message-bubble:has(:global(.has-reactions)) { margin-bottom: .72rem; }
  .mine .message-bubble { background: #162019; color: #cbd7ce; }
  .message-streak.host:not(.mine) .message-bubble { background: #18291d; box-shadow: inset 2px 0 rgb(124 245 157 / .12); }
  .mine .message-bubble.host { background: #162019; box-shadow: none; }
  .message-bubble p { white-space: pre-wrap; overflow-wrap: anywhere; }
  .message-bubble.mentioned { box-shadow: inset 2px 0 #f1f58f; }
  .mentioned-you { display: block; margin: -.05rem 0 .3rem; color: #f1f58f; font-size: .58rem; font-weight: 760; letter-spacing: .08em; line-height: 1.2; text-transform: uppercase; }
  .shared-invite-action { display: flex; width: 100%; min-height: 3.25rem; align-items: center; justify-content: space-between; gap: .8rem; border: 1px solid rgb(124 245 157 / .2); background: #101a13; padding: .65rem .7rem; color: #cfe8d5; text-align: left; transition: border-color .15s ease, background .15s ease, color .15s ease; }
  .shared-invite-action:hover, .shared-invite-action:focus-visible { border-color: #7cf59d; outline: none; background: #14241a; color: #effff2; }
  .shared-invite-copy { min-width: 0; line-height: 1.45; }
  .shared-invite-copy strong { color: #b9fac8; font-weight: 700; }
  .shared-invite-host { display: inline-flex; flex: 0 0 auto; align-items: center; gap: .3rem; color: #8fa397; font-size: .58rem; }
  .shared-invite-host img { width: 1.35rem; height: 1.35rem; border: 1px solid rgb(124 245 157 / .2); background: #0b0e0d; object-fit: cover; }
  .message-bubble :global(.message-timestamp) { min-height: .65rem; margin-top: .18rem; }
  .mine .message-bubble :global(.message-reactions) { right: .75rem; left: auto; }
  .mine .message-bubble :global(.reaction-picker) { right: 0; left: auto; }
  @media (max-width: 520px) {
    .message-streak { max-width: 88%; gap: .45rem; }
    .message-bubble { padding-inline: .65rem; }
    .shared-invite-action { align-items: flex-start; flex-direction: column; gap: .45rem; }
  }
</style>
