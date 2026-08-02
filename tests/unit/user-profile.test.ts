import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { NostrConnectSigner } from "applesauce-signers/signers";
import { generateSecretKey, getPublicKey } from "nostr-tools";

const signerMocks = vi.hoisted(() => ({
  getPublicKey: vi.fn<() => Promise<string>>(),
}));

vi.mock("applesauce-signers/signers", () => ({
  ExtensionSigner: class {
    async getPublicKey(): Promise<string> {
      return signerMocks.getPublicKey();
    }
  },
  NostrConnectSigner: class {},
}));

vi.mock("nostr-tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("nostr-tools")>()),
  SimplePool: class {
    async querySync(): Promise<[]> {
      return [];
    }

    destroy(): void {}
  },
}));

import {
  createPubkeyAvatar,
  NIP46_CONNECT_RELAYS,
  parseKindZero,
  PROFILE_RELAYS,
  UserProfileStore,
} from "../../src/identity/user-profile.svelte";
import {
  ANONYMOUS_IDENTITY_STORAGE_KEY,
  prepareAnonymousIdentityReplacement,
} from "../../src/identity/anonymous-identity";
import { BrowserNostrSigner } from "../../src/crypto/browser-nostr-signer";

const NIP07_SESSION_STORAGE_KEY = "cordn:v1:nip07-session";
const NIP07_PUBKEY = "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0";
const NIP46_PUBKEY = "4646464646464646464646464646464646464646464646464646464646464646";

describe("user profile helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "nostr", { configurable: true, value: {} });
    signerMocks.getPublicKey.mockReset();
    signerMocks.getPublicKey.mockResolvedValue(NIP07_PUBKEY);
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "nostr");
  });

  test("uses the requested profile relays", () => {
    expect(PROFILE_RELAYS).toEqual(["wss://purplepag.es", "wss://relay.damus.io"]);
  });

  test("uses the Coracle bucket relay for NIP-46 connection requests", () => {
    expect(NIP46_CONNECT_RELAYS).toEqual(["wss://bucket.coracle.social"]);
  });

  test("parses supported kind 0 fields and ignores invalid metadata", () => {
    expect(parseKindZero(JSON.stringify({
      name: "river",
      display_name: "River",
      picture: "https://example.test/avatar.png",
      nip05: "river@example.test",
      ignored: 42,
    }))).toEqual({
      name: "river",
      display_name: "River",
      picture: "https://example.test/avatar.png",
      nip05: "river@example.test",
    });
    expect(parseKindZero("{not-json")).toBeNull();
  });

  test("creates stable, pubkey-specific local avatar images", () => {
    const first = createPubkeyAvatar("aa11bb22cc33dd44");
    expect(first).toBe(createPubkeyAvatar("aa11bb22cc33dd44"));
    expect(first).not.toBe(createPubkeyAvatar("ff11bb22cc33dd44"));
    expect(first.startsWith("data:image/svg+xml,")).toBe(true);
  });

  test("creates and reloads one durable anonymous identity while keeping the display name separate", async () => {
    const store = new UserProfileStore();
    expect(store.initialized).toBe(false);
    expect(store.hasIdentity).toBe(false);

    await store.initialize("River");
    expect(store.initialized).toBe(true);
    expect(store.method).toBe("anonymous");
    expect(store.status).toBe("ready");
    expect(store.activeSigner).not.toBeNull();

    const firstPubkey = store.pubkey;
    const firstAvatar = store.avatarUrl;
    const record = JSON.parse(localStorage.getItem(ANONYMOUS_IDENTITY_STORAGE_KEY) ?? "null") as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual(["secretKeyHex", "version"]);
    expect(record.version).toBe(1);
    expect(typeof record.secretKeyHex).toBe("string");

    const reloaded = new UserProfileStore();
    await reloaded.initialize("River");
    expect(reloaded.pubkey).toBe(firstPubkey);
    expect(reloaded.avatarUrl).toBe(firstAvatar);
    expect(reloaded.displayName).toBe("River");
  });

  test("memoizes anonymous initialization without coordinator identity input", async () => {
    const store = new UserProfileStore();

    const initial = store.initialize("River");
    const afterUnlock = store.initialize("Other");

    expect(afterUnlock).toBe(initial);
    await initial;
    expect(store.initialized).toBe(true);
    expect(store.method).toBe("anonymous");
    expect(store.displayName).toBe("River");
    expect(store.hasIdentity).toBe(true);
  });

  test("memoizes initialization and restores a stored NIP-07 session at most once", async () => {
    localStorage.setItem(NIP07_SESSION_STORAGE_KEY, JSON.stringify({ version: 1, method: "nip07" }));
    const store = new UserProfileStore();

    const first = store.initialize("River");
    const second = store.initialize("Other");
    expect(second).toBe(first);

    await Promise.all([first, second]);
    expect(signerMocks.getPublicKey).toHaveBeenCalledTimes(1);
    expect(store.initialized).toBe(true);
    expect(store.method).toBe("nip07");
    expect(store.pubkey).toBe(NIP07_PUBKEY);
  });

  test("falls back to a ready anonymous identity when NIP-07 restoration fails", async () => {
    localStorage.setItem(NIP07_SESSION_STORAGE_KEY, JSON.stringify({ version: 1, method: "nip07" }));
    signerMocks.getPublicKey.mockRejectedValueOnce(new Error("Extension denied access"));
    const store = new UserProfileStore();

    await store.initialize("River");

    expect(store.initialized).toBe(true);
    expect(store.hasIdentity).toBe(true);
    expect(store.method).toBe("anonymous");
    expect(store.activeSigner).not.toBeNull();
    expect(store.displayName).toBe("River");
    expect(store.status).toBe("ready");
    expect(store.error).toBe("");
  });

  test("restores a selected NIP-07 session in a new store", async () => {
    const signedIn = new UserProfileStore();
    await signedIn.connectNip07();
    expect(localStorage.getItem(NIP07_SESSION_STORAGE_KEY)).toBe(JSON.stringify({ version: 1, method: "nip07" }));

    const reloaded = new UserProfileStore();
    await reloaded.initialize("River");
    expect(reloaded.initialized).toBe(true);
    expect(reloaded.method).toBe("nip07");
    expect(reloaded.pubkey).toBe(NIP07_PUBKEY);
  });

  test("keeps the initialized anonymous identity without a prior NIP-07 selection", async () => {
    const reloaded = new UserProfileStore();
    await reloaded.initialize("River");
    expect(reloaded.initialized).toBe(true);
    expect(reloaded.hasIdentity).toBe(true);
    expect(reloaded.method).toBe("anonymous");
    expect(reloaded.activeSigner).not.toBeNull();
  });

  test("ignores a malformed NIP-07 session marker", async () => {
    localStorage.setItem(NIP07_SESSION_STORAGE_KEY, JSON.stringify({ version: 2, method: "nip07" }));
    const reloaded = new UserProfileStore();
    await reloaded.initialize("River");
    expect(reloaded.initialized).toBe(true);
    expect(reloaded.hasIdentity).toBe(true);
    expect(reloaded.method).toBe("anonymous");
    expect(reloaded.activeSigner).not.toBeNull();
  });

  test("does not replace an active NIP-46 identity during initialization", async () => {
    const remoteSigner = {
      getPublicKey: vi.fn().mockResolvedValue(NIP46_PUBKEY),
    } as unknown as NostrConnectSigner;
    const store = new UserProfileStore();
    await store.adoptNip46(remoteSigner);

    await store.initialize("River");

    expect(store.initialized).toBe(true);
    expect(store.method).toBe("nip46");
    expect(store.pubkey).toBe(NIP46_PUBKEY);
    expect(store.activeSigner).toBe(remoteSigner);
  });

  test("clears a selected NIP-07 session on logout", async () => {
    const signedIn = new UserProfileStore();
    await signedIn.connectNip07();
    await signedIn.logout();
    expect(localStorage.getItem(NIP07_SESSION_STORAGE_KEY)).toBeNull();
  });

  test.each([
    "{",
    JSON.stringify({ version: 2, secretKeyHex: "00".repeat(32) }),
    JSON.stringify({ version: 1, secretKeyHex: "z".repeat(64) }),
    JSON.stringify({ version: 1, secretKeyHex: "00".repeat(31) }),
    JSON.stringify({ version: 1, secretKeyHex: "00".repeat(33) }),
  ])("requires explicit recovery for corrupt persisted identity", async (corruptRecord) => {
    localStorage.setItem(ANONYMOUS_IDENTITY_STORAGE_KEY, corruptRecord);
    const store = new UserProfileStore();

    await store.initialize("River");

    expect(store.recoveryRequired).toBe(true);
    expect(store.initialized).toBe(false);
    expect(store.hasIdentity).toBe(false);
    expect(localStorage.getItem(ANONYMOUS_IDENTITY_STORAGE_KEY)).toBe(corruptRecord);
    expect(store.error).toBe("Local identity needs recovery");
  });

  test("keeps the anonymous signer across authenticated selection and logout", async () => {
    const store = new UserProfileStore();
    await store.initialize("River");
    const anonymousSigner = store.activeSigner;
    const anonymousPubkey = store.pubkey;

    await store.connectNip07();
    expect(store.activeSigner).not.toBe(anonymousSigner);
    await store.logout();

    expect(store.method).toBe("anonymous");
    expect(store.activeSigner).toBe(anonymousSigner);
    expect(store.pubkey).toBe(anonymousPubkey);
  });

  test("keeps the anonymous signer across NIP-46 selection and logout", async () => {
    const store = new UserProfileStore();
    await store.initialize("River");
    const anonymousSigner = store.activeSigner;
    const anonymousPubkey = store.pubkey;
    const remoteSigner = {
      getPublicKey: vi.fn().mockResolvedValue(NIP46_PUBKEY),
    } as unknown as NostrConnectSigner;

    await store.adoptNip46(remoteSigner);
    await store.logout();

    expect(store.method).toBe("anonymous");
    expect(store.activeSigner).toBe(anonymousSigner);
    expect(store.pubkey).toBe(anonymousPubkey);
  });

  test("destroys secret-dependent signer operations without exposing private material", async () => {
    const secretKey = generateSecretKey();
    const signer = new BrowserNostrSigner(secretKey);
    secretKey.fill(0);
    const peerSecretKey = generateSecretKey();
    const peerPubkey = getPublicKey(peerSecretKey);
    peerSecretKey.fill(0);

    signer.destroy();

    await expect(signer.signEvent({ kind: 1, created_at: 1, tags: [], content: "" })).rejects.toThrow("Signer is no longer available");
    await expect(signer.nip44.encrypt(peerPubkey, "private message")).rejects.toThrow("Signer is no longer available");
    await expect(signer.nip44.decrypt(peerPubkey, "not-a-ciphertext")).rejects.toThrow("Signer is no longer available");
  });

  test("aborts a staged replacement without changing the canonical identity", async () => {
    const store = new UserProfileStore();
    await store.initialize("River");
    const canonicalPubkey = store.pubkey;
    const prepared = await prepareAnonymousIdentityReplacement();

    prepared.abort();

    await expect(prepared.signer.signEvent({ kind: 1, created_at: 1, tags: [], content: "" })).rejects.toThrow("Signer is no longer available");
    const reloaded = new UserProfileStore();
    await reloaded.initialize("River");
    expect(reloaded.pubkey).toBe(canonicalPubkey);
  });
});
