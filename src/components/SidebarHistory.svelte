<script lang="ts">
  import { historyReasonLabel, type SidebarHistoryEntry } from "../chat/sidebar-ledger";

  interface Props { entries: SidebarHistoryEntry[]; }
  let { entries }: Props = $props();
  let open = $state(false);
</script>

{#if entries.length > 0}
  <section class="sidebar-history" data-testid="sidebar-history">
    <button type="button" aria-expanded={open} aria-controls="sidebar-history-list" onclick={() => open = !open}>
      <span>History</span><span>{entries.length}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {#if open}
      <ul id="sidebar-history-list">
        {#each entries as entry (entry.roomKey)}
          <li>
            <span class="history-hash" aria-hidden="true">#</span>
            <span><strong title={entry.title}>{entry.title}</strong><small>{entry.coordinatorLabel} · {historyReasonLabel(entry.reason)}</small></span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .sidebar-history { border: 1px solid #202d25; color: #718277; }
  .sidebar-history > button { display: grid; width: 100%; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: .5rem; padding: .5rem .65rem; color: inherit; text-align: left; font-size: .56rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .sidebar-history > button:hover, .sidebar-history > button:focus-visible { background: #101713; color: #a8b9ad; outline: none; }
  ul { display: grid; gap: .08rem; border-top: 1px solid #202d25; padding: .3rem; }
  li { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .45rem; padding: .38rem .35rem; }
  .history-hash { color: #46564d; }
  li span, strong, small { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  strong { color: #899b90; font-size: .58rem; font-weight: 600; }
  small { margin-top: .12rem; color: #59685f; font-size: .48rem; }
</style>
