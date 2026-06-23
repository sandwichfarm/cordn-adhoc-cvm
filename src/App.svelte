<script lang="ts">
  import LifecyclePanel from "./components/LifecyclePanel.svelte";
  import DebugLogPanel from "./components/DebugLogPanel.svelte";
  import NpubDisplay from "./components/NpubDisplay.svelte";
  import PassphrasePrompt from "./components/PassphrasePrompt.svelte";
  import PersistencePanel from "./components/PersistencePanel.svelte";
  import RelayConfigPanel from "./components/RelayConfigPanel.svelte";
  import ResourceMonitor from "./components/ResourceMonitor.svelte";
  import { configStore } from "./config/config.svelte";
  import { coordinatorStore } from "./coordinator/coordinator.svelte";
</script>

{#if coordinatorStore.loadState === "prompting"}
  <PassphrasePrompt coordinator={coordinatorStore} />
{:else}
  <main class="operator-field min-h-screen px-4 py-5 text-[#87ff9f]">
    <div class="operator-shell mx-auto flex max-w-6xl flex-col gap-6" data-testid="operator-shell">
      <header class="operator-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="operator-kicker text-xs uppercase tracking-[0.24em] text-[#617767]">Web-based MLS coordinator</p>
          <h1 class="operator-title mt-2 text-3xl uppercase text-[#d1ffd9] sm:text-5xl">Cordn Ad-Hoc</h1>
          <a
            class="mt-3 inline-flex w-fit border border-[#21482b] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[#87ff9f] hover:border-[#87ff9f] hover:bg-[#87ff9f] hover:text-black"
            href="https://github.com/sandwichfarm/cordn-adhoc-cvm/"
            rel="noreferrer"
            target="_blank"
          >
            git
          </a>
        </div>
        <NpubDisplay identity={coordinatorStore.identity} />
      </header>

      <LifecyclePanel coordinator={coordinatorStore} />
      {#if coordinatorStore.status === "running"}
        <ResourceMonitor />
      {/if}
      <RelayConfigPanel config={configStore} coordinator={coordinatorStore} />
      <PersistencePanel coordinator={coordinatorStore} />
      <DebugLogPanel coordinator={coordinatorStore} />
    </div>
  </main>
{/if}
