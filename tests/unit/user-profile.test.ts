import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { NostrConnectSigner } from "applesauce-signers/signers";

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

vi.mock("nostr-tools", () => ({
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

const NIP07_SESSION_STORAGE_KEY = "cordn:v1:nip07-session";
const NIP07_PUBKEY = "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0";
const ANONYMOUS_PUBKEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
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

  test("initializes an established anonymous identity when no stored signer is selected", async () => {
    const store = new UserProfileStore();
    expect(store.initialized).toBe(false);
    expect(store.hasIdentity).toBe(false);

    const initialization = store.initialize(ANONYMOUS_PUBKEY, "River");
    expect(store.pubkey).toBe(ANONYMOUS_PUBKEY);
    expect(store.displayName).toBe("River");
    expect(store.hasIdentity).toBe(true);

    await initialization;
    expect(store.initialized).toBe(true);
    expect(store.method).toBe("anonymous");
    expect(store.status).toBe("ready");
  });

  test("adopts a later anonymous identity after bootstrap begins without a coordinator key", async () => {
    const store = new UserProfileStore();

    const initial = store.initialize("", "");
    const afterUnlock = store.initialize(ANONYMOUS_PUBKEY, "River");

    expect(afterUnlock).toBe(initial);
    await initial;
    expect(store.initialized).toBe(true);
    expect(store.method).toBe("anonymous");
    expect(store.pubkey).toBe(ANONYMOUS_PUBKEY);
    expect(store.displayName).toBe("River");
    expect(store.hasIdentity).toBe(true);
  });

  test("memoizes initialization and restores a stored NIP-07 session at most once", async () => {
    localStorage.setItem(NIP07_SESSION_STORAGE_KEY, JSON.stringify({ version: 1, method: "nip07" }));
    const store = new UserProfileStore();

    const first = store.initialize(ANONYMOUS_PUBKEY, "River");
    const second = store.initialize("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "Other");
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

    await store.initialize(ANONYMOUS_PUBKEY, "River");

    expect(store.initialized).toBe(true);
    expect(store.hasIdentity).toBe(true);
    expect(store.method).toBe("anonymous");
    expect(store.pubkey).toBe(ANONYMOUS_PUBKEY);
    expect(store.displayName).toBe("River");
    expect(store.status).toBe("ready");
    expect(store.error).toBe("");
  });

  test("restores a selected NIP-07 session in a new store", async () => {
    const signedIn = new UserProfileStore();
    await signedIn.connectNip07();
    expect(localStorage.getItem(NIP07_SESSION_STORAGE_KEY)).toBe(JSON.stringify({ version: 1, method: "nip07" }));

    const reloaded = new UserProfileStore();
    await reloaded.initialize(ANONYMOUS_PUBKEY, "River");
    expect(reloaded.initialized).toBe(true);
    expect(reloaded.method).toBe("nip07");
    expect(reloaded.pubkey).toBe(NIP07_PUBKEY);
  });

  test("keeps the initialized anonymous identity without a prior NIP-07 selection", async () => {
    const reloaded = new UserProfileStore();
    await reloaded.initialize(ANONYMOUS_PUBKEY, "River");
    expect(reloaded.initialized).toBe(true);
    expect(reloaded.hasIdentity).toBe(true);
    expect(reloaded.method).toBe("anonymous");
    expect(reloaded.pubkey).toBe(ANONYMOUS_PUBKEY);
    expect(reloaded.activeSigner).toBeNull();
  });

  test("ignores a malformed NIP-07 session marker", async () => {
    localStorage.setItem(NIP07_SESSION_STORAGE_KEY, JSON.stringify({ version: 2, method: "nip07" }));
    const reloaded = new UserProfileStore();
    await reloaded.initialize(ANONYMOUS_PUBKEY, "River");
    expect(reloaded.initialized).toBe(true);
    expect(reloaded.hasIdentity).toBe(true);
    expect(reloaded.method).toBe("anonymous");
    expect(reloaded.pubkey).toBe(ANONYMOUS_PUBKEY);
    expect(reloaded.activeSigner).toBeNull();
  });

  test("does not replace an active NIP-46 identity during initialization", async () => {
    const remoteSigner = {
      getPublicKey: vi.fn().mockResolvedValue(NIP46_PUBKEY),
    } as unknown as NostrConnectSigner;
    const store = new UserProfileStore();
    await store.adoptNip46(remoteSigner);

    await store.initialize(ANONYMOUS_PUBKEY, "River");

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
});
