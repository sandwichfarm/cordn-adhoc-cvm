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

test("participant menu opens from a non-self author, mentions through the composer, and offers only other active rooms", async ({ page }) => {
  const viewer = "e".repeat(64);
  const participant = "d".repeat(64);
  await page.goto("/");
  await seedGuestMessages(page, viewer, [{
    id: "participant-menu-message",
    sender: participant,
    name: "Participant",
    content: "Open my actions",
    createdAt: Date.now(),
  }, {
    id: "self-message",
    sender: viewer,
    name: "Guest",
    content: "Do not offer self actions",
    createdAt: Date.now() + 1,
  }]);
  await page.evaluate(() => {
    const activeRoom = {
      version: 1,
      id: "other-active-room",
      title: "Other active room",
      coordinatorPubkey: "a".repeat(64),
      coordinatorOrigin: window.location.origin,
      coordinatorName: "Other coordinator",
      relayUrls: ["ws://127.0.0.1:1"],
      name: "Guest",
      stablePubkey: "e".repeat(64),
      isHost: false,
      stateBase64: "",
      keyPackage: { reference: "other-room", publicBase64: "public", privateBase64: "private" },
      lastCursor: 0,
      messages: [],
      pending: [],
      membershipStatus: "active",
      createdAt: Date.now(),
    };
    const retiredRoom = { ...activeRoom, id: "retired-room", title: "History room", membershipStatus: "retired" };
    localStorage.setItem(`cordn-adhoc-chat-room:v2:${encodeURIComponent(activeRoom.coordinatorPubkey)}:${encodeURIComponent(activeRoom.id)}`, JSON.stringify(activeRoom));
    localStorage.setItem(`cordn-adhoc-chat-room:v2:${encodeURIComponent(retiredRoom.coordinatorPubkey)}:${encodeURIComponent(retiredRoom.id)}`, JSON.stringify(retiredRoom));
  });
  await page.reload();
  await page.getByRole("button", { name: /^Open room Recipient tracer guest/ }).click();

  const trigger = page.getByRole("button", { name: "Actions for Participant" });
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Actions for Guest" })).toHaveCount(0);
  await trigger.press("Enter");
  const menu = page.getByRole("dialog", { name: "Actions for Participant" });
  await expect(menu.getByRole("button", { name: "Mention" })).toBeFocused();
  await expect(menu.getByRole("button").allTextContents()).resolves.toEqual(["Mention", "Invite to room", "Follow on Nostr", "Highlight", "Ignore"]);
  await page.getByTestId("chat-composer").locator("input").evaluate((input) => input.removeAttribute("disabled"));
  await menu.getByRole("button", { name: "Mention" }).click();
  await expect(page.getByTestId("chat-composer").locator("input")).toBeFocused();
  await expect(page.getByTestId("chat-composer").locator("input")).toHaveValue("@Participant");

  await trigger.click();
  await menu.getByRole("button", { name: "Invite to room" }).click();
  const chooser = page.getByRole("dialog", { name: "Invite Participant to a room" });
  await expect(chooser.getByRole("button", { name: /Other active room/ })).toBeVisible();
  await expect(chooser).not.toContainText("Recipient tracer guest");
  await expect(chooser).not.toContainText("History room");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("ignore collapses each participant streak locally and highlight stays private across reload", async ({ page }) => {
  const viewer = "e".repeat(64);
  const participant = "d".repeat(64);
  await page.goto("/");
  await seedGuestMessages(page, viewer, [{
    id: "highlight-before-ignore",
    sender: participant,
    name: "Participant",
    content: "First local preference message",
    createdAt: Date.now(),
  }]);
  await page.reload();
  await page.getByRole("button", { name: /^Open room Recipient tracer guest/ }).click();
  const trigger = page.getByRole("button", { name: "Actions for Participant" });
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.click();
  await page.getByRole("dialog", { name: "Actions for Participant" }).getByRole("button", { name: "Highlight" }).click();
  await page.getByRole("button", { name: "Gold" }).click();
  await expect(page.getByTestId("guest-message-list").getByTestId("message-streak")).toHaveClass(/highlighted/);
  await trigger.click();
  await page.getByRole("dialog", { name: "Actions for Participant" }).getByRole("button", { name: "Ignore" }).click();
  const disclosure = page.getByRole("button", { name: /Participant posted 1 message/ });
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("First local preference message")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Open room Recipient tracer guest/ }).click();
  await expect(page.getByRole("button", { name: /Participant posted 1 message/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("body")).not.toContainText(participant);
});
