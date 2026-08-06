<script lang="ts">
  import { channelPreferences } from "../notifications/channel-preferences.svelte";

  interface Props { roomKey: string; }

  let { roomKey }: Props = $props();
  const preference = $derived(channelPreferences.get(roomKey));
  const soundLabel = $derived(preference.sound === "off" ? "Sound muted for this channel" : "Sound always on for this channel");
  const notificationLabel = $derived(preference.notifications === "mute"
    ? "Notifications muted for this channel"
    : preference.notifications === "follows"
      ? "Notifications limited to follows"
      : "Notifications limited to mutuals");
</script>

{#if preference.sound !== "global" || preference.notifications !== "all"}
  <span class="channel-preference-indicators" data-testid={`channel-preferences-${roomKey}`}>
    {#if preference.sound !== "global"}
      <span class="preference-icon" role="img" aria-label={soundLabel} title={soundLabel}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path class="filled" d="M3.2 7.5h3L10 4.4v11.2l-3.8-3.1h-3z"></path>
          {#if preference.sound === "on"}<path d="M12.7 7.1a4 4 0 0 1 0 5.8M15 5.2a6.7 6.7 0 0 1 0 9.6"></path>{:else}<path class="strike" d="M3.2 3.2 16.8 16.8"></path>{/if}
        </svg>
      </span>
    {/if}
    {#if preference.notifications !== "all"}
      <span class="preference-icon" role="img" aria-label={notificationLabel} title={notificationLabel}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.1 13.3h9.8l-1.2-1.7V8.4a3.7 3.7 0 0 0-7.4 0v3.2zM8.2 15.3a2 2 0 0 0 3.6 0"></path>
          {#if preference.notifications === "mute"}<path class="strike" d="M3.2 3.2 16.8 16.8"></path>{/if}
        </svg>
      </span>
    {/if}
  </span>
{/if}

<style>
  .channel-preference-indicators { display: inline-flex; min-width: 0; flex: 0 0 auto; align-items: center; gap: .18rem; color: #6f8176; }
  .preference-icon { display: inline-grid; place-items: center; }
  svg { width: .82rem; height: .82rem; overflow: visible; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.35; }
  .filled { fill: currentColor; stroke: none; }
  .strike { stroke-width: 1.65; }
</style>
