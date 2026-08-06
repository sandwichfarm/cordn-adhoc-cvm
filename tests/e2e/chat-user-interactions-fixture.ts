import { expect, type Page } from "./established-installation-fixture";

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
