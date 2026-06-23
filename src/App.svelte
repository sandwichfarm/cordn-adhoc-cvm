<script lang="ts">
  import LifecyclePanel from "./components/LifecyclePanel.svelte";
  import NpubDisplay from "./components/NpubDisplay.svelte";
  import RelayConfigPanel from "./components/RelayConfigPanel.svelte";
  import { configStore } from "./config/config.svelte";
  import { coordinatorStore } from "./coordinator/coordinator.svelte";
</script>

<main class="min-h-screen bg-black px-4 py-5 text-[#87ff9f]">
  <div class="mx-auto flex max-w-5xl flex-col gap-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.24em] text-[#617767]">ContextVM relay coordinator</p>
        <h1 class="mt-2 text-3xl uppercase text-[#d1ffd9] sm:text-5xl">Cordn Browser</h1>
      </div>
      <NpubDisplay identity={coordinatorStore.identity} />
    </header>

    <LifecyclePanel coordinator={coordinatorStore} />
    <RelayConfigPanel config={configStore} coordinator={coordinatorStore} />
  </div>
</main>
