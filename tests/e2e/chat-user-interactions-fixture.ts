import { expect, type Page } from "./established-installation-fixture";
import { finalizeEvent, generateSecretKey, getPublicKey, nip44 } from "nostr-tools";

interface TestNip07Identity {
  secretKey: Uint8Array;
  pubkey: string;
}

export interface ControllableNip07 {
  pubkey: string;
  rejectNextSignature: () => void;
  replaceIdentity: () => string;
}

/** A page-lifetime NIP-07 bridge. Generated key material never enters the page's DOM or storage. */
export async function installControllableNip07(page: Page): Promise<ControllableNip07> {
  const secretKey = generateSecretKey();
  let identity: TestNip07Identity = { secretKey, pubkey: getPublicKey(secretKey) };
  let rejectNextSignature = false;
  await page.exposeFunction("__phase24Nip07Bridge", (operation: string, peerOrEvent: unknown, plaintext?: string) => {
    if (operation === "getPublicKey") return identity.pubkey;
    if (operation === "sign") {
      if (rejectNextSignature) {
        rejectNextSignature = false;
        throw new Error("Test signer rejected this envelope");
      }
      return finalizeEvent(peerOrEvent as Parameters<typeof finalizeEvent>[0], identity.secretKey);
    }
    const peer = String(peerOrEvent);
    const key = nip44.v2.utils.getConversationKey(identity.secretKey, peer);
    if (operation === "encrypt") return nip44.v2.encrypt(String(plaintext), key);
    if (operation === "decrypt") return nip44.v2.decrypt(String(plaintext), key);
    throw new Error("Unsupported NIP-07 bridge operation");
  });
  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __phase24Nip07Bridge?: (operation: string, peerOrEvent: unknown, plaintext?: string) => Promise<unknown>;
    };
    Object.defineProperty(window, "nostr", {
      configurable: true,
      value: {
        getPublicKey: async () => testWindow.__phase24Nip07Bridge?.("getPublicKey", ""),
        signEvent: async (event: unknown) => testWindow.__phase24Nip07Bridge?.("sign", event),
        nip44: {
          encrypt: async (peer: string, plaintext: string) => testWindow.__phase24Nip07Bridge?.("encrypt", peer, plaintext),
          decrypt: async (peer: string, ciphertext: string) => testWindow.__phase24Nip07Bridge?.("decrypt", peer, ciphertext),
        },
      },
    });
  });
  return {
    get pubkey() { return identity.pubkey; },
    rejectNextSignature: () => { rejectNextSignature = true; },
    replaceIdentity: () => {
      const nextSecret = generateSecretKey();
      identity = { secretKey: nextSecret, pubkey: getPublicKey(nextSecret) };
      return identity.pubkey;
    },
  };
}

interface StoredMessageView {
  id: string;
  recipientPubkeys?: string[];
  auth?: unknown;
  content?: string;
}

interface StoredRoomView {
  id: string;
  coordinatorPubkey: string;
  stablePubkey: string;
  messages: StoredMessageView[];
}

/**
 * Keep browser-only inspection on the recipient side.  Tests deliberately
 * never inspect a relay event's ciphertext as if it were decrypted content.
 */
export async function storedRoom(page: Page, title: string): Promise<StoredRoomView | null> {
  return page.evaluate((expectedTitle) => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:v2:")) continue;
      try {
        const room = JSON.parse(localStorage.getItem(key) ?? "null") as (StoredRoomView & { title?: string }) | null;
        if (room?.title === expectedTitle) return room;
      } catch {
        // A malformed unrelated entry must not make the browser helper fail.
      }
    }
    return null;
  }, title);
}

export async function waitForStoredMessage(
  page: Page,
  roomTitle: string,
  predicate: (message: StoredMessageView) => boolean,
): Promise<StoredMessageView> {
  await expect.poll(async () => ((await storedRoom(page, roomTitle))?.messages ?? []).some(predicate), {
    timeout: 20_000,
  }).toBe(true);
  const room = await storedRoom(page, roomTitle);
  const message = room?.messages.find(predicate);
  if (!message) throw new Error("Expected recipient-side message was not persisted");
  return message;
}

export async function roomIdentity(page: Page, title: string): Promise<Pick<StoredRoomView, "id" | "coordinatorPubkey" | "stablePubkey">> {
  await expect.poll(async () => await storedRoom(page, title), { timeout: 20_000 }).not.toBeNull();
  const room = await storedRoom(page, title);
  if (!room) throw new Error("Expected room was not persisted");
  return { id: room.id, coordinatorPubkey: room.coordinatorPubkey, stablePubkey: room.stablePubkey };
}
