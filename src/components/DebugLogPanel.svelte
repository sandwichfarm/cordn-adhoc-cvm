<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";

  interface Props {
    coordinator: CoordinatorStore;
  }

  let { coordinator }: Props = $props();
</script>

<section class="mx-auto max-w-3xl border-t border-[#16331f] py-8" data-testid="debug-panel">
  <div class="mb-4 flex items-center justify-between gap-4">
    <h2 class="text-sm uppercase tracking-[0.22em] text-[#87ff9f]">Debug log</h2>
    <button
      class="border border-[#21482b] px-3 py-1 text-xs uppercase text-[#a7b0aa] hover:border-[#87ff9f] hover:text-[#87ff9f]"
      type="button"
      onclick={() => coordinator.clearDebugLog()}
    >
      Clear
    </button>
  </div>

  <div class="max-h-72 overflow-y-auto border border-[#16331f] bg-[#020402]" role="log" aria-label="Cordn debug log">
    {#if coordinator.debugLog.length === 0}
      <p class="p-3 text-sm text-[#6d746f]" data-testid="debug-log-empty">No debug events yet</p>
    {:else}
      <ol class="divide-y divide-[#16331f]" data-testid="debug-log-entries">
        {#each coordinator.debugLog as entry (entry.id)}
          <li class="grid gap-1 p-3 text-sm sm:grid-cols-[7rem_5rem_1fr]" data-testid="debug-log-entry">
            <time class="text-[#6d746f]" datetime={String(entry.timestamp)}>{entry.timeLabel}</time>
            <span
              class={entry.level === "error"
                ? "uppercase text-[#ff8f8f]"
                : entry.level === "warn"
                  ? "uppercase text-[#f1f58f]"
                  : "uppercase text-[#87ff9f]"}
            >
              {entry.level}
            </span>
            <span class="min-w-0 break-words text-[#d1ffd9]">
              {entry.message}
              {#if entry.details}
                <span class="text-[#a7b0aa]">: {entry.details}</span>
              {/if}
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</section>
