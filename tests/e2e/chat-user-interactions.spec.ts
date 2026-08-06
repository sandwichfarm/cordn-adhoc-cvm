import { expect, installEstablishedInstallation, test, type Page } from "./established-installation-fixture";
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

interface FixtureInteraction {
  pane: "host" | "guest";
  operation: "invite" | "follow";
  recipientPubkeys?: string[];
  participant?: string;
  roomId?: string;
}

async function openMessageGroupFixture(page: Page, pane: "host" | "guest"): Promise<void> {
  await page.addInitScript(() => {
    const testWindow = window as typeof window & { __messageGroupFixtureEvents?: FixtureInteraction[] };
    testWindow.__messageGroupFixtureEvents = [];
    window.addEventListener("cahmls-test-interaction-started", (event) => {
      testWindow.__messageGroupFixtureEvents?.push((event as CustomEvent<FixtureInteraction>).detail);
    });
  });
  await page.goto(`/?__message-group-test-harness=1&pane=${pane}`);
  await expect(page.getByTestId("message-group-test-harness")).toBeVisible();
}

async function latestFixtureInteraction(page: Page): Promise<FixtureInteraction | undefined> {
  return page.evaluate(() => {
    const testWindow = window as typeof window & { __messageGroupFixtureEvents?: FixtureInteraction[] };
    return testWindow.__messageGroupFixtureEvents?.at(-1);
  });
}

async function settleFixtureInteraction(page: Page, operation: "invite" | "follow", outcome: "resolve" | "reject"): Promise<void> {
  await page.evaluate(({ operation, outcome }) => {
    window.dispatchEvent(new CustomEvent("cahmls-test-interaction-settle", { detail: { operation, outcome } }));
  }, { operation, outcome });
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

async function openSeededGuestRoom(page: Page): Promise<void> {
  const room = page.getByRole("button", { name: /^Open room Recipient tracer guest/ });
  if (!(await room.isVisible())) {
    const roomBrowser = page.getByRole("button", { name: "Open room browser" });
    if (await roomBrowser.isVisible()) await roomBrowser.click();
  }
  await room.click();
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
  await openSeededGuestRoom(page);
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
  await openSeededGuestRoom(page);

  const log = page.getByTestId("guest-message-list");
  await expect(log.getByText("After targeted invite")).toBeVisible({ timeout: 20_000 });
  await expect(log.getByTestId("message-bubble").filter({ has: page.locator('[data-message-id="hidden-targeted-invite"]') })).toHaveCount(0);
  await expect(log.locator('[data-message-id="hidden-targeted-invite"]')).toHaveCount(0);
  await expect(log.getByRole("button", { name: /Join Projection room/ })).toHaveCount(1);
  await expect(log.getByTestId("message-streak").filter({ hasText: "Before targeted invite" })).toHaveAttribute("data-message-count", "2");
});

test("host and guest participant fixtures deterministically cover targeted invite and authenticated follow UI", async ({ page }) => {
  const participant = "d".repeat(64);
  for (const pane of ["guest", "host"] as const) {
    await openMessageGroupFixture(page, pane);
    const trigger = page.getByRole("button", { name: "Actions for Participant" });
    await trigger.click();
    const menu = page.getByRole("dialog", { name: "Actions for Participant" });
    await menu.getByRole("button", { name: "Invite to room" }).click();
    const chooser = page.getByRole("dialog", { name: "Invite Participant to a room" });
    const room = chooser.getByRole("button", { name: /Fixture room/ });
    await room.click();
    await expect(chooser.getByRole("button", { name: "Sending invite…" })).toBeVisible();
    await expect.poll(() => latestFixtureInteraction(page)).toEqual({
      pane,
      operation: "invite",
      recipientPubkeys: [participant],
      roomId: "fixture-room",
    });
    await settleFixtureInteraction(page, "invite", "resolve");
    await expect(chooser).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByText("Invite sent to Participant.")).toBeAttached();

    await trigger.click();
    await menu.getByRole("button", { name: "Invite to room" }).click();
    await chooser.getByRole("button", { name: /Fixture room/ }).click();
    await settleFixtureInteraction(page, "invite", "reject");
    await expect(chooser.getByRole("status")).toContainText("Couldn’t send the invite");

    await page.keyboard.press("Escape");
    await trigger.click();
    const follow = menu.getByRole("button", { name: "Follow on Nostr" });
    await follow.click();
    await expect(menu.getByRole("button", { name: "Following Participant…" })).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => latestFixtureInteraction(page)).toEqual({ pane, operation: "follow", participant });
    await settleFixtureInteraction(page, "follow", "resolve");
    await expect(page.getByText("Now following Participant.")).toBeAttached();

    await follow.click();
    await expect(menu.getByRole("button", { name: "Following Participant…" })).toHaveAttribute("aria-busy", "true");
    await settleFixtureInteraction(page, "follow", "reject");
    await expect(menu.getByRole("status")).toContainText("Couldn’t complete that action. Check your connection and try again.");
  }
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
    id: "second-participant-menu-message",
    sender: "f".repeat(64),
    name: "Second participant",
    content: "Open my other actions",
    createdAt: Date.now() + 1,
  }, {
    id: "self-message",
    sender: viewer,
    name: "Guest",
    content: "Do not offer self actions",
    createdAt: Date.now() + 2,
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
  await openSeededGuestRoom(page);

  const trigger = page.getByRole("button", { name: "Actions for Participant" });
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Actions for Guest" })).toHaveCount(0);
  await trigger.press("Enter");
  const menu = page.getByRole("dialog", { name: "Actions for Participant" });
  await expect(menu.getByRole("button", { name: "Mention" })).toBeFocused();
  await expect(menu.getByRole("button").allTextContents()).resolves.toEqual(["Mention", "Invite to room", "Follow on Nostr", "Highlight", "Ignore"]);
  await expect(menu.getByRole("button", { name: "Follow on Nostr" })).toBeDisabled();
  await expect(menu).toContainText("Sign in to follow people on Nostr.");
  await page.getByTestId("chat-composer").locator("input").evaluate((input) => input.removeAttribute("disabled"));
  await menu.getByRole("button", { name: "Mention" }).click();
  await expect(page.getByTestId("chat-composer").locator("input")).toBeFocused();
  await expect(page.getByTestId("chat-composer").locator("input")).toHaveValue("@Participant");

  const secondTrigger = page.getByRole("button", { name: "Actions for Second participant" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Actions for Participant" })).toBeVisible();
  await secondTrigger.focus();
  await expect(page.getByRole("dialog", { name: "Actions for Participant" })).toHaveCount(0);
  await secondTrigger.press("Enter");
  await expect(page.getByRole("dialog", { name: "Actions for Participant" })).toHaveCount(0);
  const secondMenu = page.getByRole("dialog", { name: "Actions for Second participant" });
  await expect(secondMenu).toHaveCount(1);
  await expect(secondMenu).toBeVisible();
  await page.getByTestId("chat-composer").locator("input").focus();
  await expect(secondMenu).toHaveCount(0);

  await secondTrigger.click();
  await expect(secondMenu).toBeVisible();
  await page.getByTestId("chat-composer").locator("input").click();
  await expect(secondMenu).toHaveCount(0);

  await trigger.click();
  await menu.getByRole("button", { name: "Invite to room" }).click();
  const chooser = page.getByRole("dialog", { name: "Invite Participant to a room" });
  await expect(chooser.getByRole("button", { name: /Other active room/ })).toBeVisible();
  await expect(chooser).not.toContainText("Recipient tracer guest");
  await expect(chooser).not.toContainText("History room");
  await chooser.getByRole("button", { name: /Other active room/ }).click();
  await expect(chooser.getByRole("status")).toContainText("Couldn’t send the invite");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("participant surfaces keep invite controls contained at 320px and disable invite motion", async ({ page }) => {
  const viewer = "e".repeat(64);
  const participant = "d".repeat(64);
  const invite = createInviteUrl("https://chat.example", {
    groupId: "motion-safe-invite",
    coordinatorPubkey: "a".repeat(64),
    relayUrls: ["wss://relay.example"],
    title: "Motion safe room",
  });
  await page.setViewportSize({ width: 320, height: 360 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await seedGuestMessages(page, viewer, [
    { id: "compact-participant", sender: participant, name: "Participant", content: "Compact menu", createdAt: 1 },
    { id: "motion-safe-invite", sender: "f".repeat(64), name: "Host", content: invite, createdAt: 2 },
  ]);
  await page.reload();
  await openSeededGuestRoom(page);

  const trigger = page.getByRole("button", { name: "Actions for Participant" });
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Actions for Participant" });
  await expect(menu).toBeVisible();
  await expect.poll(() => menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);
  await menu.getByRole("button", { name: "Invite to room" }).click();
  const chooser = page.getByRole("dialog", { name: "Invite Participant to a room" });
  await expect(chooser).toBeVisible();
  await expect.poll(() => chooser.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);
  await expect(page.getByRole("button", { name: /Join Motion safe room/ })).toHaveCSS("transition-duration", "0s");
});

test("host renders the shared participant menu and mention flow for an admitted guest", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeVisible({ timeout: 35_000 });
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  const createRoom = page.getByTestId("create-room-dialog");
  await createRoom.getByPlaceholder("Friday plans").fill("Participant host parity");
  await createRoom.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(createRoom).toBeHidden();
  const inviteUrl = await page.getByTestId("invite-link").textContent();
  expect(inviteUrl).toBeTruthy();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  try {
    await installEstablishedInstallation(guest);
    await guest.goto(inviteUrl!);
    await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 35_000 });
    await guest.getByPlaceholder("Message").fill("A host-visible participant message");
    await guest.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("host-message-list").getByText("A host-visible participant message")).toBeVisible({ timeout: 20_000 });

    const hostTrigger = page.getByTestId("host-message-list").getByRole("button", { name: /^Actions for / });
    await expect(hostTrigger).toBeVisible();
    await hostTrigger.click();
    const menu = page.getByRole("dialog", { name: /^Actions for / });
    await expect(menu.getByRole("button").allTextContents()).resolves.toEqual(["Mention", "Invite to room", "Follow on Nostr", "Highlight", "Ignore"]);
    await menu.getByRole("button", { name: "Mention" }).click();
    await expect(page.getByPlaceholder("Message as host")).toBeFocused();
    await expect(page.getByPlaceholder("Message as host")).toHaveValue(/^@/);
  } finally {
    await guestContext.close();
  }
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
  }, {
    id: "other-before-ignore",
    sender: "f".repeat(64),
    name: "Other participant",
    content: "Separating message",
    createdAt: Date.now() + 1,
  }, {
    id: "highlight-after-ignore",
    sender: participant,
    name: "Participant",
    content: "Second local preference message",
    createdAt: Date.now() + 2,
  }]);
  await page.reload();
  await openSeededGuestRoom(page);
  const firstParticipantStreak = page.getByTestId("message-streak").filter({
    has: page.locator('[data-message-id="highlight-before-ignore"]'),
  });
  const trigger = firstParticipantStreak.getByRole("button", { name: "Actions for Participant" });
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.click();
  await page.getByRole("dialog", { name: "Actions for Participant" }).getByRole("button", { name: "Highlight" }).click();
  await page.getByRole("button", { name: "Gold" }).click();
  await expect(firstParticipantStreak).toHaveClass(/highlighted/);
  await trigger.click();
  await page.getByRole("dialog", { name: "Actions for Participant" }).getByRole("button", { name: "Ignore" }).click();
  const disclosures = page.getByRole("button", { name: /Participant posted 1 message/ });
  await expect(disclosures).toHaveCount(2);
  await expect(disclosures.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(disclosures.nth(1)).toHaveAttribute("aria-expanded", "false");
  await disclosures.nth(0).click();
  await expect(disclosures.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(disclosures.nth(1)).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("First local preference message")).toBeVisible();
  await page.reload();
  await openSeededGuestRoom(page);
  await expect(page.getByRole("button", { name: /Participant posted 1 message/ })).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator("body")).not.toContainText(participant);
});
