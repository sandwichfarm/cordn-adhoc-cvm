<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";

  interface Props {
    coordinator: CoordinatorStore;
  }

  let { coordinator }: Props = $props();
  let passphrase = $state("");
</script>

<main class="operator-field h-[100dvh] max-h-[100dvh] overflow-hidden text-[#dfffe7]">
  <div class="mx-auto grid h-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)] border-x border-[#21352a] bg-[#070c09]/80">
    <header class="border-b border-[#21352a] px-4 py-3 sm:px-6"><p class="text-[10px] uppercase tracking-[0.2em] text-[#77917f]">Cordn / coordinator workspace</p><p class="mt-1 text-lg font-semibold text-[#effff2]">Ad-hoc MLS</p></header>
    <section class="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,34rem)]">
      <div class="flex min-h-0 items-center border-b border-[#21352a] p-6 sm:p-10 lg:border-r lg:border-b-0"><div class="max-w-xl"><p class="text-[11px] uppercase tracking-[0.2em] text-[#7cf59d]">Encrypted coordinator key found</p><h1 class="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">Unlock Cordn Ad-Hoc</h1><p class="mt-5 max-w-lg text-sm leading-6 text-[#91a59a] sm:text-base">Your browser has a saved, encrypted identity. Unlock it to return to the same coordinator workspace and keep serving your rooms.</p></div></div>
      <div class="flex min-h-0 items-center p-4 sm:p-8"><div class="w-full"><p class="text-xs uppercase tracking-[0.16em] text-[#cfe2d4]">Passphrase</p><form class="mt-3 grid gap-3" onsubmit={(event) => { event.preventDefault(); void coordinator.loadFromPassphrase(passphrase); }}><input class="w-full border border-[#34433b] bg-[#090d0b] px-4 py-3 text-[#effff2] outline-none placeholder:text-[#617767] focus:border-[#7cf59d]" type="password" autocomplete="current-password" placeholder="passphrase" bind:value={passphrase} />{#if coordinator.passphraseError}<p class="text-sm text-[#ffaaa3]" data-testid="passphrase-error">{coordinator.passphraseError}</p>{/if}<button class="border border-[#7cf59d] bg-[#7cf59d] px-5 py-3 font-medium text-[#08110b] hover:bg-[#c5ffcf]" type="submit">Unlock</button></form><div class="mt-8 border-t border-[#293832] pt-5"><p class="text-xs leading-5 text-[#82958a]">If the key is no longer needed, create a new coordinator identity. This cannot be undone.</p><button class="mt-3 w-full border border-[#7a3939] px-5 py-3 text-sm text-[#ffaaa3] hover:border-[#ffaaa3]" type="button" onclick={() => coordinator.generateFreshKey()}>Generate a new key instead</button></div></div></div>
    </section>
  </div>
</main>
