<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import type { NostrConnectSigner } from "applesauce-signers/signers";
  import { userProfileStore } from "../identity/user-profile.svelte";

  interface Props {
    testIdPrefix: string;
    qrTestId?: string;
    autoFocus?: boolean;
    onIdentityReady: () => void | Promise<void>;
  }

  let { testIdPrefix, qrTestId, autoFocus = false, onIdentityReady }: Props = $props();
  let bunkerUri = $state("");
  let remoteUri = $state("");
  let remoteQr = $state("");
  let remoteSigner: NostrConnectSigner | null = null;
  let remoteAbort: AbortController | null = null;
  let connectionError = $state("");
  let firstAction = $state<HTMLButtonElement>();

  const busy = $derived(userProfileStore.status === "connecting");
  const testId = (name: string) => `${testIdPrefix}-${name}`;

  async function notifyReady(): Promise<void> {
    if (!userProfileStore.initialized || !userProfileStore.hasIdentity) return;
    await onIdentityReady();
  }

  async function connectNip07(): Promise<void> {
    connectionError = "";
    try {
      await userProfileStore.connectNip07();
      await notifyReady();
    } catch {
      connectionError = "Could not connect the NIP-07 signer. Try again.";
    }
  }

  async function connectNip46(): Promise<void> {
    connectionError = "";
    try {
      await userProfileStore.connectNip46(bunkerUri);
      bunkerUri = "";
      await notifyReady();
    } catch {
      connectionError = "Could not connect the NIP-46 signer. Try again.";
    }
  }

  async function connectNip46Qr(): Promise<void> {
    cancelNip46Qr();
    connectionError = "";
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
      await notifyReady();
    } catch {
      if (abort.signal.aborted) return;
      connectionError = "Could not connect the NIP-46 signer. Try again.";
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
    connectionError = "";
  }

  onDestroy(cancelNip46Qr);
  onMount(() => {
    if (autoFocus) void tick().then(() => firstAction?.focus());
  });
</script>

<div class="operator-identity-choices" aria-label="Connect a Nostr identity">
  <button bind:this={firstAction} class="identity-choice" data-testid={testId("nip07")} type="button" disabled={busy} onclick={() => void connectNip07()}>
    <span>NIP-07 browser signer</span>
    <small>{userProfileStore.nip07Available ? "extension detected" : "requires an extension"}</small>
  </button>
  {#if remoteUri}
    <div class="remote-connect" data-testid={qrTestId ?? testId("nip46-qr")}>
      <a class="remote-qr" href={remoteUri} aria-label="Open NIP-46 connection in a signer">
        <img src={remoteQr} alt="QR code for NIP-46 signer connection" />
      </a>
      <div class="remote-copy">
        <strong>Scan with your signer</strong>
        <p role="status">Waiting for signer connection…</p>
        <a href={remoteUri}>Open signer on this device ↗</a>
        <button data-testid={testId("cancel-signer-connection")} type="button" onclick={cancelNip46Qr}>Cancel signer connection</button>
      </div>
    </div>
  {:else}
    <button class="identity-choice remote-choice" data-testid={testId("nip46")} type="button" disabled={busy} onclick={() => void connectNip46Qr()}>
      <span>NIP-46 remote signer</span>
      <small>show QR code</small>
    </button>
  {/if}
  <details class="bunker-fallback">
    <summary>Use a bunker URI instead</summary>
    <div class="bunker-connect">
      <input bind:value={bunkerUri} placeholder="bunker://…" aria-label="NIP-46 bunker URI" />
      <button type="button" disabled={!bunkerUri.trim() || busy} onclick={() => void connectNip46()}>Connect</button>
    </div>
  </details>
  {#if connectionError}<p class="connection-error" role="alert">{connectionError}</p>{/if}
</div>

<style>
  .operator-identity-choices { display: grid; gap: 12px; }
  .identity-choice { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: .75rem; border: 1px solid #293832; padding: .65rem .7rem; color: #c6d7cb; text-align: left; font-size: 12px; }
  .identity-choice:hover, .identity-choice:focus-visible { border-color: #7cf59d; background: #111a14; outline: 2px solid #7cf59d; outline-offset: 2px; }
  .identity-choice small { color: #687a6f; font-size: 10px; }
  .remote-choice { border-color: #36533f; background: #0d1711; }
  .remote-connect { display: grid; grid-template-columns: 8.5rem minmax(0, 1fr); align-items: center; gap: .8rem; border: 1px solid #477e57; background: #0d1711; padding: .7rem; }
  .remote-qr { display: block; border: 4px solid #dfffe7; background: #dfffe7; }
  .remote-qr img { display: block; width: 100%; }
  .remote-copy { display: grid; gap: .45rem; min-width: 0; }
  .remote-copy strong { color: #e7ffed; font-size: 12px; }
  .remote-copy p { color: #82958a; font-size: 12px; line-height: 1.5; }
  .remote-copy a, .remote-copy button { width: fit-content; min-height: 44px; color: #7cf59d; font-size: 12px; text-align: left; }
  .bunker-fallback { color: #718277; font-size: 12px; }
  .bunker-fallback summary { width: fit-content; cursor: pointer; }
  .bunker-fallback[open] summary { margin-bottom: .5rem; color: #91a59a; }
  .bunker-connect { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .4rem; }
  .bunker-connect input { min-width: 0; min-height: 44px; border: 1px solid #34433b; background: #070b08; padding: 12px; color: #effff2; font: inherit; }
  .bunker-connect button { min-height: 44px; border: 1px solid #3f5a47; padding: .55rem .65rem; color: #bde7c7; font-size: 12px; }
  .connection-error { color: #ffaaa3; font-size: 12px; line-height: 1.5; }
  button:disabled { cursor: not-allowed; opacity: .4; }
  @media (max-width: 520px) { .remote-connect { grid-template-columns: 1fr; } .remote-qr { width: min(12rem, 100%); } }
</style>
