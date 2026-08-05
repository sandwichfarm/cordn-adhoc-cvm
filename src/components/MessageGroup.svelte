<script lang="ts">
  import type { ChatEmojiShortcut } from "../chat/protocol";
  import type { ReactionSummary, StoredMessage } from "../chat/room-store";
  import { createPubkeyAvatar } from "../identity/user-profile.svelte";
  import MessageReactions from "./MessageReactions.svelte";
  import MessageTimestamp from "./MessageTimestamp.svelte";

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
  }: Props = $props();

  const first = $derived(messages[0]);
  const mine = $derived(first?.sender === viewerPubkey);
  const host = $derived(Boolean(first?.badgeLabel || first?.badgeEmoji));
  const fallbackAvatar = $derived(first ? createPubkeyAvatar(first.sender) : "");

  function useFallback(event: Event): void {
    (event.currentTarget as HTMLImageElement).src = fallbackAvatar;
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
        <strong>{first.name || "anon"}</strong>
        {#if host}
          <span class="message-badge" data-testid="message-badge">
            {#if first.badgeEmoji}<span aria-hidden="true">{first.badgeEmoji}</span>{/if}
            {first.badgeLabel || "host"}
          </span>
        {/if}
      </div>
      <div class="streak-messages">
        {#each messages as message (message.id)}
          {@const reactions = reactionsFor(message.id)}
          <article class:host class={`message-bubble ${idPrefix === "host" ? "host-message" : "message"}`} data-testid="message-bubble" data-message-id={message.id}>
            <p>{message.content}</p>
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
{/if}

<style>
  .message-streak { display: grid; width: max(60%, 18rem); max-width: min(88%, 44rem); grid-template-columns: 2rem minmax(0, 1fr); align-items: end; gap: .6rem; margin: 0 0 1.15rem; }
  .message-streak.mine { margin-left: auto; grid-template-columns: minmax(0, 1fr) 2rem; }
  .streak-avatar { grid-column: 1; width: 2rem; height: 2rem; border: 1px solid rgb(124 245 157 / .16); background: #0b0e0d; object-fit: cover; }
  .mine .streak-avatar { grid-column: 2; }
  .streak-content { grid-column: 2; min-width: 0; }
  .mine .streak-content { grid-column: 1; grid-row: 1; }
  .streak-author { display: flex; min-width: 0; align-items: center; gap: .4rem; margin: 0 0 .3rem; }
  .mine .streak-author { justify-content: flex-end; }
  .streak-author strong { overflow: hidden; color: #b9fac8; font-size: .7rem; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
  .message-badge { display: inline-flex; user-select: text; align-items: center; gap: .22rem; border: 1px solid #41664b; background: rgb(124 245 157 / .07); padding: .12rem .32rem; color: #93dba4; font-size: .48rem; font-weight: 680; letter-spacing: .09em; line-height: 1.15; text-transform: uppercase; }
  .streak-messages { display: grid; gap: .28rem; }
  .message-bubble { position: relative; min-width: 5rem; border: 1px solid #293832; background: #161e1a; padding: .62rem .78rem .9rem; color: #e4f2e7; }
  .mine .message-bubble { border-color: #2e553b; background: #173323; }
  .message-bubble.host { border-color: #41664b; background: #14251a; box-shadow: inset 2px 0 rgb(124 245 157 / .16); }
  .mine .message-bubble.host { box-shadow: inset -2px 0 rgb(124 245 157 / .18); }
  .message-bubble p { white-space: pre-wrap; overflow-wrap: anywhere; }
  .mine .message-bubble :global(.message-reactions) { right: .75rem; left: auto; }
  .mine .message-bubble :global(.reaction-picker) { right: 0; left: auto; }
  @media (max-width: 520px) {
    .message-streak { max-width: 88%; gap: .45rem; }
    .message-bubble { padding-inline: .65rem; }
  }
</style>
