<script lang="ts">
  import type { ConfigStore, PresenceState } from "../config/config.svelte";
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";
  import { userProfileStore } from "../identity/user-profile.svelte";
  import { nostrSocialStore } from "../invites/nostr-social.svelte";

  interface Props {
    config: ConfigStore;
    coordinator: CoordinatorStore;
    coordinatorPubkey: string;
    relayUrls: string[];
  }

  let { config, coordinator, coordinatorPubkey, relayUrls }: Props = $props();
  let open = $state(false);
  let busy = $state(false);

  const authenticated = $derived(userProfileStore.method !== "anonymous" && userProfileStore.activeSigner !== null);
  const effectivePresence = $derived(
    config.presenceState === "online" && coordinator.status !== "running"
      ? "invisible"
      : config.presenceState,
  );

  $effect(() => {
    const signer = userProfileStore.activeSigner;
    const method = userProfileStore.method;
    const descriptor = {
      coordinatorPubkey,
      coordinatorOrigin: window.location.origin,
      relayUrls: [...relayUrls],
      coordinatorName: config.coordinatorName || "My coordinator",
    };
    if (method === "anonymous" || !signer) {
      nostrSocialStore.disconnect();
      return;
    }
    void nostrSocialStore.connect(signer, effectivePresence, descriptor);
  });

  async function selectPresence(state: PresenceState): Promise<void> {
    if ((state === "online" && !authenticated) || busy) return;
    busy = true;
    open = false;
    try {
      if (state === "offline") {
        await nostrSocialStore.setPresence("offline");
        config.setPresenceState("offline");
        if (coordinator.status === "running") await coordinator.stop();
        return;
      }
      config.setPresenceState(state);
      if (coordinator.status === "idle") await coordinator.start();
      await nostrSocialStore.setPresence(
        state === "online" && coordinator.status !== "running" ? "invisible" : state,
      );
    } finally {
      busy = false;
    }
  }

  function label(state: PresenceState): string {
    if (state === "online") return "Online";
    if (state === "offline") return "Offline · sleeping";
    return "Invisible";
  }
</script>

<div class="presence-control">
  <button
    class:online={config.presenceState === "online" && coordinator.status === "running"}
    class:offline={config.presenceState === "offline"}
    class="presence-trigger"
    type="button"
    aria-haspopup="menu"
    aria-expanded={open}
    title={authenticated ? "Set Nostr presence" : "Connect NIP-07 or NIP-46 to appear online"}
    disabled={busy}
    onclick={() => open = !open}
  >
    <span class="presence-dot" aria-hidden="true"></span>
    <span>{label(config.presenceState)}</span>
    <span aria-hidden="true">⌄</span>
  </button>
  {#if open}
    <div class="presence-menu" role="menu" aria-label="Set presence">
      <button class:active={config.presenceState === "online"} type="button" role="menuitem" disabled={!authenticated} title={authenticated ? "Appear online" : "Connect a Nostr identity first"} onclick={() => void selectPresence("online")}><span class="state-dot online"></span><span><strong>Online</strong><small>{authenticated ? "Visible privately to followers" : "Requires NIP-07 or NIP-46"}</small></span></button>
      <button class:active={config.presenceState === "invisible"} type="button" role="menuitem" onclick={() => void selectPresence("invisible")}><span class="state-dot invisible"></span><span><strong>Invisible</strong><small>Coordinator stays available</small></span></button>
      <button class:active={config.presenceState === "offline"} type="button" role="menuitem" onclick={() => void selectPresence("offline")}><span class="state-dot offline"></span><span><strong>Offline</strong><small>Stop and persist sleep mode</small></span></button>
    </div>
  {/if}
</div>

<style>
  .presence-control { position: relative; flex: 0 0 auto; }
  .presence-trigger { display: flex; height: 2.65rem; align-items: center; gap: .45rem; border: 1px solid #293832; padding: 0 .6rem; color: #91a59a; font-size: .6rem; }
  .presence-trigger:hover:not(:disabled), .presence-trigger[aria-expanded="true"] { border-color: #496451; background: #101713; color: #dfffe7; }
  .presence-trigger:disabled { cursor: not-allowed; opacity: .48; }
  .presence-dot, .state-dot { width: .48rem; height: .48rem; border-radius: 999px; background: #59655d; }
  .presence-trigger.online .presence-dot, .state-dot.online { background: #7cf59d; box-shadow: 0 0 9px rgb(124 245 157 / .42); }
  .presence-trigger.offline .presence-dot, .state-dot.offline { background: #9b6b56; }
  .state-dot.invisible { border: 1px solid #82958a; background: transparent; }
  .presence-menu { position: absolute; z-index: 80; top: calc(100% + .45rem); right: 0; display: grid; width: 16.5rem; gap: .15rem; border: 1px solid #496451; background: #090e0b; padding: .35rem; box-shadow: 0 16px 44px rgb(0 0 0 / .58); }
  .presence-menu button { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: .65rem; border: 1px solid transparent; padding: .65rem; color: #91a59a; text-align: left; }
  .presence-menu button:hover, .presence-menu button.active { border-color: #293832; background: #132019; color: #dfffe7; }
  .presence-menu button:disabled { cursor: not-allowed; opacity: .42; }
  .presence-menu strong, .presence-menu small { display: block; }
  .presence-menu strong { font-size: .66rem; font-weight: 650; }
  .presence-menu small { margin-top: .18rem; color: #718277; font-size: .54rem; }
</style>
