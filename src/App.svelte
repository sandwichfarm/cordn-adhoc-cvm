<script lang="ts">
  import PassphrasePrompt from "./components/PassphrasePrompt.svelte";
  import HostWorkspace from "./components/HostWorkspace.svelte";
  import { configStore } from "./config/config.svelte";
  import { coordinatorStore } from "./coordinator/coordinator.svelte";
</script>

{#if coordinatorStore.loadState === "prompting"}
  <PassphrasePrompt coordinator={coordinatorStore} />
{:else}
  <HostWorkspace
    coordinator={coordinatorStore}
    config={configStore}
    identity={coordinatorStore.identity}
    coordinatorPubkey={coordinatorStore.identity.publicKeyHex}
    relayUrls={configStore.enabledRelayUrls}
  />
{/if}
