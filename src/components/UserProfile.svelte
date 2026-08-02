<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import type { NostrConnectSigner } from "applesauce-signers/signers";
  import {
    createPubkeyAvatar,
    NIP46_CONNECT_RELAYS,
    userProfileStore,
  } from "../identity/user-profile.svelte";
  import IdentityRotationDialog from "./IdentityRotationDialog.svelte";
  import { anonymousMembershipImpact } from "../chat/room-store";

  interface Props {
    anonymousName?: string;
    onAnonymousNameChange?: (name: string) => void;
    showHostIdentity?: boolean;
    badgeLabel?: string;
    badgeEmoji?: string;
    onBadgeLabelChange?: (label: string) => void;
    onBadgeEmojiChange?: (emoji: string) => void;
  }

  const badgeEmojis = ["🛡️", "👑", "⚡", "🌿", "🛰️", "🫡", "🔐", "🧭", "🦉", "🦊", "🐙", "✨", "💚", "🏠", "🎛️", "☕"];

  let {
    anonymousName = "",
    onAnonymousNameChange,
    showHostIdentity = false,
    badgeLabel = "host",
    badgeEmoji = "🛡️",
    onBadgeLabelChange,
    onBadgeEmojiChange,
  }: Props = $props();
  let open = $state(false);
  let bunkerUri = $state("");
  let remoteUri = $state("");
  let remoteQr = $state("");
  let emojiPickerOpen = $state(false);
  let remoteSigner: NostrConnectSigner | null = null;
  let remoteAbort: AbortController | null = null;
  let rotationDialog = $state<"confirm" | "recovery" | null>(null);
  let membershipCount = $state(0);
  let completionAnnouncement = $state("");

  const shortKey = $derived(userProfileStore.pubkey
    ? `${userProfileStore.pubkey.slice(0, 8)}…${userProfileStore.pubkey.slice(-6)}`
    : "local identity"
  );

  $effect(() => {
    userProfileStore.setAnonymousName(anonymousName);
  });

  function updateAnonymousName(value: string): void {
    userProfileStore.setAnonymousName(value);
    onAnonymousNameChange?.(value);
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
  {#if !userProfileStore.recoveryRequired}
  <button
    class="user-trigger"
    type="button"
    aria-label={`${open ? "Close" : "Open"} profile for ${userProfileStore.displayName}`}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={() => open ? closeMenu() : open = true}
  >
    <img src={userProfileStore.avatarUrl} alt="" onerror={avatarFallback} />
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

      {#if showHostIdentity}
        <div class="user-menu-section host-identity-section">
          <div class="section-heading">
            <span class="section-label">Message identity</span>
            <span class="badge-preview"><span aria-hidden="true">{badgeEmoji}</span><span>{badgeLabel.trim() || "host"}</span></span>
          </div>
          <div class="badge-editor">
            <button
              class="emoji-trigger"
              type="button"
              aria-label="Choose badge emoji"
              aria-expanded={emojiPickerOpen}
              onclick={() => emojiPickerOpen = !emojiPickerOpen}
            >{badgeEmoji || "＋"}</button>
            <label>
              Badge text
              <input
                value={badgeLabel}
                placeholder="host"
                maxlength="20"
                oninput={(event) => onBadgeLabelChange?.(event.currentTarget.value)}
              />
            </label>
          </div>
          {#if emojiPickerOpen}
            <div class="emoji-picker" role="group" aria-label="Badge emoji">
              {#each badgeEmojis as emoji (emoji)}
                <button
                  class:selected={emoji === badgeEmoji}
                  type="button"
                  aria-label={`Use ${emoji} for badge`}
                  onclick={() => {
                    onBadgeEmojiChange?.(emoji);
                    emojiPickerOpen = false;
                  }}
                >{emoji}</button>
              {/each}
            </div>
          {/if}
          <p>Your name, avatar, and badge appear beside messages you host. Badge text remains selectable in the conversation.</p>
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
  .user-trigger { display: grid; height: 2.65rem; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .55rem; border: 1px solid transparent; padding: .25rem .45rem; color: #dfffe7; }
  .user-trigger:hover, .user-trigger[aria-expanded="true"] { border-color: #34483a; background: #101713; }
  .user-trigger img { width: 1.85rem; height: 1.85rem; object-fit: cover; image-rendering: pixelated; }
  .user-copy { display: none; min-width: 0; text-align: left; line-height: 1; }
  .user-copy strong { display: block; max-width: 8rem; overflow: hidden; font-size: .68rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
  .user-copy small { display: block; margin-top: .28rem; color: #708177; font-size: .5rem; letter-spacing: .1em; text-transform: uppercase; }
  .user-chevron { color: #64766a; font-size: .56rem; }
  .user-scrim { position: fixed; z-index: 69; inset: 0; border: 0; background: transparent; cursor: default; }
  .user-menu { position: absolute; z-index: 70; top: calc(100% + .55rem); right: 0; width: min(22rem, calc(100vw - 1.5rem)); border: 1px solid #496451; background: rgb(8 13 10 / .99); box-shadow: 0 20px 56px rgb(0 0 0 / .62); }
  .user-menu > header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .75rem; border-bottom: 1px solid #293832; padding: .85rem; }
  .user-menu > header img { width: 2.5rem; height: 2.5rem; object-fit: cover; image-rendering: pixelated; }
  .user-menu > header strong, .user-menu > header span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .user-menu > header strong { color: #effff2; font-size: .8rem; }
  .user-menu > header div > span { margin-top: .25rem; color: #718277; font-size: .58rem; }
  .auth-chip { border: 1px solid #34483a; padding: .25rem .35rem; color: #82958a; font-size: .5rem; letter-spacing: .08em; text-transform: uppercase; }
  .auth-chip.authenticated { border-color: #477e57; color: #7cf59d; }
  .user-menu-section { display: grid; gap: .65rem; border-bottom: 1px solid #202d25; padding: .85rem; }
  .user-menu-section:last-of-type { border-bottom: 0; }
  .user-menu-section label, .section-label { color: #83958a; font-size: .56rem; letter-spacing: .1em; text-transform: uppercase; }
  .user-menu-section input { width: 100%; margin-top: .45rem; border: 1px solid #34433b; background: #070b08; padding: .65rem .7rem; color: #effff2; font-size: .72rem; outline: none; text-transform: none; }
  .user-menu-section input:focus { border-color: #7cf59d; }
  .user-menu-section p { color: #82958a; font-size: .65rem; line-height: 1.55; }
  .rotate-identity { min-height: 2.75rem; border: 1px solid #7b4843; color: #ffaaa3; font-size: .68rem; text-align: left; padding: .65rem .7rem; }
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
  .host-identity-section { gap: .75rem; }
  .section-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  .badge-preview { display: inline-flex; user-select: text; align-items: center; gap: .28rem; border: 1px solid #3f5a47; background: #111a14; padding: .22rem .42rem; color: #a9e9b8; font-size: .55rem; letter-spacing: .08em; text-transform: uppercase; }
  .badge-editor { display: grid; grid-template-columns: 2.55rem minmax(0, 1fr); align-items: end; gap: .5rem; }
  .badge-editor label { min-width: 0; }
  .emoji-trigger { display: grid; width: 2.55rem; height: 2.55rem; place-items: center; border: 1px solid #34433b; background: #070b08; font-size: 1rem; }
  .emoji-trigger:hover, .emoji-trigger[aria-expanded="true"] { border-color: #7cf59d; background: #111a14; }
  .emoji-picker { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: .25rem; border: 1px solid #293832; background: #070b08; padding: .4rem; }
  .emoji-picker button { display: grid; aspect-ratio: 1; place-items: center; border: 1px solid transparent; font-size: .9rem; }
  .emoji-picker button:hover, .emoji-picker button.selected { border-color: #7cf59d; background: #17241b; }
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
