import { nip19 } from "nostr-tools";

export interface RoomHostIdentity {
  name: string;
  pubkey: string;
  avatar?: string;
}

export type CoordinatorKeyMode = "ephemeral" | "persistent";

export interface ChatInvite {
  groupId: string;
  coordinatorPubkey: string;
  relayUrls: string[];
  title?: string;
  coordinatorOrigin?: string;
  inviteToken?: string;
  host?: RoomHostIdentity;
  coordinatorKeyMode?: CoordinatorKeyMode;
}

interface InviteMetadata {
  title: string;
  coordinatorOrigin: string;
  host?: RoomHostIdentity;
  coordinatorKeyMode?: CoordinatorKeyMode;
}

const HOST_NAME_MAX_LENGTH = 96;
const HOST_AVATAR_MAX_LENGTH = 2_048;
const NOSTR_PUBKEY_PATTERN = /^[0-9a-f]{64}$/i;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

function base64UrlEncode(value: unknown): string {
  const bytes = encoder.encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): unknown {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return JSON.parse(decoder.decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))));
}

function normalizeHttpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function requireHttpOrigin(value: string): string {
  const origin = normalizeHttpOrigin(value);
  if (!origin) throw new TypeError("Chat invite origins must use http or https");
  return origin;
}

/**
 * Accept only the small, display-safe subset of host metadata that may travel
 * in an invite. Invalid optional metadata is intentionally ignored so older
 * and third-party invite links remain usable.
 */
export function normalizeRoomHostIdentity(value: unknown): RoomHostIdentity | undefined {
  if (!isRecord(value)) return undefined;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const pubkey = typeof value.pubkey === "string" ? value.pubkey.trim() : "";
  if (!name || name.length > HOST_NAME_MAX_LENGTH || !NOSTR_PUBKEY_PATTERN.test(pubkey)) return undefined;

  const avatar = normalizeShareSafeAvatar(value.avatar);
  return {
    name,
    pubkey,
    ...(avatar ? { avatar } : {}),
  };
}

function normalizeShareSafeAvatar(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > HOST_AVATAR_MAX_LENGTH) return undefined;
  try {
    const url = new URL(trimmed);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCoordinatorKeyMode(value: unknown): CoordinatorKeyMode | undefined {
  return value === "ephemeral" || value === "persistent" ? value : undefined;
}

/** A self-contained invite: group, coordinator identity, and relay hints travel together. */
export function createInviteUrl(origin: string, invite: ChatInvite): string {
  const shellOrigin = requireHttpOrigin(origin);
  const coordinatorOrigin = requireHttpOrigin(invite.coordinatorOrigin ?? shellOrigin);
  const host = normalizeRoomHostIdentity(invite.host);
  const coordinatorKeyMode = normalizeCoordinatorKeyMode(invite.coordinatorKeyMode);
  const coordinator = nip19.nprofileEncode({
    pubkey: invite.coordinatorPubkey,
    relays: invite.relayUrls,
  });
  const meta = base64UrlEncode({
    title: invite.title ?? "Chat",
    coordinatorOrigin,
    ...(host ? { host } : {}),
    ...(coordinatorKeyMode ? { coordinatorKeyMode } : {}),
  } satisfies InviteMetadata);
  const params = new URLSearchParams({ c: coordinator, m: meta });
  if (invite.inviteToken) params.set("i", invite.inviteToken);
  return `${shellOrigin}/chat/${encodeURIComponent(invite.groupId)}?${params}`;
}

export function parseInviteUrl(value: string): ChatInvite | null {
  try {
    const url = new URL(value, window.location.origin);
    const match = url.pathname.match(/^\/chat\/([^/]+)$/);
    const coordinator = url.searchParams.get("c")?.trim();
    if (!match || !coordinator) return null;

    const shellOrigin = normalizeHttpOrigin(url.origin);
    if (!shellOrigin) return null;

    const decoded = nip19.decode(coordinator);
    if (decoded.type !== "nprofile") return null;
    const rawMeta = url.searchParams.get("m");
    const meta = rawMeta ? base64UrlDecode(rawMeta) : {};
    const title = typeof (meta as { title?: unknown }).title === "string"
      ? (meta as { title: string }).title
      : undefined;
    const rawCoordinatorOrigin = (meta as { coordinatorOrigin?: unknown }).coordinatorOrigin;
    const coordinatorOrigin = rawCoordinatorOrigin === undefined
      ? shellOrigin
      : typeof rawCoordinatorOrigin === "string"
        ? normalizeHttpOrigin(rawCoordinatorOrigin)
        : null;
    if (!coordinatorOrigin) return null;
    const host = normalizeRoomHostIdentity((meta as { host?: unknown }).host);
    const coordinatorKeyMode = normalizeCoordinatorKeyMode(
      (meta as { coordinatorKeyMode?: unknown }).coordinatorKeyMode,
    );
    const inviteToken = url.searchParams.get("i")?.trim() || undefined;

    return {
      groupId: decodeURIComponent(match[1]),
      coordinatorPubkey: decoded.data.pubkey,
      relayUrls: decoded.data.relays ?? [],
      title,
      coordinatorOrigin,
      ...(inviteToken ? { inviteToken } : {}),
      ...(host ? { host } : {}),
      ...(coordinatorKeyMode ? { coordinatorKeyMode } : {}),
    };
  } catch {
    return null;
  }
}
