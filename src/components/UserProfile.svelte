<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import type { NostrConnectSigner } from "applesauce-signers/signers";
  import type { ConfigStore, PresenceState } from "../config/config.svelte";
  import {
    createPubkeyAvatar,
    NIP46_CONNECT_RELAYS,
    userProfileStore,
  } from "../identity/user-profile.svelte";
  import { nostrSocialStore } from "../invites/nostr-social.svelte";
  import IdentityRotationDialog from "./IdentityRotationDialog.svelte";
  import { anonymousMembershipImpact } from "../chat/room-store";

  interface Props {
    config: ConfigStore;
    coordinatorPubkey: string;
    relayUrls: string[];
    anonymousName?: string;
    onAnonymousNameChange?: (name: string) => void;
  }

  let {
    config,
    coordinatorPubkey,
    relayUrls,
    anonymousName = "",
    onAnonymousNameChange,
  }: Props = $props();
  let open = $state(false);
  let bunkerUri = $state("");
  let remoteUri = $state("");
  let remoteQr = $state("");
  let remoteSigner: NostrConnectSigner | null = null;
  let remoteAbort: AbortController | null = null;
  let rotationDialog = $state<"confirm" | "recovery" | null>(null);
  let membershipCount = $state(0);
  let completionAnnouncement = $state("");

  const shortKey = $derived(userProfileStore.pubkey
    ? `${userProfileStore.pubkey.slice(0, 8)}…${userProfileStore.pubkey.slice(-6)}`
    : "local identity"
  );
  const presenceLabel = $derived(formatPresence(config.presenceState));

  $effect(() => {
    userProfileStore.setAnonymousName(anonymousName);
  });

  $effect(() => {
    const signer = userProfileStore.activeSigner;
    if (userProfileStore.method === "anonymous" || !signer) {
      nostrSocialStore.disconnect();
      return;
    }
    void nostrSocialStore.connect(signer, config.presenceState, {
      coordinatorPubkey,
      coordinatorOrigin: window.location.origin,
      relayUrls: [...relayUrls],
      coordinatorName: config.coordinatorName || "My coordinator",
    });
  });

  function updateAnonymousName(value: string): void {
    userProfileStore.setAnonymousName(value);
    onAnonymousNameChange?.(value);
  }

  function formatPresence(state: PresenceState): string {
    if (state === "online") return "Online";
    if (state === "offline") return "Offline";
    return "Invisible";
  }

  function selectPresence(state: PresenceState): void {
    if (config.presenceState === state) return;
    config.setPresenceState(state);
    completionAnnouncement = `Presence set to ${formatPresence(state)}.`;
    if (userProfileStore.method !== "anonymous" && userProfileStore.activeSigner) {
      void nostrSocialStore.setPresence(state, {
        coordinatorPubkey,
        coordinatorOrigin: window.location.origin,
        relayUrls: [...relayUrls],
        coordinatorName: config.coordinatorName || "My coordinator",
      });
    }
  }

  async function connectNip07(): Promise<void> {
    try {
      await userProfileStore.connectNip07();
      open = false;
    } catch {
      // The store exposes the actionable error in the menu.
    }
  }

  async function connectNip46(): Promise<void> {
    try {
      await userProfileStore.connectNip46(bunkerUri);
      bunkerUri = "";
      open = false;
    } catch {
      // The store exposes the actionable error in the menu.
    }
  }

  async function connectNip46Qr(): Promise<void> {
    cancelNip46Qr();
    const abort = new AbortController();
    const request = userProfileStore.createNip46Request();
    remoteAbort = abort;
    remoteSigner = request.signer;
    remoteUri = request.uri;
    remoteQr = toSvgDataURL(generate(request.uri), { on: "#c8ffdc", off: "#101614", pad: 2, scale: 5 });
    try {
      await request.signer.waitForSigner(abort.signal);
      if (abort.signal.aborted) return;
      await userProfileStore.adoptNip46(request.signer);
      remoteAbort = null;
      remoteSigner = null;
      remoteUri = "";
      remoteQr = "";
      open = false;
    } catch (cause) {
      if (abort.signal.aborted) return;
      userProfileStore.status = "error";
      userProfileStore.error = cause instanceof Error ? cause.message : "Could not connect the NIP-46 signer";
    }
  }

  function cancelNip46Qr(): void {
    const abort = remoteAbort;
    abort?.abort();
    if (remoteSigner) userProfileStore.cancelNip46Request(remoteSigner, abort === null);
    remoteAbort = null;
    remoteSigner = null;
    remoteUri = "";
    remoteQr = "";
  }

  function closeMenu(): void {
    cancelNip46Qr();
    open = false;
  }

  async function openRotationDialog(): Promise<void> {
    const impact = await anonymousMembershipImpact(userProfileStore.pubkey);
    membershipCount = impact.count;
    rotationDialog = "confirm";
  }

  async function rotateIdentity(): Promise<void> {
    await userProfileStore.rotateAnonymousIdentity();
    completionAnnouncement = "Identity rotated. Local room access was removed.";
    rotationDialog = null;
    closeMenu();
  }

  async function recoverIdentity(): Promise<void> {
    await userProfileStore.recoverAnonymousIdentity();
    rotationDialog = null;
  }

  $effect(() => {
    if (userProfileStore.recoveryRequired) rotationDialog = "recovery";
  });

  async function disconnect(): Promise<void> {
    await userProfileStore.logout();
    userProfileStore.setAnonymousName(anonymousName);
  }

  function avatarFallback(event: Event): void {
    (event.currentTarget as HTMLImageElement).src = createPubkeyAvatar(userProfileStore.pubkey);
  }

  onMount(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });
  onDestroy(cancelNip46Qr);
</script>

<div class="user-profile" data-testid="user-profile">
  <p class="sr-only" aria-live="polite">{completionAnnouncement}</p>
  {#if userProfileStore.initialized && !userProfileStore.recoveryRequired}
  <button
    class="user-trigger"
    type="button"
    aria-label={`${open ? "Close" : "Open"} profile for ${userProfileStore.displayName}. Presence ${presenceLabel}`}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={() => open ? closeMenu() : open = true}
  >
    <span class="user-avatar">
      <img src={userProfileStore.avatarUrl} alt="" onerror={avatarFallback} />
      <span
        class:online={config.presenceState === "online"}
        class:offline={config.presenceState === "offline"}
        class="profile-presence-dot"
        data-testid="profile-presence-status"
        data-presence={config.presenceState}
        role="img"
        aria-label={`Presence: ${presenceLabel}`}
      ></span>
    </span>
    <span class="user-copy">
      <strong>{userProfileStore.displayName}</strong>
      <small>{userProfileStore.authLabel}</small>
    </span>
    <span class="user-chevron" aria-hidden="true">{open ? "↑" : "↓"}</span>
  </button>

  {#if open}
    <button class="user-scrim" type="button" aria-label="Close profile menu" onclick={closeMenu}></button>
    <div class="user-menu" role="dialog" aria-label="User profile">
      <header>
        <img src={userProfileStore.avatarUrl} alt="" onerror={avatarFallback} />
        <div class="min-w-0">
          <strong>{userProfileStore.displayName}</strong>
          <span>{shortKey}</span>
        </div>
        <span class:authenticated={userProfileStore.method !== "anonymous"} class="auth-chip">{userProfileStore.authLabel}</span>
      </header>

      <fieldset class="user-menu-section presence-section">
        <legend class="section-label">Presence</legend>
        <p>Choose how your identity appears. This never changes coordinator availability.</p>
        <div class="presence-options" role="radiogroup" aria-label="Presence">
          {#each ["online", "invisible", "offline"] as state (state)}
            <label class:chosen={config.presenceState === state}>
              <input
                type="radio"
                name="presence"
                value={state}
                checked={config.presenceState === state}
                onchange={() => selectPresence(state as PresenceState)}
              />
              <span class:online={state === "online"} class:offline={state === "offline"} class="presence-option-dot" aria-hidden="true"></span>
              <span><strong>{formatPresence(state as PresenceState)}</strong><small>{state === "online" ? "Visible privately to followers" : state === "invisible" ? "Keep your availability private" : "Do not announce your availability"}</small></span>
            </label>
          {/each}
        </div>
      </fieldset>

      {#if userProfileStore.method === "anonymous"}
        <div class="user-menu-section">
          <label>
            Display name
            <input
              value={anonymousName}
              placeholder="anon"
              maxlength="32"
              oninput={(event) => updateAnonymousName(event.currentTarget.value)}
            />
          </label>
          <p>Your generated avatar and identity are device-local and persist in this browser. No account is required.</p>
          <button class="rotate-identity" type="button" onclick={() => void openRotationDialog()}>Rotate identity…</button>
        </div>
        <div class="user-menu-section">
          <span class="section-label">Connect a Nostr identity</span>
          <button class="connect-button" type="button" disabled={userProfileStore.status === "connecting"} onclick={() => void connectNip07()}>
            <span>NIP-07 browser signer</span>
            <small>{userProfileStore.nip07Available ? "extension detected" : "requires an extension"}</small>
          </button>
          {#if remoteUri}
            <div class="remote-connect" data-testid="nip46-qr-connect">
              <a class="remote-qr" href={remoteUri} aria-label="Open NIP-46 connection in a signer">
                <img src={remoteQr} alt="QR code for NIP-46 signer connection" />
              </a>
              <div class="remote-copy">
                <strong>Scan with your signer</strong>
                <p>Waiting securely via {NIP46_CONNECT_RELAYS[0]}</p>
                <a href={remoteUri}>Open signer on this device ↗</a>
                <button type="button" onclick={cancelNip46Qr}>Cancel</button>
              </div>
            </div>
          {:else}
            <button class="connect-button remote-button" type="button" disabled={userProfileStore.status === "connecting"} onclick={() => void connectNip46Qr()}>
              <span>NIP-46 remote signer</span>
              <small>show QR code</small>
            </button>
          {/if}
          <details class="bunker-fallback">
            <summary>Use a bunker URI instead</summary>
            <div class="bunker-connect">
              <input bind:value={bunkerUri} placeholder="bunker://…" aria-label="NIP-46 bunker URI" />
              <button type="button" disabled={!bunkerUri.trim() || userProfileStore.status === "connecting"} onclick={() => void connectNip46()}>Connect</button>
            </div>
          </details>
        </div>
      {:else}
        <div class="user-menu-section">
          {#if userProfileStore.profile?.nip05}<p class="profile-nip05">{userProfileStore.profile.nip05}</p>{/if}
          {#if userProfileStore.profile?.about}<p>{userProfileStore.profile.about}</p>{:else}<p>Profile loaded from your Nostr identity.</p>{/if}
          <div class="profile-actions">
            <button type="button" onclick={() => void userProfileStore.refreshProfile()}>Refresh profile</button>
            <button class="disconnect" type="button" onclick={() => void disconnect()}>Disconnect</button>
          </div>
        </div>
      {/if}

      {#if userProfileStore.status === "loading"}<p class="user-status">Looking up kind 0 on purplepag.es and relay.damus.io…</p>{/if}
      {#if userProfileStore.error}<p class="user-error">{userProfileStore.error}</p>{/if}
    </div>
  {/if}
  {/if}

  {#if rotationDialog}
    <IdentityRotationDialog
      variant={rotationDialog}
      {membershipCount}
      onConfirm={rotationDialog === "recovery" ? recoverIdentity : rotateIdentity}
      onClose={() => {
        if (rotationDialog === "confirm") {
          rotationDialog = null;
          void tick().then(() => document.querySelector<HTMLButtonElement>(".user-trigger")?.focus());
        }
      }}
    />
  {/if}
</div>

<style>
  .user-profile { position: relative; flex: 0 0 auto; }
  .user-trigger { display: grid; height: 2.65rem; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; border: 1px solid transparent; padding: 4px 8px; color: #dfffe7; }
  .user-trigger:hover { border-color: #34483a; background: #101713; }
  .user-profile > .user-trigger[aria-expanded="true"] { border: 1px solid #87ff9f; background: #101713; }
  .user-avatar { position: relative; display: block; width: 1.85rem; height: 1.85rem; }
  .user-trigger img { width: 1.85rem; height: 1.85rem; object-fit: cover; image-rendering: pixelated; }
  .profile-presence-dot { position: absolute; right: -.12rem; bottom: -.12rem; width: .62rem; height: .62rem; border: 2px solid #080d0a; border-radius: 999px; background: #82958a; }
  .profile-presence-dot.online { background: #7cf59d; box-shadow: 0 0 8px rgb(124 245 157 / .4); }
  .profile-presence-dot.offline { background: #9b6b56; }
  .user-copy { display: none; min-width: 0; text-align: left; line-height: 1; }
  .user-copy strong { display: block; max-width: 8rem; overflow: hidden; font-size: 12px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
  .user-copy small { display: block; margin-top: 4px; color: #708177; font-size: 10px; font-weight: 400; line-height: 1.3; letter-spacing: .1em; text-transform: uppercase; }
  .user-chevron { color: #64766a; font-size: 10px; }
  .user-scrim { position: fixed; z-index: 69; inset: 0; border: 0; background: transparent; cursor: default; }
  .user-menu { position: absolute; z-index: 70; top: calc(100% + 8px); right: 0; width: min(22rem, calc(100vw - 1.5rem)); border: 1px solid #496451; background: rgb(8 13 10 / .99); box-shadow: 0 20px 56px rgb(0 0 0 / .62); }
  .user-menu > header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; border-bottom: 1px solid #293832; padding: 16px; }
  .user-menu > header img { width: 2.5rem; height: 2.5rem; object-fit: cover; image-rendering: pixelated; }
  .user-menu > header strong, .user-menu > header span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .user-menu > header strong { color: #effff2; font-size: 14px; font-weight: 650; line-height: 1.4; }
  .user-menu > header div > span { margin-top: 4px; color: #718277; font-size: 10px; font-weight: 400; line-height: 1.3; }
  .auth-chip { border: 1px solid #34483a; padding: 4px 8px; color: #82958a; font-size: 10px; font-weight: 400; line-height: 1.3; letter-spacing: .08em; text-transform: uppercase; }
  .auth-chip.authenticated { border-color: #477e57; color: #7cf59d; }
  .user-menu-section { display: grid; gap: 12px; border-bottom: 1px solid #202d25; padding: 16px; }
  .user-menu-section:last-of-type { border-bottom: 0; }
  .presence-section { min-width: 0; }
  .presence-section > p { margin-top: -.15rem; }
  .presence-options { display: grid; gap: .3rem; }
  .presence-options > label { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: .55rem; border: 1px solid transparent; padding: .55rem; color: #91a59a; cursor: pointer; text-transform: none; }
  .presence-options > label:hover, .presence-options > label.chosen { border-color: #34483a; background: #111a14; color: #effff2; }
  .presence-options input { position: absolute; width: 1px; height: 1px; margin: -1px; opacity: 0; }
  .presence-option-dot { width: .52rem; height: .52rem; border: 1px solid #82958a; border-radius: 999px; background: transparent; }
  .presence-option-dot.online { border-color: #7cf59d; background: #7cf59d; box-shadow: 0 0 7px rgb(124 245 157 / .35); }
  .presence-option-dot.offline { border-color: #9b6b56; background: #9b6b56; }
  .presence-options strong, .presence-options small { display: block; }
  .presence-options strong { font-size: .68rem; font-weight: 600; }
  .presence-options small { margin-top: .13rem; color: #718277; font-size: .54rem; }
  .user-menu-section label, .section-label { color: #83958a; font-size: 10px; font-weight: 400; line-height: 1.3; letter-spacing: .1em; text-transform: uppercase; }
  .user-menu-section input { width: 100%; margin-top: 8px; border: 1px solid #34433b; background: #070b08; padding: 12px; color: #effff2; font-size: 12px; font-weight: 400; line-height: 1.5; outline: none; text-transform: none; }
  .user-menu-section input:focus { border-color: #7cf59d; }
  .user-menu-section p { color: #82958a; font-size: 12px; font-weight: 400; line-height: 1.5; }
  .rotate-identity { min-height: 44px; border: 1px solid #7b4843; padding: 12px; color: #ffaaa3; font-size: 12px; font-weight: 400; line-height: 1.5; text-align: left; }
  .rotate-identity:hover, .rotate-identity:focus-visible { border-color: #ffaaa3; background: #24100f; outline: 2px solid #87ff9f; outline-offset: 2px; }
  .connect-button { display: flex; align-items: center; justify-content: space-between; gap: .75rem; border: 1px solid #293832; padding: .65rem .7rem; color: #c6d7cb; text-align: left; font-size: .68rem; }
  .connect-button:hover { border-color: #7cf59d; background: #111a14; }
  .connect-button small { color: #687a6f; font-size: .55rem; }
  .remote-button { border-color: #36533f; background: #0d1711; }
  .remote-connect { display: grid; grid-template-columns: 8.5rem minmax(0, 1fr); align-items: center; gap: .8rem; border: 1px solid #477e57; background: #0d1711; padding: .7rem; }
  .remote-qr { display: block; border: 1px solid #53745d; background: #101614; padding: .3rem; }
  .remote-qr img { display: block; width: 100%; aspect-ratio: 1; }
  .remote-copy { display: grid; min-width: 0; gap: .5rem; align-content: center; }
  .remote-copy strong { color: #e7ffed; font-size: .68rem; }
  .remote-copy p { overflow-wrap: anywhere; font-size: .56rem; }
  .remote-copy a, .remote-copy button { width: fit-content; color: #7cf59d; font-size: .58rem; }
  .remote-copy a:hover, .remote-copy button:hover { color: #c5ffcf; }
  .bunker-fallback { color: #718277; font-size: .58rem; }
  .bunker-fallback summary { width: fit-content; cursor: pointer; }
  .bunker-fallback[open] summary { margin-bottom: .5rem; color: #91a59a; }
  .bunker-connect { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .4rem; }
  .bunker-connect input { margin: 0; }
  .bunker-connect button, .profile-actions button { border: 1px solid #3f5a47; padding: .55rem .65rem; color: #bde7c7; font-size: .62rem; }
  .bunker-connect button:hover, .profile-actions button:hover { border-color: #7cf59d; }
  .bunker-connect button:disabled, .connect-button:disabled { opacity: .4; }
  .profile-nip05 { color: #9bf6b3 !important; }
  .profile-actions { display: flex; gap: .5rem; }
  .profile-actions .disconnect { border-color: #583737; color: #d69d99; }
  .user-status, .user-error { border-top: 1px solid #293832; padding: .65rem .85rem; font-size: .6rem; }
  .user-status { color: #91a59a; }
  .user-error { color: #ffaaa3; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  @media (min-width: 720px) {
    .user-copy { display: block; }
  }

  @media (max-width: 420px) {
    .remote-connect { grid-template-columns: 1fr; }
    .remote-qr { width: min(11rem, 100%); justify-self: center; }
  }
</style>
