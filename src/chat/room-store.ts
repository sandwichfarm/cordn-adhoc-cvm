import type { NostrSigner } from "@contextvm/sdk/core";
import { generateSecretKey } from "nostr-tools";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";
import { BrowserNostrSigner } from "../crypto/browser-nostr-signer";
import type { ChatInvite } from "./invite";
import {
  addMember,
  createKeyPackage,
  createRoomState,
  decodeState,
  decryptMessage,
  encodeState,
  encryptMessage,
  groupId,
  joinWelcome,
  type ChatEnvelope,
  type LocalKeyPackage,
} from "./protocol";
import { ChatCoordinatorClient } from "./coordinator-client";

const ROOM_KEY_PREFIX = "cordn-adhoc-chat-room:";

export interface StoredMessage extends ChatEnvelope {
  cursor?: number;
  pending?: boolean;
}

export interface PendingMessage {
  id: string;
  opaqueBase64: string;
}

export interface StoredRoom {
  version: 1;
  id: string;
  title: string;
  coordinatorPubkey: string;
  relayUrls: string[];
  name: string;
  stablePubkey: string;
  isHost: boolean;
  stateBase64: string;
  keyPackage: LocalKeyPackage;
  anonymousSecretKey?: string;
  lastCursor: number;
  messages: StoredMessage[];
  pending: PendingMessage[];
  autoApprove?: boolean;
  joinRequestSent?: boolean;
}

export interface RoomStatus {
  connection: "connecting" | "connected" | "offline";
  detail?: string;
}

export class ChatRoomSession {
  private client: ChatCoordinatorClient | null = null;
  private timer: number | null = null;
  private syncing = false;
  private readonly listeners = new Set<() => void>();
  status: RoomStatus = { connection: "connecting" };

  constructor(public room: StoredRoom, private signer: NostrSigner) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    await this.sync();
    this.timer = window.setInterval(() => void this.sync(), 4_000);
    window.addEventListener("online", this.handleOnline);
  }

  stop(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener("online", this.handleOnline);
    void this.client?.close();
    this.client = null;
  }

  async send(content: string): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) return;
    const event: ChatEnvelope = {
      type: "message",
      id: crypto.randomUUID(),
      sender: this.room.stablePubkey,
      name: this.room.name,
      content: trimmed,
      createdAt: Date.now(),
    };
    const encrypted = await encryptMessage(decodeState(this.room.stateBase64), event);
    this.room.stateBase64 = encodeState(encrypted.state);
    this.room.messages = [...this.room.messages, { ...event, pending: true }];
    this.room.pending = [...this.room.pending, { id: event.id, opaqueBase64: encrypted.opaqueBase64 }];
    this.persist();
    await this.sync();
  }

  async setAutoApprove(enabled: boolean): Promise<void> {
    this.room.autoApprove = enabled;
    this.persist();
    await this.sync();
  }

  async approveJoinRequests(): Promise<void> {
    const client = this.getClient();
    await this.acceptJoinRequests(client);
    await this.sync();
  }

  async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    this.status = { connection: "connecting" };
    this.emit();
    try {
      const client = this.getClient();
      if (this.room.isHost && this.room.autoApprove !== false) await this.acceptJoinRequests(client);
      if (!this.room.isHost && this.room.joinRequestSent) await this.acceptWelcome(client);
      if (!this.room.isHost && this.room.joinRequestSent) {
        this.status = { connection: "connected", detail: "Waiting for the host to admit you" };
        return;
      }
      await this.flushPending(client);
      await this.pullMessages(client);
      this.status = { connection: "connected" };
    } catch (error) {
      this.status = { connection: "offline", detail: error instanceof Error ? error.message : "Coordinator unavailable" };
      await this.client?.close();
      this.client = null;
    } finally {
      this.syncing = false;
      this.persist();
      this.emit();
    }
  }

  private handleOnline = () => void this.sync();

  private getClient(): ChatCoordinatorClient {
    if (!this.client) {
      this.client = new ChatCoordinatorClient({ coordinatorPubkey: this.room.coordinatorPubkey, relayUrls: this.room.relayUrls }, this.signer);
    }
    return this.client;
  }

  private async acceptJoinRequests(client: ChatCoordinatorClient): Promise<void> {
    for (const request of await client.fetchJoinRequests(this.room.id)) {
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
    this.room.id = groupId(state);
    this.room.stateBase64 = encodeState(state);
    this.room.lastCursor = welcome.after ?? 0;
    this.room.joinRequestSent = false;
  }

  private async flushPending(client: ChatCoordinatorClient): Promise<void> {
    for (const pending of [...this.room.pending]) {
      const posted = await client.postGroupMessage(pending.opaqueBase64);
      this.room.lastCursor = Math.max(this.room.lastCursor, posted.cursor);
      this.room.messages = this.room.messages.map((message) => message.id === pending.id ? { ...message, cursor: posted.cursor, pending: false } : message);
      this.room.pending = this.room.pending.filter((message) => message.id !== pending.id);
    }
  }

  private async pullMessages(client: ChatCoordinatorClient): Promise<void> {
    const messages = await client.fetchMessages(this.room.id, this.room.lastCursor);
    let state = decodeState(this.room.stateBase64);
    for (const message of messages) {
      try {
        const decoded = await decryptMessage(state, message.msg_64);
        state = decoded.state;
        this.room.lastCursor = Math.max(this.room.lastCursor, message.cursor);
        if (decoded.envelope && !this.room.messages.some((entry) => entry.id === decoded.envelope?.id)) {
          this.room.messages = [...this.room.messages, { ...decoded.envelope, cursor: message.cursor }];
        }
      } catch {
        // A stale pre-join message is intentionally ignored. Its cursor is still
        // advanced so a coordinator replay cannot trap the client in a loop.
        this.room.lastCursor = Math.max(this.room.lastCursor, message.cursor);
      }
    }
    this.room.stateBase64 = encodeState(state);
  }

  private persist(): void {
    saveRoom(this.room);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export async function createHostedRoom(input: { title: string; coordinatorPubkey: string; relayUrls: string[]; autoApprove?: boolean }): Promise<StoredRoom> {
  const secret = generateSecretKey();
  const signer = new BrowserNostrSigner(secret);
  const stablePubkey = await signer.getPublicKey();
  const key = await createKeyPackage(stablePubkey);
  const state = await createRoomState(key.keyPackage, key.privateKeyPackage);
  const room: StoredRoom = {
    version: 1,
    id: groupId(state),
    title: input.title.trim() || "Untitled chat",
    coordinatorPubkey: input.coordinatorPubkey,
    relayUrls: input.relayUrls,
    name: "Host",
    stablePubkey,
    isHost: true,
    stateBase64: encodeState(state),
    keyPackage: key.stored,
    anonymousSecretKey: bytesToHex(secret),
    lastCursor: 0,
    messages: [],
    pending: [],
    autoApprove: input.autoApprove ?? true,
  };
  saveRoom(room);
  return room;
}

export async function createJoiningRoom(input: { invite: ChatInvite; name: string; signer: NostrSigner; anonymousSecretKey?: string }): Promise<StoredRoom> {
  const stablePubkey = await input.signer.getPublicKey();
  const key = await createKeyPackage(stablePubkey);
  const room: StoredRoom = {
    version: 1,
    id: input.invite.groupId,
    title: input.invite.title || "Chat",
    coordinatorPubkey: input.invite.coordinatorPubkey,
    relayUrls: input.invite.relayUrls,
    name: input.name.trim() || "Anonymous",
    stablePubkey,
    isHost: false,
    stateBase64: "",
    keyPackage: key.stored,
    anonymousSecretKey: input.anonymousSecretKey,
    lastCursor: 0,
    messages: [],
    pending: [],
    joinRequestSent: true,
  };
  const client = new ChatCoordinatorClient({ coordinatorPubkey: room.coordinatorPubkey, relayUrls: room.relayUrls }, input.signer);
  try {
    await client.publishKeyPackage(key.stored.reference, key.stored.publicBase64);
    await client.storeJoinRequest(room.id, key.stored.reference);
  } finally {
    await client.close();
  }
  saveRoom(room);
  return room;
}

export function signerForStoredRoom(room: StoredRoom): BrowserNostrSigner | null {
  return room.anonymousSecretKey ? new BrowserNostrSigner(hexToBytes(room.anonymousSecretKey)) : null;
}

export function loadRoom(id: string): StoredRoom | null {
  try {
    const raw = localStorage.getItem(`${ROOM_KEY_PREFIX}${id}`);
    if (!raw) return null;
    const room = JSON.parse(raw) as StoredRoom;
    return room.version === 1 ? room : null;
  } catch {
    return null;
  }
}

export function saveRoom(room: StoredRoom): void {
  localStorage.setItem(`${ROOM_KEY_PREFIX}${room.id}`, JSON.stringify(room));
}
