import { ExtensionSigner, NostrConnectSigner } from "applesauce-signers/signers";
import type { NostrPool } from "applesauce-signers";
import type { NostrSigner } from "@contextvm/sdk/core";
import { SimplePool, type Event as NostrEvent, type Filter } from "nostr-tools";
import { Observable } from "rxjs";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

export const PROFILE_RELAYS = ["wss://purplepag.es", "wss://relay.damus.io"] as const;
export const NIP46_CONNECT_RELAYS = ["wss://bucket.coracle.social"] as const;

export type UserAuthMethod = "anonymous" | "nip07" | "nip46";
export type UserProfileStatus = "idle" | "connecting" | "loading" | "ready" | "error";

export interface NostrProfile {
  name?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
  about?: string;
}

interface NostrConnectPool {
  adapter: NostrPool;
  destroy: () => void;
}

export class UserProfileStore {
  method = $state<UserAuthMethod>("anonymous");
  pubkey = $state("");
  anonymousName = $state("");
  profile = $state<NostrProfile | null>(null);
  status = $state<UserProfileStatus>("idle");
  error = $state("");
  private signer: NostrSigner | null = null;
  private remoteSigner: NostrConnectSigner | null = null;
  private remotePool: NostrConnectPool | null = null;

  get displayName(): string {
    return this.profile?.display_name?.trim()
      || this.profile?.name?.trim()
      || this.anonymousName.trim()
      || "anon";
  }

  get authLabel(): string {
    if (this.method === "nip07") return "NIP-07";
    if (this.method === "nip46") return "NIP-46";
    return "local";
  }

  get avatarUrl(): string {
    return this.profile?.picture?.trim() || createPubkeyAvatar(this.pubkey || "anon");
  }

  get nip07Available(): boolean {
    return typeof window !== "undefined" && "nostr" in window;
  }

  get activeSigner(): NostrSigner | null {
    return this.signer;
  }

  setAnonymous(pubkey: string, name = ""): void {
    if (this.method !== "anonymous") return;
    this.pubkey = pubkey;
    this.anonymousName = name;
    this.status = "ready";
  }

  async connectNip07(): Promise<NostrSigner> {
    this.status = "connecting";
    this.error = "";
    try {
      const signer = new ExtensionSigner() as unknown as NostrSigner;
      await this.adoptSigner(signer, "nip07");
      return signer;
    } catch (cause) {
      this.status = "error";
      this.error = cause instanceof Error ? cause.message : "Could not connect the NIP-07 signer";
      throw cause;
    }
  }

  async connectNip46(bunkerUri: string): Promise<NostrSigner> {
    this.status = "connecting";
    this.error = "";
    const connection = createNostrConnectPool();
    try {
      const parsed = NostrConnectSigner.parseBunkerURI(bunkerUri.trim());
      const remote = new NostrConnectSigner({
        relays: parsed.relays,
        remote: parsed.remote,
        bunkerSecret: parsed.bunkerSecret ?? parsed.secret,
        pool: connection.adapter,
      });
      await withTimeout(remote.connect(parsed.bunkerSecret ?? parsed.secret), 20_000, "Remote signer timed out");
      this.remoteSigner = remote;
      this.remotePool?.destroy();
      this.remotePool = connection;
      await this.adoptSigner(remote as unknown as NostrSigner, "nip46");
      return remote as unknown as NostrSigner;
    } catch (cause) {
      connection.destroy();
      this.status = "error";
      this.error = cause instanceof Error ? cause.message : "Could not connect the NIP-46 signer";
      throw cause;
    }
  }

  createNip46Request(relays: readonly string[] = NIP46_CONNECT_RELAYS): { signer: NostrConnectSigner; uri: string } {
    this.status = "connecting";
    this.error = "";
    const connection = createNostrConnectPool();
    const signer = new NostrConnectSigner({ relays: [...relays], pool: connection.adapter });
    this.remoteSigner = signer;
    this.remotePool?.destroy();
    this.remotePool = connection;
    return {
      signer,
      uri: signer.getNostrConnectURI({ name: "Cordn Ad-Hoc", url: window.location.origin }),
    };
  }

  async adoptNip46(signer: NostrConnectSigner): Promise<NostrSigner> {
    await this.adoptSigner(signer as unknown as NostrSigner, "nip46");
    return signer as unknown as NostrSigner;
  }

  cancelNip46Request(signer: NostrConnectSigner, closeSigner = true): void {
    if (this.remoteSigner !== signer || this.method !== "anonymous") return;
    if (closeSigner) void signer.close();
    this.remotePool?.destroy();
    this.remotePool = null;
    this.remoteSigner = null;
    this.status = "ready";
    this.error = "";
  }

  async logout(): Promise<void> {
    try {
      await this.remoteSigner?.logout();
    } catch {
      // A remote signer may already be offline; local logout still succeeds.
    }
    this.remotePool?.destroy();
    this.remotePool = null;
    this.remoteSigner = null;
    this.signer = null;
    this.method = "anonymous";
    this.profile = null;
    this.error = "";
    this.status = "ready";
  }

  async refreshProfile(): Promise<void> {
    if (this.method === "anonymous" || !this.pubkey) return;
    this.status = "loading";
    this.error = "";
    const pool = new SimplePool();
    try {
      const events = await pool.querySync(
        [...PROFILE_RELAYS],
        { kinds: [0], authors: [this.pubkey], limit: 1 },
        { maxWait: 4_000 },
      );
      const newest = events.sort((left, right) => right.created_at - left.created_at)[0];
      this.profile = newest ? parseKindZero(newest.content) : null;
      this.status = "ready";
    } catch {
      this.profile = null;
      this.status = "ready";
    } finally {
      pool.destroy();
    }
  }

  private async adoptSigner(signer: NostrSigner, method: Exclude<UserAuthMethod, "anonymous">): Promise<void> {
    const pubkey = await signer.getPublicKey();
    this.signer = signer;
    this.method = method;
    this.pubkey = pubkey;
    this.profile = null;
    await this.refreshProfile();
  }
}

export function parseKindZero(content: string): NostrProfile | null {
  try {
    const value = JSON.parse(content) as Record<string, unknown>;
    const profile: NostrProfile = {};
    for (const key of ["name", "display_name", "picture", "nip05", "about"] as const) {
      if (typeof value[key] === "string") profile[key] = value[key];
    }
    return profile;
  } catch {
    return null;
  }
}

export function createPubkeyAvatar(pubkey: string): string {
  const normalized = pubkey.toLowerCase().replace(/[^a-f0-9]/g, "") || "a110";
  const hue = Number.parseInt(normalized.slice(0, 6).padEnd(6, "0"), 16) % 360;
  const cells: string[] = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const index = (row * 3 + column) * 2;
      const pair = normalized.slice(index, index + 2).padEnd(2, normalized[index % normalized.length] || "a");
      if (Number.parseInt(pair, 16) % 2 === 0) continue;
      const mirror = 4 - column;
      cells.push(`<rect x="${column}" y="${row}" width="1" height="1"/>`);
      if (mirror !== column) cells.push(`<rect x="${mirror}" y="${row}" width="1" height="1"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><rect width="5" height="5" fill="hsl(${hue} 20% 10%)"/><g fill="hsl(${hue} 72% 68%)">${cells.join("")}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function fetchNostrProfiles(pubkeys: string[]): Promise<Map<string, NostrProfile>> {
  const authors = [...new SvelteSet(pubkeys.filter(Boolean))];
  const profiles = new SvelteMap<string, NostrProfile>();
  if (authors.length === 0) return profiles;

  const pool = new SimplePool();
  try {
    const events = await pool.querySync(
      [...PROFILE_RELAYS],
      { kinds: [0], authors, limit: Math.max(authors.length * 2, 20) },
      { maxWait: 4_000 },
    );
    const newestByAuthor = new SvelteMap<string, NostrEvent>();
    for (const event of events) {
      const current = newestByAuthor.get(event.pubkey);
      if (!current || event.created_at > current.created_at) newestByAuthor.set(event.pubkey, event);
    }
    for (const [pubkey, event] of newestByAuthor) {
      const profile = parseKindZero(event.content);
      if (profile) profiles.set(pubkey, profile);
    }
  } catch {
    // Missing metadata should never prevent a requester from being admitted.
  } finally {
    pool.destroy();
  }
  return profiles;
}

function createNostrConnectPool(): NostrConnectPool {
  const pool = new SimplePool();
  return {
    adapter: {
      subscription: (relays, filters) => new Observable<NostrEvent>((subscriber) => {
        let closed = 0;
        const subscriptions = (filters as Filter[]).map((filter) => pool.subscribeMany(relays, filter, {
          onevent: (event) => subscriber.next(event),
          onclose: () => {
            closed += 1;
            if (closed === filters.length) subscriber.complete();
          },
        }));
        return () => subscriptions.forEach((subscription) => subscription.close());
      }),
      publish: async (relays, event) => {
        await Promise.any(pool.publish(relays, event as NostrEvent));
      },
    },
    destroy: () => pool.destroy(),
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

export const userProfileStore = new UserProfileStore();
