<script lang="ts">
  import { onMount } from "svelte";
  import { parseInviteUrl, type ChatInvite, type CoordinatorKeyMode, type RoomHostIdentity } from "../chat/invite";
  import { createSameShellChatHref } from "../chat/room-navigation";
  import { hostIdentityForRoom, listRooms, roomIdentityKey, ROOMS_CHANGED_EVENT, SERVER_ONLINE_EVENT, type StoredRoom } from "../chat/room-store";
  import InviteRedeemer from "./InviteRedeemer.svelte";
  import RoomHostBadge from "./RoomHostBadge.svelte";

  interface Props {
    currentUrl: string;
    homeCoordinatorPubkey?: string;
    homeCoordinatorName?: string;
    coordinatorStatus?: string;
    soundsEnabled?: boolean;
    activeRoomTitle?: string;
    activeRoomCoordinatorPubkey?: string;
    activeRoomHost?: RoomHostIdentity;
    roomConnectionStatus?: "cached" | "connecting" | "connected" | "offline" | "deleted";
    showRoomBrowser?: boolean;
    onNavigate: (href: string) => void;
  }

  interface RoomLink {
    id: string;
    title: string;
    coordinatorPubkey: string;
    coordinatorOrigin?: string;
    coordinatorKeyMode?: CoordinatorKeyMode;
    relayUrls: string[];
    isHost: boolean;
    host: RoomHostIdentity;
    href: string;
  }

  interface ServerGroup {
    pubkey: string;
    origin?: string;
    rooms: RoomLink[];
  }

  let {
    currentUrl,
    homeCoordinatorPubkey,
    homeCoordinatorName = "My coordinator",
    coordinatorStatus = "idle",
    soundsEnabled = true,
    activeRoomTitle,
    activeRoomCoordinatorPubkey,
    activeRoomHost,
    roomConnectionStatus,
    showRoomBrowser = true,
    onNavigate,
  }: Props = $props();
  let open = $state(false);
  let roomsRevision = $state(0);
  let serverNotice = $state(false);
  let previousCoordinatorStatus = $state<string | null>(null);
  let noticeTimer: number | null = null;
  let lastNoticeAt = 0;
  let notificationAudio: AudioContext | null = null;

  const invite = $derived(parseInviteUrl(currentUrl));
  const storedRooms = $derived(readRooms(roomsRevision));
  const roomLinks = $derived(storedRooms.map(toRoomLink));
  const effectiveHomeCoordinatorPubkey = $derived(homeCoordinatorPubkey?.trim() || undefined);
  const homeRooms = $derived(effectiveHomeCoordinatorPubkey
    ? roomLinks.filter((room) => room.coordinatorPubkey === effectiveHomeCoordinatorPubkey)
    : []
  );
  const previousLocalSessions = $derived(roomLinks.filter((room) =>
    room.isHost && room.coordinatorPubkey !== effectiveHomeCoordinatorPubkey
  ));
  const otherServers = $derived.by(() => {
    const groups: Record<string, ServerGroup> = {};
    for (const room of roomLinks) {
      if (room.isHost) continue;
      if (homeRooms.some((homeRoom) => homeRoom.id === room.id && homeRoom.coordinatorPubkey === room.coordinatorPubkey)) continue;
      const existing = groups[room.coordinatorPubkey];
      if (existing) {
        existing.rooms.push(room);
      } else {
        groups[room.coordinatorPubkey] = {
          pubkey: room.coordinatorPubkey,
          origin: room.coordinatorOrigin,
          rooms: [room],
        };
      }
    }

    const inviteAlreadyStored = invite
      ? roomLinks.some((room) => room.id === invite.groupId && room.coordinatorPubkey === invite.coordinatorPubkey)
      : false;
    if (invite && invite.coordinatorPubkey !== effectiveHomeCoordinatorPubkey && !inviteAlreadyStored) {
      const group = groups[invite.coordinatorPubkey];
      if (!group) {
        groups[invite.coordinatorPubkey] = {
          pubkey: invite.coordinatorPubkey,
          origin: invite.coordinatorOrigin,
          rooms: [{
            id: invite.groupId,
            title: invite.title || "Invited room",
            coordinatorPubkey: invite.coordinatorPubkey,
            coordinatorOrigin: invite.coordinatorOrigin,
            coordinatorKeyMode: invite.coordinatorKeyMode,
            relayUrls: invite.relayUrls,
            isHost: false,
            host: hostIdentityForInvite(invite),
            href: currentUrl,
          }],
        };
      } else if (!group.rooms.some((room) => room.id === invite.groupId && room.coordinatorPubkey === invite.coordinatorPubkey)) {
        group.rooms.unshift({
          id: invite.groupId,
          title: invite.title || "Invited room",
          coordinatorPubkey: invite.coordinatorPubkey,
          coordinatorOrigin: invite.coordinatorOrigin,
          relayUrls: invite.relayUrls,
          isHost: false,
          host: hostIdentityForInvite(invite),
          href: currentUrl,
        });
      }
    }
    return Object.values(groups);
  });
  const activeRoom = $derived(invite
    ? roomLinks.find((room) => room.id === invite.groupId && room.coordinatorPubkey === invite.coordinatorPubkey) ?? {
        id: invite.groupId,
        title: invite.title || "Invited room",
        coordinatorPubkey: invite.coordinatorPubkey,
        coordinatorOrigin: invite.coordinatorOrigin,
        relayUrls: invite.relayUrls,
        isHost: false,
        host: hostIdentityForInvite(invite),
        href: currentUrl,
      }
    : null);
  const contextRoomTitle = $derived(activeRoomTitle || activeRoom?.title);
  const contextCoordinatorPubkey = $derived(activeRoomCoordinatorPubkey || activeRoom?.coordinatorPubkey);
  const contextHost = $derived(activeRoomHost || activeRoom?.host);
  const contextIsHome = $derived(!contextCoordinatorPubkey || Boolean(
    effectiveHomeCoordinatorPubkey && contextCoordinatorPubkey === effectiveHomeCoordinatorPubkey
  ));
  const contextCoordinatorReachability = $derived.by<"online" | "connecting" | "offline" | "unknown">(() => {
    if (contextIsHome) {
      if (coordinatorStatus === "running") return "online";
      if (coordinatorStatus === "starting" || coordinatorStatus === "stopping") return "connecting";
      return "offline";
    }
    if (roomConnectionStatus === "connected") return "online";
    if (roomConnectionStatus === "connecting") return "connecting";
    if (roomConnectionStatus === "offline" || roomConnectionStatus === "deleted" || roomConnectionStatus === "cached") return "offline";
    return "unknown";
  });
  const roomCount = $derived(roomLinks.length);

  $effect(() => {
    const nextStatus = coordinatorStatus;
    if (previousCoordinatorStatus !== null && previousCoordinatorStatus !== "running" && nextStatus === "running") announceServerOnline();
    previousCoordinatorStatus = nextStatus;
  });

  function readRooms(revision: number): StoredRoom[] {
    if (!Number.isFinite(revision)) return [];
    return listRooms();
  }

  function toRoomLink(room: StoredRoom): RoomLink {
    return {
      id: room.id,
      title: room.title,
      coordinatorPubkey: room.coordinatorPubkey,
      coordinatorOrigin: room.coordinatorOrigin,
      coordinatorKeyMode: room.coordinatorKeyMode,
      relayUrls: room.relayUrls,
      isHost: room.isHost,
      host: hostIdentityForRoom(room),
      href: createSameShellChatHref(window.location.origin, room),
    };
  }

  function hostIdentityForInvite(nextInvite: ChatInvite): RoomHostIdentity {
    const host = nextInvite.host ?? { name: "Unknown host", pubkey: "" };
    // Invite-provided image URLs are not loaded until the user joins the room.
    return { ...host, avatar: undefined };
  }

  function hostContextLabel(host: RoomHostIdentity): string {
    const name = host.name.trim() || "Unknown host";
    return /\bhost\b/i.test(name) ? name : `${name} · host`;
  }

  function shortKey(pubkey: string): string {
    return `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;
  }

  function serverHost(origin: string | undefined): string {
    if (!origin) return "remote coordinator";
    try {
      return new URL(origin).host;
    } catch {
      return origin;
    }
  }

  function navigate(href: string) {
    open = false;
    onNavigate(href);
  }

  function toggleRoomSwitcher() {
    open = !open;
    if (open) serverNotice = false;
  }

  function primeNotificationAudio() {
    if (!soundsEnabled) return;
    try {
      notificationAudio ??= new AudioContext();
      void notificationAudio.resume();
    } catch {
      notificationAudio = null;
    }
  }

  function playOnlineTone() {
    if (!soundsEnabled || !notificationAudio || notificationAudio.state !== "running") return;
    const now = notificationAudio.currentTime;
    const gain = notificationAudio.createGain();
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.035, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .28);
    gain.connect(notificationAudio.destination);
    for (const [frequency, offset] of [[660, 0], [880, .11]] as const) {
      const oscillator = notificationAudio.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      oscillator.connect(gain);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + .15);
    }
  }

  function announceServerOnline() {
    const now = performance.now();
    serverNotice = true;
    if (noticeTimer) window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      serverNotice = false;
      noticeTimer = null;
    }, 6_000);
    if (now - lastNoticeAt > 800) playOnlineTone();
    lastNoticeAt = now;
  }

  function isActive(room: RoomLink): boolean {
    return activeRoom?.id === room.id && activeRoom.coordinatorPubkey === room.coordinatorPubkey;
  }

  onMount(() => {
    const refresh = () => roomsRevision += 1;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        open = false;
      }
    };
    window.addEventListener(ROOMS_CHANGED_EVENT, refresh);
    window.addEventListener(SERVER_ONLINE_EVENT, announceServerOnline);
    window.addEventListener("storage", refresh);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", primeNotificationAudio, { once: true });
    return () => {
      window.removeEventListener(ROOMS_CHANGED_EVENT, refresh);
      window.removeEventListener(SERVER_ONLINE_EVENT, announceServerOnline);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", primeNotificationAudio);
      if (noticeTimer) window.clearTimeout(noticeTimer);
      void notificationAudio?.close();
    };
  });
</script>

<nav class="workspace-nav" aria-label="Server and room navigation" data-testid="workspace-navigation">
  <a
    class="brand"
    href="/"
    aria-label="CAHMLS home"
    aria-describedby="cahmls-expansion"
    onclick={(event) => {
      event.preventDefault();
      navigate("/");
    }}
  >
    <span class="brand-camel" aria-hidden="true">🐫</span>
    <strong class="brand-wordmark">CAHMLS</strong>
    <span class="brand-tooltip" id="cahmls-expansion" role="tooltip">
      <span class="brand-tooltip-key" aria-hidden="true">CAHMLS ::</span>
      <span>Cordn Ad-hoc MLS</span>
    </span>
  </a>

  <div class="active-context" data-testid="active-server-context">
    {#if contextRoomTitle && contextHost}
      <RoomHostBadge host={contextHost} avatarOnly />
    {:else}
      <span
        class:online={contextCoordinatorReachability === "online"}
        class:connecting={contextCoordinatorReachability === "connecting"}
        class:offline={contextCoordinatorReachability === "offline"}
        class:unknown={contextCoordinatorReachability === "unknown"}
        class="server-dot"
        data-state={contextCoordinatorReachability}
        role="img"
        aria-label={`Coordinator ${contextCoordinatorReachability}`}
      ></span>
    {/if}
    <span class="context-copy">
      {#if contextRoomTitle}
        <span>{contextHost ? hostContextLabel(contextHost) : contextIsHome ? homeCoordinatorName || "My coordinator" : `Coordinator ${shortKey(contextCoordinatorPubkey || "")}`}</span>
        <strong># {contextRoomTitle}</strong>
      {:else}
        <strong>Workspace</strong>
      {/if}
    </span>
    {#if !contextIsHome}
      <span class="remote-badge">remote</span>
    {/if}
  </div>

  {#if contextRoomTitle && roomConnectionStatus}
    <div class="room-utilities" aria-label={`Controls for ${contextRoomTitle}`}>
      <span
        class:offline={roomConnectionStatus === "offline"}
        class:deleted={roomConnectionStatus === "deleted"}
        class:cached={roomConnectionStatus === "cached"}
        class:connecting={roomConnectionStatus === "connecting"}
        class="room-connection"
        data-testid="chat-connection-status"
        title={`Room connection: ${roomConnectionStatus}`}
      >
        <span class="connection-dot" aria-hidden="true"></span>
        <span class="connection-label">{roomConnectionStatus === "connected" ? "Room synced" : roomConnectionStatus === "deleted" ? "Room deleted" : roomConnectionStatus === "offline" ? "Room offline" : roomConnectionStatus === "cached" ? "Room cached" : "Room connecting"}</span>
      </span>
    </div>
  {/if}

  {#if showRoomBrowser}
    <button
      class="browse-button"
      type="button"
      aria-label={`Rooms, ${roomCount} available`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="room-switcher"
      class:has-notice={serverNotice}
      onclick={toggleRoomSwitcher}
    >
      <span class="browse-label">Rooms</span>
      <span class="room-count">{roomCount}</span>
      {#if serverNotice}<span class="server-notice" aria-hidden="true" data-testid="server-online-notice"></span>{/if}
      <span aria-hidden="true">{open ? "↑" : "↓"}</span>
    </button>
  {:else if serverNotice}
    <span class="server-notice embedded-notice" aria-hidden="true" data-testid="server-online-notice"></span>
  {/if}
  <InviteRedeemer onNavigate={navigate} />
  <span class="sr-only" aria-live="polite">{serverNotice ? "A coordinator is online" : ""}</span>

  {#if showRoomBrowser && open}
    <button class="nav-scrim" type="button" aria-label="Close room switcher" onclick={() => open = false}></button>
    <div id="room-switcher" class="room-switcher" role="dialog" aria-label="Choose a server or room" data-testid="room-switcher">
      <header class="switcher-header">
        <div>
          <p>Rooms & coordinators</p>
          <span>Move between conversations without disconnecting your home coordinator.</span>
        </div>
        <button type="button" aria-label="Close room switcher" onclick={() => open = false}>×</button>
      </header>

      <div class="server-section">
        <div class="server-heading">
          <span class="server-avatar home" aria-hidden="true">C</span>
          <span>
            <strong>{homeCoordinatorName || "My coordinator"}</strong>
            <small class:online={coordinatorStatus === "running"}>{coordinatorStatus === "running" ? "online" : coordinatorStatus}</small>
          </span>
          <button class="workspace-link" type="button" onclick={() => navigate("/")}>Workspace</button>
        </div>
        {#if homeRooms.length === 0}
          <button class="empty-room" type="button" onclick={() => navigate("/")}>
            <span>Create your first room</span><span aria-hidden="true">＋</span>
          </button>
        {:else}
          <div class="room-list">
            {#each homeRooms as room (roomIdentityKey(room.coordinatorPubkey, room.id))}
              <button class:active={isActive(room)} class="room-row" type="button" aria-label={`Open room ${room.title}, hosted by ${room.host.name}`} onclick={() => navigate(room.href)}>
                <span class="hash" aria-hidden="true">#</span>
                <span class="room-name"><span>{room.title}</span>{#if room.coordinatorKeyMode === "ephemeral"}<small class="key-mode">temporary key</small>{/if}</span>
                <RoomHostBadge host={room.host} compact />
                {#if isActive(room)}<span class="active-label" aria-label="Current room">live</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#if previousLocalSessions.length > 0}
        <div class="server-section previous-local-sessions">
          <div class="server-heading">
            <span class="server-avatar previous" aria-hidden="true">↺</span>
            <span class="min-w-0">
              <strong>Previous local sessions</strong>
              <small>Coordinator key changed; these rooms are retained on this device.</small>
            </span>
            <span class="server-kind previous">previous</span>
          </div>
          <div class="room-list">
            {#each previousLocalSessions as room (roomIdentityKey(room.coordinatorPubkey, room.id))}
              <button class:active={isActive(room)} class="room-row" type="button" aria-label={`Open previous local session ${room.title}, hosted by ${room.host.name}`} onclick={() => navigate(room.href)}>
                <span class="hash" aria-hidden="true">#</span>
                <span class="room-name"><span>{room.title}</span>{#if room.coordinatorKeyMode === "ephemeral"}<small class="key-mode">temporary key</small>{/if}</span>
                <RoomHostBadge host={room.host} compact />
                {#if isActive(room)}<span class="active-label" aria-label="Current room">live</span>{/if}
              </button>
            {/each}
          </div>
          <p class="previous-local-guidance">Open a previous session to leave it from this device. It cannot be deleted by the current coordinator key.</p>
        </div>
      {/if}

      {#each otherServers as server (server.pubkey)}
        <div class="server-section">
          <div class="server-heading">
            <span class="server-avatar remote" aria-hidden="true">{server.pubkey.slice(0, 2).toUpperCase()}</span>
            <span class="min-w-0">
              <strong>Coordinator {shortKey(server.pubkey)}</strong>
              <small>{serverHost(server.origin)}</small>
            </span>
            <span class="server-kind">remote</span>
          </div>
          <div class="room-list">
            {#each server.rooms as room (roomIdentityKey(room.coordinatorPubkey, room.id))}
              <button class:active={isActive(room)} class="room-row" type="button" aria-label={`Open room ${room.title}, hosted by ${room.host.name}`} onclick={() => navigate(room.href)}>
                <span class="hash" aria-hidden="true">#</span>
                <span class="room-name"><span>{room.title}</span>{#if room.coordinatorKeyMode === "ephemeral"}<small class="key-mode">temporary key</small>{/if}</span>
                <RoomHostBadge host={room.host} compact />
                {#if isActive(room)}<span class="active-label" aria-label="Current room">live</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</nav>

<style>
  .workspace-nav { position: relative; display: flex; min-width: 0; align-items: center; gap: .75rem; color: #dfffe7; }
  .brand { position: relative; display: flex; flex: 0 0 auto; align-items: center; gap: .5rem; color: inherit; text-decoration: none; }
  .brand-camel { display: inline-grid; width: 2.35rem; height: 1rem; flex: 0 0 2.35rem; place-items: center; overflow: visible; font-family: "Apple Color Emoji", "Segoe UI Emoji", sans-serif; font-size: 1.45rem; line-height: 1; transform: translateY(-.38rem); }
  .brand-wordmark { color: #effff2; font-size: 1.08rem; font-weight: 760; letter-spacing: .12em; line-height: 1; text-shadow: 0 0 18px transparent; transition: color .18s ease, text-shadow .18s ease; }
  .brand-wordmark::after { display: block; width: 34%; height: 1px; margin-top: .38rem; background: #4c7659; content: ""; transform-origin: left; transition: width .24s ease, background .18s ease, box-shadow .18s ease; }
  .brand:hover .brand-wordmark, .brand:focus-visible .brand-wordmark { color: #fff; text-shadow: 0 0 18px rgb(124 245 157 / .18); }
  .brand:hover .brand-wordmark::after, .brand:focus-visible .brand-wordmark::after { width: 100%; background: #7cf59d; box-shadow: 0 0 10px rgb(124 245 157 / .35); }
  .brand:focus-visible { outline: none; }
  .brand-tooltip { position: absolute; z-index: 110; top: calc(100% + .8rem); left: -.25rem; display: grid; width: max-content; max-width: min(19rem, calc(100vw - 1.5rem)); grid-template-columns: auto auto; align-items: center; gap: .65rem; border: 1px solid #42624b; background: linear-gradient(105deg, rgb(124 245 157 / .055), transparent 44%), rgb(6 12 8 / .98); box-shadow: 0 15px 38px rgb(0 0 0 / .5), inset 0 0 0 1px rgb(124 245 157 / .025); padding: .62rem .72rem; color: #dfffe7; font-size: .66rem; letter-spacing: .025em; line-height: 1.2; opacity: 0; pointer-events: none; transform: translateY(-.4rem) scale(.975); transform-origin: top left; transition: opacity .16s ease, transform .2s cubic-bezier(.2, .85, .3, 1); white-space: nowrap; }
  .brand-tooltip::before { position: absolute; top: -.3rem; left: 1rem; width: .55rem; height: .55rem; border-top: 1px solid #42624b; border-left: 1px solid #42624b; background: #09110b; content: ""; transform: rotate(45deg); }
  .brand-tooltip::after { position: absolute; top: -.5px; right: .55rem; width: 2.4rem; height: 1px; background: #7cf59d; box-shadow: 0 0 9px rgb(124 245 157 / .36); content: ""; }
  .brand-tooltip-key { color: #7cf59d; font-size: .52rem; font-weight: 720; letter-spacing: .12em; text-transform: uppercase; }
  .brand:hover .brand-tooltip, .brand:focus-visible .brand-tooltip { opacity: 1; transform: translateY(0) scale(1); }
  .active-context { display: flex; min-width: 0; align-items: center; gap: .55rem; border-left: 1px solid #293832; padding-left: .75rem; }
  .server-dot { width: .5rem; height: .5rem; flex: 0 0 auto; border-radius: 999px; background: #344139; box-shadow: none; }
  .server-dot.online { background: #7cf59d; box-shadow: 0 0 0 3px rgb(124 245 157 / .09); }
  .server-dot.connecting { background: #d4bc69; box-shadow: 0 0 0 3px rgb(212 188 105 / .07); animation: connection-pulse 1.4s ease-in-out infinite; }
  .server-dot.offline { background: #59675f; }
  .context-copy { display: block; min-width: 0; line-height: 1.05; }
  .context-copy > span { display: block; overflow: hidden; color: #82958a; font-size: .55rem; letter-spacing: .08em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  .context-copy strong { display: block; max-width: 9rem; overflow: hidden; margin-top: .25rem; color: #effff2; font-size: .72rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .context-copy > strong:first-child { margin-top: 0; }
  .remote-badge { display: none; border: 1px solid #5f4c2b; background: #21190d; padding: .2rem .35rem; color: #f4c46d; font-size: .52rem; letter-spacing: .1em; text-transform: uppercase; }
  .room-utilities { position: relative; display: flex; flex: 0 0 auto; align-items: center; gap: .1rem; }
  .room-connection { display: inline-flex; align-items: center; gap: .35rem; padding: 0 .35rem; color: #8ea397; font-size: .52rem; font-weight: 650; letter-spacing: .07em; text-transform: uppercase; }
  .connection-dot { width: .38rem; height: .38rem; flex: 0 0 auto; border-radius: 999px; background: #7cf59d; box-shadow: 0 0 7px rgb(124 245 157 / .28); }
  .room-connection.offline { color: #d2a16c; }
  .room-connection.offline .connection-dot { background: #f4a85f; box-shadow: 0 0 7px rgb(244 168 95 / .22); }
  .room-connection.deleted { color: #d99583; }
  .room-connection.deleted .connection-dot { border-radius: 1px; background: #dc6f66; box-shadow: none; }
  .room-connection.cached { color: #7c8d82; }
  .room-connection.cached .connection-dot { background: #718277; box-shadow: none; }
  .room-connection.connecting { color: #c2bc72; }
  .room-connection.connecting .connection-dot { background: #e4e78d; animation: connection-pulse 1.4s ease-in-out infinite; }
  .browse-button { display: flex; flex: 0 0 auto; align-items: center; gap: .4rem; border: 1px solid #34483a; background: #0b120d; padding: .45rem .55rem; color: #c9dfce; font-size: .65rem; }
  .browse-button:hover, .browse-button[aria-expanded="true"] { border-color: #7cf59d; color: #effff2; }
  .browse-button.has-notice { border-color: #477e57; }
  .browse-label { display: none; }
  .room-count { display: grid; min-width: 1.15rem; height: 1.15rem; place-items: center; background: #17241b; color: #9bf6b3; font-size: .58rem; }
  .server-notice { position: relative; width: .48rem; height: .48rem; flex: 0 0 auto; border-radius: 999px; background: #7cf59d; box-shadow: 0 0 0 3px rgb(124 245 157 / .1), 0 0 10px rgb(124 245 157 / .38); }
  .server-notice::after { position: absolute; inset: -.25rem; border: 1px solid rgb(124 245 157 / .55); border-radius: inherit; content: ""; animation: server-notice-pulse 1.8s ease-out infinite; }
  .embedded-notice { margin-left: .1rem; }
  .nav-scrim { position: fixed; z-index: 79; inset: 0; border: 0; background: rgb(0 0 0 / .42); cursor: default; backdrop-filter: blur(2px); }
  .room-switcher { position: fixed; z-index: 80; top: 3.7rem; left: .75rem; width: min(27rem, calc(100vw - 1.5rem)); max-height: min(38rem, calc(100dvh - 4.45rem)); overflow-y: auto; border: 1px solid #496451; background: rgb(7 12 9 / .99); box-shadow: 0 24px 64px rgb(0 0 0 / .62); }
  .switcher-header { position: sticky; z-index: 1; top: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #293832; background: rgb(9 14 11 / .97); padding: 1rem; backdrop-filter: blur(12px); }
  .switcher-header p { color: #effff2; font-size: .8rem; font-weight: 650; }
  .switcher-header span { display: block; max-width: 19rem; margin-top: .35rem; color: #82958a; font-size: .65rem; line-height: 1.45; }
  .switcher-header button { color: #91a59a; font-size: 1.1rem; line-height: 1; }
  .switcher-header button:hover { color: white; }
  .server-section { border-bottom: 1px solid #243229; padding: .65rem; }
  .server-section:last-child { border-bottom: 0; }
  .server-heading { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .65rem; padding: .25rem .35rem .55rem; }
  .server-heading > span:nth-child(2) { min-width: 0; }
  .server-heading strong { display: block; overflow: hidden; color: #dfffe7; font-size: .7rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
  .server-heading small { display: block; overflow: hidden; margin-top: .2rem; color: #73867a; font-size: .58rem; text-overflow: ellipsis; text-transform: lowercase; white-space: nowrap; }
  .server-heading small.online { color: #7cf59d; }
  .server-avatar { display: grid; width: 1.8rem; height: 1.8rem; place-items: center; border: 1px solid #3c5544; background: #121b15; color: #a8c9b0; font-size: .62rem; font-weight: 750; }
  .server-avatar.home { border-color: #477e57; color: #7cf59d; }
  .server-avatar.remote { border-color: #66522f; color: #f4c46d; }
  .server-avatar.previous { border-color: #5d5b39; color: #e4e78d; }
  .workspace-link { border: 1px solid #34483a; padding: .35rem .5rem; color: #a9cbb1; font-size: .58rem; }
  .workspace-link:hover { border-color: #7cf59d; color: #effff2; }
  .server-kind { border: 1px solid #5f4c2b; padding: .2rem .3rem; color: #dcae59; font-size: .5rem; letter-spacing: .08em; text-transform: uppercase; }
  .server-kind.previous { border-color: #5d5b39; color: #e4e78d; }
  .room-list { display: grid; gap: .12rem; border: 1px solid #202d25; background: #090e0b; padding: .3rem; }
  .room-row, .empty-room { display: grid; width: 100%; align-items: center; border: 1px solid transparent; background: transparent; padding: .62rem .65rem; text-align: left; }
  .room-row { grid-template-columns: auto minmax(0, 1fr) auto auto; gap: .6rem; color: #91a59a; }
  .room-row:hover { background: #111a14; color: #effff2; }
  .room-row.active { border-color: transparent; background: #17241b; color: #effff2; box-shadow: inset 3px 0 #7cf59d; }
  .hash { color: #587060; font-size: .8rem; }
  .room-name { display: flex; min-width: 0; flex-direction: column; overflow: hidden; font-size: .72rem; }
  .room-name > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .key-mode { margin-top: .08rem; color: #d6ce77; font-size: .47rem; letter-spacing: .05em; text-transform: uppercase; }
  .active-label { color: #7cf59d; font-size: .5rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .empty-room { grid-template-columns: 1fr auto; border-color: #293832; border-style: dashed; color: #91a59a; font-size: .68rem; }
  .empty-room:hover { border-color: #7cf59d; color: #dfffe7; }
  .previous-local-guidance { margin: .55rem .35rem .15rem; color: #9d9e7d; font-size: .57rem; line-height: 1.45; }

  @media (min-width: 520px) {
    .browse-label, .remote-badge { display: block; }
    .context-copy strong { max-width: 14rem; }
    .room-switcher { left: 1rem; }
  }

  @media (max-width: 700px) {
    .connection-label { display: none; }
    .room-connection { padding-inline: .2rem; }
  }

  @media (max-width: 420px) {
    .workspace-nav { gap: .35rem; }
    .active-context { gap: .4rem; padding-left: .45rem; }
    .context-copy strong { max-width: 6.5rem; }
    .room-utilities { gap: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .server-notice::after { animation: none; }
    .brand-wordmark, .brand-wordmark::after, .brand-tooltip { transition: none; }
  }

  @keyframes server-notice-pulse {
    0% { opacity: .85; transform: scale(.55); }
    70%, 100% { opacity: 0; transform: scale(1.65); }
  }
  @keyframes connection-pulse { 50% { opacity: .35; } }
</style>
