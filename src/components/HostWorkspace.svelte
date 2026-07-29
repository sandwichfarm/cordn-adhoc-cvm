<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import type { CoordinatorIdentity } from "../crypto/key-manager";
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";
  import type { ConfigStore } from "../config/config.svelte";
  import { createInviteUrl } from "../chat/invite";
  import { ChatRoomSession, createHostedRoom, signerForStoredRoom, type StoredRoom } from "../chat/room-store";
  import LifecyclePanel from "./LifecyclePanel.svelte";
  import NpubDisplay from "./NpubDisplay.svelte";
  import ResourceMonitor from "./ResourceMonitor.svelte";

  const emojiShortcuts = ["👍", "❤️", "😂", "🎉", "👋", "✨"];

  interface Props {
    coordinator: CoordinatorStore;
    config: ConfigStore;
    identity: CoordinatorIdentity;
    coordinatorPubkey: string;
    relayUrls: string[];
  }

  let { coordinator, config, identity, coordinatorPubkey, relayUrls }: Props = $props();
  let title = $state("");
  let inviteUrl = $state("");
  let qrUrl = $state("");
  let error = $state("");
  let busy = $state(false);
  let autoApprove = $state(true);
  let room = $state<StoredRoom | null>(null);
  let session = $state<ChatRoomSession | null>(null);
  let composer = $state("");
  let revision = $state(0);
  let soundsEnabled = $state(true);
  let messageList: HTMLDivElement | undefined = $state();
  let composerInput: HTMLInputElement | undefined = $state();
  let audioContext: AudioContext | null = null;
  let knownMessageIds = new Set<string>();
  let relayInput = $state("");
  let enablingPersistence = $state(false);
  let passphrase = $state("");
  let confirmPassphrase = $state("");

  const editingAllowed = $derived(config.editMode && !coordinator.locked);
  const lockLabel = $derived(editingAllowed ? "editing" : "locked");

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

  function openHostChat(nextRoom: StoredRoom) {
    const signer = signerForStoredRoom(nextRoom);
    if (!signer) throw new Error("The host chat signer is unavailable");
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
    oscillator.frequency.setValueAtTime(620, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.16);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.17);
  }

  async function createInvite() {
    busy = true;
    error = "";
    void enableSounds();
    try {
      const created = await createHostedRoom({ title, coordinatorPubkey, relayUrls, autoApprove });
      inviteUrl = createInviteUrl(window.location.origin, { groupId: created.id, coordinatorPubkey, relayUrls, title: created.title });
      qrUrl = toSvgDataURL(generate(inviteUrl), { on: "#c8ffdc", off: "#101614", pad: 2, scale: 4 });
      openHostChat(created);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not create invite";
    } finally {
      busy = false;
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
  }

  async function setAutoApprove(enabled: boolean) {
    autoApprove = enabled;
    await session?.setAutoApprove(enabled);
  }

  async function approveWaitingInvitees() {
    try {
      await session?.approveJoinRequests();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not approve invitees";
    }
  }

  function addEmoji(emoji: string) {
    composer += emoji;
    composerInput?.focus();
  }

  function addRelay() {
    if (config.addRelay(relayInput)) relayInput = "";
  }

  function updateMaxUsers(event: Event) {
    config.setMaxUsers((event.currentTarget as HTMLInputElement).valueAsNumber);
  }

  async function savePersistence() {
    const saved = await coordinator.enablePersistence(passphrase, confirmPassphrase);
    if (saved) {
      enablingPersistence = false;
      passphrase = "";
      confirmPassphrase = "";
    }
  }

  async function toggleSounds() {
    if (soundsEnabled) {
      soundsEnabled = false;
      return;
    }
    await enableSounds();
  }

  async function send() {
    if (!session) return;
    void enableSounds();
    const message = composer;
    composer = "";
    await session.send(message);
  }

  onDestroy(() => session?.stop());
  onMount(() => {
    if (config.autostart && coordinator.status === "idle") void coordinator.start();
  });
</script>

<main class="operator-field h-[100dvh] max-h-[100dvh] overflow-x-hidden overflow-y-hidden text-[#dfffe7]">
  <div class="host-workspace relative mx-auto grid h-full min-w-0 max-w-[1600px] grid-rows-[auto_minmax(0,1fr)]" data-testid="operator-shell">
    <header class="host-topbar flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-5">
      <div class="min-w-0"><p class="text-[10px] uppercase tracking-[0.2em] text-[#77917f]">Cordn / coordinator workspace</p><div class="flex items-center gap-3"><h1 class="truncate text-lg font-semibold tracking-tight text-[#effff2] sm:text-xl">Ad-hoc MLS</h1><a class="text-[10px] uppercase tracking-[0.16em] text-[#7cf59d] hover:text-[#dfffe7]" href="https://github.com/sandwichfarm/cordn-adhoc-cvm/" rel="noreferrer" target="_blank">git</a></div></div>
      <div class="flex items-center gap-2"><div class="hidden sm:block"><NpubDisplay {identity} /></div><LifecyclePanel {coordinator} compact /></div>
    </header>

    <div class="host-layout grid min-h-0 min-w-0 grid-rows-[minmax(0,42dvh)_minmax(0,1fr)] lg:grid-cols-[minmax(19rem,25rem)_minmax(0,1fr)] lg:grid-rows-1">
      <aside class="host-rail min-h-0 min-w-0 overflow-y-auto border-b border-[#21352a] p-3 sm:p-4 lg:border-r lg:border-b-0" data-testid="invite-panel">
        {#if coordinator.status !== "running"}
          <div class="space-y-6">
            <div><p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">Coordinator setup</p><h2 class="mt-2 text-xl font-semibold text-white">Ready to host a private room.</h2><p class="mt-2 text-sm leading-5 text-[#91a59a]">Configure the relay and identity once, then use the same workspace for your live room.</p></div>

            <section class="space-y-3"><div class="flex items-center justify-between gap-3"><h3 class="text-xs uppercase tracking-[0.16em] text-[#cfe2d4]">Relay connection</h3><span class="text-[10px] uppercase tracking-[0.14em] text-[#82958a]" data-testid="lock-indicator">{lockLabel}</span></div>{#each config.relays as relay (relay.id)}<div class="flex items-center gap-2 border-b border-[#293832] py-2"><input class="h-4 w-4 accent-[#7cf59d]" type="checkbox" aria-label={`Toggle ${relay.url}`} checked={relay.enabled} disabled={!editingAllowed} onchange={() => config.toggleRelay(relay.id)} /><span class:line-through={!relay.enabled} class="min-w-0 flex-1 truncate text-xs text-[#dfffe7]">{relay.url}</span><button class="text-sm text-[#ffaaa3] disabled:opacity-30" type="button" aria-label={`Remove ${relay.url}`} disabled={!editingAllowed} onclick={() => config.removeRelay(relay.id)}>×</button></div>{/each}<form class="flex gap-2" onsubmit={(event) => { event.preventDefault(); addRelay(); }} aria-label="Add relay"><input class="host-input min-w-0 flex-1 text-xs" type="text" placeholder="wss://relay.example" bind:value={relayInput} disabled={!editingAllowed} /><button class="host-secondary" type="submit" disabled={!editingAllowed}>Add</button></form>{#if config.relayError}<p class="text-xs text-[#ffaaa3]" data-testid="relay-error">{config.relayError}</p>{/if}<div class="flex justify-end">{#if editingAllowed}<button class="host-secondary" type="button" onclick={() => config.exitEdit()}>Lock</button>{:else}<button class="host-secondary" type="button" disabled={coordinator.locked} onclick={() => config.enterEdit()}>Edit configuration</button>{/if}</div></section>

            <section class="space-y-3 border-t border-[#293832] pt-5"><div class="flex items-center justify-between"><h3 class="text-xs uppercase tracking-[0.16em] text-[#cfe2d4]">Runtime options</h3><span class="text-[10px] text-[#82958a]" data-testid="max-users-state">{config.maxUsers} key packages / identity</span></div><label class="flex items-center justify-between gap-4 text-sm text-[#cfe2d4]"><span>Announcement</span><input class="h-4 w-4 accent-[#7cf59d]" type="checkbox" checked={config.announce} disabled={!editingAllowed} aria-label="Toggle announcement" onchange={(event) => config.setAnnouncement(event.currentTarget.checked)} /></label><label class="flex items-center justify-between gap-4 text-sm text-[#cfe2d4]"><span><span class="block">Autostart coordinator</span><span class="mt-1 block text-[10px] text-[#82958a]">Start automatically when this page opens.</span></span><input class="h-4 w-4 accent-[#7cf59d]" type="checkbox" checked={config.autostart} disabled={!editingAllowed} aria-label="Toggle autostart" onchange={(event) => config.setAutostart(event.currentTarget.checked)} /></label><label class="grid gap-2 text-xs text-[#82958a]">Key-package quota<input class="host-input" type="number" min="1" max="256" step="1" value={config.maxUsers} disabled={!editingAllowed} aria-label="Key-package quota" data-testid="max-users-input" onchange={updateMaxUsers} /></label>{#if config.limitError}<p class="text-xs text-[#ffaaa3]" data-testid="limit-error">{config.limitError}</p>{/if}</section>

            <section class="space-y-3 border-t border-[#293832] pt-5"><div class="flex items-center justify-between"><h3 class="text-xs uppercase tracking-[0.16em] text-[#cfe2d4]">Persistent identity</h3><span class="text-[10px] text-[#82958a]" data-testid="persistence-state">{coordinator.persistenceEnabled ? "encrypted" : "off"}</span></div>{#if coordinator.persistenceEnabled}<p class="text-xs leading-5 text-[#91a59a]">Your coordinator identity is encrypted in browser storage.</p><button class="host-secondary" type="button" onclick={() => void coordinator.disablePersistence()}>Remove saved key</button>{:else if enablingPersistence}<form class="grid gap-2" onsubmit={(event) => { event.preventDefault(); void savePersistence(); }}><input class="host-input" type="password" autocomplete="new-password" placeholder="passphrase" bind:value={passphrase} /><input class="host-input" type="password" autocomplete="new-password" placeholder="confirm passphrase" bind:value={confirmPassphrase} />{#if coordinator.persistenceError}<p class="text-xs text-[#ffaaa3]" data-testid="persistence-error">{coordinator.persistenceError}</p>{/if}<div class="flex gap-2"><button class="host-secondary" type="button" onclick={() => { enablingPersistence = false; passphrase = ""; confirmPassphrase = ""; }}>Cancel</button><button class="host-primary" type="submit">Save</button></div></form>{:else}<p class="text-xs leading-5 text-[#91a59a]">Keep this coordinator identity across reloads.</p><button class="host-secondary" type="button" onclick={() => enablingPersistence = true}>Enable persistence</button>{/if}</section>

            <section class="space-y-3 border-t border-[#293832] pt-5" data-testid="debug-panel"><div class="flex items-center justify-between"><h3 class="text-xs uppercase tracking-[0.16em] text-[#cfe2d4]">Activity</h3><button class="text-xs text-[#82958a] hover:text-[#dfffe7]" type="button" onclick={() => coordinator.clearDebugLog()}>Clear</button></div><div class="max-h-32 overflow-y-auto text-[11px]" role="log" aria-label="Cordn debug log">{#if coordinator.debugLog.length === 0}<p class="text-[#82958a]" data-testid="debug-log-empty">No debug events yet</p>{:else}<ol class="space-y-1" data-testid="debug-log-entries">{#each coordinator.debugLog as entry (entry.id)}<li class="text-[#b9cbbf]"><span class="text-[#7cf59d]">{entry.level}</span> {entry.message}</li>{/each}</ol>{/if}</div></section>

          </div>
        {:else if !room}
          <div class="flex min-h-full flex-col justify-between gap-6">
            <div><p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">Open a room</p><h2 class="mt-2 text-xl font-semibold text-white">Invite a small group.</h2><p class="mt-2 text-sm leading-5 text-[#91a59a]">Guests join an encrypted MLS room through a single link or QR code.</p></div>
            <div class="space-y-3"><label class="block text-sm text-[#cfe2d4]">Room name<input bind:value={title} class="host-input mt-2" placeholder="Friday plans" /></label><label class="flex cursor-pointer items-start gap-3 border border-[#293832] bg-[#0b0e0d] p-3 text-sm text-[#b9cbbf]"><input type="checkbox" checked={autoApprove} onchange={(event) => void setAutoApprove((event.currentTarget as HTMLInputElement).checked)} aria-label="Auto-approve invitees" class="mt-0.5 h-4 w-4 accent-[#7cf59d]" /><span><strong class="block font-medium text-[#e8f5eb]">Auto-approve invitees</strong><span class="mt-1 block text-xs text-[#82958a]">Enabled by default. Turn off to admit guests manually.</span></span></label><button class="host-primary w-full" disabled={busy || relayUrls.length === 0} onclick={createInvite}>{busy ? "Creating…" : "Create invite"}</button>{#if relayUrls.length === 0}<p class="text-xs text-[#ffaaa3]">Add an enabled relay before starting a room.</p>{/if}</div>
            <ResourceMonitor compact />
          </div>
        {:else}
          <div class="flex min-h-full flex-col gap-4">
            <div class="flex items-start justify-between gap-3"><div><p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">Room live</p><h2 class="mt-1 break-words text-xl font-semibold text-white">{room.title}</h2></div><button class="sound-button" aria-label={soundsEnabled ? "Mute notification sounds" : "Enable notification sounds"} onclick={() => void toggleSounds()}>{soundsEnabled ? "Sound on" : "Sound off"}</button></div>
            <div class="border-y border-[#293832] py-4"><div class="grid grid-cols-[auto_1fr] gap-3"><a href={inviteUrl} aria-label="Open chat invite" class="bg-[#dfffe7] p-1"><img src={qrUrl} alt="QR code for chat invite" class="h-24 w-24" /></a><div class="min-w-0"><p class="text-sm text-[#dfffe7]">Share the invite</p><p class="mt-1 text-xs leading-5 text-[#82958a]">The link includes this coordinator and its relay hints.</p><button class="host-secondary mt-3" onclick={copy}>Copy link</button></div></div><code class="mt-3 block truncate border border-[#293832] bg-[#090d0b] px-2 py-1 text-[10px] text-[#9bf6b3]" data-testid="invite-link">{inviteUrl}</code></div>
            <label class="flex cursor-pointer items-start gap-3 border border-[#293832] bg-[#0b0e0d] p-3 text-sm text-[#b9cbbf]"><input type="checkbox" checked={autoApprove} onchange={(event) => void setAutoApprove((event.currentTarget as HTMLInputElement).checked)} aria-label="Auto-approve invitees" class="mt-0.5 h-4 w-4 accent-[#7cf59d]" /><span><strong class="block font-medium text-[#e8f5eb]">Auto-approve invitees</strong><span class="mt-1 block text-xs text-[#82958a]">Guests are admitted automatically.</span></span></label>
            {#if !autoApprove}<button class="host-secondary w-full" onclick={approveWaitingInvitees}>Approve waiting invitees</button>{/if}
            {#if error}<p class="text-sm text-[#ffaaa3]">{error}</p>{/if}
            <div class="mt-auto"><ResourceMonitor compact /></div>
          </div>
        {/if}
      </aside>

      <section class="host-chat min-h-0 min-w-0 overflow-hidden bg-[#101614]" data-testid="host-chat" data-revision={revision}>
        {#if room && session}
          {@const current = session}
          <div class="flex h-full min-h-0 flex-col"><header class="flex shrink-0 items-center justify-between gap-3 border-b border-[#293832] px-4 py-3 sm:px-6"><div><p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">Host chat</p><p class="mt-1 text-sm text-[#91a59a]">Keep this page open while guests join.</p></div><span class:offline={current.status.connection === "offline"} class="status">{current.status.connection === "connected" ? "Synced" : current.status.connection === "offline" ? "Offline" : "Syncing"}</span></header>{#if current.status.detail}<p class="shrink-0 border-b border-[#293832] px-4 py-2 text-xs text-[#91a59a]">{current.status.detail}</p>{/if}
            <div bind:this={messageList} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6" data-testid="host-message-list">{#if room.messages.length === 0}<div class="flex h-full items-center justify-center"><p class="max-w-sm text-center text-sm leading-6 text-[#82958a]">Your room is ready. Share the invite from the left and this chat will stay connected to the coordinator.</p></div>{/if}{#each room.messages as message (message.id)}<article class:mine={message.sender === room.stablePubkey} class="host-message"><div class="flex items-baseline gap-2"><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{#if message.pending}<span>sending…</span>{/if}</div><p>{message.content}</p></article>{/each}</div>
            <form class="shrink-0 border-t border-[#293832] p-3 sm:p-4" onsubmit={(event) => { event.preventDefault(); void send(); }}><div class="mb-2 flex gap-1 overflow-x-auto pb-1">{#each emojiShortcuts as emoji (emoji)}<button type="button" class="emoji-button" aria-label={`Add ${emoji}`} onclick={() => addEmoji(emoji)}>{emoji}</button>{/each}</div><div class="flex gap-2"><input bind:this={composerInput} bind:value={composer} class="host-input min-w-0 flex-1" placeholder="Message as host" /><button class="host-primary px-4 sm:px-5">Send</button></div></form>
          </div>
        {:else if coordinator.status !== "running"}
          <div class="flex h-full items-center justify-center p-8"><div class="max-w-md text-center"><p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">One workspace, start to finish</p><h2 class="mt-3 text-2xl font-semibold text-white">Set up your coordinator, then start it here.</h2><p class="mt-3 text-sm leading-6 text-[#91a59a]">The left rail holds relays, runtime settings, durable identity, and activity. Once live, this area becomes your host chat.</p></div></div>
        {:else}
          <div class="flex h-full items-center justify-center p-8"><div class="max-w-sm text-center"><p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">Ready when you are</p><h2 class="mt-3 text-2xl font-semibold text-white">Create a room to start hosting.</h2><p class="mt-3 text-sm leading-6 text-[#91a59a]">The conversation will live here, alongside the coordinator, without a separate host tab.</p></div></div>
        {/if}
      </section>
    </div>

    {#if coordinator.status === "running"}
    <details class="host-log-drawer" data-testid="debug-panel">
      <summary class="flex cursor-pointer items-center justify-between gap-4 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[#b9cbbf] hover:text-[#dfffe7]">
        <span>Logs</span>
        <span class="text-[#7cf59d]">{coordinator.debugLog.length}</span>
      </summary>
      <div class="border-t border-[#293832] bg-[#090d0b]/95 p-3" role="log" aria-label="Cordn debug log">
        {#if coordinator.debugLog.length === 0}
          <p class="text-[11px] text-[#82958a]" data-testid="debug-log-empty">No debug events yet</p>
        {:else}
          <ol class="space-y-1" data-testid="debug-log-entries">
            {#each coordinator.debugLog as entry (entry.id)}
              <li class="break-words text-[11px] text-[#b9cbbf]"><span class="text-[#7cf59d]">{entry.level}</span> {entry.message}</li>
            {/each}
          </ol>
        {/if}
        <button class="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#82958a] hover:text-[#dfffe7]" type="button" onclick={() => coordinator.clearDebugLog()}>Clear logs</button>
      </div>
    </details>
    {/if}
  </div>
</main>

<style>
  .host-workspace { border-inline: 1px solid rgb(33 53 42 / .9); background: rgb(7 12 9 / .8); box-shadow: inset 0 0 0 1px rgb(124 245 157 / .025); }
  .host-log-drawer { position: absolute; left: .75rem; bottom: .75rem; z-index: 20; width: min(28rem, calc(100% - 1.5rem)); border: 1px solid #293832; background: rgb(9 13 11 / .94); box-shadow: 0 12px 32px rgb(0 0 0 / .35); backdrop-filter: blur(10px); pointer-events: none; }
  .host-log-drawer > summary, .host-log-drawer[open] > div { pointer-events: auto; }
  .host-log-drawer[open] { max-height: min(18rem, 42dvh); }
  .host-log-drawer[open] > div { max-height: calc(min(18rem, 42dvh) - 2.5rem); overflow-y: auto; }
  .host-topbar { border-bottom: 1px solid #21352a; background: rgb(10 16 12 / .94); }
  .host-rail { background: #0d1310; }
  .host-input { width: 100%; border: 1px solid #34433b; background: #090d0b; padding: .7rem .8rem; color: #effff2; outline: none; }
  .host-input:focus { border-color: #7cf59d; box-shadow: 0 0 0 2px rgb(124 245 157 / .11); }
  .host-primary { border: 1px solid #7cf59d; background: #7cf59d; padding: .72rem 1rem; color: #08110b; font-weight: 650; }
  .host-primary:hover { border-color: #c5ffcf; background: #c5ffcf; }
  .host-primary:disabled { cursor: not-allowed; opacity: .45; }
  .host-secondary { border: 1px solid #496451; padding: .55rem .7rem; color: #c6eccc; font-size: .75rem; }
  .host-secondary:hover { border-color: #7cf59d; }
  .sound-button { border: 1px solid #34433b; padding: .35rem .5rem; color: #b9cbbf; font-size: .7rem; }
  .sound-button:hover { border-color: #7cf59d; color: #dfffe7; }
  .status { border: 1px solid #2e553b; background: #112219; color: #9bf6b3; padding: .3rem .5rem; font-size: .7rem; font-weight: 650; }
  .status.offline { border-color: #754c27; background: #291b10; color: #ffc17d; }
  .emoji-button { flex: 0 0 auto; border: 1px solid #293832; background: #0b0e0d; padding: .2rem .4rem; font-size: .9rem; line-height: 1; }
  .emoji-button:hover { border-color: #7cf59d; background: #112219; }
  .host-message { max-width: min(78%, 42rem); border: 1px solid #293832; background: #161e1a; padding: .7rem .85rem; color: #e4f2e7; }
  .host-message.mine { margin-left: auto; border-color: #2e553b; background: #173323; }
  .host-message strong { font-size: .78rem; color: #9bf6b3; }
  .host-message time, .host-message span { font-size: .7rem; color: #82958a; }
  .host-message p { margin-top: .2rem; white-space: pre-wrap; word-break: break-word; }
</style>
