import { nip19 } from "nostr-tools";

export interface ChatInvite {
  groupId: string;
  coordinatorPubkey: string;
  relayUrls: string[];
  title?: string;
}

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

/** A self-contained invite: group, coordinator identity, and relay hints travel together. */
export function createInviteUrl(origin: string, invite: ChatInvite): string {
  const coordinator = nip19.nprofileEncode({
    pubkey: invite.coordinatorPubkey,
    relays: invite.relayUrls,
  });
  const meta = base64UrlEncode({ title: invite.title ?? "Chat" });
  return `${origin.replace(/\/$/, "")}/chat/${encodeURIComponent(invite.groupId)}?c=${coordinator}&m=${meta}`;
}

export function parseInviteUrl(value: string): ChatInvite | null {
  try {
    const url = new URL(value, window.location.origin);
    const match = url.pathname.match(/^\/chat\/([^/]+)$/);
    const coordinator = url.searchParams.get("c")?.trim();
    if (!match || !coordinator) return null;

    const decoded = nip19.decode(coordinator);
    if (decoded.type !== "nprofile") return null;
    const rawMeta = url.searchParams.get("m");
    const meta = rawMeta ? base64UrlDecode(rawMeta) : {};
    const title = typeof (meta as { title?: unknown }).title === "string"
      ? (meta as { title: string }).title
      : undefined;

    return {
      groupId: decodeURIComponent(match[1]),
      coordinatorPubkey: decoded.data.pubkey,
      relayUrls: decoded.data.relays ?? [],
      title,
    };
  } catch {
    return null;
  }
}
