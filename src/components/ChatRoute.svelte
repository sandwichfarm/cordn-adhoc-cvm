<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import type { NostrSigner } from "@contextvm/sdk/core";
  import type { ConfigStore } from "../config/config.svelte";
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";
  import { generateSecretKey } from "nostr-tools";
  import { bytesToHex } from "nostr-tools/utils";
  import { parseInviteUrl, type ChatInvite, type RoomHostIdentity } from "../chat/invite";
  import { ChatRoomSession, createJoiningRoom, hostIdentityForRoom, loadRoom, reconcileRoomHostIdentity, removeStoredRoom, saveRoom, signerForStoredRoom, type StoredRoom } from "../chat/room-store";
  import { BrowserNostrSigner } from "../crypto/browser-nostr-signer";
  import { userProfileStore } from "../identity/user-profile.svelte";
  import InviteInbox from "./InviteInbox.svelte";
  import MessageAuthor from "./MessageAuthor.svelte";
  import NotificationCenter from "./NotificationCenter.svelte";
  import PresenceControl from "./PresenceControl.svelte";
  import RoomHostBadge from "./RoomHostBadge.svelte";
  import RoomRemovalDialog from "./RoomRemovalDialog.svelte";
  import UserProfile from "./UserProfile.svelte";
  import WorkspaceNav from "./WorkspaceNav.svelte";

  interface Props {
    currentUrl: string;
    homeCoordinatorPubkey?: string;
    homeCoordinatorName?: string;
    anonymousPubkey?: string;
    anonymousName?: string;
    onAnonymousNameChange?: (name: string) => void;
    coordinatorStatus?: string;
    config: ConfigStore;
    coordinator: CoordinatorStore;
    coordinatorPubkey: string;
    relayUrls: string[];
    onNavigate: (href: string) => void;
  }

  const emojiShortcuts = ["👍", "❤️", "😂", "🎉", "👋", "✨"];

  let {
    currentUrl,
    homeCoordinatorPubkey,
    homeCoordinatorName = "My coordinator",
    anonymousPubkey = "",
    anonymousName = "",
    onAnonymousNameChange,
    coordinatorStatus = "idle",
    config,
    coordinator,
    coordinatorPubkey,
    relayUrls,
    onNavigate,
  }: Props = $props();
  let invite = $state<ChatInvite | null>(null);
  let room = $state<StoredRoom | null>(null);
  let session = $state<ChatRoomSession | null>(null);
  let revision = $state(0);
  let connection = $state<"cached" | "connecting" | "connected" | "offline">("cached");
  let connectionDetail = $state<string | undefined>();
  let name = $state("");
  let composer = $state("");
  let composerError = $state("");
  let error = $state("");
  let joining = $state(false);
  let signerConnecting = $state(false);
  let signerMode = $state<"anonymous" | "extension" | "remote">("anonymous");
  let bunkerUri = $state("");
  let remoteUri = $state("");
  let remoteQr = $state("");
  let soundsEnabled = $state(true);
  let messageList: HTMLDivElement | undefined = $state();
  let composerInput: HTMLInputElement | undefined = $state();
  let audioContext: AudioContext | null = null;
  let knownMessageIds = new Set<string>();
  let unsubscribeSession: (() => void) | null = null;
  let pendingRemoteSigner: ReturnType<typeof userProfileStore.createNip46Request>["signer"] | null = null;
  let disposed = false;
  let followLatest = true;
  let roomRemovalTarget = $state<StoredRoom | null>(null);
  let mobileActionsOpen = $state(false);
  let emojiOpen = $state(false);
  let mobileActionsButton: HTMLButtonElement | undefined = $state();
  let mobileActionsClose: HTMLButtonElement | undefined = $state();
  let mobileActionsPanel: HTMLDivElement | undefined = $state();
  const roomDeletedByHost = $derived(connection === "offline" && connectionDetail?.toLowerCase().includes("room deleted by host") === true);
  const displayedConnection = $derived(room ? (roomDeletedByHost ? "deleted" : connection) : null);
  const activeRoomHost = $derived(room
    ? hostIdentityForRoom(room)
    : invite
      ? hostIdentityForInvite(invite)
      : null
  );

  function hostIdentityForInvite(nextInvite: ChatInvite): RoomHostIdentity {
    const host = nextInvite.host ?? { name: "Unknown host", pubkey: "" };
    // Avoid a cross-origin image request merely from opening an invite.
    return { ...host, avatar: undefined };
  }

  function mergeFreshInviteHost(stored: StoredRoom, nextInvite: ChatInvite): StoredRoom {
    if (!nextInvite.host) return stored;
    const currentHost = hostIdentityForRoom(stored);
    const nextHost = stored.joinRequestSent
      ? nextInvite.host
      : reconcileRoomHostIdentity(nextInvite.host, currentHost.pubkey || null);
    // Once admitted, ignore an invite that claims a different creator instead
    // of replacing already verified presentation with untrusted metadata.
    if (!stored.joinRequestSent && nextHost.name === "Unknown host" && currentHost.name !== "Unknown host") return stored;
    if (stored.host?.name === nextHost.name
      && stored.host.pubkey === nextHost.pubkey
      && stored.host.avatar === nextHost.avatar) return stored;
    const refreshed = { ...stored, host: nextHost };
    saveRoom(refreshed);
    return refreshed;
  }

  function update() {
    if (session) {
      const wasConnected = connection === "connected";
      connection = session.status.connection;
      connectionDetail = session.status.detail;
      const nextRoom = { ...session.room, messages: [...session.room.messages], pending: [...session.room.pending] };
      const appendedMessage = nextRoom.messages.some((message) => !knownMessageIds.has(message.id));
      const receivedMessage = nextRoom.messages.some((message) => !knownMessageIds.has(message.id) && message.sender !== nextRoom.stablePubkey);
      knownMessageIds = new Set(nextRoom.messages.map((message) => message.id));
      room = nextRoom;
      if (receivedMessage && wasConnected) playIncomingTone();
      if (appendedMessage && followLatest) {
        void tick().then(() => {
          if (messageList) messageList.scrollTop = messageList.scrollHeight;
        });
      }
    }
    revision += 1;
  }

  function attach(nextRoom: StoredRoom, signer: NostrSigner) {
    if (disposed) return;
    unsubscribeSession?.();
    session?.stop();
    knownMessageIds = new Set(nextRoom.messages.map((message) => message.id));
    followLatest = true;
    room = nextRoom;
    session = new ChatRoomSession(nextRoom, signer);
    connection = session.status.connection;
    connectionDetail = session.status.detail;
    unsubscribeSession = session.subscribe(update);
    void session.start();
    update();
    void tick().then(() => {
      if (messageList) messageList.scrollTop = messageList.scrollHeight;
    });
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
    if (!canSendMessages()) return;
    composer += emoji;
    emojiOpen = false;
    composerInput?.focus();
  }

  function connectionLabel(status: "cached" | "connecting" | "connected" | "offline" | "deleted"): string {
    if (status === "connected") return "Room synced";
    if (status === "deleted") return "Room deleted";
    if (status === "offline") return "Room offline";
    if (status === "cached") return "Room cached";
    return "Room connecting";
  }

  async function toggleMobileActions(): Promise<void> {
    mobileActionsOpen = !mobileActionsOpen;
    emojiOpen = false;
    if (mobileActionsOpen) {
      await tick();
      mobileActionsClose?.focus();
    }
  }

  function closeMobileActions(returnFocus = false): void {
    mobileActionsOpen = false;
    if (returnFocus) void tick().then(() => mobileActionsButton?.focus());
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      if (mobileActionsOpen) {
        event.preventDefault();
        closeMobileActions(true);
      } else {
        emojiOpen = false;
      }
      return;
    }
    if (event.key !== "Tab" || !mobileActionsOpen || !mobileActionsPanel) return;
    const focusable = Array.from(mobileActionsPanel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleWindowResize(): void {
    if (window.innerWidth > 900) mobileActionsOpen = false;
  }

  function navigate(href: string): void {
    closeMobileActions();
    onNavigate(href);
  }

  function updateFollowLatest(): void {
    if (!messageList) return;
    followLatest = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 80;
  }

  function canSendMessages(): boolean {
    return session?.status.connection === "connected" && room?.joinRequestSent !== true;
  }

  async function toggleSounds() {
    if (soundsEnabled) {
      soundsEnabled = false;
      return;
    }
    await enableSounds();
  }

  async function removeCurrentRoom(): Promise<void> {
    const target = roomRemovalTarget;
    if (!target) return;
    if (target.isHost) {
      if (!coordinatorPubkey || target.coordinatorPubkey !== coordinatorPubkey) {
        throw new Error("Open the coordinator that hosts this room before deleting it");
      }
      await coordinator.deleteHostedRoom(target.id);
    }
    unsubscribeSession?.();
    unsubscribeSession = null;
    session?.discard();
    session = null;
    removeStoredRoom(target);
    room = null;
    navigate(target.isHost ? "/" : "/chats");
  }

  onMount(() => {
    disposed = false;
    invite = parseInviteUrl(currentUrl);
    if (!invite) return;
    const loaded = loadRoom(invite.groupId, invite.coordinatorPubkey);
    const stored = loaded ? mergeFreshInviteHost(loaded, invite) : null;
    const signer = stored ? signerForStoredRoom(stored) : null;
    if (stored && signer) attach(stored, signer);
    else if (stored) {
      room = stored;
      const activeSigner = userProfileStore.activeSigner;
      if (activeSigner) void resumeActiveSigner(stored, activeSigner);
    }
    else if (new URL(currentUrl).searchParams.get("autojoin") === "1") {
      name = userProfileStore.displayName;
      const activeSigner = userProfileStore.activeSigner;
      if (activeSigner) void join(activeSigner);
      else void joinAnonymous();
    }
  });
  onDestroy(() => {
    disposed = true;
    if (pendingRemoteSigner) userProfileStore.cancelNip46Request(pendingRemoteSigner);
    pendingRemoteSigner = null;
    unsubscribeSession?.();
    session?.stop();
  });

  async function join(signer: NostrSigner, anonymousSecretKey: string | undefined = undefined) {
    if (!invite || disposed) return;
    joining = true;
    error = "";
    try {
      const created = await createJoiningRoom({
        invite,
        name,
        signer,
        anonymousSecretKey,
        avatar: userProfileStore.avatarUrl,
      });
      if (disposed) return;
      attach(created, signer);
    } catch (cause) {
      if (!disposed) error = cause instanceof Error ? cause.message : "Unable to join this chat";
    } finally {
      if (!disposed) joining = false;
    }
  }

  async function joinAnonymous() {
    if (signerConnecting || joining) return;
    signerConnecting = true;
    void enableSounds();
    try {
      const secret = generateSecretKey();
      const signer = new BrowserNostrSigner(secret);
      userProfileStore.setAnonymous(await signer.getPublicKey(), name);
      if (!disposed) await join(signer, bytesToHex(secret));
    } finally {
      if (!disposed) signerConnecting = false;
    }
  }

  async function joinExtension() {
    if (signerConnecting || joining) return;
    void enableSounds();
    signerConnecting = true;
    try {
      const signer = await userProfileStore.connectNip07();
      if (disposed) return;
      if (!name.trim() && userProfileStore.displayName !== "anon") name = userProfileStore.displayName;
      if (room && !session) await resume(signer);
      else await join(signer);
    } catch (cause) {
      if (!disposed) error = cause instanceof Error ? cause.message : "Could not connect browser signer";
    } finally {
      if (!disposed) signerConnecting = false;
    }
  }

  async function beginRemote() {
    if (!invite || joining || signerConnecting) return;
    void enableSounds();
    error = "";
    const { signer: remote, uri } = userProfileStore.createNip46Request(invite.relayUrls);
    pendingRemoteSigner = remote;
    remoteUri = uri;
    remoteQr = toSvgDataURL(generate(remoteUri), { on: "#c8ffdc", off: "#101614", pad: 2, scale: 4 });
    joining = true;
    try {
      await remote.waitForSigner();
      if (disposed || pendingRemoteSigner !== remote) return;
      const signer = await userProfileStore.adoptNip46(remote);
      if (disposed || pendingRemoteSigner !== remote) return;
      if (!name.trim() && userProfileStore.displayName !== "anon") name = userProfileStore.displayName;
      if (room && !session) await resume(signer);
      else await join(signer);
    } catch (cause) {
      if (!disposed) error = cause instanceof Error ? cause.message : "Remote signer did not connect";
    } finally {
      if (pendingRemoteSigner === remote) pendingRemoteSigner = null;
      if (!disposed) joining = false;
    }
  }

  async function joinBunker() {
    if (signerConnecting || joining) return;
    void enableSounds();
    signerConnecting = true;
    try {
      const signer = await userProfileStore.connectNip46(bunkerUri.trim());
      if (disposed) return;
      if (!name.trim() && userProfileStore.displayName !== "anon") name = userProfileStore.displayName;
      if (room && !session) await resume(signer);
      else await join(signer);
    } catch (cause) {
      if (!disposed) error = cause instanceof Error ? cause.message : "Could not connect bunker";
    } finally {
      if (!disposed) signerConnecting = false;
    }
  }

  async function send() {
    if (!session || !canSendMessages()) return;
    const next = composer;
    if (!next.trim()) return;
    void enableSounds();
    composerError = "";
    session.setIdentity({
      name: userProfileStore.displayName,
      avatar: userProfileStore.avatarUrl,
    });
    composer = "";
    try {
      await session.send(next);
    } catch (cause) {
      if (!composer.trim()) composer = next;
      composerError = cause instanceof Error ? cause.message : "Unable to send this message";
    }
  }

  async function resume(signer: NostrSigner) {
    if (!room) return;
    const expectedRoom = room;
    const signerPubkey = await signer.getPublicKey();
    if (disposed || room.id !== expectedRoom.id || room.coordinatorPubkey !== expectedRoom.coordinatorPubkey) return;
    if (signerPubkey !== expectedRoom.stablePubkey) {
      throw new Error("This signer does not match the identity that joined this room");
    }
    attach(expectedRoom, signer);
  }

  async function resumeActiveSigner(expectedRoom: StoredRoom, signer: NostrSigner) {
    try {
      const signerPubkey = await signer.getPublicKey();
      if (disposed || signerPubkey !== expectedRoom.stablePubkey) return;
      if (room?.id !== expectedRoom.id || room.coordinatorPubkey !== expectedRoom.coordinatorPubkey) return;
      attach(expectedRoom, signer);
    } catch {
      // The cached room remains readable when the active signer is unavailable.
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} onresize={handleWindowResize} />

<main class="chat-page flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#0b0e0d] text-[#e8f5eb]" data-testid="chat-route">
  <header class="chat-global-nav flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-5">
    <div class="chat-workspace-nav">
      <WorkspaceNav
        {currentUrl}
        {homeCoordinatorPubkey}
        {homeCoordinatorName}
        {coordinatorStatus}
        {soundsEnabled}
        activeRoomHost={activeRoomHost ?? undefined}
        roomConnectionStatus={room ? (roomDeletedByHost ? "deleted" : connection) : undefined}
        onToggleSounds={room ? toggleSounds : undefined}
        roomActionKind={room?.isHost ? "delete" : "leave"}
        roomActionLabel={room ? `${room.isHost ? "Delete" : "Leave"} room ${room.title}` : undefined}
        onRoomAction={room ? () => roomRemovalTarget = room : undefined}
        onNavigate={navigate}
      />
    </div>
    <div class="mobile-primary-actions" aria-label="Current room controls">
      {#if displayedConnection}
        <span
          class:offline={displayedConnection === "offline"}
          class:deleted={displayedConnection === "deleted"}
          class:cached={displayedConnection === "cached"}
          class:connecting={displayedConnection === "connecting"}
          class="mobile-connection"
          role="status"
          aria-label={connectionLabel(displayedConnection)}
          title={connectionLabel(displayedConnection)}
        ><span aria-hidden="true"></span></span>
        <button
          class:enabled={soundsEnabled}
          class="mobile-sound-toggle"
          type="button"
          aria-label={soundsEnabled ? "Mute sounds" : "Enable sounds"}
          aria-pressed={soundsEnabled}
          title={soundsEnabled ? "Notification sounds on" : "Notification sounds off"}
          onclick={() => void toggleSounds()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h3.3L12 5.2v13.6L7.3 15H4z"></path>
            {#if soundsEnabled}<path d="M15.5 9.1a4 4 0 0 1 0 5.8M18 6.7a7.4 7.4 0 0 1 0 10.6"></path>{:else}<path d="m16 9 5 6m0-6-5 6"></path>{/if}
          </svg>
        </button>
      {/if}
      <button
        bind:this={mobileActionsButton}
        class="mobile-actions-trigger"
        type="button"
        aria-label="More chat actions"
        aria-haspopup="dialog"
        aria-controls="mobile-chat-actions"
        aria-expanded={mobileActionsOpen}
        onclick={() => void toggleMobileActions()}
      ><span aria-hidden="true">•••</span></button>
    </div>
    {#if mobileActionsOpen}
      <button class="mobile-actions-backdrop" type="button" aria-label="Close chat actions" onclick={() => closeMobileActions(true)}></button>
    {/if}
    <div
      bind:this={mobileActionsPanel}
      id="mobile-chat-actions"
      class:open={mobileActionsOpen}
      class:has-presence={coordinator.loadState === "ready"}
      class="chat-global-actions"
      role={mobileActionsOpen ? "dialog" : undefined}
      aria-modal={mobileActionsOpen ? "true" : undefined}
      aria-label={mobileActionsOpen ? "More chat actions" : undefined}
    >
      <div class="mobile-sheet-heading">
        <div><strong>Chat actions</strong><span>{room ? `# ${room.title}` : "Workspace"}</span></div>
        <button bind:this={mobileActionsClose} type="button" aria-label="Close chat actions" onclick={() => closeMobileActions(true)}>×</button>
      </div>
      {#if room}
        <button class:delete={room.isHost} class="mobile-room-action" type="button" onclick={() => { closeMobileActions(); roomRemovalTarget = room; }}>
          <span>{room.isHost ? "Delete this room" : "Leave this room"}</span><span aria-hidden="true">→</span>
        </button>
      {/if}
      {#if coordinator.loadState === "ready"}
        <div class="mobile-action-item"><span class="mobile-action-label">Presence</span><PresenceControl {config} {coordinator} {coordinatorPubkey} {relayUrls} /></div>
      {/if}
      <div class="mobile-action-item"><span class="mobile-action-label">Invites</span><InviteInbox onNavigate={navigate} /></div>
      <div class="mobile-action-item"><span class="mobile-action-label">Notifications</span><NotificationCenter /></div>
      <div class="mobile-action-item"><span class="mobile-action-label">Profile & signer</span><UserProfile {anonymousPubkey} {anonymousName} {onAnonymousNameChange} /></div>
    </div>
  </header>
  {#if !invite}
    <section class="flex min-h-0 flex-1 items-center justify-center p-5"><div class="max-w-sm border border-[#293832] bg-[#101614] p-6 text-sm text-[#a2b4a7]">This chat invite is incomplete or malformed.</div></section>
  {:else if !room}
    <section class="mx-auto flex min-h-0 w-full max-w-xl flex-1 items-center overflow-y-auto p-4 sm:p-8"><div class="w-full border border-[#293832] bg-[#101614] p-5 shadow-2xl sm:p-8">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#7cf59d]">Cordn private chat</p>
      <h1 class="mt-3 text-3xl font-semibold tracking-tight text-white">{invite.title || "You’re invited"}</h1>
      <p class="mt-2 leading-6 text-[#a2b4a7]">Choose a name, then join the encrypted room. This invite connects only to its host coordinator.</p>
      <div class="invite-host" data-testid="invite-host">
        <span>Invited by</span>
        <RoomHostBadge host={activeRoomHost || hostIdentityForInvite(invite)} showRole={false} allowExternalAvatar={false} />
      </div>
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
          <div class="mt-3 flex flex-col gap-2 sm:flex-row"><input bind:value={bunkerUri} class="guest-input min-w-0 flex-1" placeholder="bunker://…" /><button class="secondary-button" disabled={joining || signerConnecting} onclick={joinBunker}>Connect bunker</button></div>
          {#if remoteUri}<a href={remoteUri} class="mt-4 flex w-fit flex-col items-center border border-[#293832] bg-[#101614] p-3 text-xs text-[#bff6cc]"><img src={remoteQr} alt="QR code to connect remote signer" class="h-40 w-40" />Tap on mobile to open a signer</a>{/if}
        </div>
      {/if}
      {#if error}<p class="mt-4 text-sm text-[#ffaaa3]">{error}</p>{/if}
      <button class="primary-button mt-6 w-full" disabled={joining || signerConnecting} onclick={signerMode === "anonymous" ? joinAnonymous : signerMode === "extension" ? joinExtension : beginRemote}>{joining || signerConnecting ? "Connecting…" : signerMode === "remote" ? "Connect signer" : "Join chat"}</button>
    </div></section>
  {:else}
    {@const currentRoom = room}
    {@const composerEnabled = connection === "connected" && !currentRoom.joinRequestSent}
    <section class="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col border-x border-[#1e2924] bg-[#101614]" data-revision={revision} data-testid="cached-room-view">
      <h1 class="sr-only">{currentRoom.title}</h1>
      {#if roomDeletedByHost}
        <p class="connection-banner deleted" role="status" aria-live="polite" data-testid="room-deleted-message">This room was deleted by its host. Cached messages remain on this device until you leave.</p>
      {:else if connection === "offline"}
        <p class="connection-banner offline" role="status" aria-live="polite" data-testid="room-connection-offline-message">Room connection offline. You can read cached messages, but sending is unavailable until this room reconnects.</p>
      {:else if connection === "connecting"}
        <p class="connection-banner" role="status" aria-live="polite">Connecting to the coordinator… Cached messages are available.</p>
      {:else if connectionDetail && !currentRoom.joinRequestSent}
        <p class="connection-banner" role="status">{connectionDetail}</p>
      {/if}
      {#if !session}
        <div class="reconnect-panel" data-testid="reconnect-signer">
          <div><strong>Cached conversation</strong><span>Reconnect the signer that joined this room to sync and send. The messages below remain readable.</span></div>
          <div class="reconnect-actions"><button class="secondary-button" type="button" disabled={joining || signerConnecting} onclick={joinExtension}>Use NIP-07</button><button class="secondary-button" type="button" disabled={joining || signerConnecting} onclick={() => signerMode = "remote"}>Use NIP-46</button></div>
          {#if signerMode === "remote"}
            <div class="reconnect-remote"><input bind:value={bunkerUri} class="guest-input" placeholder="bunker://…" /><button class="secondary-button" type="button" disabled={joining || signerConnecting} onclick={joinBunker}>Connect bunker</button><button class="secondary-button" type="button" disabled={joining || signerConnecting} onclick={beginRemote}>{joining ? "Waiting…" : "Show QR"}</button></div>
            {#if remoteUri}<a href={remoteUri} class="remote-resume-qr"><img src={remoteQr} alt="QR code to reconnect remote signer" />Open in a signer</a>{/if}
          {/if}
          {#if error}<p class="text-sm text-[#ffaaa3]">{error}</p>{/if}
        </div>
      {/if}
      {#if currentRoom.joinRequestSent}<div class="m-4 border border-[#2e553b] bg-[#112219] p-4 text-sm text-[#b9eac5]">Your encrypted join request is with the host. This page keeps checking for your welcome.</div>{:else}
        <div bind:this={messageList} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6" role="log" aria-live="polite" aria-relevant="additions" data-testid="guest-message-list" onscroll={updateFollowLatest}>{#if currentRoom.messages.length === 0}<p class="pt-16 text-center text-sm text-[#82958a]">Say hello — messages are encrypted before they leave your device.</p>{/if}{#each currentRoom.messages as message (message.id)}<article class:mine={message.sender === currentRoom.stablePubkey} class="message"><MessageAuthor sender={message.sender} name={message.name} avatar={message.avatar} badgeLabel={message.badgeLabel} badgeEmoji={message.badgeEmoji} createdAt={message.createdAt} pending={message.pending} /><p>{message.content}</p></article>{/each}</div>
        <form class="chat-composer shrink-0 border-t border-[#293832] bg-[#101614] p-3 sm:p-4" data-testid="chat-composer" onsubmit={(event) => { event.preventDefault(); void send(); }}>
          <div id="chat-emoji-shortcuts" class:open={emojiOpen} class="emoji-shortcuts">{#each emojiShortcuts as emoji (emoji)}<button type="button" class="emoji-button" aria-label={`Add ${emoji}`} disabled={!composerEnabled} onclick={() => addEmoji(emoji)}>{emoji}</button>{/each}</div>
          <div class="composer-row">
            <button class="emoji-toggle" type="button" aria-label="Add emoji" aria-controls="chat-emoji-shortcuts" aria-expanded={emojiOpen} disabled={!composerEnabled} onclick={() => emojiOpen = !emojiOpen}>☺</button>
            <input bind:this={composerInput} bind:value={composer} class="guest-input min-w-0 flex-1" aria-describedby="chat-composer-status" disabled={!composerEnabled} placeholder={roomDeletedByHost ? "Room deleted by host" : connection === "offline" ? "Room offline" : connection === "cached" ? "Reconnect your signer" : connection === "connecting" ? "Connecting…" : "Message"} />
            <button class="primary-button px-4 sm:px-5" disabled={!composerEnabled || !composer.trim()}>Send</button>
          </div>
          <p id="chat-composer-status" class:unavailable={!composerEnabled} class="composer-status" aria-live="polite" data-testid="chat-composer-status">{roomDeletedByHost ? "This room is closed — cached messages are read-only." : connection === "offline" ? "This room is offline — cached messages are read-only." : connection === "cached" ? "Reconnect your signer to sync this room and send messages." : connection === "connecting" ? "Connecting this room…" : "Connected. Messages are end-to-end encrypted."}</p>
          {#if composerError}<p class="mt-2 text-center text-xs text-[#ffaaa3]">{composerError}</p>{/if}
        </form>
      {/if}
    </section>
  {/if}

  {#if roomRemovalTarget}
    <RoomRemovalDialog
      mode={roomRemovalTarget.isHost ? "delete" : "leave"}
      roomTitle={roomRemovalTarget.title}
      messageCount={roomRemovalTarget.messages.length}
      pendingInviteCount={roomRemovalTarget.isHost ? session?.pendingJoinRequests.length ?? 0 : 0}
      joinRequestPending={!roomRemovalTarget.isHost && roomRemovalTarget.joinRequestSent === true}
      onConfirm={removeCurrentRoom}
      onClose={() => roomRemovalTarget = null}
    />
  {/if}
</main>

<style>
  .chat-global-nav { min-width: 0; border-bottom: 1px solid #21352a; background: rgb(10 16 12 / .96); }
  .chat-workspace-nav { min-width: 0; flex: 1 1 auto; }
  .chat-global-actions { display: flex; min-width: 0; flex: 0 0 auto; align-items: center; gap: .5rem; }
  .mobile-primary-actions, .mobile-sheet-heading, .mobile-room-action, .mobile-actions-backdrop, .mobile-action-label { display: none; }
  .mobile-action-item { display: contents; }
  .guest-input { width: 100%; border: 1px solid #34433b; background: #0b0e0d; padding: .75rem .9rem; color: #f3fff6; outline: none; }
  .guest-input:focus { border-color: #7cf59d; box-shadow: 0 0 0 2px rgb(124 245 157 / .12); }
  .guest-input:disabled { cursor: not-allowed; border-color: #26322c; color: #64766b; opacity: .72; }
  .invite-host { display: flex; min-width: 0; align-items: center; gap: .7rem; margin-top: .9rem; color: #718277; }
  .invite-host > span { flex: 0 0 auto; font-size: .55rem; font-weight: 720; letter-spacing: .12em; text-transform: uppercase; }
  .choice { border: 1px solid #34433b; padding: .7rem .8rem; font-size: .875rem; color: #b9cbbf; background: #0b0e0d; }
  .choice.active, .choice:hover { border-color: #7cf59d; background: #112219; color: #dfffe7; }
  .primary-button { border: 1px solid #7cf59d; background: #7cf59d; padding: .75rem 1rem; color: #0a120d; font-weight: 650; transition: .15s ease; }
  .primary-button:hover { background: #c5ffcf; border-color: #c5ffcf; }
  .primary-button:disabled { cursor: not-allowed; opacity: .5; }
  .secondary-button { border: 1px solid #4a6553; padding: .75rem 1rem; color: #c7ead0; }
  .secondary-button:hover { border-color: #7cf59d; }
  .connection-banner { flex: 0 0 auto; border-bottom: 1px solid #293832; background: #111814; padding: .65rem 1rem; color: #a9bbb0; font-size: .7rem; line-height: 1.5; }
  .connection-banner.offline { border-bottom-color: #604326; background: #21170f; color: #ffc17d; }
  .connection-banner.deleted { border-bottom-color: #6f3633; background: #21100f; color: #ffaaa3; }
  .reconnect-panel { display: grid; flex: 0 0 auto; gap: .7rem; border-bottom: 1px solid #35443c; background: #0c120f; padding: .85rem 1rem; }
  .reconnect-panel strong, .reconnect-panel span { display: block; }
  .reconnect-panel strong { color: #dfffe7; font-size: .75rem; }
  .reconnect-panel span { margin-top: .25rem; color: #82958a; font-size: .65rem; line-height: 1.45; }
  .reconnect-actions { display: flex; flex-wrap: wrap; gap: .45rem; }
  .reconnect-remote { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: .45rem; }
  .remote-resume-qr { display: flex; width: fit-content; flex-direction: column; gap: .35rem; border: 1px solid #293832; padding: .5rem; color: #bff6cc; font-size: .62rem; }
  .remote-resume-qr img { width: 8rem; height: 8rem; }
  .composer-status { margin-top: .5rem; color: #7ca087; text-align: center; font-size: .65rem; }
  .composer-status.unavailable { color: #a98b69; }
  .chat-composer { position: relative; }
  .composer-row, .emoji-shortcuts { display: flex; gap: .5rem; }
  .emoji-shortcuts { margin-bottom: .5rem; gap: .25rem; overflow-x: auto; padding-bottom: .25rem; }
  .emoji-toggle { display: none; }
  .emoji-button { flex: 0 0 auto; border: 1px solid #293832; background: #0b0e0d; padding: .2rem .4rem; font-size: .9rem; line-height: 1; }
  .emoji-button:hover { border-color: #7cf59d; background: #112219; }
  .emoji-button:disabled { cursor: not-allowed; opacity: .28; }
  .message { max-width: min(78%, 38rem); border: 1px solid #293832; background: #161e1a; padding: .7rem .85rem; color: #e4f2e7; }
  .message.mine { margin-left: auto; border-color: #2e553b; background: #173323; }
  .message p { margin-top: .48rem; white-space: pre-wrap; word-break: break-word; }

  @media (max-width: 900px) {
    .chat-page { position: fixed; inset: 0; width: 100%; height: 100dvh; max-height: 100dvh; overscroll-behavior: none; }
    .chat-global-nav { position: relative; z-index: 60; display: flex; min-height: 3.25rem; align-items: center; gap: .35rem; padding: max(.35rem, env(safe-area-inset-top)) .45rem .35rem; }
    .chat-workspace-nav { min-width: 0; overflow: visible; }
    .chat-workspace-nav, .chat-workspace-nav :global(.workspace-nav) { width: 100%; }
    .chat-workspace-nav :global(.workspace-nav) { gap: .35rem; }
    .chat-workspace-nav :global(.active-context) { flex: 1 1 auto; overflow: hidden; }
    .chat-workspace-nav :global(.context-copy) { min-width: 0; overflow: hidden; }
    .chat-workspace-nav :global(.context-copy strong) { max-width: none; }
    .chat-workspace-nav :global(.room-utilities), .chat-workspace-nav :global(.remote-badge) { display: none; }
    .chat-workspace-nav :global(.browse-button) { min-width: 2.15rem; height: 2.25rem; justify-content: center; padding: .35rem; }
    .chat-workspace-nav :global(.browse-label) { display: none; }
    .mobile-primary-actions { display: flex; flex: 0 0 auto; align-items: center; gap: .15rem; }
    .mobile-primary-actions > * { width: 2.25rem; height: 2.25rem; flex: 0 0 auto; }
    .mobile-connection { display: grid; place-items: center; border: 1px solid transparent; }
    .mobile-connection > span { width: .5rem; height: .5rem; border-radius: 999px; background: #7cf59d; box-shadow: 0 0 7px rgb(124 245 157 / .3); }
    .mobile-connection.offline > span { background: #f4a85f; box-shadow: 0 0 7px rgb(244 168 95 / .22); }
    .mobile-connection.deleted > span { border-radius: 1px; background: #dc6f66; box-shadow: none; }
    .mobile-connection.cached > span { background: #718277; box-shadow: none; }
    .mobile-connection.connecting > span { background: #e4e78d; animation: mobile-connection-pulse 1.4s ease-in-out infinite; }
    .mobile-sound-toggle, .mobile-actions-trigger { display: grid; place-items: center; border: 1px solid transparent; color: #718277; }
    .mobile-sound-toggle:hover, .mobile-sound-toggle:focus-visible, .mobile-actions-trigger:hover, .mobile-actions-trigger:focus-visible, .mobile-actions-trigger[aria-expanded="true"] { border-color: #34483a; background: #111a14; color: #dfffe7; outline: none; }
    .mobile-sound-toggle.enabled { color: #9bcfa7; }
    .mobile-sound-toggle svg { width: 1rem; height: 1rem; overflow: visible; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
    .mobile-sound-toggle svg path:first-child { fill: currentColor; stroke: none; }
    .mobile-actions-trigger { color: #9aada1; font-size: .7rem; font-weight: 800; letter-spacing: .05em; }
    .mobile-actions-backdrop { position: fixed; z-index: 89; inset: 0; display: block; border: 0; background: rgb(0 0 0 / .56); cursor: default; backdrop-filter: blur(2px); }
    .chat-global-actions { position: fixed; z-index: 90; top: calc(max(.35rem, env(safe-area-inset-top)) + 2.9rem); right: 0; bottom: 0; display: none; width: min(22rem, 100vw); max-height: calc(100dvh - 3.25rem); align-content: start; align-items: stretch; gap: .35rem; overflow-y: auto; border-left: 1px solid #496451; background: rgb(7 12 9 / .99); padding: .65rem .65rem max(.65rem, env(safe-area-inset-bottom)); box-shadow: -18px 24px 64px rgb(0 0 0 / .62); overscroll-behavior: contain; }
    .chat-global-actions.open { display: grid; }
    .mobile-sheet-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #293832; padding: .25rem .2rem .7rem; }
    .mobile-sheet-heading strong, .mobile-sheet-heading span { display: block; }
    .mobile-sheet-heading strong { color: #effff2; font-size: .78rem; }
    .mobile-sheet-heading span { max-width: 15rem; overflow: hidden; margin-top: .2rem; color: #718277; font-size: .58rem; text-overflow: ellipsis; white-space: nowrap; }
    .mobile-sheet-heading button { display: grid; width: 2rem; height: 2rem; place-items: center; color: #91a59a; font-size: 1.1rem; }
    .mobile-sheet-heading button:hover, .mobile-sheet-heading button:focus-visible { background: #162019; color: #effff2; outline: none; }
    .mobile-room-action { display: flex; align-items: center; justify-content: space-between; border: 1px solid #58443b; background: #17110e; padding: .75rem; color: #efb18a; font-size: .68rem; }
    .mobile-room-action.delete { border-color: #593735; color: #ffaaa3; }
    .mobile-room-action:hover, .mobile-room-action:focus-visible { border-color: currentColor; outline: none; }
    .mobile-action-item { display: flex; min-height: 3.25rem; align-items: center; justify-content: space-between; gap: .75rem; border: 1px solid #202d25; background: #0b110d; padding: .3rem .4rem .3rem .75rem; }
    .mobile-action-label { display: block; color: #b9cbbf; font-size: .66rem; }
    .mobile-action-item > :global(*) { min-width: 0; flex: 0 0 auto; }
    .mobile-action-item :global(.presence-trigger), .mobile-action-item :global(.notification-trigger), .mobile-action-item :global(.user-trigger) { width: auto; max-width: 13rem; border-color: transparent; }
    .mobile-action-item :global(.notification-trigger > span:nth-child(2)), .mobile-action-item :global(.user-copy) { display: block !important; }
    .mobile-action-item :global(.user-trigger) { grid-template-columns: auto minmax(0, 1fr) auto; }
    .mobile-action-item :global(.user-chevron) { display: block; }
    .chat-workspace-nav :global(.room-switcher) { top: calc(max(.35rem, env(safe-area-inset-top)) + 2.9rem); max-height: calc(100dvh - 3.5rem); }
    .chat-global-actions :global(.presence-menu),
    .chat-global-actions :global(.inbox-menu),
    .chat-global-actions :global(.notification-menu),
    .chat-global-actions :global(.user-menu) {
      position: fixed;
      top: calc(max(.35rem, env(safe-area-inset-top)) + 2.9rem);
      right: .5rem;
      left: .5rem;
      width: auto;
      max-height: calc(100dvh - 3.75rem);
      overflow-y: auto;
    }
    .connection-banner { padding: .45rem .65rem; font-size: .62rem; }
    .reconnect-panel { max-height: min(10rem, 28dvh); gap: .45rem; overflow-y: auto; padding: .55rem .65rem; overscroll-behavior: contain; }
    .reconnect-panel span { margin-top: .15rem; font-size: .58rem; line-height: 1.35; }
    .reconnect-actions { gap: .3rem; }
    .reconnect-panel .secondary-button { padding: .5rem .65rem; font-size: .62rem; }
    .reconnect-remote { grid-template-columns: minmax(0, 1fr); }
    .reconnect-remote .guest-input { padding: .55rem .65rem; }
    .remote-resume-qr { flex-direction: row; align-items: center; }
    .remote-resume-qr img { width: 5.5rem; height: 5.5rem; }
    [data-testid="guest-message-list"] { min-block-size: 6rem; padding: .75rem .65rem; overscroll-behavior: contain; }
    .message { max-width: 88%; padding: .55rem .65rem; }
    .message p { margin-top: .35rem; }
    .chat-composer { padding: .45rem .55rem; }
    .composer-row { gap: .35rem; }
    .composer-row .guest-input { padding: .58rem .65rem; }
    .composer-row .primary-button { padding: .58rem .72rem; }
    .emoji-toggle { display: grid; width: 2.35rem; flex: 0 0 auto; place-items: center; border: 1px solid #34433b; background: #0b0e0d; color: #b9cbbf; font-size: 1rem; }
    .emoji-toggle:hover, .emoji-toggle:focus-visible, .emoji-toggle[aria-expanded="true"] { border-color: #7cf59d; background: #112219; outline: none; }
    .emoji-toggle:disabled { cursor: not-allowed; opacity: .35; }
    .emoji-shortcuts { position: absolute; z-index: 3; bottom: calc(100% + .35rem); left: .55rem; display: none; width: max-content; max-width: calc(100% - 1.1rem); margin: 0; overflow-x: auto; border: 1px solid #496451; background: #090e0b; padding: .45rem; box-shadow: 0 12px 32px rgb(0 0 0 / .52); }
    .emoji-shortcuts.open { display: flex; }
    .emoji-button { min-width: 2rem; min-height: 2rem; padding: .3rem .45rem; }
    .composer-status { margin-top: .35rem; font-size: .58rem; }
    .composer-status:not(.unavailable) { display: none; }
  }

  @media (max-width: 520px) {
    .chat-workspace-nav :global(.brand) { display: none; }
    .chat-workspace-nav :global(.active-context) { border-left: 0; padding-left: 0; }
  }

  @media (max-width: 360px) {
    .chat-workspace-nav :global(.active-context > .room-host-badge) { display: none; }
    .chat-workspace-nav :global(.context-copy > span) { display: none; }
    .mobile-primary-actions { gap: 0; }
  }

  @media (max-width: 900px) and (max-height: 520px) {
    .chat-global-nav { min-height: 2.75rem; padding-top: max(.2rem, env(safe-area-inset-top)); padding-bottom: .2rem; }
    .chat-workspace-nav :global(.brand-copy span), .chat-workspace-nav :global(.context-copy > span) { display: none; }
    .chat-workspace-nav :global(.browse-button), .mobile-primary-actions > * { height: 2.15rem; }
    .chat-global-actions, .chat-workspace-nav :global(.room-switcher),
    .chat-global-actions :global(.presence-menu), .chat-global-actions :global(.inbox-menu),
    .chat-global-actions :global(.notification-menu), .chat-global-actions :global(.user-menu) { top: calc(max(.2rem, env(safe-area-inset-top)) + 2.55rem); max-height: calc(100dvh - 2.8rem); }
    .reconnect-panel { max-height: min(7rem, 24dvh); }
    [data-testid="guest-message-list"] { min-block-size: 4.5rem; padding-block: .5rem; }
    .chat-composer { padding-block: .35rem; }
  }

  @keyframes mobile-connection-pulse { 50% { opacity: .35; } }
</style>
