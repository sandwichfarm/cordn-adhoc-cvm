<script lang="ts">
  import { createPubkeyAvatar } from "../identity/user-profile.svelte";

  interface Props {
    sender: string;
    name: string;
    avatar?: string;
    badgeLabel?: string;
    badgeEmoji?: string;
    createdAt: number;
    pending?: boolean;
  }

  let {
    sender,
    name,
    avatar,
    badgeLabel,
    badgeEmoji,
    createdAt,
    pending = false,
  }: Props = $props();

  const fallbackAvatar = $derived(createPubkeyAvatar(sender));

  function useFallback(event: Event): void {
    (event.currentTarget as HTMLImageElement).src = fallbackAvatar;
  }
</script>

<div class="message-author" data-testid="message-author">
  <img src={avatar || fallbackAvatar} alt="" onerror={useFallback} />
  <div class="message-author-copy">
    <div class="message-author-line">
      <strong>{name || "anon"}</strong>
      {#if badgeLabel || badgeEmoji}
        <span class="message-badge" data-testid="message-badge">
          {#if badgeEmoji}<span aria-hidden="true">{badgeEmoji}</span>{/if}
          {badgeLabel || "host"}
        </span>
      {/if}
    </div>
    <div class="message-meta">
      <time>{new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
      {#if pending}<span>sending…</span>{/if}
    </div>
  </div>
</div>

<style>
  .message-author { display: grid; grid-template-columns: 2rem minmax(0, 1fr); align-items: center; gap: .55rem; }
  .message-author > img { width: 2rem; height: 2rem; border: 1px solid rgb(124 245 157 / .14); background: #0b0e0d; object-fit: cover; }
  .message-author-copy { min-width: 0; }
  .message-author-line, .message-meta { display: flex; min-width: 0; align-items: center; gap: .42rem; }
  .message-author-line strong { overflow: hidden; color: #b9fac8; font-size: .76rem; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
  .message-badge { display: inline-flex; user-select: text; align-items: center; gap: .22rem; border: 1px solid #41664b; background: rgb(124 245 157 / .07); padding: .12rem .32rem; color: #93dba4; font-size: .48rem; font-weight: 680; letter-spacing: .09em; line-height: 1.15; text-transform: uppercase; }
  .message-meta { margin-top: .16rem; color: #73867a; font-size: .58rem; }
</style>
