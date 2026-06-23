<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";
  import type { ConfigStore } from "../config/config.svelte";

  interface Props {
    config: ConfigStore;
    coordinator: CoordinatorStore;
  }

  let { config, coordinator }: Props = $props();
  let relayInput = $state("");

  const editingAllowed = $derived(config.editMode && !coordinator.locked);
  const lockLabel = $derived(editingAllowed ? "editing" : "locked");

  function addRelay(): void {
    if (config.addRelay(relayInput)) {
      relayInput = "";
    }
  }
</script>

<section class="mx-auto max-w-3xl py-8">
  <div class="mb-4 flex items-center justify-between gap-4">
    <h2 class="text-sm uppercase tracking-[0.22em] text-[#87ff9f]">Relay configuration</h2>
    <span class="border border-[#21482b] px-3 py-1 text-xs uppercase text-[#a7b0aa]" data-testid="lock-indicator">
      {editingAllowed ? "✎" : "⊘"} {lockLabel}
    </span>
  </div>

  <div class="space-y-3">
    {#each config.relays as relay (relay.id)}
      <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3 border border-[#16331f] bg-[#050805] p-3">
        <input
          class="h-4 w-4 accent-[#87ff9f]"
          type="checkbox"
          aria-label={`Toggle ${relay.url}`}
          checked={relay.enabled}
          disabled={!editingAllowed}
          onchange={() => config.toggleRelay(relay.id)}
        />
        <span class:line-through={!relay.enabled} class="min-w-0 truncate text-sm text-[#d1ffd9]">{relay.url}</span>
        <button
          class="border border-[#493030] px-2 text-sm text-[#ff8f8f] disabled:cursor-not-allowed disabled:border-[#261818] disabled:text-[#553838]"
          type="button"
          aria-label={`Remove ${relay.url}`}
          disabled={!editingAllowed}
          onclick={() => config.removeRelay(relay.id)}
        >
          ×
        </button>
      </div>
    {/each}
  </div>

  <form
    class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
    onsubmit={(event) => {
      event.preventDefault();
      addRelay();
    }}
    aria-label="Add relay"
  >
    <input
      class="border border-[#21482b] bg-black px-3 py-3 text-[#87ff9f] outline-none placeholder:text-[#415247] focus:border-[#87ff9f] disabled:cursor-not-allowed disabled:text-[#4b554e]"
      type="text"
      placeholder="wss://relay.example"
      bind:value={relayInput}
      disabled={!editingAllowed}
    />
    <button
      class="border border-[#87ff9f] px-5 py-3 uppercase text-[#87ff9f] enabled:hover:bg-[#87ff9f] enabled:hover:text-black disabled:cursor-not-allowed disabled:border-[#26302a] disabled:text-[#4b554e]"
      type="submit"
      disabled={!editingAllowed}
    >
      Add
    </button>
  </form>

  {#if config.relayError}
    <p class="mt-3 text-sm text-[#ff8f8f]" data-testid="relay-error">{config.relayError}</p>
  {/if}

  <div class="mt-4 flex justify-end gap-3">
    {#if editingAllowed}
      <button class="border border-[#6d746f] px-4 py-2 text-sm uppercase text-[#a7b0aa]" type="button" onclick={() => config.exitEdit()}>
        Lock
      </button>
    {:else}
      <button
        class="border border-[#87ff9f] px-4 py-2 text-sm uppercase text-[#87ff9f] disabled:cursor-not-allowed disabled:border-[#26302a] disabled:text-[#4b554e]"
        type="button"
        disabled={coordinator.locked}
        onclick={() => config.enterEdit()}
      >
        Edit configuration
      </button>
    {/if}
  </div>
</section>
