import { expect, test, type Page } from "./established-installation-fixture";
import { getEventHash } from "nostr-tools";
import { createInviteUrl } from "../../src/chat/invite";

interface SeedMessage {
  id: string;
  sender: string;
  name: string;
  content: string;
  createdAt: number;
  recipientPubkeys?: string[];
  auth?: { id: string; sig: string };
}

async function seedGuestMessages(page: Page, recipientPubkey: string, messages: SeedMessage[]): Promise<void> {
  await page.evaluate(({ recipient, seededMessages }) => {
    const coordinatorPubkey = "c".repeat(64);
    const roomId = "recipient-tracer-guest";
    const room = {
      version: 1,
      id: roomId,
      title: "Recipient tracer guest",
      coordinatorPubkey,
      coordinatorOrigin: window.location.origin,
      relayUrls: ["ws://127.0.0.1:1"],
      name: "Guest",
      stablePubkey: recipient,
      host: { name: "Host", pubkey: "d".repeat(64) },
      isHost: false,
      stateBase64: "",
      keyPackage: { reference: "recipient-tracer", publicBase64: "public", privateBase64: "private" },
      lastCursor: 0,
      messages: seededMessages.map((message) => ({ type: "message", ...message })),
      pending: [],
      coordinatorKeyMode: "ephemeral",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem(
      `cordn-adhoc-chat-room:v2:${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(roomId)}`,
      JSON.stringify(room),
    );
  }, { recipient: recipientPubkey, seededMessages: messages });
}

test("signed recipient tracer renders Mentioned you in the shared invitee presentation", async ({ page }) => {
  await page.goto("/");
  const guestPubkey = "b".repeat(64);
  const createdAt = Date.now();
  const eventId = getEventHash({
    kind: 9,
    pubkey: "d".repeat(64),
    created_at: Math.floor(createdAt / 1_000),
    tags: [["name", "Host"], ["p", guestPubkey]],
    content: "A signed recipient tracer message",
  });
  await seedGuestMessages(page, guestPubkey, [{
    id: "recipient-tracer-message",
    sender: "d".repeat(64),
    name: "Host",
    content: "A signed recipient tracer message",
    createdAt,
    recipientPubkeys: [guestPubkey],
    auth: { id: eventId, sig: "cordn" },
  }]);
  await page.reload();
  await page.getByRole("button", { name: /^Open room Recipient tracer guest/ }).click();
  await expect(page.getByTestId("guest-message-list").getByText("A signed recipient tracer message")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => {
    const raw = Object.entries(localStorage).find(([key]) => key.startsWith("cordn-adhoc-chat-room:v2:"))?.[1];
    const room = raw ? JSON.parse(raw) as { stablePubkey: string; messages: Array<{ recipientPubkeys?: string[]; auth?: unknown }> } : null;
    return room ? { stablePubkey: room.stablePubkey, recipientPubkeys: room.messages[0]?.recipientPubkeys, authenticated: Boolean(room.messages[0]?.auth) } : null;
  })).toEqual({ stablePubkey: guestPubkey, recipientPubkeys: [guestPubkey], authenticated: true });
  await expect(page.getByTestId("guest-message-list").getByTestId("mentioned-you")).toHaveText("Mentioned you");
});

test("targeted invite projection removes non-target layout artifacts before grouping", async ({ page }) => {
  const viewer = "e".repeat(64);
  const target = "b".repeat(64);
  const invite = createInviteUrl("https://chat.example", {
    groupId: "targeted-invite-projection",
    coordinatorPubkey: "a".repeat(64),
    relayUrls: ["wss://relay.example"],
    title: "Projection room",
  });

  await page.goto("/");
  await seedGuestMessages(page, viewer, [
    { id: "before", sender: "d".repeat(64), name: "Host", content: "Before targeted invite", createdAt: 1 },
    { id: "hidden-targeted-invite", sender: "d".repeat(64), name: "Host", content: invite, createdAt: 2, recipientPubkeys: [target] },
    { id: "after", sender: "d".repeat(64), name: "Host", content: "After targeted invite", createdAt: 3 },
    { id: "public-invite", sender: "f".repeat(64), name: "Public host", content: invite, createdAt: 4 },
  ]);
  await page.reload();
  await page.getByRole("button", { name: /^Open room Recipient tracer guest/ }).click();

  const log = page.getByTestId("guest-message-list");
  await expect(log.getByText("After targeted invite")).toBeVisible({ timeout: 20_000 });
  await expect(log.getByTestId("message-bubble").filter({ has: page.locator('[data-message-id="hidden-targeted-invite"]') })).toHaveCount(0);
  await expect(log.locator('[data-message-id="hidden-targeted-invite"]')).toHaveCount(0);
  await expect(log.getByRole("button", { name: /Join Projection room/ })).toHaveCount(1);
  await expect(log.getByTestId("message-streak").filter({ hasText: "Before targeted invite" })).toHaveAttribute("data-message-count", "2");
});
