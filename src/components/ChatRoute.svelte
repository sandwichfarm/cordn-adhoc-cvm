<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { ExtensionSigner, NostrConnectSigner } from "applesauce-signers/signers";
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import type { NostrSigner } from "@contextvm/sdk/core";
  import { generateSecretKey } from "nostr-tools";
  import { bytesToHex } from "nostr-tools/utils";
  import { parseInviteUrl, type ChatInvite } from "../chat/invite";
  import { ChatRoomSession, createJoiningRoom, loadRoom, signerForStoredRoom, type StoredRoom } from "../chat/room-store";
  import { BrowserNostrSigner } from "../crypto/browser-nostr-signer";

  let invite = $state<ChatInvite | null>(null);
  let room = $state<StoredRoom | null>(null);
  let session = $state<ChatRoomSession | null>(null);
  let revision = $state(0);
  let name = $state("");
  let composer = $state("");
  let error = $state("");
  let joining = $state(false);
  let signerMode = $state<"anonymous" | "extension" | "remote">("anonymous");
  let bunkerUri = $state("");
  let remoteUri = $state("");
  let remoteQr = $state("");

  function update() {
    // ChatRoomSession deliberately mutates its durable record before writing it
    // to local storage. Hand Svelte a new top-level object on every session
    // update so join/welcome transitions and buffered-message state render.
    if (session) room = { ...session.room, messages: [...session.room.messages], pending: [...session.room.pending] };
    revision += 1;
  }
  function attach(nextRoom: StoredRoom, signer: NostrSigner) {
    session?.stop();
    room = nextRoom;
    session = new ChatRoomSession(nextRoom, signer);
    session.subscribe(update);
    void session.start();
    update();
  }

  onMount(() => {
    invite = parseInviteUrl(window.location.href);
    if (!invite) return;
    const stored = loadRoom(invite.groupId);
    const signer = stored ? signerForStoredRoom(stored) : null;
    if (stored && signer) attach(stored, signer);
    else if (stored) room = stored;
  });
  onDestroy(() => session?.stop());

  async function join(signer: NostrSigner, anonymousSecretKey: string | undefined = undefined) {
    if (!invite) return;
    joining = true;
    error = "";
    try {
      const created = await createJoiningRoom({ invite, name, signer, anonymousSecretKey });
      attach(created, signer);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Unable to join this chat";
    } finally { joining = false; }
  }

  async function joinAnonymous() {
    const secret = generateSecretKey();
    await join(new BrowserNostrSigner(secret), bytesToHex(secret));
  }
  async function joinExtension() {
    await join(new ExtensionSigner() as unknown as NostrSigner);
  }
  async function beginRemote() {
    if (!invite) return;
    error = "";
    const remote = new NostrConnectSigner({ relays: invite.relayUrls });
    remoteUri = remote.getNostrConnectURI({ name: "Cordn Ad-Hoc", url: window.location.origin });
    remoteQr = toSvgDataURL(generate(remoteUri), { on: "#103e32", off: "#f5fbf8", pad: 2, scale: 4 });
    joining = true;
    try {
      await remote.waitForSigner();
      await join(remote as unknown as NostrSigner);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Remote signer did not connect";
    } finally { joining = false; }
  }
  async function joinBunker() {
    try {
      const remote = await NostrConnectSigner.fromBunkerURI(bunkerUri.trim());
      await remote.connect();
      await join(remote as unknown as NostrSigner);
    } catch (cause) { error = cause instanceof Error ? cause.message : "Could not connect bunker"; }
  }
  async function send() {
    if (!session) return;
    const next = composer;
    composer = "";
    await session.send(next);
  }
</script>

<main class="chat-page min-h-screen bg-[#f2f7f4] text-[#13231a]" data-testid="chat-route">
  {#if !invite}
    <section class="mx-auto flex min-h-screen max-w-lg items-center px-5"><div class="rounded-2xl bg-white p-7 shadow-xl"><p class="text-sm text-[#607267]">This chat invite is incomplete or malformed.</p></div></section>
  {:else if !room}
    <section class="mx-auto flex min-h-screen max-w-xl items-center px-5 py-10"><div class="w-full rounded-3xl bg-white p-6 shadow-[0_24px_80px_rgba(21,57,36,0.16)] sm:p-9">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#39825d]">Cordn ad-hoc chat</p>
      <h1 class="mt-3 text-3xl font-semibold tracking-tight">{invite.title || "You’re invited"}</h1>
      <p class="mt-2 leading-6 text-[#5e7064]">Choose a name, then join privately. This link is connected only to the host’s ad-hoc coordinator.</p>
      <label class="mt-6 block text-sm font-medium">Your name<input bind:value={name} class="mt-2 w-full rounded-xl border border-[#ccdcd1] px-4 py-3 outline-none focus:border-[#39825d]" placeholder="e.g. River" /></label>
      <div class="mt-5 grid gap-2 sm:grid-cols-3">
        <button class:active={signerMode === "anonymous"} class="choice" onclick={() => signerMode = "anonymous"}>Stay anonymous</button>
        <button class:active={signerMode === "extension"} class="choice" onclick={() => signerMode = "extension"}>NIP-07</button>
        <button class:active={signerMode === "remote"} class="choice" onclick={() => signerMode = "remote"}>NIP-46</button>
      </div>
      {#if signerMode === "anonymous"}<p class="mt-3 text-sm text-[#5e7064]">A new chat-only identity is stored on this device. No account needed.</p>{/if}
      {#if signerMode === "extension"}<p class="mt-3 text-sm text-[#5e7064]">Use your browser Nostr signer. Your private key stays in the extension.</p>{/if}
      {#if signerMode === "remote"}
        <div class="mt-4 rounded-xl bg-[#eef7f1] p-4"><p class="text-sm text-[#355044]">Use a remote signer app, or paste its bunker URI.</p>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row"><input bind:value={bunkerUri} class="min-w-0 flex-1 rounded-lg border border-[#ccdcd1] bg-white px-3 py-2" placeholder="bunker://…" /><button class="rounded-lg border border-[#39825d] px-3 py-2 text-sm" onclick={joinBunker}>Connect bunker</button></div>
          {#if remoteUri}<a href={remoteUri} class="mt-4 flex w-fit flex-col items-center rounded-lg bg-white p-3 text-xs text-[#39825d]"><img src={remoteQr} alt="QR code to connect remote signer" class="h-40 w-40" />Tap this QR on mobile to open Amber or another signer</a>{/if}
        </div>
      {/if}
      {#if error}<p class="mt-4 text-sm text-[#b42318]">{error}</p>{/if}
      <button class="mt-6 w-full rounded-xl bg-[#176b46] px-4 py-3 font-medium text-white hover:bg-[#115638] disabled:opacity-50" disabled={joining} onclick={signerMode === "anonymous" ? joinAnonymous : signerMode === "extension" ? joinExtension : beginRemote}>{joining ? "Connecting…" : signerMode === "remote" ? "Connect signer" : "Join chat"}</button>
    </div></section>
  {:else if !session}
    <section class="mx-auto flex min-h-screen max-w-lg items-center px-5"><div class="w-full rounded-3xl bg-white p-7 shadow-xl"><h1 class="text-2xl font-semibold">Resume {room.title}</h1><p class="mt-2 text-[#5e7064]">Reconnect the signer you used to join this chat.</p><div class="mt-5 flex gap-2"><button class="choice active" onclick={joinExtension}>Use NIP-07</button><button class="choice" onclick={() => signerMode = "remote"}>Use NIP-46</button></div>{#if signerMode === "remote"}<input bind:value={bunkerUri} class="mt-4 w-full rounded-lg border p-3" placeholder="bunker://…" /><button class="mt-2 rounded-lg bg-[#176b46] px-3 py-2 text-white" onclick={joinBunker}>Connect bunker</button>{/if}</div></section>
  {:else}
    {@const current = session}
    {@const currentRoom = room}
    <section class="mx-auto flex min-h-screen max-w-3xl flex-col bg-white shadow-[0_0_80px_rgba(21,57,36,0.1)]" data-revision={revision}>
      <header class="border-b border-[#e1ebe4] px-5 py-4 sm:px-7"><div class="flex items-center justify-between gap-4"><div><p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#39825d]">Private group</p><h1 class="mt-1 text-xl font-semibold">{currentRoom.title}</h1></div><span class:offline={current.status.connection === "offline"} class="status">{current.status.connection === "connected" ? "Synced" : current.status.connection === "offline" ? "Offline — buffered" : "Syncing"}</span></div>{#if current.status.detail}<p class="mt-2 text-xs text-[#6a7e70]">{current.status.detail}</p>{/if}</header>
      {#if currentRoom.joinRequestSent}<div class="m-5 rounded-2xl bg-[#eef7f1] p-5 text-sm text-[#355044]">Your encrypted join request is with the host. This page checks for your welcome automatically.</div>{:else}
        <div class="flex-1 space-y-3 overflow-y-auto px-5 py-6 sm:px-7">{#if currentRoom.messages.length === 0}<p class="pt-16 text-center text-sm text-[#7a8d80]">Say hello — messages are encrypted before they leave this device.</p>{/if}{#each currentRoom.messages as message (message.id)}<article class:mine={message.sender === currentRoom.stablePubkey} class="message"><div class="flex items-baseline gap-2"><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{#if message.pending}<span class="text-xs">sending…</span>{/if}</div><p>{message.content}</p></article>{/each}</div>
        <form class="border-t border-[#e1ebe4] p-4 sm:p-5" onsubmit={(event) => { event.preventDefault(); void send(); }}><div class="flex gap-2"><input bind:value={composer} class="min-w-0 flex-1 rounded-xl border border-[#ccdcd1] px-4 py-3 outline-none focus:border-[#39825d]" placeholder="Message" /><button class="rounded-xl bg-[#176b46] px-5 py-3 font-medium text-white">Send</button></div><p class="mt-2 text-center text-xs text-[#7a8d80]">Stored locally and replayed after coordinator reconnects.</p></form>
      {/if}
    </section>
  {/if}
</main>

<style>
  .choice { border: 1px solid #ccdcd1; border-radius: .75rem; padding: .65rem .8rem; font-size: .875rem; color: #355044; background: white; }
  .choice.active, .choice:hover { border-color: #39825d; background: #eef7f1; color: #176b46; }
  .status { border-radius: 999px; background: #e6f6eb; color: #176b46; padding: .35rem .65rem; font-size: .75rem; font-weight: 600; }
  .status.offline { background: #fff2e5; color: #9a5216; }
  .message { max-width: 78%; border-radius: 1rem; background: #f0f5f1; padding: .75rem 1rem; color: #1d3024; }
  .message.mine { margin-left: auto; background: #dff5e7; }
  .message strong { font-size: .8rem; color: #176b46; } .message time, .message span { font-size: .7rem; color: #778a7d; } .message p { margin-top: .25rem; white-space: pre-wrap; word-break: break-word; }
</style>
