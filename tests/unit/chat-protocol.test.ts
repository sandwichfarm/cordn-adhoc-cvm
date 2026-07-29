import { generateSecretKey } from "nostr-tools";
import { describe, expect, test } from "vitest";
import { BrowserNostrSigner } from "../../src/crypto/browser-nostr-signer";
import {
  addMember,
  createKeyPackage,
  createRoomState,
  decryptMessage,
  encryptMessage,
  groupId,
  joinWelcome,
} from "../../src/chat/protocol";

describe("Feature: encrypted ad-hoc chat", () => {
  test("Scenario: an admitted invitee exchanges an MLS-encrypted chat message with the host", async () => {
    const hostSigner = new BrowserNostrSigner(generateSecretKey());
    const guestSigner = new BrowserNostrSigner(generateSecretKey());
    const hostKeyPackage = await createKeyPackage(await hostSigner.getPublicKey());
    const guestKeyPackage = await createKeyPackage(await guestSigner.getPublicKey());
    const hostInitialState = await createRoomState(hostKeyPackage.keyPackage, hostKeyPackage.privateKeyPackage);

    const admitted = await addMember(hostInitialState, guestKeyPackage.stored.publicBase64);
    const guestState = await joinWelcome(admitted.welcomeBase64, guestKeyPackage.stored);
    expect(groupId(guestState)).toBe(groupId(admitted.state));

    const outbound = await encryptMessage(guestState, {
      type: "message",
      id: "message-1",
      sender: await guestSigner.getPublicKey(),
      name: "River",
      content: "Hello from the invite link",
      createdAt: 1,
    });
    const received = await decryptMessage(admitted.state, outbound.opaqueBase64);

    expect(received.envelope).toMatchObject({ name: "River", content: "Hello from the invite link" });
  });
});
