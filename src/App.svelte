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
  import { resourceMonitor } from "./coordinator/resource-monitor.svelte";

  $effect(() => {
    configStore.setActiveSubscriptionCount(resourceMonitor.subscriptionCount);
  });
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
