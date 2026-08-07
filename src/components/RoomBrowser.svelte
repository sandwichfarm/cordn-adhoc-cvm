<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * Presentational shell for the host and guest room-browser content. Routes
   * retain their own room records and business callbacks and supply only the
   * already-authorized body content through the snippet.
   */
  interface Props {
    open: boolean;
    onClose: () => void;
    children?: Snippet;
  }

  let { open, onClose, children }: Props = $props();
</script>

{#if open}
  <section class="room-browser" role="dialog" aria-modal="true" aria-label="Rooms">
    <header>
      <h2>Rooms</h2>
      <button type="button" aria-label="Close room browser" onclick={onClose}>Close room browser</button>
    </header>
    <div class="room-browser-body">
      {@render children?.()}
    </div>
  </section>
{/if}

<style>
  .room-browser { display: grid; min-height: 0; grid-template-rows: auto minmax(0, 1fr); background: #09100c; color: #dfffe7; }
  header { display: flex; min-height: 44px; align-items: center; justify-content: space-between; border-bottom: 1px solid #293832; padding: max(8px, env(safe-area-inset-top)) 8px 8px; }
  h2 { font-size: 18px; font-weight: 600; }
  button { min-width: 44px; min-height: 44px; border: 1px solid #496451; padding: 8px; color: #bde7c7; font-size: 12px; }
  .room-browser-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); }
</style>
