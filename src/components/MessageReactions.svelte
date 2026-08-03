<script lang="ts">
  import type { ReactionSummary } from "../chat/room-store";
  import { CHAT_EMOJI_SHORTCUTS, type ChatEmojiShortcut } from "../chat/protocol";

  interface Props {
    messageId: string;
    authorName: string;
    reactions: ReactionSummary[];
    pickerOpen: boolean;
    disabled?: boolean;
    idPrefix: "host" | "guest";
    onTogglePicker: () => void;
    onClosePicker: () => void;
    onToggleReaction: (emoji: ChatEmojiShortcut) => void | Promise<void>;
    onSetReaction: (emoji: ChatEmojiShortcut) => void | Promise<void>;
  }

  let {
    messageId,
    authorName,
    reactions,
    pickerOpen,
    disabled = false,
    idPrefix,
    onTogglePicker,
    onClosePicker,
    onToggleReaction,
    onSetReaction,
  }: Props = $props();

  const triggerId = $derived(`${idPrefix}-add-reaction-${messageId}`);
  const menuId = $derived(`${idPrefix}-reaction-menu-${messageId}`);

  function closeAfterFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return;
    onClosePicker();
  }
</script>

<div
  class:has-reactions={reactions.length > 0}
  class:picker-open={pickerOpen}
  class="message-reactions"
  role="group"
  aria-label={`Reactions for message from ${authorName}`}
  onfocusout={closeAfterFocusLeaves}
>
  <button
    id={triggerId}
    type="button"
    class="reaction-add"
    aria-label="Add reaction"
    aria-haspopup="menu"
    aria-controls={pickerOpen ? menuId : undefined}
    aria-expanded={pickerOpen}
    {disabled}
    onclick={onTogglePicker}
  ><span aria-hidden="true">+</span></button>

  {#if reactions.length > 0}
    <div class="reaction-strip">
      {#each reactions as reaction (reaction.emoji)}
        <button
          type="button"
          class:pressed={reaction.viewerActive}
          class="reaction-chip"
          aria-pressed={reaction.viewerActive}
          aria-label={`${reaction.viewerActive ? "Remove" : "Add"} ${reaction.emoji} reaction, ${reaction.count} participant${reaction.count === 1 ? "" : "s"}`}
          {disabled}
          onclick={() => void onToggleReaction(reaction.emoji)}
        >
          <span aria-hidden="true">{reaction.emoji}</span>
          <span class="reaction-count">{reaction.count}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if pickerOpen}
    <div id={menuId} class="reaction-picker" role="menu" aria-label={`Choose reaction for message from ${authorName}`}>
      {#each CHAT_EMOJI_SHORTCUTS as emoji (emoji)}
        <button
          type="button"
          role="menuitem"
          aria-label={`React ${emoji}`}
          {disabled}
          onclick={() => void onSetReaction(emoji)}
        >{emoji}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .message-reactions {
    position: absolute;
    left: .75rem;
    bottom: -.8rem;
    display: inline-flex;
    min-height: 1.6rem;
    align-items: center;
    isolation: isolate;
  }

  .reaction-add,
  .reaction-chip,
  .reaction-picker button {
    display: inline-flex;
    min-width: 1.55rem;
    min-height: 1.55rem;
    align-items: center;
    justify-content: center;
    border: 1px solid #34483a;
    background: #0b110d;
    color: #c6eccc;
    font-size: .72rem;
    line-height: 1;
  }

  .reaction-add {
    z-index: 2;
    border-radius: 999px;
    padding: 0;
    color: #9fb2a5;
    font-size: .95rem;
  }

  .has-reactions .reaction-add {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  }

  .reaction-add:hover:not(:disabled),
  .reaction-add:focus-visible,
  .picker-open .reaction-add {
    border-color: #7cf59d;
    background: #13251a;
    color: #effff2;
    outline: none;
  }

  .reaction-strip {
    display: inline-flex;
    align-items: center;
    gap: .08rem;
    margin-left: .68rem;
    border: 1px solid #34483a;
    border-radius: 999px;
    background: #0b110d;
    padding: .1rem .18rem .1rem 1rem;
  }

  .reaction-chip {
    gap: .28rem;
    border-color: transparent;
    border-radius: 999px;
    background: transparent;
    padding: .2rem .42rem;
  }

  .reaction-chip:hover:not(:disabled),
  .reaction-chip:focus-visible {
    border-color: #45604d;
    background: #152219;
    outline: none;
  }

  .reaction-chip.pressed {
    border-color: #5b8d67;
    background: #173323;
    color: #effff2;
  }

  .reaction-count {
    color: #9eb0a3;
    font-size: .62rem;
    font-variant-numeric: tabular-nums;
  }

  .reaction-chip.pressed .reaction-count { color: #b9f7c6; }

  .reaction-picker {
    position: absolute;
    z-index: 20;
    left: 0;
    bottom: calc(100% + .38rem);
    display: flex;
    gap: .15rem;
    border: 1px solid #496451;
    background: #08100b;
    padding: .24rem;
    box-shadow: 0 .8rem 2.2rem rgb(0 0 0 / .46);
  }

  .reaction-picker::after {
    position: absolute;
    left: .56rem;
    top: 100%;
    width: .45rem;
    height: .45rem;
    border-right: 1px solid #496451;
    border-bottom: 1px solid #496451;
    background: #08100b;
    content: "";
    transform: translateY(-50%) rotate(45deg);
  }

  .reaction-picker button {
    border-color: transparent;
    padding: .22rem .36rem;
    font-size: .82rem;
  }

  .reaction-picker button:hover:not(:disabled),
  .reaction-picker button:focus-visible {
    border-color: #7cf59d;
    background: #173323;
    outline: none;
  }

  button:disabled { cursor: not-allowed; opacity: .3; }

  @media (max-width: 520px) {
    .reaction-picker { max-width: min(17rem, calc(100vw - 2rem)); overflow-x: auto; }
  }
</style>
