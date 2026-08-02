import type { NostrSigner } from "@contextvm/sdk/core";
import { hexToBytes } from "nostr-tools/utils";
import { BrowserNostrSigner } from "../crypto/browser-nostr-signer";
import { notificationCenter } from "../notifications/notification-center.svelte";
import { normalizeRoomHostIdentity, type ChatInvite, type CoordinatorKeyMode, type RoomHostIdentity } from "./invite";
import {
  CHAT_EMOJI_SHORTCUTS,
  addMember,
  createKeyPackage,
  createRoomState,
  decodeState,
  decryptMessage,
  encodeState,
  encryptMessage,
  groupCreatorPubkey,
  groupId,
  hasValidChatEnvelopeAuth,
  isChatReactionMutation,
  joinWelcome,
  sanitizeChatEnvelopeHostBadge,
  signChatEnvelope,
  type ChatEmojiShortcut,
  type ChatEnvelope,
  type ChatReactionMutation,
  type LocalKeyPackage,
} from "./protocol";
import { ChatCoordinatorClient, type RemoteJoinRequest } from "./coordinator-client";

const ROOM_KEY_PREFIX = "cordn-adhoc-chat-room:";
const ROOM_KEY_V2_PREFIX = `${ROOM_KEY_PREFIX}v2:`;
const ACTIVE_HOST_ROOM_KEY_PREFIX = "cordn-adhoc-active-host-room:";
export const ROOMS_CHANGED_EVENT = "cordn:rooms-changed";
export const SERVER_ONLINE_EVENT = "cordn:server-online";
export const SERVER_OFFLINE_EVENT = "cordn:server-offline";

export interface StoredMessage extends ChatEnvelope {
  cursor?: number;
  pending?: boolean;
}

export interface PendingMessage {
  id: string;
  opaqueBase64: string;
}

/** Bounded latest-state record: one entry per message, emoji, and participant. */
export interface StoredReaction extends ChatReactionMutation {
  id: string;
  sender: string;
  createdAt: number;
  cursor?: number;
}

export interface ReactionSummary {
  emoji: ChatEmojiShortcut;
  count: number;
  viewerActive: boolean;
}

export interface RoomIdentity {
  name: string;
  avatar?: string;
  badgeLabel?: string;
  badgeEmoji?: string;
}

export interface StoredRoom {
  version: 1;
  id: string;
  title: string;
  coordinatorPubkey: string;
  coordinatorOrigin?: string;
  relayUrls: string[];
  name: string;
  avatar?: string;
  badgeLabel?: string;
  badgeEmoji?: string;
  stablePubkey: string;
  /** Retired records retain display cache only and must never create a session. */
  membershipStatus?: "active" | "retired";
  isHost: boolean;
  stateBase64: string;
  keyPackage: LocalKeyPackage;
  anonymousSecretKey?: string;
  lastCursor: number;
  messages: StoredMessage[];
  pending: PendingMessage[];
  /** Optional for version-1 cached rooms written before reactions existed. */
  reactions?: StoredReaction[];
  autoApprove?: boolean;
  inviteToken?: string;
  host?: RoomHostIdentity;
  coordinatorKeyMode?: CoordinatorKeyMode;
  joinRequestSent?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface AnonymousMembershipImpact {
  count: number;
}

export interface MembershipRetirementJournal {
  count: number;
  commit(): void;
  rollback(): void;
}

export interface RoomStatus {
  connection: "connecting" | "connected" | "offline";
  detail?: string;
}

export class ChatRoomSession {
  private client: ChatCoordinatorClient | null = null;
  private timer: number | null = null;
  private operationQueue: Promise<void> = Promise.resolve();
  private pendingSync: Promise<void> | null = null;
  private serverWasOnline = false;
  private stopped = false;
  private persistenceEnabled = true;
  private lifecycleGeneration = 0;
  private hasCompletedInitialMessageSync = false;
  private readonly knownJoinRequestIds = new Set<string>();
  private readonly listeners = new Set<() => void>();
  status: RoomStatus = { connection: "connecting" };
  pendingJoinRequests: RemoteJoinRequest[] = [];

  constructor(public room: StoredRoom, private signer: NostrSigner) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    const generation = ++this.lifecycleGeneration;
    this.stopped = false;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    await this.sync();
    if (this.stopped || generation !== this.lifecycleGeneration) return;
    this.timer = window.setInterval(() => void this.sync(), 4_000);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
  }

  stop(): void {
    this.lifecycleGeneration += 1;
    this.stopped = true;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    void this.client?.close();
    this.client = null;
  }

  /**
   * Permanently stop this session without allowing an in-flight operation to
   * write the room back to local storage. Use this before deleting or leaving
   * a room; `stop()` alone intentionally remains restartable.
   */
  discard(): void {
    this.persistenceEnabled = false;
    this.stop();
  }

  async send(content: string): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) return;
    await this.runExclusive(async () => {
      if (this.stopped || this.status.connection !== "connected") {
        throw new Error("The coordinator must be connected before you can send a message");
      }
      if (this.room.joinRequestSent) {
        throw new Error("Wait for the host to admit you before sending a message");
      }
      const event = await signChatEnvelope({
        type: "message",
        id: crypto.randomUUID(),
        sender: this.room.stablePubkey,
        name: this.room.name,
        avatar: this.room.avatar,
        badgeLabel: this.room.badgeLabel,
        badgeEmoji: this.room.badgeEmoji,
        content: trimmed,
        createdAt: Date.now(),
      }, this.signer);
      const encrypted = await encryptMessage(decodeState(this.room.stateBase64), event);
      this.room.stateBase64 = encodeState(encrypted.state);
      this.room.messages = [...this.room.messages, { ...event, pending: true }];
      this.room.pending = [...this.room.pending, { id: event.id, opaqueBase64: encrypted.opaqueBase64 }];
      this.persist();
      this.emit();
      await this.syncOnce();
    });
  }

  async setReaction(targetMessageId: string, emoji: ChatEmojiShortcut, active: boolean): Promise<void> {
    await this.runExclusive(async () => {
      if (this.stopped || this.status.connection !== "connected") {
        throw new Error("The coordinator must be connected before you can react");
      }
      if (this.room.joinRequestSent) throw new Error("Wait for the host to admit you before reacting");
      if (!this.room.messages.some((message) => message.id === targetMessageId)) {
        throw new Error("That message is no longer available for reactions");
      }
      if (!(CHAT_EMOJI_SHORTCUTS as readonly string[]).includes(emoji)) {
        throw new Error("That emoji is not available as a reaction");
      }
      const event = await signChatEnvelope({
        type: "message",
        id: crypto.randomUUID(),
        sender: this.room.stablePubkey,
        name: this.room.name,
        avatar: this.room.avatar,
        badgeLabel: this.room.badgeLabel,
        badgeEmoji: this.room.badgeEmoji,
        content: `${active ? "Reacted" : "Removed reaction"} ${emoji}`,
        createdAt: Date.now(),
        reaction: { targetMessageId, emoji, active },
      }, this.signer);
      const encrypted = await encryptMessage(decodeState(this.room.stateBase64), event);
      this.room.stateBase64 = encodeState(encrypted.state);
      this.applyReaction(event);
      this.room.pending = [...this.room.pending, { id: event.id, opaqueBase64: encrypted.opaqueBase64 }];
      this.persist();
      this.emit();
      await this.syncOnce();
    });
  }

  async toggleReaction(targetMessageId: string, emoji: ChatEmojiShortcut): Promise<void> {
    const current = reactionSummary(this.room, targetMessageId, this.room.stablePubkey)
      .find((reaction) => reaction.emoji === emoji);
    await this.setReaction(targetMessageId, emoji, !current?.viewerActive);
  }

  setIdentity(identity: RoomIdentity): void {
    this.room.name = identity.name.trim() || (this.room.isHost ? "Host" : "Anonymous");
    this.room.avatar = identity.avatar?.trim() || undefined;
    this.room.badgeLabel = identity.badgeLabel?.trim() || undefined;
    this.room.badgeEmoji = identity.badgeEmoji?.trim() || undefined;
    if (this.room.isHost) {
      this.room.host = normalizeRoomHostIdentity({
        name: this.room.name,
        pubkey: this.room.stablePubkey,
        avatar: this.room.avatar,
      });
    }
    this.persist();
    this.emit();
  }

  async setAutoApprove(enabled: boolean): Promise<void> {
    await this.runExclusive(async () => {
      this.room.autoApprove = enabled;
      this.persist();
      await this.syncOnce();
    });
  }

  async approveJoinRequests(): Promise<void> {
    await this.runExclusive(async () => {
      const client = this.getClient();
      const requests = this.pendingJoinRequests.length > 0
        ? [...this.pendingJoinRequests]
        : this.currentInviteRequests(await client.fetchJoinRequests(this.room.id));
      await this.acceptJoinRequests(client, requests);
      this.pendingJoinRequests = [];
      await this.syncOnce();
    });
  }

  async sync(): Promise<void> {
    if (this.stopped) return;
    if (this.pendingSync) return this.pendingSync;
    const operation = this.runExclusive(() => this.syncOnce());
    this.pendingSync = operation;
    try {
      await operation;
    } finally {
      if (this.pendingSync === operation) this.pendingSync = null;
    }
  }

  private async syncOnce(): Promise<void> {
    if (this.stopped) return;
    if (this.status.connection !== "connected" && this.status.connection !== "offline") {
      this.status = { connection: "connecting" };
      this.emit();
    }
    try {
      const client = this.getClient();
      if (this.room.isHost) {
        const requests = this.currentInviteRequests(await client.fetchJoinRequests(this.room.id));
        const newRequests = requests.filter((request) => !this.knownJoinRequestIds.has(request.kp_ref));
        for (const request of requests) this.knownJoinRequestIds.add(request.kp_ref);
        for (const request of newRequests) {
          notificationCenter.enqueue({
            category: "join_request",
            key: `${this.room.id}:${request.kp_ref}`,
            room: this.room.title,
            action: this.room.autoApprove !== false ? "joined" : "waiting",
          });
        }
        if (this.room.autoApprove !== false) {
          await this.acceptJoinRequests(client, requests);
          this.pendingJoinRequests = [];
        } else {
          this.pendingJoinRequests = requests;
        }
      }
      if (!this.room.isHost && this.room.joinRequestSent) await this.acceptWelcome(client);
      if (!this.room.isHost && this.room.joinRequestSent) {
        this.markServerOnline("Waiting for the host to admit you");
        return;
      }
      await this.flushPending(client);
      await this.pullMessages(client);
      if (this.stopped) return;
      this.markServerOnline();
    } catch (error) {
      this.markServerOffline(error instanceof Error ? error.message : "Coordinator unavailable");
      await this.client?.close();
      this.client = null;
    } finally {
      this.persist();
      this.emit();
    }
  }

  private handleOnline = () => void this.sync();
  private handleOffline = () => this.markServerOffline("Browser offline");

  private markServerOnline(detail?: string): void {
    this.status = { connection: "connected", detail };
    this.emit();
    if (this.serverWasOnline) return;
    this.serverWasOnline = true;
    window.dispatchEvent(new CustomEvent(SERVER_ONLINE_EVENT, {
      detail: {
        coordinatorPubkey: this.room.coordinatorPubkey,
        roomId: this.room.id,
      },
    }));
  }

  private markServerOffline(detail: string): void {
    const alreadyOffline = this.status.connection === "offline";
    this.serverWasOnline = false;
    this.status = { connection: "offline", detail };
    this.emit();
    if (alreadyOffline) return;
    window.dispatchEvent(new CustomEvent(SERVER_OFFLINE_EVENT, {
      detail: {
        coordinatorPubkey: this.room.coordinatorPubkey,
        roomId: this.room.id,
      },
    }));
  }

  private getClient(): ChatCoordinatorClient {
    if (!this.client) {
      this.client = new ChatCoordinatorClient({ coordinatorPubkey: this.room.coordinatorPubkey, relayUrls: this.room.relayUrls }, this.signer);
    }
    return this.client;
  }

  private currentInviteRequests(requests: RemoteJoinRequest[]): RemoteJoinRequest[] {
    if (!this.room.inviteToken) return requests;
    return requests.filter((request) => request.invite_token === this.room.inviteToken);
  }

  private async acceptJoinRequests(client: ChatCoordinatorClient, requests: RemoteJoinRequest[]): Promise<void> {
    for (const request of requests) {
      const consumed = await client.consumeKeyPackage(request.kp_ref);
      if (!consumed) continue;
      const event = consumed.event as { content?: string };
      const published = JSON.parse(event.content ?? "{}") as { params?: { arguments?: { kp_64?: string } } };
      const keyPackageBase64 = published.params?.arguments?.kp_64;
      if (!keyPackageBase64) continue;
      const added = await addMember(decodeState(this.room.stateBase64), keyPackageBase64);
      const posted = await client.postGroupMessage(added.commitBase64);
      this.room.stateBase64 = encodeState(added.state);
      this.room.lastCursor = Math.max(this.room.lastCursor, posted.cursor);
      await client.storeWelcome(consumed.pk, request.kp_ref, added.welcomeBase64, posted.cursor);
    }
  }

  private async acceptWelcome(client: ChatCoordinatorClient): Promise<void> {
    const welcome = (await client.fetchWelcomes()).find((entry) => entry.kp_ref === this.room.keyPackage.reference);
    if (!welcome) return;
    const state = await joinWelcome(welcome.welcome_64, this.room.keyPackage);
    if (groupId(state) !== this.room.id) {
      throw new Error("The coordinator welcome does not match this room");
    }
    this.room.host = reconcileRoomHostIdentity(this.room.host, groupCreatorPubkey(state));
    this.room.stateBase64 = encodeState(state);
    this.room.lastCursor = welcome.after ?? 0;
    this.room.joinRequestSent = false;
  }

  private async flushPending(client: ChatCoordinatorClient): Promise<void> {
    for (const pending of [...this.room.pending]) {
      const posted = await client.postGroupMessage(pending.opaqueBase64);
      this.room.lastCursor = Math.max(this.room.lastCursor, posted.cursor);
      this.room.messages = this.room.messages.map((message) => message.id === pending.id ? { ...message, cursor: posted.cursor, pending: false } : message);
      this.room.reactions = (this.room.reactions ?? []).map((reaction) => reaction.id === pending.id ? { ...reaction, cursor: posted.cursor } : reaction);
      this.room.pending = this.room.pending.filter((message) => message.id !== pending.id);
    }
  }

  private async pullMessages(client: ChatCoordinatorClient): Promise<void> {
    const messages = await client.fetchMessages(this.room.id, this.room.lastCursor);
    let state = decodeState(this.room.stateBase64);
    const shouldNotify = this.hasCompletedInitialMessageSync;
    for (const message of messages) {
      try {
        const decoded = await decryptMessage(state, message.msg_64, {
          expectedHostPubkey: groupCreatorPubkey(state) ?? undefined,
        });
        state = decoded.state;
        this.room.lastCursor = Math.max(this.room.lastCursor, message.cursor);
        if (decoded.envelope?.reaction) {
          this.applyReaction({ ...decoded.envelope, cursor: message.cursor });
        } else if (decoded.envelope && !this.room.messages.some((entry) => entry.id === decoded.envelope?.id)) {
          this.room.messages = [...this.room.messages, { ...decoded.envelope, cursor: message.cursor }];
          if (shouldNotify && decoded.envelope.sender !== this.room.stablePubkey) {
            notificationCenter.enqueue({
              category: "new_message",
              key: decoded.envelope.id,
              actor: decoded.envelope.name,
              room: this.room.title,
            });
          }
        }
      } catch {
        // A stale pre-join message is intentionally ignored. Its cursor is still
        // advanced so a coordinator replay cannot trap the client in a loop.
        this.room.lastCursor = Math.max(this.room.lastCursor, message.cursor);
      }
    }
    this.room.stateBase64 = encodeState(state);
    this.hasCompletedInitialMessageSync = true;
  }

  private persist(): void {
    if (!this.persistenceEnabled) return;
    saveRoom(this.room);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private applyReaction(envelope: ChatEnvelope & { cursor?: number }): void {
    const reaction = envelope.reaction;
    if (!reaction || !hasValidChatEnvelopeAuth(envelope) || !this.room.messages.some((message) => message.id === reaction.targetMessageId)) return;
    const next: StoredReaction = {
      id: envelope.id,
      sender: envelope.sender,
      createdAt: envelope.createdAt,
      cursor: envelope.cursor,
      ...reaction,
    };
    const key = reactionKey(next);
    const prior = (this.room.reactions ?? []).find((entry) => reactionKey(entry) === key);
    if (prior && !isLaterReaction(next, prior)) return;
    this.room.reactions = [...(this.room.reactions ?? []).filter((entry) => reactionKey(entry) !== key), next];
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

export async function createHostedRoom(input: { title: string; coordinatorPubkey: string; relayUrls: string[]; signer: NostrSigner; coordinatorOrigin?: string; autoApprove?: boolean; identity?: RoomIdentity; coordinatorKeyMode?: CoordinatorKeyMode }): Promise<StoredRoom> {
  const stablePubkey = await input.signer.getPublicKey();
  const key = await createKeyPackage(stablePubkey);
  const state = await createRoomState(key.keyPackage, key.privateKeyPackage);
  const name = input.identity?.name.trim() || "Host";
  const avatar = input.identity?.avatar?.trim() || undefined;
  const room: StoredRoom = {
    version: 1,
    id: groupId(state),
    title: input.title.trim() || "Untitled chat",
    coordinatorPubkey: input.coordinatorPubkey,
    coordinatorOrigin: input.coordinatorOrigin ?? window.location.origin,
    relayUrls: input.relayUrls,
    name,
    avatar,
    badgeLabel: input.identity?.badgeLabel?.trim() || "host",
    badgeEmoji: input.identity?.badgeEmoji,
    stablePubkey,
    isHost: true,
    stateBase64: encodeState(state),
    keyPackage: key.stored,
    lastCursor: 0,
    messages: [],
    pending: [],
    reactions: [],
    autoApprove: input.autoApprove ?? true,
    inviteToken: createInviteToken(),
    host: normalizeRoomHostIdentity({ name, pubkey: stablePubkey, avatar }),
    coordinatorKeyMode: input.coordinatorKeyMode,
    createdAt: Date.now(),
  };
  saveRoom(room);
  return room;
}

export async function createJoiningRoom(input: { invite: ChatInvite; name: string; signer: NostrSigner; avatar?: string }): Promise<StoredRoom> {
  const stablePubkey = await input.signer.getPublicKey();
  const key = await createKeyPackage(stablePubkey);
  const room: StoredRoom = {
    version: 1,
    id: input.invite.groupId,
    title: input.invite.title || "Chat",
    coordinatorPubkey: input.invite.coordinatorPubkey,
    coordinatorOrigin: input.invite.coordinatorOrigin ?? window.location.origin,
    relayUrls: input.invite.relayUrls,
    name: input.name.trim() || "Anonymous",
    avatar: input.avatar,
    stablePubkey,
    isHost: false,
    stateBase64: "",
    keyPackage: key.stored,
    lastCursor: 0,
    messages: [],
    pending: [],
    reactions: [],
    inviteToken: input.invite.inviteToken,
    host: normalizeRoomHostIdentity(input.invite.host),
    coordinatorKeyMode: input.invite.coordinatorKeyMode,
    joinRequestSent: true,
    createdAt: Date.now(),
  };
  const client = new ChatCoordinatorClient({ coordinatorPubkey: room.coordinatorPubkey, relayUrls: room.relayUrls }, input.signer);
  try {
    await client.publishKeyPackage(key.stored.reference, key.stored.publicBase64);
    await client.storeJoinRequest(room.id, key.stored.reference, room.inviteToken);
  } finally {
    await client.close();
  }
  saveRoom(room);
  return room;
}

/** Reject every send-capable attachment whose signer does not own this room's immutable key. */
export async function requireRoomSigner(room: Pick<StoredRoom, "stablePubkey" | "membershipStatus">, signer: NostrSigner): Promise<NostrSigner> {
  if (room.membershipStatus === "retired") {
    throw new Error("This room needs a fresh invite before it can reconnect");
  }
  if (await signer.getPublicKey() !== room.stablePubkey) {
    throw new Error("This signer does not match the identity that joined this room");
  }
  return signer;
}

/**
 * Read legacy room-local credentials only for controlled migration/retirement.
 * New rooms never write this field, and UI attachment always uses the active profile signer.
 */
export async function signerForStoredRoom(room: StoredRoom): Promise<BrowserNostrSigner | null> {
  const encoded = room.anonymousSecretKey;
  if (!encoded || !/^[0-9a-f]{64}$/i.test(encoded)) return null;
  try {
    const secret = hexToBytes(encoded);
    if (secret.length !== 32) return null;
    const signer = new BrowserNostrSigner(secret);
    await requireRoomSigner(room, signer);
    return signer;
  } catch {
    return null;
  }
}

/** Count distinct composite room memberships that would lose anonymous authority. */
export async function anonymousMembershipImpact(stablePubkey: string): Promise<AnonymousMembershipImpact> {
  const identities = new Set<string>();
  for (const { room } of storedRoomEntries()) {
    if (await belongsToAnonymousMembership(room, stablePubkey)) {
      identities.add(roomIdentityKey(room.coordinatorPubkey, room.id));
    }
  }
  return { count: identities.size };
}

/**
 * Retire local anonymous authority while retaining room presentation and decrypted cache.
 * The returned journal can restore every exact raw storage value until its commit boundary.
 */
export async function retireAnonymousMemberships(stablePubkey: string): Promise<MembershipRetirementJournal> {
  const originals = new Map<string, string | null>();
  const matching = new Map<string, Array<{ key: string; room: StoredRoom }>>();
  for (const entry of storedRoomEntries()) {
    if (!await belongsToAnonymousMembership(entry.room, stablePubkey)) continue;
    const identity = roomIdentityKey(entry.room.coordinatorPubkey, entry.room.id);
    const entries = matching.get(identity) ?? [];
    entries.push(entry);
    matching.set(identity, entries);
  }

  const capture = (key: string) => {
    if (!originals.has(key)) originals.set(key, localStorage.getItem(key));
  };
  let count = 0;
  for (const entries of matching.values()) {
    const authoritative = entries.find(({ key, room }) => key === roomStorageKey(room.coordinatorPubkey, room.id)) ?? entries[0];
    if (!authoritative) continue;
    const targetKey = roomStorageKey(authoritative.room.coordinatorPubkey, authoritative.room.id);
    capture(targetKey);
    for (const { key } of entries) capture(key);

    const retired: StoredRoom = {
      ...authoritative.room,
      membershipStatus: "retired",
      anonymousSecretKey: undefined,
      stateBase64: "",
      keyPackage: { reference: "", publicBase64: "", privateBase64: "" },
      pending: [],
      inviteToken: undefined,
      autoApprove: undefined,
      joinRequestSent: undefined,
      updatedAt: Date.now(),
    };
    localStorage.setItem(targetKey, JSON.stringify(retired));
    const verified = readStoredRoom(localStorage.getItem(targetKey));
    if (!sameRoomIdentity(verified, retired) || verified.membershipStatus !== "retired") continue;

    for (const { key } of entries) {
      if (key === targetKey) continue;
      const source = readStoredRoom(localStorage.getItem(key));
      if (sameRoomIdentity(source, retired)) localStorage.removeItem(key);
    }
    count += 1;
  }

  let closed = false;
  return {
    count,
    commit() {
      closed = true;
      originals.clear();
    },
    rollback() {
      if (closed) return;
      for (const [key, raw] of originals) {
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      }
      closed = true;
      window.dispatchEvent(new CustomEvent(ROOMS_CHANGED_EVENT, { detail: { action: "membership-rollback" } }));
    },
  };
}

async function belongsToAnonymousMembership(room: StoredRoom, stablePubkey: string): Promise<boolean> {
  if (room.stablePubkey === stablePubkey) return true;
  const encoded = room.anonymousSecretKey;
  if (!encoded || !/^[0-9a-f]{64}$/i.test(encoded)) return false;
  try {
    const secret = hexToBytes(encoded);
    if (secret.length !== 32) return false;
    return await new BrowserNostrSigner(secret).getPublicKey() === stablePubkey;
  } catch {
    return false;
  }
}

/** Resolve an explicit host, with deterministic fallbacks for legacy rooms. */
export function hostIdentityForRoom(room: StoredRoom): RoomHostIdentity {
  const host = normalizeRoomHostIdentity(room.host);
  if (room.isHost) {
    if (host) return host;
    return normalizeRoomHostIdentity({
      name: room.name.trim() || "Host",
      pubkey: room.stablePubkey,
      avatar: room.avatar,
    }) ?? { name: room.name.trim() || "Host", pubkey: room.stablePubkey };
  }
  if (!room.joinRequestSent && room.stateBase64) {
    try {
      return reconcileRoomHostIdentity(host, groupCreatorPubkey(decodeState(room.stateBase64)));
    } catch {
      // A corrupt cached state is handled by the normal room connection flow.
    }
  }
  if (room.joinRequestSent && host) return host;
  return unknownHostIdentity();
}

/** Keep claimed presentation only when MLS proves the same creator key. */
export function reconcileRoomHostIdentity(host: RoomHostIdentity | undefined, creatorPubkey: string | null): RoomHostIdentity {
  const normalized = normalizeRoomHostIdentity(host);
  if (creatorPubkey && normalized?.pubkey.toLowerCase() === creatorPubkey.toLowerCase()) return normalized;
  return unknownHostIdentity(creatorPubkey ?? "");
}

function unknownHostIdentity(pubkey = ""): RoomHostIdentity {
  return { name: "Unknown host", pubkey };
}

export function loadRoom(id: string, coordinatorPubkey?: string): StoredRoom | null {
  try {
    if (coordinatorPubkey) {
      const stored = readStoredRoom(localStorage.getItem(roomStorageKey(coordinatorPubkey, id)));
      if (stored?.id === id && stored.coordinatorPubkey === coordinatorPubkey) return stored;

      const legacyKey = `${ROOM_KEY_PREFIX}${id}`;
      const legacy = readStoredRoom(localStorage.getItem(legacyKey));
      if (legacy?.id !== id || legacy.coordinatorPubkey !== coordinatorPubkey) return null;
      migrateLegacyRoom(legacyKey, legacy);
      return legacy;
    }

    const matches = listRooms().filter((room) => room.id === id);
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}

export function listRooms(): StoredRoom[] {
  const rooms = new Map<string, { room: StoredRoom; currentKey: boolean; storageKey: string; sourceKeys: string[] }>();
  try {
    const entries: Array<{ key: string; raw: string }> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(ROOM_KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      entries.push({ key, raw });
    }

    for (const { key, raw } of entries) {
      const room = readStoredRoom(raw);
      if (!room) continue;
      const identity = roomIdentityKey(room.coordinatorPubkey, room.id);
      const currentKey = key === roomStorageKey(room.coordinatorPubkey, room.id);
      const existing = rooms.get(identity);
      if (!existing) {
        rooms.set(identity, { room, currentKey, storageKey: key, sourceKeys: [key] });
      } else {
        existing.sourceKeys.push(key);
        if (currentKey && !existing.currentKey) {
          existing.room = room;
          existing.currentKey = true;
          existing.storageKey = key;
        }
      }
    }

    for (const entry of rooms.values()) {
      if (!entry.currentKey) migrateLegacyRoom(entry.storageKey, entry.room);
    }

    for (const entry of rooms.values()) {
      const currentStorageKey = roomStorageKey(entry.room.coordinatorPubkey, entry.room.id);
      const current = readStoredRoom(localStorage.getItem(currentStorageKey));
      if (!sameRoomIdentity(current, entry.room)) continue;
      entry.room = current;
      entry.currentKey = true;
      for (const sourceKey of entry.sourceKeys) {
        if (sourceKey === currentStorageKey) continue;
        const source = readStoredRoom(localStorage.getItem(sourceKey));
        if (sameRoomIdentity(source, entry.room)) localStorage.removeItem(sourceKey);
      }
    }
  } catch {
    return [];
  }

  return Array.from(rooms.values(), ({ room }) => room).sort((left, right) => {
    const leftActivity = left.updatedAt ?? left.messages.at(-1)?.createdAt ?? left.createdAt ?? 0;
    const rightActivity = right.updatedAt ?? right.messages.at(-1)?.createdAt ?? right.createdAt ?? 0;
    return rightActivity - leftActivity || left.title.localeCompare(right.title);
  });
}

/** Read every validated persisted alias; callers that mutate authority must not use deduplicated room lists. */
function storedRoomEntries(): Array<{ key: string; room: StoredRoom }> {
  const entries: Array<{ key: string; room: StoredRoom }> = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(ROOM_KEY_PREFIX)) continue;
      const room = readStoredRoom(localStorage.getItem(key));
      if (room) entries.push({ key, room });
    }
  } catch {
    return [];
  }
  return entries;
}

export function rememberActiveHostRoom(room: StoredRoom): void {
  if (!room.isHost) return;
  try {
    localStorage.setItem(`${ACTIVE_HOST_ROOM_KEY_PREFIX}${room.coordinatorPubkey}`, room.id);
  } catch {
    // Room selection still works when storage is unavailable.
  }
}

export function loadRememberedHostRoom(coordinatorPubkey: string): StoredRoom | null {
  try {
    const roomId = localStorage.getItem(`${ACTIVE_HOST_ROOM_KEY_PREFIX}${coordinatorPubkey}`);
    if (!roomId) return null;
    const room = loadRoom(roomId, coordinatorPubkey);
    if (room?.isHost && room.coordinatorPubkey === coordinatorPubkey) return room;
    localStorage.removeItem(`${ACTIVE_HOST_ROOM_KEY_PREFIX}${coordinatorPubkey}`);
    return null;
  } catch {
    return null;
  }
}

export function forgetRememberedHostRoom(coordinatorPubkey: string): void {
  try {
    localStorage.removeItem(`${ACTIVE_HOST_ROOM_KEY_PREFIX}${coordinatorPubkey}`);
  } catch {
    // Nothing else depends on selection persistence.
  }
}

export function saveRoom(room: StoredRoom): void {
  room.updatedAt = Date.now();
  const currentKey = roomStorageKey(room.coordinatorPubkey, room.id);
  localStorage.setItem(currentKey, JSON.stringify(room));
  const verified = readStoredRoom(localStorage.getItem(currentKey));
  if (!sameRoomIdentity(verified, room)) return;
  const legacyKey = `${ROOM_KEY_PREFIX}${room.id}`;
  const legacy = readStoredRoom(localStorage.getItem(legacyKey));
  if (legacy?.id === room.id && legacy.coordinatorPubkey === room.coordinatorPubkey) {
    localStorage.removeItem(legacyKey);
  }
  window.dispatchEvent(new CustomEvent(ROOMS_CHANGED_EVENT, {
    detail: { roomId: room.id, coordinatorPubkey: room.coordinatorPubkey },
  }));
}

export function removeStoredRoom(room: Pick<StoredRoom, "id" | "coordinatorPubkey">): void {
  const currentKey = roomStorageKey(room.coordinatorPubkey, room.id);
  const current = readStoredRoom(localStorage.getItem(currentKey));
  if (sameRoomIdentity(current, room)) localStorage.removeItem(currentKey);

  const legacyKey = `${ROOM_KEY_PREFIX}${room.id}`;
  const legacy = readStoredRoom(localStorage.getItem(legacyKey));
  if (sameRoomIdentity(legacy, room)) localStorage.removeItem(legacyKey);

  const activeHostKey = `${ACTIVE_HOST_ROOM_KEY_PREFIX}${room.coordinatorPubkey}`;
  if (localStorage.getItem(activeHostKey) === room.id) localStorage.removeItem(activeHostKey);

  window.dispatchEvent(new CustomEvent(ROOMS_CHANGED_EVENT, {
    detail: { roomId: room.id, coordinatorPubkey: room.coordinatorPubkey, action: "removed" },
  }));
}

export function rotateRoomInvite(room: StoredRoom): StoredRoom {
  room.inviteToken = createInviteToken();
  saveRoom(room);
  return room;
}

function createInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The only authoritative room identity: coordinator public key plus room id. */
export function roomIdentityKey(coordinatorPubkey: string, id: string): string {
  return `${coordinatorPubkey}\u0000${id}`;
}

function roomStorageKey(coordinatorPubkey: string, id: string): string {
  return `${ROOM_KEY_V2_PREFIX}${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(id)}`;
}

function readStoredRoom(raw: string | null): StoredRoom | null {
  if (!raw) return null;
  try {
    const room = JSON.parse(raw) as unknown;
    if (!isRecord(room)
      || room.version !== 1
      || typeof room.id !== "string"
      || typeof room.title !== "string"
      || typeof room.coordinatorPubkey !== "string"
      || !isStringArray(room.relayUrls)
      || typeof room.name !== "string"
      || typeof room.stablePubkey !== "string"
      || typeof room.isHost !== "boolean"
      || typeof room.stateBase64 !== "string"
      || !isLocalKeyPackage(room.keyPackage)
      || typeof room.lastCursor !== "number"
      || !Number.isFinite(room.lastCursor)
      || !Array.isArray(room.messages)
      || !room.messages.every(isStoredMessage)
      || !Array.isArray(room.pending)
      || !room.pending.every(isPendingMessage)) return null;
    const stored = room as unknown as StoredRoom;
    if (stored.membershipStatus !== "active" && stored.membershipStatus !== "retired") {
      delete stored.membershipStatus;
    }
    if (stored.anonymousSecretKey !== undefined && (typeof stored.anonymousSecretKey !== "string" || !/^[0-9a-f]{64}$/i.test(stored.anonymousSecretKey))) {
      delete stored.anonymousSecretKey;
    }
    if (stored.coordinatorKeyMode !== "ephemeral" && stored.coordinatorKeyMode !== "persistent") {
      delete stored.coordinatorKeyMode;
    }
    const host = normalizeRoomHostIdentity(room.host);
    if (host) stored.host = host;
    else delete stored.host;
    const expectedHostPubkey = stored.isHost
      ? stored.stablePubkey
      : verifiedCreatorPubkeyFromStoredState(stored);
    const cachedReactions = Array.isArray(room.reactions)
      ? room.reactions.filter(isStoredReaction)
      : [];
    stored.messages = stored.messages.map((message) => sanitizeChatEnvelopeHostBadge(message, expectedHostPubkey));
    for (const message of stored.messages) {
      if (message.reaction && isChatReactionMutation(message.reaction) && hasValidChatEnvelopeAuth(message)) {
        cachedReactions.push({
          id: message.id,
          sender: message.sender,
          createdAt: message.createdAt,
          cursor: message.cursor,
          ...message.reaction,
        });
      }
    }
    stored.messages = stored.messages.filter((message) => !message.reaction || !isChatReactionMutation(message.reaction) || !hasValidChatEnvelopeAuth(message));
    stored.reactions = normalizeReactionProjection(cachedReactions);
    return stored;
  } catch {
    return null;
  }
}

function migrateLegacyRoom(storageKey: string, room: StoredRoom): void {
  const nextKey = roomStorageKey(room.coordinatorPubkey, room.id);
  const current = readStoredRoom(localStorage.getItem(nextKey));
  if (!sameRoomIdentity(current, room)) localStorage.setItem(nextKey, JSON.stringify(room));
  const verified = readStoredRoom(localStorage.getItem(nextKey));
  if (storageKey !== nextKey && sameRoomIdentity(verified, room)) {
    const source = readStoredRoom(localStorage.getItem(storageKey));
    if (sameRoomIdentity(source, room)) localStorage.removeItem(storageKey);
  }
}

export function sameRoomIdentity(left: Pick<StoredRoom, "coordinatorPubkey" | "id"> | null | undefined, right: Pick<StoredRoom, "coordinatorPubkey" | "id">): left is StoredRoom {
  return left?.coordinatorPubkey === right.coordinatorPubkey && left.id === right.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isLocalKeyPackage(value: unknown): value is LocalKeyPackage {
  return isRecord(value)
    && typeof value.reference === "string"
    && typeof value.publicBase64 === "string"
    && typeof value.privateBase64 === "string";
}

function isStoredMessage(value: unknown): value is StoredMessage {
  return isRecord(value)
    && value.type === "message"
    && typeof value.id === "string"
    && typeof value.sender === "string"
    && typeof value.name === "string"
    && typeof value.content === "string"
    && typeof value.createdAt === "number"
    && Number.isFinite(value.createdAt)
    && (value.auth === undefined || (isRecord(value.auth)
      && typeof value.auth.id === "string"
      && typeof value.auth.sig === "string"))
    && (value.cursor === undefined || (typeof value.cursor === "number" && Number.isFinite(value.cursor)))
    && (value.pending === undefined || typeof value.pending === "boolean");
}

function verifiedCreatorPubkeyFromStoredState(room: StoredRoom): string | undefined {
  if (room.joinRequestSent || !room.stateBase64) return undefined;
  try {
    return groupCreatorPubkey(decodeState(room.stateBase64)) ?? undefined;
  } catch {
    return undefined;
  }
}

function isPendingMessage(value: unknown): value is PendingMessage {
  return isRecord(value) && typeof value.id === "string" && typeof value.opaqueBase64 === "string";
}

export function reactionSummary(room: Pick<StoredRoom, "reactions">, targetMessageId: string, viewerPubkey: string): ReactionSummary[] {
  const summaries = new Map<ChatEmojiShortcut, ReactionSummary>();
  for (const reaction of room.reactions ?? []) {
    if (reaction.targetMessageId !== targetMessageId || !reaction.active) continue;
    const summary = summaries.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, viewerActive: false };
    summary.count += 1;
    summary.viewerActive ||= reaction.sender === viewerPubkey;
    summaries.set(reaction.emoji, summary);
  }
  return [...summaries.values()];
}

function isStoredReaction(value: unknown): value is StoredReaction {
  if (!isRecord(value)) return false;
  const validMutation = isChatReactionMutation({
    targetMessageId: value.targetMessageId,
    emoji: value.emoji,
    active: value.active,
  });
  return validMutation
    && typeof value.id === "string"
    && typeof value.sender === "string"
    && typeof value.createdAt === "number"
    && Number.isFinite(value.createdAt)
    && (value.cursor === undefined || (typeof value.cursor === "number" && Number.isFinite(value.cursor)));
}

function normalizeReactionProjection(reactions: StoredReaction[]): StoredReaction[] {
  const latest = new Map<string, StoredReaction>();
  for (const reaction of reactions) {
    const prior = latest.get(reactionKey(reaction));
    if (!prior || isLaterReaction(reaction, prior)) latest.set(reactionKey(reaction), reaction);
  }
  return [...latest.values()];
}

function reactionKey(reaction: Pick<StoredReaction, "targetMessageId" | "emoji" | "sender">): string {
  return `${reaction.targetMessageId}\u0000${reaction.emoji}\u0000${reaction.sender}`;
}

function isLaterReaction(next: StoredReaction, prior: StoredReaction): boolean {
  if (next.cursor !== undefined && prior.cursor !== undefined && next.cursor !== prior.cursor) return next.cursor > prior.cursor;
  if (next.createdAt !== prior.createdAt) return next.createdAt > prior.createdAt;
  return next.id > prior.id;
}
