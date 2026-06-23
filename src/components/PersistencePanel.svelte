<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";

  interface Props {
    coordinator: CoordinatorStore;
  }

  let { coordinator }: Props = $props();
  let enabling = $state(false);
  let passphrase = $state("");
  let confirmPassphrase = $state("");

  async function save(): Promise<void> {
    const saved = await coordinator.enablePersistence(passphrase, confirmPassphrase);
    if (saved) {
      enabling = false;
      passphrase = "";
      confirmPassphrase = "";
    }
  }
</script>

<section class="mx-auto max-w-3xl border-t border-[#16331f] py-8">
  <div class="mb-4 flex items-center justify-between gap-4">
    <h2 class="text-sm uppercase tracking-[0.22em] text-[#87ff9f]">Persistence</h2>
    <span class="border border-[#21482b] px-3 py-1 text-xs uppercase text-[#a7b0aa]" data-testid="persistence-state">
      {coordinator.persistenceEnabled ? "encrypted" : "off"}
    </span>
  </div>

  {#if coordinator.persistenceEnabled}
    <p class="text-sm text-[#a7b0aa]">Persistence enabled — the coordinator key is encrypted in browser storage.</p>
    <button
      class="mt-4 border border-[#ff8f8f] px-4 py-2 text-sm uppercase text-[#ff8f8f] hover:bg-[#ff8f8f] hover:text-black"
      type="button"
      onclick={() => void coordinator.disablePersistence()}
    >
      Remove saved key
    </button>
  {:else if enabling}
    <p class="text-sm text-[#a7b0aa]">Choose a passphrase to encrypt this coordinator identity in browser storage.</p>
    <form
      class="mt-4 grid gap-3"
      onsubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input
        class="border border-[#21482b] bg-black px-3 py-3 text-[#87ff9f] outline-none placeholder:text-[#415247] focus:border-[#87ff9f]"
        type="password"
        autocomplete="new-password"
        placeholder="passphrase"
        bind:value={passphrase}
      />
      <input
        class="border border-[#21482b] bg-black px-3 py-3 text-[#87ff9f] outline-none placeholder:text-[#415247] focus:border-[#87ff9f]"
        type="password"
        autocomplete="new-password"
        placeholder="confirm passphrase"
        bind:value={confirmPassphrase}
      />
      {#if coordinator.persistenceError}
        <p class="text-sm text-[#ff8f8f]" data-testid="persistence-error">{coordinator.persistenceError}</p>
      {/if}
      <div class="flex justify-end gap-3">
        <button
          class="border border-[#6d746f] px-4 py-2 text-sm uppercase text-[#a7b0aa]"
          type="button"
          onclick={() => {
            enabling = false;
            passphrase = "";
            confirmPassphrase = "";
          }}
        >
          Cancel
        </button>
        <button
          class="border border-[#87ff9f] px-4 py-2 text-sm uppercase text-[#87ff9f] hover:bg-[#87ff9f] hover:text-black"
          type="submit"
        >
          Save
        </button>
      </div>
    </form>
  {:else}
    <p class="text-sm text-[#a7b0aa]">Key persistence is off — this coordinator identity resets on reload.</p>
    <button
      class="mt-4 border border-[#87ff9f] px-4 py-2 text-sm uppercase text-[#87ff9f] hover:bg-[#87ff9f] hover:text-black"
      type="button"
      onclick={() => {
        enabling = true;
      }}
    >
      Enable persistence
    </button>
  {/if}
</section>
