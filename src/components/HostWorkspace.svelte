<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import type { CoordinatorIdentity } from "../crypto/key-manager";
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";
  import type { ConfigStore } from "../config/config.svelte";
  import { createInviteUrl, normalizeRoomHostIdentity } from "../chat/invite";
  import { createSameShellChatHref } from "../chat/room-navigation";
  import { ChatRoomSession, createHostedRoom, forgetRememberedHostRoom, hostIdentityForRoom, listRooms, loadRememberedHostRoom, loadRoom, rememberActiveHostRoom, removeStoredRoom, ROOMS_CHANGED_EVENT, rotateRoomInvite, saveRoom, signerForStoredRoom, type RoomIdentity, type StoredRoom } from "../chat/room-store";
  import type { RemoteJoinRequest } from "../chat/coordinator-client";
  import CoordinatorSettings from "./CoordinatorSettings.svelte";
  import LifecyclePanel from "./LifecyclePanel.svelte";
  import InviteInbox from "./InviteInbox.svelte";
  import MessageAuthor from "./MessageAuthor.svelte";
  import NotificationCenter from "./NotificationCenter.svelte";
  import OnlineInvitePicker from "./OnlineInvitePicker.svelte";
  import PendingInvitees from "./PendingInvitees.svelte";
  import PresenceControl from "./PresenceControl.svelte";
  import ResourceMonitor from "./ResourceMonitor.svelte";
  import RoomHostBadge from "./RoomHostBadge.svelte";
  import RoomRemovalDialog from "./RoomRemovalDialog.svelte";
  import StartupSignalField from "./StartupSignalField.svelte";
  import UserProfile from "./UserProfile.svelte";
  import WorkspaceNav from "./WorkspaceNav.svelte";
  import { userProfileStore } from "../identity/user-profile.svelte";

  const emojiShortcuts = ["👍", "❤️", "😂", "🎉", "👋", "✨"];

  interface Props {
    coordinator: CoordinatorStore;
    config: ConfigStore;
    identity: CoordinatorIdentity;
    coordinatorPubkey: string;
    relayUrls: string[];
    currentUrl: string;
    homeCoordinatorPubkey?: string;
    onNavigate: (href: string) => void;
  }

  interface HostedRoomEntry {
    room: StoredRoom;
    inviteUrl: string;
    qrUrl: string;
  }

  interface RemoteServerGroup {
    pubkey: string;
    origin?: string;
    rooms: StoredRoom[];
  }

  let { coordinator, config, identity, coordinatorPubkey, relayUrls, currentUrl, homeCoordinatorPubkey, onNavigate }: Props = $props();
  let title = $state("");
  let inviteUrl = $state("");
  let qrUrl = $state("");
  let error = $state("");
  let busy = $state(false);
  let autoApprove = $state(true);
  let room = $state<StoredRoom | null>(null);
  let session = $state<ChatRoomSession | null>(null);
  let hostedRooms = $state<HostedRoomEntry[]>([]);
  let homeJoinedRooms = $state<StoredRoom[]>([]);
  let remoteRooms = $state<StoredRoom[]>([]);
  let composer = $state("");
  let revision = $state(0);
  let roomConnection = $state<"connecting" | "connected" | "offline">("connecting");
  let roomConnectionDetail = $state<string | undefined>();
  let soundsEnabled = $state(true);
  let messageList: HTMLDivElement | undefined = $state();
  let composerInput: HTMLInputElement | undefined = $state();
  let audioContext: AudioContext | null = null;
  let knownMessageIds = new Set<string>();
  let shareDialogOpen = $state(false);
  let createDialogOpen = $state(false);
  let settingsDialogOpen = $state(false);
  let newRoomAutoApprove = $state(true);
  let serverMenuOpen = $state(false);
  let selectedServerPubkey = $state("");
  let copyState = $state<"idle" | "copied">("idle");
  let unsubscribeSession: (() => void) | null = null;
  let roomNameInput: HTMLInputElement | undefined = $state();
  let pendingJoinRequests = $state<RemoteJoinRequest[]>([]);
  let managementOpen = $state(false);
  let compactViewport = $state(false);
  let mobileRailOpen = $state(false);
  let mobileToolsOpen = $state(false);
  let refreshState = $state<"idle" | "refreshing" | "refreshed">("idle");
  let roomRemovalTarget = $state<StoredRoom | null>(null);

  const dialogOpen = $derived(shareDialogOpen || createDialogOpen || roomRemovalTarget !== null);
  const remoteServers = $derived.by(() => {
    const groups: Record<string, RemoteServerGroup> = {};
    for (const storedRoom of remoteRooms) {
      const group = groups[storedRoom.coordinatorPubkey];
      if (group) {
        group.rooms.push(storedRoom);
      } else {
        groups[storedRoom.coordinatorPubkey] = {
          pubkey: storedRoom.coordinatorPubkey,
          origin: storedRoom.coordinatorOrigin,
          rooms: [storedRoom],
        };
      }
    }
    return Object.values(groups);
  });
  const selectedRemoteServer = $derived(remoteServers.find((server) => server.pubkey === selectedServerPubkey));
  const selectedServerIsHome = $derived(!selectedServerPubkey || selectedServerPubkey === coordinatorPubkey);
  const selectedServerName = $derived(selectedServerIsHome
    ? config.coordinatorName || "My coordinator"
    : `Coordinator ${shortKey(selectedServerPubkey || coordinatorPubkey)}`
  );
  const selectedServerRoomCount = $derived(selectedServerIsHome
    ? hostedRooms.length + homeJoinedRooms.length
    : selectedRemoteServer?.rooms.length ?? 0
  );
  const joinedChatCount = $derived(homeJoinedRooms.length + remoteRooms.filter((storedRoom) => !storedRoom.isHost).length);
  const localRoomReady = $derived(
    coordinator.status === "running" && room !== null && session !== null && roomConnection === "connected"
  );
  const localCoordinatorStatus = $derived.by(() => {
    if (localRoomReady) return "ready";
    if (coordinator.status === "running" && room !== null && session !== null && roomConnection === "offline") return "error";
    return "neutral";
  });
  const localCoordinatorStatusLabel = $derived.by(() => {
    if (localCoordinatorStatus === "ready") return "Coordinator and local room connected";
    if (localCoordinatorStatus === "error") return "Coordinator running; local room offline";
    if (coordinator.status === "running") {
      return room !== null && session !== null
        ? "Coordinator running; connecting local room"
        : "Coordinator running; no local room selected";
    }
    return room !== null && session !== null
      ? `Coordinator ${coordinator.status}; local room ${roomConnection}`
      : `Coordinator ${coordinator.status}; local room not ready`;
  });

  $effect(() => {
    if (revision >= 0) void tick().then(() => messageList?.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" }));
  });

  $effect(() => {
    const activeSession = session;
    const activeRoom = room;
    const identity = currentHostIdentity();
    if (!activeSession || !activeRoom?.isHost) return;
    if (activeRoom.name === identity.name
      && activeRoom.avatar === identity.avatar
      && activeRoom.badgeLabel === identity.badgeLabel
      && activeRoom.badgeEmoji === identity.badgeEmoji) return;

    activeSession.setIdentity(identity);
    const refreshedEntry = buildHostedRoomEntry(activeSession.room);
    hostedRooms = hostedRooms.map((entry) => entry.room.id === activeSession.room.id ? refreshedEntry : entry);
    inviteUrl = refreshedEntry.inviteUrl;
    qrUrl = refreshedEntry.qrUrl;
  });

  $effect(() => {
    const identity = currentHostIdentity();
    const activeRoomId = room?.id;
    let changed = false;
    const nextEntries = hostedRooms.map((entry) => {
      if (entry.room.id === activeRoomId || roomIdentityMatches(entry.room, identity)) return entry;
      const updatedRoom: StoredRoom = {
        ...entry.room,
        name: identity.name,
        avatar: identity.avatar,
        badgeLabel: identity.badgeLabel,
        badgeEmoji: identity.badgeEmoji,
        host: normalizeRoomHostIdentity({
          name: identity.name,
          pubkey: entry.room.stablePubkey,
          avatar: identity.avatar,
        }),
      };
      saveRoom(updatedRoom);
      changed = true;
      return buildHostedRoomEntry(updatedRoom);
    });
    if (changed) hostedRooms = nextEntries;
  });

  function roomIdentityMatches(nextRoom: StoredRoom, identity: RoomIdentity): boolean {
    return nextRoom.name === identity.name
      && nextRoom.avatar === identity.avatar
      && nextRoom.badgeLabel === identity.badgeLabel
      && nextRoom.badgeEmoji === identity.badgeEmoji;
  }

  function update() {
    if (session) {
      roomConnection = session.status.connection;
      roomConnectionDetail = session.status.detail;
      const nextRoom = { ...session.room, messages: [...session.room.messages], pending: [...session.room.pending] };
      const receivedMessage = nextRoom.messages.some((message) => !knownMessageIds.has(message.id) && message.sender !== nextRoom.stablePubkey);
      knownMessageIds = new Set(nextRoom.messages.map((message) => message.id));
      room = nextRoom;
      pendingJoinRequests = [...session.pendingJoinRequests];
      hostedRooms = hostedRooms.map((entry) => entry.room.id === nextRoom.id ? { ...entry, room: nextRoom } : entry);
      if (receivedMessage) playIncomingTone();
    }
    revision += 1;
  }

  function openHostChat(nextRoom: StoredRoom) {
    const signer = signerForStoredRoom(nextRoom);
    if (!signer) throw new Error("The host chat signer is unavailable");
    unsubscribeSession?.();
    session?.stop();
    knownMessageIds = new Set(nextRoom.messages.map((message) => message.id));
    room = nextRoom;
    pendingJoinRequests = [];
    session = new ChatRoomSession(nextRoom, signer);
    roomConnection = session.status.connection;
    roomConnectionDetail = session.status.detail;
    unsubscribeSession = session.subscribe(update);
    autoApprove = nextRoom.autoApprove !== false;
    rememberActiveHostRoom(nextRoom);
    void session.start();
    update();
  }

  function restoreHostChat(): void {
    const remembered = loadRememberedHostRoom(coordinatorPubkey);
    const candidates = remembered
      ? [remembered, ...hostedRooms.map((entry) => entry.room).filter((candidate) => candidate.id !== remembered.id)]
      : hostedRooms.map((entry) => entry.room);

    for (const candidate of candidates) {
      const latest = loadRoom(candidate.id, candidate.coordinatorPubkey) ?? candidate;
      try {
        openHostChat(latest);
        const entry = buildHostedRoomEntry(latest);
        inviteUrl = entry.inviteUrl;
        qrUrl = entry.qrUrl;
        return;
      } catch {
        if (candidate.id === remembered?.id) forgetRememberedHostRoom(coordinatorPubkey);
      }
    }
  }

  function buildHostedRoomEntry(nextRoom: StoredRoom): HostedRoomEntry {
    const createdInviteUrl = createInviteUrl(nextRoom.coordinatorOrigin ?? window.location.origin, {
      groupId: nextRoom.id,
      coordinatorPubkey: nextRoom.coordinatorPubkey,
      relayUrls: nextRoom.relayUrls,
      title: nextRoom.title,
      inviteToken: nextRoom.inviteToken,
      host: hostIdentityForRoom(nextRoom),
    });
    return {
      room: nextRoom,
      inviteUrl: createdInviteUrl,
      qrUrl: toSvgDataURL(generate(createdInviteUrl), { on: "#c8ffdc", off: "#101614", pad: 2, scale: 4 }),
    };
  }

  function currentHostIdentity() {
    return {
      name: userProfileStore.displayName,
      avatar: userProfileStore.avatarUrl,
      badgeLabel: config.hostBadgeLabel.trim() || "host",
      badgeEmoji: config.hostBadgeEmoji,
    };
  }

  function remoteRoomHref(nextRoom: StoredRoom): string {
    return createSameShellChatHref(window.location.origin, nextRoom);
  }

  function shortKey(pubkey: string): string {
    return `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;
  }

  function serverHost(origin: string | undefined): string {
    if (!origin) return "Remote coordinator";
    try {
      return new URL(origin).host;
    } catch {
      return origin;
    }
  }

  function refreshRemoteRooms() {
    const rooms = listRooms();
    homeJoinedRooms = rooms.filter((storedRoom) =>
      storedRoom.coordinatorPubkey === coordinatorPubkey && !storedRoom.isHost
    );
    remoteRooms = rooms.filter((storedRoom) => storedRoom.coordinatorPubkey !== coordinatorPubkey);
  }

  async function openCreateDialog() {
    serverMenuOpen = false;
    mobileRailOpen = false;
    mobileToolsOpen = false;
    title = "";
    error = "";
    newRoomAutoApprove = true;
    createDialogOpen = true;
    await tick();
    roomNameInput?.focus();
  }

  function closeCreateDialog() {
    if (busy) return;
    createDialogOpen = false;
    title = "";
    error = "";
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
      const created = await createHostedRoom({
        title,
        coordinatorPubkey,
        relayUrls,
        coordinatorOrigin: window.location.origin,
        autoApprove: newRoomAutoApprove,
        identity: currentHostIdentity(),
      });
      const entry = buildHostedRoomEntry(created);
      openHostChat(created);
      hostedRooms = [entry, ...hostedRooms.filter((candidate) => candidate.room.id !== created.id)];
      inviteUrl = entry.inviteUrl;
      qrUrl = entry.qrUrl;
      createDialogOpen = false;
      title = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not create invite";
    } finally {
      busy = false;
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
    copyState = "copied";
    window.setTimeout(() => {
      copyState = "idle";
    }, 1_800);
  }

  function openShareDialog() {
    copyState = "idle";
    refreshState = "idle";
    shareDialogOpen = true;
  }

  function closeShareDialog() {
    shareDialogOpen = false;
    copyState = "idle";
    refreshState = "idle";
  }

  async function refreshInviteLink() {
    if (!room || !session || refreshState === "refreshing") return;
    refreshState = "refreshing";
    copyState = "idle";
    await tick();
    const refreshedRoom = rotateRoomInvite(session.room);
    const entry = buildHostedRoomEntry(refreshedRoom);
    room = { ...refreshedRoom };
    hostedRooms = hostedRooms.map((candidate) => candidate.room.id === refreshedRoom.id ? entry : candidate);
    inviteUrl = entry.inviteUrl;
    qrUrl = entry.qrUrl;
    refreshState = "refreshed";
    window.setTimeout(() => {
      if (refreshState === "refreshed") refreshState = "idle";
    }, 2_400);
  }

  async function setAutoApprove(enabled: boolean) {
    autoApprove = enabled;
    await session?.setAutoApprove(enabled);
  }

  function selectRoom(entry: HostedRoomEntry) {
    shareDialogOpen = false;
    mobileRailOpen = false;
    mobileToolsOpen = false;
    selectedServerPubkey = coordinatorPubkey;
    const latest = loadRoom(entry.room.id, entry.room.coordinatorPubkey) ?? entry.room;
    openHostChat(latest);
    inviteUrl = entry.inviteUrl;
    qrUrl = entry.qrUrl;
  }

  function navigateFromRail(href: string): void {
    mobileRailOpen = false;
    mobileToolsOpen = false;
    onNavigate(href);
  }

  function openSettings(): void {
    mobileRailOpen = false;
    mobileToolsOpen = false;
    settingsDialogOpen = true;
  }

  function toggleMobileRail(): void {
    mobileToolsOpen = false;
    mobileRailOpen = !mobileRailOpen;
  }

  function toggleMobileTools(): void {
    mobileRailOpen = false;
    mobileToolsOpen = !mobileToolsOpen;
  }

  function toggleManagement(): void {
    mobileRailOpen = false;
    mobileToolsOpen = false;
    managementOpen = !managementOpen;
  }

  async function approveWaitingInvitees() {
    try {
      await session?.approveJoinRequests();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not approve invitees";
    }
  }

  function addEmoji(emoji: string) {
    if (!canSendMessages()) return;
    composer += emoji;
    composerInput?.focus();
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

  async function deleteCurrentHostedRoom(): Promise<void> {
    const target = roomRemovalTarget;
    if (!target?.isHost) return;

    await coordinator.deleteHostedRoom(target.id);
    const deletingActiveRoom = room?.id === target.id && room.coordinatorPubkey === target.coordinatorPubkey;
    if (deletingActiveRoom) {
      unsubscribeSession?.();
      unsubscribeSession = null;
      session?.discard();
      session = null;
    }
    removeStoredRoom(target);
    const remainingRooms = hostedRooms.filter((entry) => entry.room.id !== target.id);
    hostedRooms = remainingRooms;

    if (deletingActiveRoom) {
      room = null;
      inviteUrl = "";
      qrUrl = "";
      composer = "";
      pendingJoinRequests = [];
      roomConnection = "connecting";
      roomConnectionDetail = undefined;
      if (remainingRooms[0]) selectRoom(remainingRooms[0]);
    }
  }

  async function wakeCoordinator() {
    if (config.presenceState === "offline") config.setPresenceState("invisible");
    await coordinator.start();
  }

  async function send() {
    if (!session || !canSendMessages()) return;
    const message = composer;
    if (!message.trim()) return;
    void enableSounds();
    error = "";
    session.setIdentity(currentHostIdentity());
    composer = "";
    try {
      await session.send(message);
    } catch (cause) {
      if (!composer.trim()) composer = message;
      error = cause instanceof Error ? cause.message : "Unable to send this message";
    }
  }

  onDestroy(() => {
    unsubscribeSession?.();
    session?.stop();
  });
  onMount(() => {
    const closeDialogsOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      serverMenuOpen = false;
      managementOpen = false;
      mobileRailOpen = false;
      mobileToolsOpen = false;
      if (shareDialogOpen) closeShareDialog();
      if (createDialogOpen) closeCreateDialog();
      settingsDialogOpen = false;
    };
    hostedRooms = listRooms()
      .filter((storedRoom) => storedRoom.isHost && storedRoom.coordinatorPubkey === coordinatorPubkey)
      .map(buildHostedRoomEntry);
    restoreHostChat();
    refreshRemoteRooms();
    if (config.autostart && config.presenceState !== "offline" && coordinator.status === "idle") void coordinator.start();
    const compactQuery = window.matchMedia("(max-width: 900px)");
    const syncCompactViewport = () => {
      compactViewport = compactQuery.matches;
      if (!compactViewport) {
        mobileRailOpen = false;
        mobileToolsOpen = false;
      }
    };
    syncCompactViewport();
    compactQuery.addEventListener("change", syncCompactViewport);
    window.addEventListener(ROOMS_CHANGED_EVENT, refreshRemoteRooms);
    window.addEventListener("keydown", closeDialogsOnEscape);
    return () => {
      window.removeEventListener(ROOMS_CHANGED_EVENT, refreshRemoteRooms);
      window.removeEventListener("keydown", closeDialogsOnEscape);
      compactQuery.removeEventListener("change", syncCompactViewport);
    };
  });
</script>

<main class="operator-field h-[100dvh] max-h-[100dvh] overflow-x-hidden overflow-y-hidden text-[#dfffe7]">
  <div class:dialog-open={dialogOpen} class="host-workspace relative grid h-full w-full min-w-0 grid-rows-[auto_minmax(0,1fr)]" data-testid="operator-shell">
    <header class="host-topbar flex shrink-0 flex-wrap items-center justify-between gap-3 px-3 py-3 sm:flex-nowrap sm:px-5">
      <WorkspaceNav
        {currentUrl}
        {homeCoordinatorPubkey}
        homeCoordinatorName={config.coordinatorName}
        coordinatorStatus={coordinator.status}
        {soundsEnabled}
        activeRoomTitle={room?.title}
        activeRoomCoordinatorPubkey={room?.coordinatorPubkey}
        activeRoomHost={room ? hostIdentityForRoom(room) : undefined}
        roomConnectionStatus={room && session ? roomConnection : undefined}
        onToggleSounds={room ? toggleSounds : undefined}
        roomActionKind={room ? "delete" : undefined}
        roomActionLabel={room ? `Delete room ${room.title}` : undefined}
        onRoomAction={room ? () => roomRemovalTarget = room : undefined}
        showRoomBrowser={false}
        {onNavigate}
      />
      <div class="host-commandbar">
        <button
          class:active={mobileRailOpen}
          class="mobile-rail-toggle"
          type="button"
          aria-label={mobileRailOpen ? "Close room browser" : "Open room browser"}
          aria-controls="host-room-rail"
          aria-expanded={mobileRailOpen}
          onclick={toggleMobileRail}
        >
          <span aria-hidden="true">#</span>
          <span>{room?.title || "Rooms"}</span>
          <strong>{selectedServerRoomCount}</strong>
        </button>
        {#if mobileToolsOpen && compactViewport}
          <button class="mobile-tools-scrim" type="button" aria-label="Close host tools" onclick={() => mobileToolsOpen = false}></button>
        {/if}
        <div
          id="host-tools"
          class:open={mobileToolsOpen}
          class="host-utilities"
          aria-label="Host tools"
          aria-hidden={compactViewport && !mobileToolsOpen}
          inert={compactViewport && !mobileToolsOpen}
        >
          <PresenceControl {config} {coordinator} {coordinatorPubkey} {relayUrls} />
          <InviteInbox {onNavigate} />
          <NotificationCenter />
          <UserProfile
            anonymousPubkey={identity.publicKeyHex}
            anonymousName={config.userName}
            onAnonymousNameChange={(name) => config.setUserName(name)}
            showHostIdentity
            badgeLabel={config.hostBadgeLabel}
            badgeEmoji={config.hostBadgeEmoji}
            onBadgeLabelChange={(label) => config.setHostBadgeLabel(label)}
            onBadgeEmojiChange={(emoji) => config.setHostBadgeEmoji(emoji)}
          />
          <button class:pending={coordinator.restartRequired} class="settings-button" type="button" aria-label="Settings" onclick={openSettings}>
            <span aria-hidden="true">⚙</span>
            <span class="hidden md:inline">Settings</span>
            {#if coordinator.restartRequired}<span class="settings-pip" aria-label="Restart required"></span>{/if}
          </button>
        </div>
        <LifecyclePanel {coordinator} compact onStart={wakeCoordinator} startLabel={config.presenceState === "offline" ? "Wake" : "Start"} />
        <button
          class:active={managementOpen}
          class="manage-toggle"
          type="button"
          aria-pressed={managementOpen}
          aria-label={managementOpen ? "Close management interface" : "Open management interface"}
          onclick={toggleManagement}
        >{managementOpen ? "Host" : "Manage"}</button>
        <button
          class:active={mobileToolsOpen}
          class="mobile-tools-toggle"
          type="button"
          aria-label={mobileToolsOpen ? "Close host tools" : "Open host tools"}
          aria-controls="host-tools"
          aria-expanded={mobileToolsOpen}
          onclick={toggleMobileTools}
        ><span aria-hidden="true">•••</span></button>
      </div>
    </header>

    <div
      class:management-open={managementOpen}
      class:startup-mode={coordinator.status === "starting" || coordinator.status === "stopping"}
      class="host-layout grid min-h-0 min-w-0"
    >
      {#if mobileRailOpen && compactViewport}
        <button class="mobile-rail-scrim" type="button" aria-label="Close room browser" onclick={() => mobileRailOpen = false}></button>
      {/if}
      <aside
        id="host-room-rail"
        class:mobile-open={mobileRailOpen}
        class="host-rail min-h-0 min-w-0 overflow-y-auto border-b border-[#21352a] p-3 sm:p-4 lg:border-r lg:border-b-0"
        data-testid="invite-panel"
        aria-hidden={compactViewport && !mobileRailOpen}
        inert={compactViewport && !mobileRailOpen}
      >
        <div class="flex min-h-full flex-col gap-4">
            <nav class="channel-browser" aria-label="Server and channel browser">
              <div class="channel-context">
                <div class="channel-context-row">
                  <button
                    class="channel-context-button"
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={serverMenuOpen}
                    onclick={() => serverMenuOpen = !serverMenuOpen}
                  >
                    {#if selectedServerIsHome}
                      <span
                        class:ready={localCoordinatorStatus === "ready"}
                        class:error={localCoordinatorStatus === "error"}
                        class="channel-server-dot"
                        data-testid="local-coordinator-status"
                        data-state={localCoordinatorStatus}
                        role="img"
                        aria-label={localCoordinatorStatusLabel}
                        title={localCoordinatorStatusLabel}
                      ></span>
                    {:else}
                      <span class="channel-server-dot remote" aria-hidden="true"></span>
                    {/if}
                    <span class="channel-context-copy">
                      <strong>{selectedServerName}</strong>
                      <small>{selectedServerIsHome ? `${relayUrls.length} relay ${relayUrls.length === 1 ? "path" : "paths"}` : serverHost(selectedRemoteServer?.origin)}</small>
                    </span>
                    <span class="channel-count" title={`${selectedServerRoomCount} ${selectedServerRoomCount === 1 ? "room" : "rooms"}`}>{selectedServerRoomCount}</span>
                    <span class="channel-chevron" aria-hidden="true">{serverMenuOpen ? "↑" : "↓"}</span>
                  </button>
                  {#if selectedServerIsHome}
                    <button
                      class:pending={coordinator.restartRequired}
                      class="channel-settings"
                      type="button"
                      aria-label={`Settings for ${selectedServerName}`}
                      onclick={openSettings}
                    >
                      <span aria-hidden="true">⚙</span>
                      {#if coordinator.restartRequired}<span class="channel-settings-pip" aria-label="Restart required"></span>{/if}
                    </button>
                  {/if}
                </div>
                {#if serverMenuOpen}
                  <div class="channel-server-menu" role="menu" aria-label="Choose coordinator">
                    <button
                      class:active={selectedServerIsHome}
                      type="button"
                      role="menuitem"
                      onclick={() => { selectedServerPubkey = coordinatorPubkey; serverMenuOpen = false; }}
                    >
                      <span
                        class:ready={localCoordinatorStatus === "ready"}
                        class:error={localCoordinatorStatus === "error"}
                        class="channel-server-dot"
                        data-testid="local-coordinator-menu-status"
                        data-state={localCoordinatorStatus}
                        role="img"
                        aria-label={localCoordinatorStatusLabel}
                        title={localCoordinatorStatusLabel}
                      ></span>
                      <span><strong>{config.coordinatorName || "My coordinator"}</strong><small>{localCoordinatorStatusLabel}</small></span>
                      <span>{hostedRooms.length + homeJoinedRooms.length}</span>
                    </button>
                    {#each remoteServers as server (server.pubkey)}
                      <button
                        class:active={selectedServerPubkey === server.pubkey}
                        type="button"
                        role="menuitem"
                        onclick={() => { selectedServerPubkey = server.pubkey; serverMenuOpen = false; }}
                      >
                        <span class="channel-server-dot remote" aria-hidden="true"></span>
                        <span><strong>Coordinator {shortKey(server.pubkey)}</strong><small>{serverHost(server.origin)}</small></span>
                        <span>{server.rooms.length}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="channel-browser-header">
                <span>Channels</span>
                {#if selectedServerIsHome}
                  <button type="button" aria-label="New room" title={coordinator.status === "running" ? "New room" : "Start the coordinator to create a room"} disabled={coordinator.status !== "running"} onclick={() => void openCreateDialog()}>＋</button>
                {/if}
              </div>
              {#if selectedServerIsHome}
                <div class="channel-list">
                  {#each hostedRooms as entry (entry.room.id)}
                    <button
                      class:active={entry.room.id === room?.id}
                      class="channel-row"
                      type="button"
                      aria-label={`Open room ${entry.room.title}, hosted by ${hostIdentityForRoom(entry.room).name}`}
                      onclick={() => selectRoom(entry)}
                    >
                      <span class="channel-active-mark" aria-hidden="true"></span>
                      <span class="channel-hash" aria-hidden="true">#</span>
                      <span class="truncate">{entry.room.title}</span>
                      <RoomHostBadge host={hostIdentityForRoom(entry.room)} compact />
                    </button>
                  {/each}
                  {#each homeJoinedRooms as joinedRoom (`${joinedRoom.coordinatorPubkey}:${joinedRoom.id}`)}
                    <button
                      class="channel-row"
                      type="button"
                      aria-label={`Open joined room ${joinedRoom.title}, hosted by ${hostIdentityForRoom(joinedRoom).name}`}
                      onclick={() => navigateFromRail(remoteRoomHref(joinedRoom))}
                    >
                      <span class="channel-active-mark" aria-hidden="true"></span>
                      <span class="channel-hash" aria-hidden="true">#</span>
                      <span class="truncate">{joinedRoom.title}</span>
                      <RoomHostBadge host={hostIdentityForRoom(joinedRoom)} compact />
                    </button>
                  {/each}
                  {#if hostedRooms.length + homeJoinedRooms.length === 0}
                    <button class="channel-empty" type="button" disabled={coordinator.status !== "running"} onclick={() => void openCreateDialog()}>
                      <span>{coordinator.status === "running" ? "Create the first room" : "Rooms appear when online"}</span><span aria-hidden="true">＋</span>
                    </button>
                  {/if}
                </div>
              {:else if selectedRemoteServer}
                <div class="channel-list">
                  {#each selectedRemoteServer.rooms as remoteRoom (`${remoteRoom.coordinatorPubkey}:${remoteRoom.id}`)}
                      <button
                        class="channel-row"
                        type="button"
                        aria-label={`Open room ${remoteRoom.title}, hosted by ${hostIdentityForRoom(remoteRoom).name}, on ${serverHost(selectedRemoteServer.origin)}`}
                        onclick={() => navigateFromRail(remoteRoomHref(remoteRoom))}
                      >
                        <span class="channel-active-mark" aria-hidden="true"></span>
                        <span class="channel-hash" aria-hidden="true">#</span>
                        <span class="truncate">{remoteRoom.title}</span>
                        <RoomHostBadge host={hostIdentityForRoom(remoteRoom)} compact />
                      </button>
                  {/each}
                </div>
              {/if}
            </nav>
            {#if room}
              <div class="room-tools" aria-label={`Controls for ${room.title}`}>
                <button class="share-trigger" type="button" aria-label="Share" aria-haspopup="dialog" onclick={openShareDialog}>
                  <span>Share</span>
                  <span aria-hidden="true">↗</span>
                </button>
                <button class:enabled={autoApprove} class="room-access-toggle" type="button" aria-pressed={autoApprove} aria-label={`Auto-approve invitees for ${room.title}: ${autoApprove ? "on" : "off"}`} title="Set admission behavior for this room" onclick={() => void setAutoApprove(!autoApprove)}>
                  <span>Auto-approve</span>
                  <strong>{autoApprove ? "On" : "Off"}</strong>
                </button>
              </div>
              <span class="sr-only" data-testid="invite-link">{inviteUrl}</span>
              {#if !autoApprove}
                <PendingInvitees requests={pendingJoinRequests} onApprove={approveWaitingInvitees} />
              {/if}
              {#if error}<p class="text-sm text-[#ffaaa3]">{error}</p>{/if}
            {/if}
          <div class="mt-auto">
            {#if coordinator.status === "running"}
              <ResourceMonitor compact />
            {/if}
          </div>
        </div>
      </aside>

      <section class="host-chat min-h-0 min-w-0 overflow-hidden bg-[#101614]" data-testid="host-chat" data-revision={revision}>
        {#if localRoomReady}
          {@const composerEnabled = true}
          <div class="flex h-full min-h-0 flex-col">{#if roomConnectionDetail}<p class="host-connection-banner">{roomConnectionDetail}</p>{/if}
            <div bind:this={messageList} class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6" role="log" aria-live="polite" aria-relevant="additions" data-testid="host-message-list">{#if room.messages.length === 0}<div class="flex h-full items-center justify-center"><p class="max-w-sm text-center text-sm leading-6 text-[#82958a]">Your room is ready. Share the invite from the left and this chat will stay connected to the coordinator.</p></div>{/if}{#each room.messages as message (message.id)}<article class:mine={message.sender === room.stablePubkey} class="host-message"><MessageAuthor sender={message.sender} name={message.name} avatar={message.avatar} badgeLabel={message.badgeLabel} badgeEmoji={message.badgeEmoji} createdAt={message.createdAt} pending={message.pending} /><p>{message.content}</p></article>{/each}</div>
            <form class="shrink-0 border-t border-[#293832] p-3 sm:p-4" onsubmit={(event) => { event.preventDefault(); void send(); }}><div class="mb-2 flex gap-1 overflow-x-auto pb-1">{#each emojiShortcuts as emoji (emoji)}<button type="button" class="emoji-button" aria-label={`Add ${emoji}`} disabled={!composerEnabled} onclick={() => addEmoji(emoji)}>{emoji}</button>{/each}</div><div class="flex gap-2"><input bind:this={composerInput} bind:value={composer} class="host-input min-w-0 flex-1" disabled={!composerEnabled} placeholder={roomConnection === "offline" ? "Room offline" : roomConnection === "connecting" ? "Connecting…" : "Message as host"} /><button class="host-primary px-4 sm:px-5" disabled={!composerEnabled || !composer.trim()}>Send</button></div><p class:unavailable={!composerEnabled} class="host-composer-status">{roomConnection === "offline" ? "Cached messages are read-only while this room is offline." : roomConnection === "connecting" ? "Connecting this room…" : "Connected. Messages are end-to-end encrypted."}</p></form>
          </div>
        {:else if coordinator.status !== "running" || (room && session)}
          <div class="startup-stage">
            <StartupSignalField />
            <div class="startup-content">
              <p class="startup-kicker">Private MLS coordination</p>
              <h1>{config.coordinatorName || "My coordinator"}</h1>
              {#if coordinator.status === "starting"}
                <section class="startup-progress-panel" data-testid="startup-progress-panel" aria-label="Coordinator startup">
                  <header>
                    <div>
                      <span>Current operation</span>
                      <strong data-testid="startup-current-status">{coordinator.startupProgress.label}</strong>
                    </div>
                    <span class="startup-progress-value" data-testid="startup-progress-value" aria-hidden="true">{coordinator.startupProgress.percent}%</span>
                  </header>
                  <div
                    class="startup-progress-track"
                    role="progressbar"
                    aria-label="Coordinator startup progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={coordinator.startupProgress.percent}
                    aria-valuetext={`${coordinator.startupProgress.label}, step ${coordinator.startupProgress.step} of ${coordinator.startupProgress.totalSteps}`}
                  >
                    <span style={`--startup-progress: ${coordinator.startupProgress.percent}%`}></span>
                  </div>
                  <footer>
                    <span role="status" aria-live="polite">{coordinator.startupProgress.detail}</span>
                    <span>{coordinator.startupProgress.step}/{coordinator.startupProgress.totalSteps}</span>
                  </footer>
                </section>
              {:else if coordinator.status === "running" && room && session}
                <section class="startup-progress-panel room-connection-panel" data-testid="room-connection-panel" aria-label="Local room connection">
                  <header>
                    <div>
                      <span>Room connection</span>
                      <strong data-testid="room-connection-loading-status">{roomConnection === "offline" ? "Local room offline" : "Connecting local room"}</strong>
                    </div>
                    <span class:error={roomConnection === "offline"} class="startup-progress-value">{roomConnection}</span>
                  </header>
                  <footer>
                    <span role="status" aria-live="polite">{roomConnection === "offline"
                      ? `The coordinator is running, but this local room is offline${roomConnectionDetail ? `: ${roomConnectionDetail}` : "."}`
                      : "Coordinator is ready. Opening your local hosted room…"}</span>
                  </footer>
                </section>
              {:else}
                <p class="startup-copy">
                  {coordinator.status === "idle"
                    ? (config.presenceState === "offline" ? "Sleep mode is active and will persist after reload. Wake when you want the coordinator reachable again." : "Your identity and rooms are ready. Start when you want this coordinator reachable.")
                    : "Closing relay paths and securing coordinator state."}
                </p>
                <div class="startup-actions">
                  {#if joinedChatCount > 0}<button type="button" data-testid="open-chats" onclick={() => navigateFromRail("/chats")}>Open chats</button>{/if}
                  <button type="button" onclick={openSettings}>Review settings</button>
                  <button class="startup-primary" type="button" disabled={coordinator.status !== "idle"} onclick={() => void wakeCoordinator()}>
                    {coordinator.status === "stopping" ? "Stopping…" : config.presenceState === "offline" ? "Wake coordinator" : "Start coordinator"}
                  </button>
                </div>
                <dl class="startup-facts">
                  <div><dt>Relay paths</dt><dd>{config.enabledRelayUrls.length}</dd></div>
                  <div><dt>Identity</dt><dd>{coordinator.persistenceEnabled ? "encrypted" : "ephemeral"}</dd></div>
                  <div><dt>Autostart</dt><dd>{config.autostart ? "on" : "off"}</dd></div>
                </dl>
              {/if}
            </div>
          </div>
        {:else}
          <div class="empty-workspace">
            <span class="empty-glyph" aria-hidden="true">#</span>
            <p>Coordinator online</p>
            <h2>No channel selected</h2>
            <div class="empty-actions">
              <button type="button" onclick={openSettings}>Settings</button>
              <button class="host-primary" type="button" onclick={() => void openCreateDialog()}>Create room</button>
            </div>
          </div>
        {/if}
      </section>

      <section class="management-main" data-testid="management-interface" aria-label="Coordinator management">
        <header class="management-heading">
          <div>
            <p>Coordinator</p>
            <h1>Management</h1>
          </div>
          <div>
            <button type="button" onclick={openSettings}>Settings</button>
            <button class="management-close" type="button" onclick={toggleManagement}>Back to host</button>
          </div>
        </header>
        <div class="management-dashboard">
          <section class="management-summary" data-testid="management-summary">
            <div><span>Channels</span><strong>{hostedRooms.length}</strong></div>
            <div><span>Relay paths</span><strong>{config.enabledRelayUrls.length}</strong></div>
            <div><span>Waiting</span><strong>{pendingJoinRequests.length}</strong></div>
          </section>
          <section class="management-activity">
            <header>
              <div><p>Coordinator activity</p><span>{coordinator.debugLog.length} events</span></div>
              <button type="button" onclick={() => coordinator.clearDebugLog()}>Clear</button>
            </header>
            <div class="management-log" role="log" aria-label="Coordinator activity">
              {#if coordinator.debugLog.length === 0}
                <p class="management-empty">No activity yet.</p>
              {:else}
                <ol data-testid="management-log-entries">
                  {#each coordinator.debugLog as entry (entry.id)}
                    <li><time>{entry.timeLabel}</time><span class={`level ${entry.level}`}>{entry.level}</span><p>{entry.message}{#if entry.details}<small>{entry.details}</small>{/if}</p></li>
                  {/each}
                </ol>
              {/if}
            </div>
          </section>
        </div>
      </section>
    </div>

    {#if settingsDialogOpen}
      <CoordinatorSettings
        {coordinator}
        {config}
        {identity}
        onClose={() => { config.exitEdit(); settingsDialogOpen = false; }}
      />
    {/if}

    {#if createDialogOpen}
      <div class="share-overlay" data-testid="create-room-dialog">
        <button class="share-backdrop" type="button" aria-label="Close create room dialog" onclick={closeCreateDialog}></button>
        <div
          class="create-room-dialog share-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-room-dialog-title"
        >
          <form onsubmit={(event) => { event.preventDefault(); void createInvite(); }}>
            <header class="share-dialog-header">
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7cf59d]">New channel</p>
                <h2 id="create-room-dialog-title" class="mt-1 text-xl font-semibold text-white">Create a room</h2>
              </div>
              <button class="share-close" type="button" aria-label="Close create room dialog" onclick={closeCreateDialog}>×</button>
            </header>
            <div class="create-room-content">
              <label class="block text-sm text-[#cfe2d4]">
                Room name
                <input bind:this={roomNameInput} bind:value={title} class="host-input mt-2" placeholder="Friday plans" />
              </label>
              <label class="create-room-option">
                <input
                  type="checkbox"
                  checked={newRoomAutoApprove}
                  onchange={(event) => newRoomAutoApprove = (event.currentTarget as HTMLInputElement).checked}
                  aria-label="Auto-approve invitees"
                  class="mt-0.5 h-4 w-4 accent-[#7cf59d]"
                />
                <span>
                  <strong>Auto-approve invitees</strong>
                  <small>Enabled by default. Turn off to admit guests manually.</small>
                </span>
              </label>
              {#if relayUrls.length === 0}<p class="text-xs text-[#ffaaa3]">Add an enabled relay before starting a room.</p>{/if}
              {#if error}<p class="text-xs text-[#ffaaa3]">{error}</p>{/if}
            </div>
            <footer class="create-room-actions">
              <button class="host-secondary" type="button" disabled={busy} onclick={closeCreateDialog}>Cancel</button>
              <button class="host-primary" type="submit" disabled={busy || relayUrls.length === 0 || title.trim().length === 0}>{busy ? "Creating…" : "Create room"}</button>
            </footer>
          </form>
        </div>
      </div>
    {/if}

    {#if shareDialogOpen && room}
      <div class="share-overlay" data-testid="share-dialog">
        <button class="share-backdrop" type="button" aria-label="Close share dialog" onclick={closeShareDialog}></button>
        <div class="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
          <header class="share-dialog-header">
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7cf59d]">Room invite</p>
              <h2 id="share-dialog-title" class="mt-1 truncate text-xl font-semibold text-white">Share {room.title}</h2>
            </div>
            <button class="share-close" type="button" aria-label="Close share dialog" onclick={closeShareDialog}>×</button>
          </header>
          <div class="share-dialog-body">
            <div class="share-dialog-content">
              <a href={inviteUrl} aria-label="Open chat invite" class="share-qr">
                {#key inviteUrl}<img src={qrUrl} alt={`QR code to join ${room.title}`} />{/key}
              </a>
              <div class="flex min-w-0 flex-col">
                <div>
                  <p class="text-sm font-medium text-[#e8f5eb]">Scan to join</p>
                  <p class="mt-2 text-xs leading-5 text-[#91a59a]">This invite carries the coordinator identity and relay hints needed to enter the encrypted room.</p>
                </div>
                <code class="share-url">{inviteUrl}</code>
                <div class="share-actions">
                  <button class="host-primary" type="button" onclick={copy}>
                    {copyState === "copied" ? "Copied" : "Copy link"}
                  </button>
                  <button class="refresh-invite" type="button" disabled={refreshState === "refreshing"} onclick={() => void refreshInviteLink()}>
                    <span aria-hidden="true">↻</span>
                    {refreshState === "refreshing" ? "Refreshing…" : refreshState === "refreshed" ? "Refreshed" : "Refresh link"}
                  </button>
                </div>
                <p class:refreshed={refreshState === "refreshed"} class="refresh-guidance" aria-live="polite">
                  {refreshState === "refreshed"
                    ? "New link ready. Previous links can no longer admit guests."
                    : "Refresh to stop previous links admitting new guests. Current members stay connected."}
                </p>
              </div>
            </div>
            <OnlineInvitePicker {inviteUrl} roomTitle={room.title} />
          </div>
        </div>
      </div>
    {/if}

    {#if roomRemovalTarget}
      <RoomRemovalDialog
        mode="delete"
        roomTitle={roomRemovalTarget.title}
        messageCount={roomRemovalTarget.messages.length}
        pendingInviteCount={pendingJoinRequests.length}
        onConfirm={deleteCurrentHostedRoom}
        onClose={() => roomRemovalTarget = null}
      />
    {/if}
  </div>
</main>

<style>
  .host-workspace { max-width: 100vw; overflow: hidden; background: rgb(7 12 9 / .8); }
  .host-workspace > .host-topbar, .host-workspace > .host-layout { transition: filter .18s ease, opacity .18s ease; }
  .host-workspace.dialog-open > .host-topbar, .host-workspace.dialog-open > .host-layout { filter: blur(2px); opacity: .72; }
  .host-topbar { position: relative; z-index: 40; border-bottom: 1px solid #21352a; background: rgb(10 16 12 / .94); padding-block: .55rem; }
  .host-commandbar { position: relative; display: flex; width: auto; min-width: 0; flex: 0 1 auto; align-items: stretch; justify-content: flex-end; border: 1px solid #293832; background: #080d0a; }
  .host-utilities { display: flex; min-width: 0; align-items: stretch; }
  .mobile-rail-toggle, .mobile-tools-toggle, .mobile-tools-scrim, .mobile-rail-scrim { display: none; }
  .host-commandbar :global(.presence-control), .host-commandbar :global(.invite-inbox), .host-commandbar :global(.notification-center), .host-commandbar :global(.user-profile) { border-right: 1px solid #202d25; }
  .host-commandbar :global(.presence-trigger), .host-commandbar :global(.inbox-trigger), .host-commandbar :global(.notification-trigger), .host-commandbar :global(.user-trigger) { border: 0; background: transparent; }
  .host-commandbar :global(.presence-trigger:hover:not(:disabled)), .host-commandbar :global(.presence-trigger[aria-expanded="true"]), .host-commandbar :global(.inbox-trigger:hover), .host-commandbar :global(.inbox-trigger.pending), .host-commandbar :global(.notification-trigger:hover), .host-commandbar :global(.notification-trigger[aria-expanded="true"]), .host-commandbar :global(.user-trigger:hover), .host-commandbar :global(.user-trigger[aria-expanded="true"]) { background: #101713; }
  .host-commandbar :global(.compact-controls) { height: 2.65rem; gap: .25rem; border: 0; border-right: 1px solid #202d25; background: transparent; padding: .3rem .4rem; }
  .host-layout { position: relative; width: 100%; max-width: 100%; overflow: hidden; grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
  .host-layout:not(.management-open) .management-main { display: none; }
  .host-layout.management-open { grid-template-columns: minmax(21rem, 28rem) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
  .host-layout.management-open .host-chat { display: none; }
  .manage-toggle { display: grid; height: 2.65rem; place-items: center; border: 0; padding: 0 .85rem; background: #0d1510; color: #a7b9ad; font-size: .6rem; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  .manage-toggle:hover, .manage-toggle.active { background: #7cf59d; color: #071009; }
  .settings-button { position: relative; display: flex; height: 2.65rem; align-items: center; gap: .45rem; border: 0; border-right: 1px solid #202d25; padding: 0 .65rem; color: #91a59a; font-size: .62rem; }
  .settings-button:hover, .settings-button.pending { background: #101713; color: #dfffe7; }
  .settings-pip { position: absolute; top: .35rem; right: .35rem; width: .4rem; height: .4rem; border-radius: 999px; background: #e4e78d; box-shadow: 0 0 8px rgb(228 231 141 / .4); }
  .host-rail { background: #0d1310; }
  .host-input { width: 100%; border: 1px solid #34433b; background: #090d0b; padding: .7rem .8rem; color: #effff2; outline: none; }
  .host-input:focus { border-color: #7cf59d; box-shadow: 0 0 0 2px rgb(124 245 157 / .11); }
  .host-input:disabled { cursor: not-allowed; border-color: #26322c; color: #64766b; opacity: .72; }
  .host-primary { border: 1px solid #7cf59d; background: #7cf59d; padding: .72rem 1rem; color: #08110b; font-weight: 650; }
  .host-primary:hover { border-color: #c5ffcf; background: #c5ffcf; }
  .host-primary:disabled { cursor: not-allowed; opacity: .45; }
  .host-secondary { border: 1px solid #496451; padding: .55rem .7rem; color: #c6eccc; font-size: .75rem; }
  .host-secondary:hover { border-color: #7cf59d; }
  .channel-browser { overflow: hidden; border: 1px solid #293832; background: #090e0b; }
  .channel-context { border-bottom: 1px solid #293832; background: #0b120d; }
  .channel-context-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
  .channel-context-button { display: grid; width: 100%; min-width: 0; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: .6rem; padding: .72rem .55rem .72rem .75rem; color: #dfffe7; text-align: left; }
  .channel-context-button:hover, .channel-context-button[aria-expanded="true"] { background: #111a14; }
  .channel-context-copy, .channel-context-copy strong, .channel-context-copy small { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .channel-context-copy strong { color: #dfffe7; font-size: .72rem; font-weight: 650; }
  .channel-context-copy small { margin-top: .22rem; color: #718277; font-size: .5rem; font-weight: 500; text-transform: capitalize; }
  .channel-count { display: grid; min-width: 1.25rem; height: 1.25rem; place-items: center; background: #17241b; color: #9bf6b3; font-size: .58rem; font-weight: 500; }
  .channel-chevron { color: #82958a; font-size: .58rem; }
  .channel-settings { position: relative; display: grid; width: 2.65rem; place-items: center; border-left: 1px solid #202d25; color: #718277; }
  .channel-settings:hover, .channel-settings.pending { background: #111a14; color: #dfffe7; }
  .channel-settings-pip { position: absolute; top: .5rem; right: .45rem; width: .35rem; height: .35rem; border-radius: 999px; background: #e4e78d; box-shadow: 0 0 7px rgb(228 231 141 / .4); }
  .channel-server-menu { display: grid; gap: .15rem; border-top: 1px solid #293832; padding: .35rem; background: #070c09; }
  .channel-server-menu > button { display: grid; width: 100%; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .6rem; border: 1px solid transparent; padding: .55rem .6rem; color: #91a59a; text-align: left; }
  .channel-server-menu > button:hover, .channel-server-menu > button.active { background: #17241b; color: #effff2; }
  .channel-server-menu strong, .channel-server-menu small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .channel-server-menu strong { font-size: .65rem; font-weight: 600; }
  .channel-server-menu small { margin-top: .18rem; color: #73867a; font-size: .52rem; }
  .channel-server-menu > button > span:last-child { color: #7cf59d; font-size: .58rem; }
  .channel-browser-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #202d25; padding: .5rem .55rem .5rem .75rem; color: #728378; font-size: .58rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .channel-browser-header button { display: grid; width: 1.6rem; height: 1.6rem; place-items: center; color: #82958a; font-size: .85rem; }
  .channel-browser-header button:hover { background: #17241b; color: #7cf59d; }
  .channel-browser-header button:disabled { cursor: not-allowed; opacity: .25; }
  .channel-server-dot { width: .38rem; height: .38rem; border-radius: 999px; background: #718277; }
  .channel-server-dot.ready { background: #7cf59d; box-shadow: 0 0 7px rgb(124 245 157 / .3); }
  .channel-server-dot.error { background: #ffaaa3; box-shadow: 0 0 7px rgb(255 170 163 / .3); }
  .channel-server-dot.remote { background: #f4c46d; box-shadow: 0 0 7px rgb(244 196 109 / .25); }
  .channel-list { display: grid; gap: .12rem; padding: .35rem; }
  .channel-empty { display: flex; width: 100%; align-items: center; justify-content: space-between; border: 1px dashed #293832; padding: .65rem .7rem; color: #82958a; text-align: left; font-size: .68rem; }
  .channel-empty:hover { border-color: #7cf59d; color: #dfffe7; }
  .channel-empty:disabled { cursor: default; border-color: #202d25; color: #546159; opacity: .65; }
  .channel-row { position: relative; display: grid; width: 100%; grid-template-columns: .15rem auto minmax(0, 1fr) auto; align-items: center; gap: .55rem; border: 1px solid transparent; padding: .55rem .55rem .55rem .2rem; color: #91a59a; text-align: left; font-size: .72rem; }
  .channel-row:hover { background: #111a14; color: #dfffe7; }
  .channel-row.active { background: #17241b; color: #effff2; }
  .channel-active-mark { align-self: stretch; border-radius: 0 2px 2px 0; background: transparent; }
  .channel-row.active .channel-active-mark { background: #7cf59d; box-shadow: 0 0 10px rgb(124 245 157 / .25); }
  .channel-hash { color: #52675a; font-size: .85rem; }
  .channel-row.active .channel-hash { color: #9bf6b3; }
  .channel-live { color: #7cf59d; font-size: .5rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .channel-remote { color: #9c8050; font-size: .48rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .room-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid #293832; background: #0a100c; }
  .room-tools > button + button { border-left: 1px solid #293832; }
  .room-tools > button { min-width: 0; }
  .share-trigger { display: flex; width: 100%; align-items: center; justify-content: space-between; background: #0a100c; padding: .62rem .65rem; color: #bfeac8; font-size: .65rem; font-weight: 650; }
  .share-trigger:hover { border-color: #7cf59d; background: #101a13; }
  .share-trigger > span:last-child { color: #7cf59d; }
  .room-access-toggle { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .3rem; padding: .62rem .55rem; color: #91a59a; font-size: .58rem; }
  .room-access-toggle strong { color: #82958a; font-size: .48rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
  .room-access-toggle:hover { background: #101713; color: #dfffe7; }
  .room-access-toggle.enabled { color: #c6eccc; }
  .room-access-toggle.enabled strong { color: #7cf59d; }
  .management-main { min-width: 0; min-height: 0; overflow: hidden; background: #101614; }
  .management-heading { display: flex; min-height: 5.4rem; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #293832; padding: 1rem 1.25rem; background: #0c120f; }
  .management-heading p { color: #7cf59d; font-size: .56rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  .management-heading h1 { margin-top: .35rem; color: #f0fff3; font-size: 1.25rem; font-weight: 650; }
  .management-heading > div:last-child { display: flex; gap: .5rem; }
  .management-heading button { border: 1px solid #405748; padding: .6rem .75rem; color: #b9cbbf; font-size: .64rem; }
  .management-heading button:hover { border-color: #7cf59d; color: #dfffe7; }
  .management-heading .management-close { border-color: #7cf59d; background: #7cf59d; color: #071009; font-weight: 700; }
  .management-dashboard { display: grid; height: calc(100% - 5.4rem); min-height: 0; grid-template-rows: auto minmax(0, 1fr); }
  .management-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; border-bottom: 1px solid #293832; background: #293832; }
  .management-summary > div { min-width: 0; background: #0c120f; padding: 1rem 1.1rem; }
  .management-summary span, .management-summary strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .management-summary span { color: #718277; font-size: .54rem; letter-spacing: .12em; text-transform: uppercase; }
  .management-summary strong { margin-top: .45rem; color: #dfffe7; font-size: .9rem; font-weight: 600; text-transform: capitalize; }
  .management-activity { display: grid; min-height: 0; grid-template-rows: auto minmax(0, 1fr); }
  .management-activity > header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #293832; padding: .8rem 1.1rem; }
  .management-activity > header p { color: #dfffe7; font-size: .68rem; font-weight: 650; }
  .management-activity > header span { display: block; margin-top: .2rem; color: #718277; font-size: .52rem; }
  .management-activity > header button { border: 1px solid #34483a; padding: .4rem .55rem; color: #91a59a; font-size: .56rem; }
  .management-activity > header button:hover { border-color: #7cf59d; color: #dfffe7; }
  .management-log { min-height: 0; overflow-y: auto; }
  .management-log ol { display: grid; }
  .management-log li { display: grid; grid-template-columns: 5rem 3.5rem minmax(0, 1fr); gap: .75rem; border-bottom: 1px solid #1d2a23; padding: .7rem 1.1rem; color: #b9cbbf; font-size: .62rem; }
  .management-log time { color: #64766b; font-variant-numeric: tabular-nums; }
  .management-log .level { color: #7cf59d; font-size: .52rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .management-log .level.warn { color: #e4e78d; }
  .management-log .level.error { color: #ffaaa3; }
  .management-log li p { min-width: 0; overflow-wrap: anywhere; }
  .management-log li small { display: block; margin-top: .25rem; color: #718277; line-height: 1.5; }
  .management-empty { padding: 2rem; color: #718277; font-size: .65rem; }
  .share-overlay { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; padding: 1rem; }
  .share-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: rgb(2 7 4 / .68); cursor: default; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  .share-dialog { position: relative; z-index: 1; width: min(46rem, 100%); max-height: calc(100dvh - 2rem); overflow-y: auto; border: 1px solid #52705b; background: #09100c; box-shadow: 0 28px 90px rgb(0 0 0 / .72); }
  .share-dialog-body { min-height: 0; }
  .share-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #293832; padding: 1rem 1.1rem; }
  .share-close { display: grid; width: 2rem; height: 2rem; flex: 0 0 auto; place-items: center; border: 1px solid #34483a; color: #91a59a; font-size: 1.15rem; line-height: 1; }
  .share-close:hover { border-color: #7cf59d; color: white; }
  .create-room-dialog { width: min(32rem, 100%); }
  .create-room-content { display: grid; gap: 1rem; padding: 1.1rem; }
  .create-room-option { display: flex; cursor: pointer; align-items: flex-start; gap: .75rem; border: 1px solid #293832; background: #0b0e0d; padding: .85rem; color: #b9cbbf; font-size: .78rem; }
  .create-room-option strong, .create-room-option small { display: block; }
  .create-room-option strong { color: #e8f5eb; font-weight: 500; }
  .create-room-option small { margin-top: .3rem; color: #82958a; font-size: .68rem; line-height: 1.5; }
  .create-room-actions { display: flex; justify-content: flex-end; gap: .6rem; border-top: 1px solid #293832; padding: .85rem 1.1rem; }
  .share-dialog-content { display: grid; gap: 1.25rem; padding: 1.1rem; }
  .share-qr { display: block; width: min(21rem, 100%); margin-inline: auto; border: .65rem solid #dfffe7; background: #dfffe7; }
  .share-qr img { display: block; width: 100%; aspect-ratio: 1; }
  .share-url { display: -webkit-box; margin-top: 1rem; overflow: hidden; border: 1px solid #293832; background: #050906; padding: .7rem; color: #9bf6b3; font-size: .65rem; line-height: 1.45; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
  .share-actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: .5rem; margin-top: .65rem; }
  .refresh-invite { display: flex; align-items: center; justify-content: center; gap: .45rem; border: 1px solid #496451; padding: .72rem .8rem; color: #c6eccc; font-size: .68rem; font-weight: 650; }
  .refresh-invite:hover:not(:disabled) { border-color: #7cf59d; background: #101a13; color: #effff2; }
  .refresh-invite:disabled { cursor: wait; opacity: .58; }
  .refresh-guidance { margin-top: .55rem; color: #718277; font-size: .55rem; line-height: 1.5; }
  .refresh-guidance.refreshed { color: #9bf6b3; }
  .share-qr img { animation: qr-refresh .24s ease-out; }
  .emoji-button { flex: 0 0 auto; border: 1px solid #293832; background: #0b0e0d; padding: .2rem .4rem; font-size: .9rem; line-height: 1; }
  .emoji-button:hover { border-color: #7cf59d; background: #112219; }
  .emoji-button:disabled { cursor: not-allowed; opacity: .28; }
  .host-connection-banner { flex: 0 0 auto; border-bottom: 1px solid #293832; background: #111814; padding: .65rem 1rem; color: #a9bbb0; font-size: .7rem; line-height: 1.5; }
  .host-connection-banner.offline { border-bottom-color: #604326; background: #21170f; color: #ffc17d; }
  .host-composer-status { margin-top: .5rem; color: #7ca087; text-align: center; font-size: .65rem; }
  .host-composer-status.unavailable { color: #a98b69; }
  .host-message { max-width: min(78%, 42rem); border: 1px solid #293832; background: #161e1a; padding: .7rem .85rem; color: #e4f2e7; }
  .host-message.mine { margin-left: auto; border-color: #2e553b; background: #173323; }
  .host-message p { margin-top: .48rem; white-space: pre-wrap; word-break: break-word; }
  .startup-stage { position: relative; display: grid; height: 100%; place-items: center; overflow: hidden; padding: 2rem; background: radial-gradient(circle at 50% 45%, rgb(35 72 47 / .18), transparent 34%), #101614; }
  .startup-stage::before { position: absolute; inset: 0; background-image: linear-gradient(rgb(124 245 157 / .025) 1px, transparent 1px), linear-gradient(90deg, rgb(124 245 157 / .025) 1px, transparent 1px); background-size: 48px 48px; content: ""; mask-image: radial-gradient(circle at center, black, transparent 72%); }
  .startup-content { position: relative; z-index: 1; width: min(38rem, 100%); max-height: 100%; overflow-y: auto; text-align: center; }
  .startup-kicker { margin-top: 1.4rem; color: #7cf59d; font-size: .6rem; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
  .startup-content h1 { margin-top: .6rem; color: #f3fff6; font-size: clamp(1.8rem, 4vw, 3.4rem); font-weight: 650; letter-spacing: -.035em; }
  .startup-copy { max-width: 32rem; margin: .8rem auto 0; color: #91a59a; font-size: .8rem; line-height: 1.65; }
  .startup-progress-panel { width: min(32rem, 100%); margin: 1.25rem auto 0; background: rgb(8 14 10 / .82); padding: .8rem .9rem; text-align: left; backdrop-filter: blur(8px); }
  .startup-progress-panel header { display: flex; min-width: 0; align-items: end; justify-content: space-between; gap: 1rem; }
  .startup-progress-panel header > div { min-width: 0; }
  .startup-progress-panel header span, .startup-progress-panel header strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .startup-progress-panel header span { color: #66786d; font-size: .48rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .startup-progress-panel header strong { margin-top: .28rem; color: #e8f5eb; font-size: .72rem; font-weight: 650; }
  .startup-progress-value { flex: 0 0 auto; color: #e4e78d; font-size: .72rem; font-variant-numeric: tabular-nums; }
  .startup-progress-value.error { color: #ffaaa3; }
  .startup-progress-track { position: relative; height: .28rem; margin-top: .7rem; overflow: hidden; background: #1a2820; }
  .startup-progress-track::after { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 calc(20% - 1px), rgb(6 12 8 / .72) calc(20% - 1px) 20%); content: ""; }
  .startup-progress-track > span { display: block; width: var(--startup-progress); height: 100%; background: linear-gradient(90deg, #4cae67, #7cf59d); box-shadow: 0 0 12px rgb(124 245 157 / .24); transition: width .28s ease; }
  .startup-progress-panel footer { display: flex; min-width: 0; align-items: baseline; justify-content: space-between; gap: 1rem; margin-top: .55rem; color: #82958a; font-size: .54rem; line-height: 1.45; }
  .startup-progress-panel footer > span:first-child { min-width: 0; }
  .startup-progress-panel footer > span:last-child { flex: 0 0 auto; color: #687a6f; font-variant-numeric: tabular-nums; }
  .startup-actions { display: flex; justify-content: center; gap: .55rem; margin-top: 1.3rem; }
  .startup-actions button { border: 1px solid #496451; background: rgb(8 14 10 / .78); padding: .7rem .9rem; color: #c6d7cb; font-size: .68rem; backdrop-filter: blur(8px); }
  .startup-actions button:hover:not(:disabled) { border-color: #7cf59d; }
  .startup-actions .startup-primary { border-color: #7cf59d; background: #7cf59d; color: #071009; font-weight: 650; }
  .startup-actions button:disabled { cursor: wait; opacity: .58; }
  .startup-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; max-width: 29rem; margin: 1.5rem auto 0; background: rgb(70 94 77 / .26); }
  .startup-facts div { background: rgb(8 14 10 / .78); padding: .7rem; backdrop-filter: blur(8px); }
  .startup-facts dt { color: #66786d; font-size: .5rem; letter-spacing: .1em; text-transform: uppercase; }
  .startup-facts dd { margin-top: .35rem; color: #b8cdbd; font-size: .65rem; }
  .empty-workspace { display: grid; height: 100%; place-content: center; justify-items: center; padding: 2rem; text-align: center; }
  .empty-glyph { display: grid; width: 3.2rem; height: 3.2rem; place-items: center; border: 1px solid #34483a; background: #0b120d; color: #617b68; font-size: 1.2rem; }
  .empty-workspace p { margin-top: 1rem; color: #7cf59d; font-size: .56rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  .empty-workspace h2 { margin-top: .45rem; color: #e8f5eb; font-size: 1.3rem; font-weight: 600; }
  .empty-actions { display: flex; gap: .5rem; margin-top: 1rem; }
  .empty-actions > button:first-child { border: 1px solid #405748; padding: .65rem .8rem; color: #a9cbb1; font-size: .68rem; }

  @media (min-width: 640px) {
    .share-dialog-content { grid-template-columns: minmax(15rem, 21rem) minmax(0, 1fr); align-items: center; padding: 1.35rem; }
  }

  @media (max-width: 900px) {
    .host-topbar { display: grid; grid-template-columns: minmax(0, 1fr); align-items: stretch; gap: .35rem; padding: .42rem .55rem; }
    .host-topbar :global(.workspace-nav) { width: 100%; min-width: 0; }
    .host-commandbar { display: grid; width: 100%; grid-template-columns: minmax(3.25rem, 1fr) auto auto auto; align-items: stretch; justify-content: stretch; }
    .mobile-rail-toggle { display: grid; min-width: 0; height: 2.65rem; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .4rem; padding: 0 .55rem; color: #b9cbbf; text-align: left; font-size: .6rem; }
    .mobile-rail-toggle:hover, .mobile-rail-toggle.active { background: #142018; color: #effff2; }
    .mobile-rail-toggle > span:first-child { color: #7cf59d; font-size: .78rem; }
    .mobile-rail-toggle > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mobile-rail-toggle strong { display: grid; min-width: 1.15rem; height: 1.15rem; place-items: center; background: #17241b; color: #9bf6b3; font-size: .52rem; font-weight: 600; }
    .mobile-tools-toggle { display: grid; width: 2.65rem; height: 2.65rem; place-items: center; color: #82958a; font-size: .7rem; letter-spacing: .08em; }
    .mobile-tools-toggle:hover, .mobile-tools-toggle.active { background: #142018; color: #effff2; }
    .mobile-tools-scrim { position: fixed; z-index: 59; inset: 0; display: block; border: 0; background: rgb(0 0 0 / .38); cursor: default; backdrop-filter: blur(1px); }
    .host-utilities { position: absolute; z-index: 60; top: calc(100% + .35rem); right: 0; display: none; width: min(20rem, calc(100vw - 1.1rem)); grid-template-columns: minmax(0, 1fr) repeat(4, 2.65rem); border: 1px solid #496451; background: #080d0a; box-shadow: 0 18px 48px rgb(0 0 0 / .62); }
    .host-utilities.open { display: grid; }
    .host-utilities :global(.presence-control), .host-utilities :global(.presence-trigger), .host-utilities .settings-button { width: 100%; min-width: 0; }
    .host-utilities :global(.presence-trigger) { justify-content: center; }
    .host-utilities :global(.notification-trigger), .host-utilities :global(.user-trigger) { width: 2.65rem; }
    .host-utilities :global(.notification-trigger) { justify-content: center; padding-inline: 0; }
    .host-utilities :global(.notification-trigger > span:nth-child(2)), .host-utilities :global(.user-chevron) { display: none; }
    .host-utilities :global(.user-trigger) { grid-template-columns: 1fr; justify-items: center; padding-inline: .25rem; }
    .host-utilities :global(.presence-menu),
    .host-utilities :global(.inbox-menu),
    .host-utilities :global(.notification-menu),
    .host-utilities :global(.user-menu) {
      position: fixed;
      top: auto;
      right: .55rem;
      bottom: .55rem;
      left: .55rem;
      width: auto;
      max-height: calc(100dvh - 1.1rem);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .host-commandbar :global(.compact-controls) { height: 2.65rem; gap: 0; border-inline: 1px solid #202d25; padding: 0; }
    .host-commandbar :global(.lifecycle-status) { height: 2.65rem; gap: 0; padding: 0 .4rem; }
    .host-commandbar :global(.lifecycle-status > span:first-child) { display: none; }
    .host-commandbar :global(.lifecycle-action) { height: 2.65rem; gap: .3rem; padding: 0 .52rem; }
    .host-commandbar :global(.destroy-action) { width: 2.35rem; height: 2.65rem; }
    .manage-toggle { padding-inline: .58rem; }
    .host-layout, .host-layout:not(.management-open), .host-layout.management-open { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
    .host-rail { position: absolute; z-index: 30; inset: 0 auto 0 0; display: block !important; width: min(22rem, calc(100% - 2.65rem)); max-width: 100%; transform: translateX(-102%); border-right: 1px solid #3c5544; border-bottom: 0; padding: .65rem; box-shadow: 18px 0 42px rgb(0 0 0 / .52); opacity: 0; pointer-events: none; overscroll-behavior: contain; transition: transform .18s ease, opacity .18s ease; }
    .host-rail.mobile-open { transform: translateX(0); opacity: 1; pointer-events: auto; }
    .mobile-rail-scrim { position: absolute; z-index: 25; inset: 0; display: block; width: 100%; height: 100%; border: 0; background: rgb(0 0 0 / .46); cursor: default; backdrop-filter: blur(1px); }
    .management-heading { display: none; }
    .management-dashboard { height: 100%; }
    .management-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .management-summary > div { padding: .65rem; }
    .share-overlay { padding: .55rem; }
    .share-dialog { display: grid; max-height: calc(100dvh - 1.1rem); grid-template-rows: auto minmax(0, 1fr); overflow: hidden; }
    .share-dialog-header { padding: .7rem .75rem; }
    .share-dialog-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
    .share-dialog-content { padding: .75rem; }
    .share-qr { width: min(100%, 15rem, 42dvh); border-width: .4rem; }
    .host-composer-status:not(.unavailable) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  }

  @media (max-width: 520px) {
    .startup-stage { padding: clamp(.65rem, 3vw, 1rem); }
    .startup-kicker { margin-top: .8rem; }
    .startup-content h1 { margin-top: .35rem; font-size: clamp(1.55rem, 9vw, 2.2rem); }
    .startup-progress-panel { margin-top: .85rem; padding: .7rem .75rem; }
    .startup-progress-panel footer { gap: .55rem; }
    .startup-facts { margin-top: 1rem; }
  }

  @keyframes qr-refresh { from { opacity: .25; transform: scale(.975); } }

  @media (max-height: 520px) {
    .startup-kicker { display: none; }
    .startup-progress-panel { margin-top: .65rem; }
    .startup-progress-panel footer { margin-top: .4rem; }
  }

  @media (max-width: 900px) and (max-height: 420px) and (min-width: 480px) {
    .host-topbar { gap: 0; }
    .host-topbar :global(.workspace-nav) { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .share-qr img { animation: none; }
    .host-rail { transition: none; }
  }
</style>
