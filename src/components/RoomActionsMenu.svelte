<script lang="ts">
  import { tick } from "svelte";

  interface Props {
    roomTitle: string;
    soundsEnabled: boolean;
    removalMode: "delete" | "leave";
    onToggleSounds: () => void | Promise<void>;
    onRemove: (origin?: HTMLButtonElement) => void;
    sidebar?: boolean;
  }

  let { roomTitle, soundsEnabled, removalMode, onToggleSounds, onRemove, sidebar = false }: Props = $props();
  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();

  function close(returnFocus = false): void {
    open = false;
    if (returnFocus) void tick().then(() => trigger?.focus());
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    close(true);
  }

  function toggle(event: MouseEvent): void {
    if (sidebar) event.stopPropagation();
    open = !open;
  }

</script>

<svelte:window onkeydown={handleKeydown} />

<div class:sidebar class="room-actions">
  <button
    bind:this={trigger}
    class="more-room-actions"
    type="button"
    aria-label={sidebar ? `More actions for # ${roomTitle}` : "More room actions"}
    aria-haspopup="menu"
    aria-expanded={open}
    title="More room actions"
    onclick={toggle}
  >
    <span aria-hidden="true">•••</span>
  </button>

  {#if open}
    <button class="room-actions-scrim" type="button" aria-label="Close room actions" onclick={() => close(true)}></button>
    <div class="room-actions-menu" role="menu" aria-label={`Room actions for ${roomTitle}`}>
      <header><span>Room actions</span><strong># {roomTitle}</strong></header>
      {#if !sidebar}<button
        class="room-menu-action"
        type="button"
        role="menuitemcheckbox"
        aria-checked={soundsEnabled}
        onclick={() => { close(); void onToggleSounds(); }}
      >
        <span>{soundsEnabled ? "Mute notification sounds" : "Enable notification sounds"}</span>
        <span aria-hidden="true">{soundsEnabled ? "on" : "off"}</span>
      </button>{/if}
      <button
        class:delete={removalMode === "delete"}
        class="room-menu-action"
        type="button"
        role="menuitem"
        aria-label={`${removalMode === "delete" ? "Delete" : "Leave"} room ${roomTitle}`}
        onclick={() => { close(); onRemove(trigger); }}
      >
        <span>{removalMode === "delete" ? (sidebar ? "Delete room" : "Delete this room") : (sidebar ? "Leave room" : "Leave this room")}</span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .room-actions { position: absolute; z-index: 96; top: .65rem; right: .65rem; }
  .room-actions.sidebar { position: relative; top: auto; right: auto; z-index: 2; }
  .more-room-actions { position: relative; z-index: 96; display: grid; width: 2.65rem; height: 2.65rem; place-items: center; border: 0; background: transparent; color: #91a59a; font-size: .68rem; font-weight: 800; letter-spacing: .08em; transition: background .15s ease, color .15s ease; }
  .sidebar .more-room-actions { width: 2.75rem; height: 2.75rem; }
  .more-room-actions:hover, .more-room-actions:focus-visible, .more-room-actions[aria-expanded="true"] { background: #111a14; color: #effff2; outline: 2px solid #7cf59d; outline-offset: -2px; }
  .room-actions-scrim { position: fixed; z-index: 94; inset: 0; border: 0; background: rgb(0 0 0 / .32); cursor: default; backdrop-filter: blur(1px); }
  .room-actions-menu { position: absolute; z-index: 95; top: calc(100% + .45rem); right: 0; display: grid; width: min(19rem, calc(100vw - 1rem)); border: 1px solid #496451; background: rgb(7 12 9 / .99); box-shadow: 0 20px 54px rgb(0 0 0 / .62); padding: .35rem; }
  .room-actions-menu header { display: grid; gap: .22rem; border-bottom: 1px solid #293832; padding: .55rem .6rem .65rem; }
  .room-actions-menu header span { color: #718277; font-size: .5rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .room-actions-menu header strong { overflow: hidden; color: #dfffe7; font-size: .68rem; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
  .room-menu-action { display: flex; min-height: 2.55rem; align-items: center; justify-content: space-between; gap: 1rem; padding: .6rem; color: #b9cbbf; text-align: left; font-size: .65rem; }
  .room-menu-action:hover, .room-menu-action:focus-visible { background: #142018; color: #effff2; outline: none; }
  .room-menu-action > span:last-child { color: #718277; font-size: .52rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .room-menu-action.delete { color: #ffaaa3; }
  .room-menu-action.delete:hover, .room-menu-action.delete:focus-visible { background: #21110f; }

  @media (max-width: 520px) {
    .room-actions { top: .45rem; right: .45rem; }
  }
</style>
