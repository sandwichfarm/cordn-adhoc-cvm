<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";

  interface Props {
    coordinator: CoordinatorStore;
  }

  let { coordinator }: Props = $props();
  let passphrase = $state("");
</script>

<main class="flex min-h-screen items-center justify-center bg-black px-4 text-[#87ff9f]">
  <section class="w-full max-w-lg border border-[#16331f] bg-[#050805] p-6">
    <p class="text-xs uppercase tracking-[0.24em] text-[#617767]">encrypted coordinator key found</p>
    <h1 class="mt-3 text-3xl uppercase text-[#d1ffd9]">Unlock Cordn Ad-Hoc</h1>
    <form
      class="mt-6 grid gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        void coordinator.loadFromPassphrase(passphrase);
      }}
    >
      <input
        class="border border-[#21482b] bg-black px-3 py-3 text-[#87ff9f] outline-none placeholder:text-[#415247] focus:border-[#87ff9f]"
        type="password"
        autocomplete="current-password"
        placeholder="passphrase"
        bind:value={passphrase}
      />
      {#if coordinator.passphraseError}
        <p class="text-sm text-[#ff8f8f]" data-testid="passphrase-error">{coordinator.passphraseError}</p>
      {/if}
      <button
        class="border border-[#87ff9f] px-5 py-3 uppercase text-[#87ff9f] hover:bg-[#87ff9f] hover:text-black"
        type="submit"
      >
        Unlock
      </button>
    </form>
    <button
      class="mt-4 w-full border border-[#ff8f8f] px-5 py-3 text-sm uppercase text-[#ff8f8f] hover:bg-[#ff8f8f] hover:text-black"
      type="button"
      onclick={() => coordinator.generateFreshKey()}
    >
      Generate a new key instead
    </button>
  </section>
</main>
