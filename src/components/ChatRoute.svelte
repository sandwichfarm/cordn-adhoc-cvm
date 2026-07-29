<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { ExtensionSigner, NostrConnectSigner } from "applesauce-signers/signers";
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import type { NostrSigner } from "@contextvm/sdk/core";
  import { generateSecretKey } from "nostr-tools";
  import { bytesToHex } from "nostr-tools/utils";
  import { parseInviteUrl, type ChatInvite } from "../chat/invite";
  import { ChatRoomSession, createJoiningRoom, loadRoom, signerForStoredRoom, type StoredRoom } from "../chat/room-store";
  import { BrowserNostrSigner } from "../crypto/browser-nostr-signer";

  const emojiShortcuts = ["👍", "❤️", "😂", "🎉", "👋", "✨"];

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
  let soundsEnabled = $state(true);
  let messageList: HTMLDivElement | undefined = $state();
  let composerInput: HTMLInputElement | undefined = $state();
  let audioContext: AudioContext | null = null;
  let knownMessageIds = new Set<string>();

  $effect(() => {
    if (revision >= 0) void tick().then(() => messageList?.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" }));
  });

  function update() {
    if (session) {
      const nextRoom = { ...session.room, messages: [...session.room.messages], pending: [...session.room.pending] };
      const receivedMessage = nextRoom.messages.some((message) => !knownMessageIds.has(message.id) && message.sender !== nextRoom.stablePubkey);
      knownMessageIds = new Set(nextRoom.messages.map((message) => message.id));
      room = nextRoom;
      if (receivedMessage) playIncomingTone();
    }
    revision += 1;
  }

  function attach(nextRoom: StoredRoom, signer: NostrSigner) {
    session?.stop();
    knownMessageIds = new Set(nextRoom.messages.map((message) => message.id));
    room = nextRoom;
    session = new ChatRoomSession(nextRoom, signer);
    session.subscribe(update);
    void session.start();
    update();
  }

  async function enableSounds() {
    try {
      audioContext ??= new AudioContext();
      await audioContext.resume();
      soundsEnabled = true;
    } catch {
      soundsEnabled = false;
    }
  }

  function playIncomingTone() {
    if (!soundsEnabled || !audioContext || audioContext.state !== "running") return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.setValueAtTime(720, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(960, audioContext.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.14);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
  }

  function addEmoji(emoji: string) {
    composer += emoji;
    composerInput?.focus();
  }

  async function toggleSounds() {
    if (soundsEnabled) {
      soundsEnabled = false;
      return;
    }
    await enableSounds();
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
    } finally {
      joining = false;
    }
  }

  async function joinAnonymous() {
    void enableSounds();
    const secret = generateSecretKey();
    await join(new BrowserNostrSigner(secret), bytesToHex(secret));
  }

  async function joinExtension() {
    void enableSounds();
    await join(new ExtensionSigner() as unknown as NostrSigner);
  }

  async function beginRemote() {
    if (!invite) return;
    void enableSounds();
    error = "";
    const remote = new NostrConnectSigner({ relays: invite.relayUrls });
    remoteUri = remote.getNostrConnectURI({ name: "Cordn Ad-Hoc", url: window.location.origin });
    remoteQr = toSvgDataURL(generate(remoteUri), { on: "#c8ffdc", off: "#101614", pad: 2, scale: 4 });
    joining = true;
    try {
      await remote.waitForSigner();
      await join(remote as unknown as NostrSigner);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Remote signer did not connect";
    } finally {
      joining = false;
    }
  }

  async function joinBunker() {
    void enableSounds();
    try {
      const remote = await NostrConnectSigner.fromBunkerURI(bunkerUri.trim());
      await remote.connect();
      await join(remote as unknown as NostrSigner);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not connect bunker";
    }
  }

  async function send() {
    if (!session) return;
    void enableSounds();
    const next = composer;
    composer = "";
    await session.send(next);
  }
</script>

<main class="chat-page h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#0b0e0d] text-[#e8f5eb]" data-testid="chat-route">
  {#if !invite}
    <section class="flex h-full items-center justify-center p-5"><div class="max-w-sm border border-[#293832] bg-[#101614] p-6 text-sm text-[#a2b4a7]">This chat invite is incomplete or malformed.</div></section>
  {:else if !room}
    <section class="mx-auto flex h-full w-full max-w-xl items-center p-4 sm:p-8"><div class="w-full border border-[#293832] bg-[#101614] p-5 shadow-2xl sm:p-8">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">Cordn private chat</p>
      <h1 class="mt-3 text-3xl font-semibold tracking-tight text-white">{invite.title || "You’re invited"}</h1>
      <p class="mt-2 leading-6 text-[#a2b4a7]">Choose a name, then join the encrypted room. This invite connects only to its host coordinator.</p>
      <label class="mt-6 block text-sm font-medium text-[#d4e7da]">Your name<input bind:value={name} class="guest-input mt-2" placeholder="e.g. River" /></label>
      <div class="mt-5 grid gap-2 sm:grid-cols-3">
        <button class:active={signerMode === "anonymous"} class="choice" onclick={() => signerMode = "anonymous"}>Stay anonymous</button>
        <button class:active={signerMode === "extension"} class="choice" onclick={() => signerMode = "extension"}>NIP-07</button>
        <button class:active={signerMode === "remote"} class="choice" onclick={() => signerMode = "remote"}>NIP-46</button>
      </div>
      {#if signerMode === "anonymous"}<p class="mt-3 text-sm text-[#91a59a]">A chat-only identity stays on this device. No account needed.</p>{/if}
      {#if signerMode === "extension"}<p class="mt-3 text-sm text-[#91a59a]">Use your browser Nostr signer; your key stays in the extension.</p>{/if}
      {#if signerMode === "remote"}
        <div class="mt-4 border border-[#293832] bg-[#0b0e0d] p-4"><p class="text-sm text-[#b9cbbf]">Use a remote signer app, or paste its bunker URI.</p>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row"><input bind:value={bunkerUri} class="guest-input min-w-0 flex-1" placeholder="bunker://…" /><button class="secondary-button" onclick={joinBunker}>Connect bunker</button></div>
          {#if remoteUri}<a href={remoteUri} class="mt-4 flex w-fit flex-col items-center border border-[#293832] bg-[#101614] p-3 text-xs text-[#bff6cc]"><img src={remoteQr} alt="QR code to connect remote signer" class="h-40 w-40" />Tap on mobile to open a signer</a>{/if}
        </div>
      {/if}
      {#if error}<p class="mt-4 text-sm text-[#ffaaa3]">{error}</p>{/if}
      <button class="primary-button mt-6 w-full" disabled={joining} onclick={signerMode === "anonymous" ? joinAnonymous : signerMode === "extension" ? joinExtension : beginRemote}>{joining ? "Connecting…" : signerMode === "remote" ? "Connect signer" : "Join chat"}</button>
    </div></section>
  {:else if !session}
    <section class="flex h-full items-center justify-center p-5"><div class="w-full max-w-lg border border-[#293832] bg-[#101614] p-7"><h1 class="text-2xl font-semibold text-white">Resume {room.title}</h1><p class="mt-2 text-[#a2b4a7]">Reconnect the signer you used to join this chat.</p><div class="mt-5 flex gap-2"><button class="choice active" onclick={joinExtension}>Use NIP-07</button><button class="choice" onclick={() => signerMode = "remote"}>Use NIP-46</button></div>{#if signerMode === "remote"}<input bind:value={bunkerUri} class="guest-input mt-4" placeholder="bunker://…" /><button class="primary-button mt-2" onclick={joinBunker}>Connect bunker</button>{/if}</div></section>
  {:else}
    {@const current = session}
    {@const currentRoom = room}
    <section class="mx-auto flex h-full max-w-4xl flex-col border-x border-[#1e2924] bg-[#101614]" data-revision={revision}>
      <header class="flex shrink-0 items-center justify-between gap-4 border-b border-[#293832] px-4 py-3 sm:px-6"><div class="min-w-0"><p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">Private group</p><h1 class="mt-1 truncate text-lg font-semibold text-white sm:text-xl">{currentRoom.title}</h1></div><div class="flex items-center gap-2"><button class="sound-button" aria-label={soundsEnabled ? "Mute notification sounds" : "Enable notification sounds"} title={soundsEnabled ? "Mute notification sounds" : "Enable notification sounds"} onclick={() => void toggleSounds()}>{soundsEnabled ? "◖))" : "◖×"}</button><span class:offline={current.status.connection === "offline"} class="status">{current.status.connection === "connected" ? "Synced" : current.status.connection === "offline" ? "Offline" : "Syncing"}</span></div></header>
      {#if current.status.detail}<p class="shrink-0 border-b border-[#293832] px-4 py-2 text-xs text-[#91a59a]">{current.status.detail}</p>{/if}
      {#if currentRoom.joinRequestSent}<div class="m-4 border border-[#2e553b] bg-[#112219] p-4 text-sm text-[#b9eac5]">Your encrypted join request is with the host. This page keeps checking for your welcome.</div>{:else}
        <div bind:this={messageList} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6" data-testid="guest-message-list">{#if currentRoom.messages.length === 0}<p class="pt-16 text-center text-sm text-[#82958a]">Say hello — messages are encrypted before they leave your device.</p>{/if}{#each currentRoom.messages as message (message.id)}<article class:mine={message.sender === currentRoom.stablePubkey} class="message"><div class="flex items-baseline gap-2"><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{#if message.pending}<span>sending…</span>{/if}</div><p>{message.content}</p></article>{/each}</div>
        <form class="shrink-0 border-t border-[#293832] bg-[#101614] p-3 sm:p-4" onsubmit={(event) => { event.preventDefault(); void send(); }}><div class="mb-2 flex gap-1 overflow-x-auto pb-1">{#each emojiShortcuts as emoji (emoji)}<button type="button" class="emoji-button" aria-label={`Add ${emoji}`} onclick={() => addEmoji(emoji)}>{emoji}</button>{/each}</div><div class="flex gap-2"><input bind:this={composerInput} bind:value={composer} class="guest-input min-w-0 flex-1" placeholder="Message" /><button class="primary-button px-4 sm:px-5">Send</button></div><p class="mt-2 text-center text-[11px] text-[#73867a]">Stored locally and replayed after the coordinator reconnects.</p></form>
      {/if}
    </section>
  {/if}
</main>

<style>
  .guest-input { width: 100%; border: 1px solid #34433b; background: #0b0e0d; padding: .75rem .9rem; color: #f3fff6; outline: none; }
  .guest-input:focus { border-color: #7cf59d; box-shadow: 0 0 0 2px rgb(124 245 157 / .12); }
  .choice { border: 1px solid #34433b; padding: .7rem .8rem; font-size: .875rem; color: #b9cbbf; background: #0b0e0d; }
  .choice.active, .choice:hover { border-color: #7cf59d; background: #112219; color: #dfffe7; }
  .primary-button { border: 1px solid #7cf59d; background: #7cf59d; padding: .75rem 1rem; color: #0a120d; font-weight: 650; transition: .15s ease; }
  .primary-button:hover { background: #c5ffcf; border-color: #c5ffcf; }
  .primary-button:disabled { cursor: not-allowed; opacity: .5; }
  .secondary-button { border: 1px solid #4a6553; padding: .75rem 1rem; color: #c7ead0; }
  .secondary-button:hover { border-color: #7cf59d; }
  .sound-button { border: 1px solid #34433b; padding: .35rem .45rem; color: #b9cbbf; font-size: .75rem; }
  .sound-button:hover { border-color: #7cf59d; color: #dfffe7; }
  .status { border: 1px solid #2e553b; background: #112219; color: #9bf6b3; padding: .3rem .5rem; font-size: .7rem; font-weight: 650; }
  .status.offline { border-color: #754c27; background: #291b10; color: #ffc17d; }
  .emoji-button { flex: 0 0 auto; border: 1px solid #293832; background: #0b0e0d; padding: .2rem .4rem; font-size: .9rem; line-height: 1; }
  .emoji-button:hover { border-color: #7cf59d; background: #112219; }
  .message { max-width: min(78%, 38rem); border: 1px solid #293832; background: #161e1a; padding: .7rem .85rem; color: #e4f2e7; }
  .message.mine { margin-left: auto; border-color: #2e553b; background: #173323; }
  .message strong { font-size: .78rem; color: #9bf6b3; }
  .message time, .message span { font-size: .7rem; color: #82958a; }
  .message p { margin-top: .2rem; white-space: pre-wrap; word-break: break-word; }
</style>
