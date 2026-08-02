import { describe, expect, test } from "vitest";
import { generateSecretKey } from "nostr-tools";

import {
  createGiftWrap,
  createLocalNip44Signer,
  unwrapGiftWrap,
} from "../../src/invites/nostr-envelope";
import {
  inviteEligibilityError,
  shouldAcceptInvite,
} from "../../src/invites/nostr-social.svelte";

describe("private Nostr presence and invites", () => {
  test("round-trips a gift-wrapped invite without exposing its sender or payload", async () => {
    const sender = createLocalNip44Signer(generateSecretKey());
    const recipient = createLocalNip44Signer(generateSecretKey());
    const recipientPubkey = await recipient.getPublicKey();
    const senderPubkey = await sender.getPublicKey();

    const wrapped = await createGiftWrap(sender, recipientPubkey, 24134, {
      type: "cordn-room-invite",
      inviteUrl: "https://cordn.test/chat/secret",
    }, 1059);

    expect(wrapped.pubkey).not.toBe(senderPubkey);
    expect(wrapped.content).not.toContain("cordn-room-invite");
    expect(wrapped.content).not.toContain("/chat/secret");
    expect(wrapped.tags).toEqual([["p", recipientPubkey]]);

    const opened = await unwrapGiftWrap(recipient, wrapped);
    expect(opened.sender).toBe(senderPubkey);
    expect(opened.kind).toBe(24134);
    expect(opened.payload).toEqual({
      type: "cordn-room-invite",
      inviteUrl: "https://cordn.test/chat/secret",
    });
  });

  test("enforces mutual-online egress and followed-sender ingress", () => {
    const now = 10_000;
    expect(inviteEligibilityError("mutual", ["mutual"], [{ pubkey: "mutual", expiresAt: now + 1 }], now)).toBeNull();
    expect(inviteEligibilityError("stranger", ["mutual"], [], now)).toMatch(/mutual follows/);
    expect(inviteEligibilityError("mutual", ["mutual"], [{ pubkey: "mutual", expiresAt: now }], now)).toMatch(/not currently online/);

    expect(shouldAcceptInvite("followed", ["followed"])).toBe(true);
    expect(shouldAcceptInvite("stranger", ["followed"])).toBe(false);
  });
});
