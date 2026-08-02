import { describe, expect, test } from "vitest";

import { createPubkeyAvatar, NIP46_CONNECT_RELAYS, parseKindZero, PROFILE_RELAYS } from "../../src/identity/user-profile.svelte";

describe("user profile helpers", () => {
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
});
