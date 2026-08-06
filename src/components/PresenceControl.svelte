<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { ConfigStore, PresenceState } from "../config/config.svelte";
  import { userProfileStore } from "../identity/user-profile.svelte";
  import { nostrSocialStore } from "../invites/nostr-social.svelte";
  import { viewportOverlay } from "../lib/viewport-overlay";

  interface Props {
    config: ConfigStore;
    coordinatorPubkey: string;
    relayUrls: string[];
  }

  let { config, coordinatorPubkey, relayUrls }: Props = $props();
  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let announcement = $state("");

  const options: PresenceState[] = ["online", "invisible", "offline"];
  const presenceLabel = $derived(formatPresence(config.presenceState));

  function formatPresence(state: PresenceState): string {
    if (state === "online") return "Online";
    if (state === "offline") return "Offline";
    return "Invisible";
  }

  function close(restoreFocus = true): void {
    if (!open) return;
    open = false;
    if (restoreFocus) void tick().then(() => trigger?.focus());
  }

  function selectPresence(state: PresenceState): void {
    config.setPresenceState(state);
    announcement = `Presence set to ${formatPresence(state)}.`;
    if (userProfileStore.method !== "anonymous" && userProfileStore.activeSigner) {
      void nostrSocialStore.setPresence(state, {
        coordinatorPubkey,
        coordinatorOrigin: window.location.origin,
        relayUrls: [...relayUrls],
        coordinatorName: config.coordinatorName || "My coordinator",
      });
    }
    close();
  }

  function handleRadioKey(event: KeyboardEvent, index: number): void {
    const offsets: Partial<Record<string, number>> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    let nextIndex: number;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (offsets[event.key] !== undefined) {
      nextIndex = (index + offsets[event.key]! + options.length) % options.length;
    } else {
      return;
    }
    event.preventDefault();
    selectPresence(options[nextIndex]);
  }

  onMount(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });
</script>

<div class="presence-control" data-testid="presence-control">
  <p class="sr-only" aria-live="polite">{announcement}</p>
  <button
    bind:this={trigger}
    class="presence-trigger"
    type="button"
    aria-label={`Presence: ${presenceLabel}`}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={() => open ? close(false) : open = true}
  >
    <span
      class="presence-dot"
      class:online={config.presenceState === "online"}
      class:offline={config.presenceState === "offline"}
      aria-hidden="true"
    ></span>
    <span>{presenceLabel}</span>
    <span class="presence-chevron" aria-hidden="true">{open ? "↑" : "↓"}</span>
  </button>

  {#if open}
    <button class="presence-scrim" type="button" aria-label="Close presence menu" onclick={() => close()}></button>
    <div use:viewportOverlay={{ anchor: trigger, preferredSide: "above", align: "start", compactSheetBelow: 900 }} class="presence-menu" role="dialog" aria-label="Presence">
      <p class="presence-heading">Presence</p>
      <div class="presence-options" role="radiogroup" aria-label="Presence">
        {#each options as state, index (state)}
          <button
            class:chosen={config.presenceState === state}
            type="button"
            role="radio"
            aria-checked={config.presenceState === state}
            onclick={() => selectPresence(state)}
            onkeydown={(event) => handleRadioKey(event, index)}
          >
            <span
              class="presence-option-dot"
              class:online={state === "online"}
              class:offline={state === "offline"}
              aria-hidden="true"
            ></span>
            <span>{formatPresence(state)}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .presence-control { position: relative; min-width: 0; }
  .presence-trigger { display: grid; width: 100%; min-width: 0; height: 2.75rem; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .48rem; padding: 0 .65rem; color: #b9cbbf; text-align: left; font-size: .62rem; }
  .presence-trigger:hover, .presence-trigger[aria-expanded="true"] { background: #111a14; color: #effff2; }
  .presence-trigger:focus-visible { outline: 2px solid #87ff9f; outline-offset: -3px; }
  .presence-dot, .presence-option-dot { width: .46rem; height: .46rem; border-radius: 999px; background: #82958a; }
  .presence-dot.online, .presence-option-dot.online { background: #7cf59d; box-shadow: 0 0 8px rgb(124 245 157 / .35); }
  .presence-dot.offline, .presence-option-dot.offline { background: #9b6b56; box-shadow: none; }
  .presence-chevron { color: #64766a; font-size: .52rem; }
  .presence-scrim { position: fixed; z-index: 69; inset: 0; border: 0; background: transparent; cursor: default; }
  .presence-menu { position: absolute; z-index: 70; bottom: calc(100% + .5rem); left: 0; width: min(15rem, calc(100vw - 1rem)); border: 1px solid #496451; background: rgb(8 13 10 / .99); box-shadow: 0 20px 56px rgb(0 0 0 / .62); }
  .presence-heading { border-bottom: 1px solid #293832; padding: .75rem; color: #82958a; font-size: .56rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .presence-options { display: grid; padding: .3rem; }
  .presence-options button { display: grid; min-height: 2.75rem; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .65rem; border: 1px solid transparent; padding: .55rem .65rem; color: #91a59a; text-align: left; font-size: .68rem; }
  .presence-options button:hover, .presence-options button.chosen { border-color: #34483a; background: #111a14; color: #effff2; }
  .presence-options button:focus-visible { outline: 2px solid #87ff9f; outline-offset: -3px; }
</style>
