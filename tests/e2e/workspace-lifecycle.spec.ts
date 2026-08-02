import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { generateSecretKey } from "nostr-tools";
import { bytesToHex } from "nostr-tools/utils";

import { startMockRelay, type MockRelay } from "./mock-relay";

// User-visible workspace, coordinator, room, and invite behavior.

let relay: MockRelay;

function createStoredRoomPrivateFixture(): {
  anonymousSecretKey: string;
  keyPackagePrivateBase64: string;
} {
  return {
    anonymousSecretKey: bytesToHex(generateSecretKey()),
    keyPackagePrivateBase64: Buffer.from(generateSecretKey()).toString("base64"),
  };
}

test.beforeAll(async () => {
  relay = await startMockRelay();
});

test.afterAll(async () => {
  await relay.close();
});

async function configureMockRelay(page: import("@playwright/test").Page): Promise<void> {
  const settings = await openCoordinatorSettings(page, true);
  if (await settings.getByText(relay.url).isVisible()) {
    await closeCoordinatorSettings(settings);
    return;
  }

  const removeDefaultRelay = settings.getByLabel(/Remove wss:\/\/relay\.contextvm\.org/);
  if (await removeDefaultRelay.isVisible()) {
    await removeDefaultRelay.click();
  }

  await settings.getByPlaceholder("wss://relay.example").fill(relay.url);
  await settings.getByRole("button", { name: "Add" }).click();
  await expect(settings.getByText(relay.url)).toBeVisible();
  await closeCoordinatorSettings(settings);
}

async function openCoordinatorSettings(
  page: import("@playwright/test").Page,
  edit = false,
): Promise<import("@playwright/test").Locator> {
  const topbar = page.locator(".host-topbar");
  const settingsTrigger = topbar.getByRole("button", { name: "Settings", exact: true });
  if (!(await settingsTrigger.isVisible())) {
    const toolsTrigger = topbar.getByRole("button", { name: "Open host tools" });
    if (await toolsTrigger.isVisible()) await toolsTrigger.click();
  }
  await settingsTrigger.click();
  const settings = page.getByTestId("coordinator-settings");
  await expect(settings).toBeVisible();
  if (edit) await settings.getByRole("button", { name: "Edit settings" }).click();
  return settings;
}

async function closeCoordinatorSettings(settings: import("@playwright/test").Locator): Promise<void> {
  const done = settings.getByRole("button", { name: "Done editing" });
  if (await done.isVisible()) await done.click();
  await settings.getByRole("button", { name: "Close coordinator settings" }).last().click();
  await expect(settings).toBeHidden();
}

async function pageExitIsGuarded(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

async function expectViewportOwned(
  page: import("@playwright/test").Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
  }))).toEqual({
    clientWidth: viewport.width,
    scrollWidth: viewport.width,
    clientHeight: viewport.height,
    scrollHeight: viewport.height,
    bodyWidth: viewport.width,
    bodyHeight: viewport.height,
  });
}

async function expectInsideViewport(locator: import("@playwright/test").Locator): Promise<void> {
  await expect.poll(() => locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0
      && bounds.top >= 0
      && bounds.right <= window.innerWidth
      && bounds.bottom <= window.innerHeight;
  })).toBe(true);
}

async function expectStartupFillsHostPane(page: import("@playwright/test").Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('[data-testid="host-chat"]');
    const stage = pane?.querySelector<HTMLElement>(".startup-stage");
    const field = stage?.querySelector<HTMLElement>('[data-testid="startup-ascii-field"]');
    const bed = field?.querySelector<HTMLElement>(".ascii-bed .ascii-texture");
    if (!pane || !stage || !field || !bed) return false;

    const paneBounds = pane.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const fieldBounds = field.getBoundingClientRect();
    const aligned = (left: DOMRect, right: DOMRect) => (
      Math.abs(left.left - right.left) <= 1
      && Math.abs(left.top - right.top) <= 1
      && Math.abs(left.width - right.width) <= 1
      && Math.abs(left.height - right.height) <= 1
      && Math.abs(left.right - right.right) <= 1
    );
    const paneStyle = getComputedStyle(pane);
    const stageStyle = getComputedStyle(stage);
    const fieldStyle = getComputedStyle(field);
    const firstLine = bed.textContent?.split("\n", 1)[0] ?? "";
    const textNode = bed.firstChild;
    const firstLineRange = document.createRange();
    if (!textNode || firstLine.length === 0) return false;
    firstLineRange.setStart(textNode, 0);
    firstLineRange.setEnd(textNode, firstLine.length);
    const visibleTextureWidth = firstLineRange.getBoundingClientRect().width;
    return aligned(paneBounds, stageBounds)
      && aligned(paneBounds, fieldBounds)
      && visibleTextureWidth >= fieldBounds.width * 1.08
      && bed.scrollHeight >= fieldBounds.height
      && paneStyle.position === "relative"
      && stageStyle.position === "absolute"
      && fieldStyle.position === "absolute";
  })).toBe(true);
}

async function expectShellControlsUsable(page: import("@playwright/test").Page): Promise<void> {
  const topbar = page.locator(".host-topbar");
  const rail = page.getByTestId("invite-panel");
  await expect(topbar).toBeVisible();
  await expect(rail).toBeVisible();
  await expect(topbar).not.toHaveAttribute("inert");
  await expect(topbar).not.toHaveAttribute("aria-hidden", "true");
  await expect(rail).not.toHaveAttribute("inert");
  await expect(rail).not.toHaveAttribute("aria-hidden", "true");

  const headerSettings = topbar.getByRole("button", { name: "Settings", exact: true });
  await headerSettings.focus();
  await expect(headerSettings).toBeFocused();
  await headerSettings.click();
  const settings = page.getByTestId("coordinator-settings");
  await expect(settings).toBeVisible();
  await closeCoordinatorSettings(settings);

  const railControl = page.locator(".channel-context-button");
  await railControl.focus();
  await expect(railControl).toBeFocused();
  await railControl.click();
  await expect(page.getByRole("menu", { name: "Choose coordinator" })).toBeVisible();
  await railControl.click();
}

async function expectStartupMasks(page: import("@playwright/test").Page): Promise<void> {
  const field = page.getByTestId("startup-ascii-field");
  await expect(field).toHaveAttribute("aria-hidden", "true");
  await expect(field).toHaveCSS("pointer-events", "none");
  await expect(field.locator(".ascii-bed .ascii-texture")).toHaveCount(1);
  const rings = field.locator(".ascii-ring");
  await expect(rings).toHaveCount(3);
  const maskDetails = await rings.evaluateAll((elements: Element[]) => elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      hasTexture: element.querySelector(".ascii-texture") !== null,
      hasMask: style.maskImage.includes("gradient"),
      hasWebkitMask: style.webkitMaskImage.includes("gradient"),
      borderWidth: style.borderTopWidth,
      outline: style.outlineStyle,
      hasSvgFallback: element.querySelector("svg, circle") !== null,
      focusable: element.matches(":focus-visible") || (element as HTMLElement).tabIndex >= 0,
    };
  }));
  expect(maskDetails).toEqual([
    { hasTexture: true, hasMask: true, hasWebkitMask: true, borderWidth: "0px", outline: "none", hasSvgFallback: false, focusable: false },
    { hasTexture: true, hasMask: true, hasWebkitMask: true, borderWidth: "0px", outline: "none", hasSvgFallback: false, focusable: false },
    { hasTexture: true, hasMask: true, hasWebkitMask: true, borderWidth: "0px", outline: "none", hasSvgFallback: false, focusable: false },
  ]);
}

async function openRoomActions(
  page: import("@playwright/test").Page,
  roomTitle: string,
): Promise<import("@playwright/test").Locator> {
  const navigation = page.getByTestId("workspace-navigation");
  await expect(navigation.getByRole("button", { name: "More room actions" })).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "More room actions" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.getByRole("menu", { name: `Room actions for ${roomTitle}` });
  await expect(menu).toBeVisible();
  return menu;
}

async function expectEmbeddedChatFillsHostPane(page: import("@playwright/test").Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('[data-testid="host-chat"]');
    const route = pane?.querySelector<HTMLElement>('[data-testid="chat-route"]');
    const cached = route?.querySelector<HTMLElement>('[data-testid="cached-room-view"]');
    if (!pane || !route || !cached) return false;
    const paneBounds = pane.getBoundingClientRect();
    const routeBounds = route.getBoundingClientRect();
    const cachedBounds = cached.getBoundingClientRect();
    const aligned = (left: number, right: number) => (
      Math.abs(left - paneBounds.left) <= 1
      && Math.abs(right - paneBounds.right) <= 1
    );
    return aligned(routeBounds.left, routeBounds.right)
      && aligned(cachedBounds.left, cachedBounds.right);
  })).toBe(true);
}

async function enablePersistence(page: import("@playwright/test").Page, passphrase: string): Promise<void> {
  const settings = await openCoordinatorSettings(page, true);
  await settings.getByRole("button", { name: "Enable persistence" }).click();
  await settings.getByPlaceholder("passphrase", { exact: true }).fill(passphrase);
  await settings.getByPlaceholder("confirm passphrase").fill(passphrase);
  await settings.getByRole("button", { name: "Save key" }).click();
  await expect(settings.getByText("Saved on this device")).toBeVisible();
  await closeCoordinatorSettings(settings);
}

async function readCoordinatorNpub(page: import("@playwright/test").Page): Promise<string> {
  const settings = await openCoordinatorSettings(page);
  const npub = await settings.getByRole("button", { name: "Copy coordinator public key" }).textContent() ?? "";
  await closeCoordinatorSettings(settings);
  return npub;
}

async function customizeHostIdentity(
  page: import("@playwright/test").Page,
  name: string,
  badge: string,
  emoji: string,
): Promise<void> {
  await page.getByTestId("user-profile").getByRole("button").first().click();
  const profile = page.getByRole("dialog", { name: "User profile" });
  await expect(profile).toBeVisible();
  await profile.getByLabel("Display name").fill(name);
  await profile.getByLabel("Badge text").fill(badge);
  await profile.getByRole("button", { name: "Choose badge emoji" }).click();
  await profile.getByRole("button", { name: `Use ${emoji} for badge` }).click();
  await page.keyboard.press("Escape");
  await expect(profile).toBeHidden();
}

async function createRoom(page: import("@playwright/test").Page, title: string): Promise<void> {
  const createTrigger = page.getByRole("button", { name: "Create room", exact: true });
  if (await createTrigger.isVisible()) {
    await createTrigger.click();
  } else {
    const railToggle = page.getByRole("button", { name: "Open room browser" });
    if (await railToggle.isVisible()) await railToggle.click();
    await page.getByRole("button", { name: "New room" }).click();
  }
  const dialog = page.getByTestId("create-room-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Friday plans").fill(title);
  await dialog.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function navigateWithinShell(page: import("@playwright/test").Page, href: string): Promise<void> {
  await page.evaluate((nextHref) => {
    const target = new URL(nextHref, window.location.origin);
    window.history.pushState({}, "", `${target.pathname}${target.search}${target.hash}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, href);
}

async function seedJoinedRoom(
  page: import("@playwright/test").Page,
  title: string,
  coordinatorPubkey = "a".repeat(64),
): Promise<void> {
  const privateFixture = createStoredRoomPrivateFixture();
  await page.evaluate(({ title, coordinatorPubkey, relayUrl, privateFixture }) => {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const room = {
      version: 1,
      id,
      title,
      coordinatorPubkey,
      coordinatorOrigin: "https://remote.example",
      relayUrls: [relayUrl],
      name: "Reader",
      stablePubkey: "b".repeat(64),
      isHost: false,
      stateBase64: "",
      keyPackage: {
        reference: "ref",
        publicBase64: "public",
        privateBase64: privateFixture.keyPackagePrivateBase64,
      },
      anonymousSecretKey: privateFixture.anonymousSecretKey,
      lastCursor: 0,
      messages: [],
      pending: [],
      joinRequestSent: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const key = `cordn-adhoc-chat-room:v2:${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(id)}`;
    localStorage.setItem(key, JSON.stringify(room));
  }, { title, coordinatorPubkey, relayUrl: relay.url, privateFixture });
}

test("unread badge lifecycle projects exact room and coordinator counts", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const coordinatorPubkey = "a".repeat(64);
  await seedJoinedRoom(page, "Unread one", coordinatorPubkey);
  await seedJoinedRoom(page, "Unread two", coordinatorPubkey);
  await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:v2:")) continue;
      const room = JSON.parse(localStorage.getItem(key) ?? "{}");
      room.readState = { version: 1, baselineEstablished: true, lastReadCursor: 0, unreadCount: room.title === "Unread one" ? 100 : 1 };
      localStorage.setItem(key, JSON.stringify(room));
    }
  });
  await page.reload();

  await page.locator(".channel-context-button").click();
  const coordinatorMenu = page.getByRole("menu", { name: "Choose coordinator" });
  await expect(coordinatorMenu.getByRole("menuitem")).toHaveCount(2);
  await coordinatorMenu.getByRole("menuitem", { name: /Coordinator aaaaaa/ }).click();
  const rail = page.getByTestId("invite-panel");
  await expect(rail.getByRole("button", { name: /Open room Unread one/ })).toBeVisible();
  const unreadBadge = rail.getByLabel("100 unread messages");
  await expect(unreadBadge).toHaveText("99+");
  await expect(rail.getByLabel("101 unread messages for this coordinator")).toHaveText("99+");
  expect(await unreadBadge.evaluate((element) => ({
    tag: element.tagName,
    tabIndex: (element as HTMLElement).tabIndex,
    height: Math.round(element.getBoundingClientRect().height),
  }))).toEqual({ tag: "SPAN", tabIndex: -1, height: 16 });

  const targetRow = rail.locator(".channel-row").filter({ hasText: "Unread one" });
  const targetMenu = targetRow.getByRole("button", { name: "More actions for # Unread one" });
  const activeRoomBefore = await page.locator(".channel-row.active").getAttribute("data-room-key");
  const urlBefore = page.url();
  await targetMenu.focus();
  await targetMenu.click();
  await expect(page).toHaveURL(urlBefore);
  await expect(page.locator(".channel-row.active")).toHaveAttribute("data-room-key", activeRoomBefore ?? "");
  await expect(unreadBadge).toHaveText("99+");
  await page.keyboard.press("Escape");
  await expect(targetMenu).toBeFocused();
  await expect(unreadBadge).toHaveText("99+");
  expect(pageErrors).toEqual([]);
});

test("unread zero transition announces once from the page-level owner", async ({ page }) => {
  await page.goto("/");
  const coordinatorPubkey = "c".repeat(64);
  await seedJoinedRoom(page, "Announced room", coordinatorPubkey);
  await page.reload();
  await page.evaluate(({ coordinatorPubkey }) => {
    const roomId = "announced-room";
    window.dispatchEvent(new CustomEvent("cordn:room-unread-changed", {
      detail: { coordinatorPubkey, roomId, previousCount: 0, unreadCount: 1 },
    }));
  }, { coordinatorPubkey });
  const announcement = page.locator('[aria-live="polite"]').filter({ hasText: "New messages in # Announced room" });
  await expect(announcement).toHaveCount(1);
  await page.evaluate(({ coordinatorPubkey }) => {
    window.dispatchEvent(new CustomEvent("cordn:room-unread-changed", {
      detail: { coordinatorPubkey, roomId: "announced-room", previousCount: 1, unreadCount: 2 },
    }));
  }, { coordinatorPubkey });
  await expect(announcement).toHaveCount(1);
});

test("long room navigation stays operable and contained", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const coordinatorPubkey = "d".repeat(64);
  for (let index = 0; index < 24; index += 1) {
    await seedJoinedRoom(page, `Room ${String(index).padStart(2, "0")} ${"extremely-long-label-".repeat(3)}`, coordinatorPubkey);
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.reload();
    if (viewport.width <= 900) await page.getByRole("button", { name: "Open room browser" }).click();
    await page.locator(".channel-context-button").click();
    await page.getByRole("menu", { name: "Choose coordinator" }).getByRole("menuitem", { name: /Coordinator dddddd/ }).click();
    if (viewport.width <= 900) await page.getByRole("button", { name: "Open room browser" }).click();
    const rail = page.getByTestId("invite-panel");
    await expect(rail.locator(".channel-row")).toHaveCount(24);
    expect(await rail.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    const firstRow = rail.locator(".channel-row").first();
    const label = firstRow.locator(".truncate");
    const action = firstRow.getByRole("button", { name: /More actions for/ });
    expect(await label.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await Promise.all([label.boundingBox(), action.boundingBox()]).then(([labelBox, actionBox]) => Boolean(
      labelBox && actionBox && labelBox.x + labelBox.width <= actionBox.x,
    ))).toBe(true);
    await rail.locator(".channel-row").last().scrollIntoViewIfNeeded();
    await expect(rail.locator(".channel-row").last()).toBeVisible();
    await expectViewportOwned(page, viewport);
  }
});

test("generates copyable identity on first load", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByTestId("user-profile")).toContainText("anon");
  await expect(page.getByTestId("user-profile").locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
  await expect(page.getByTestId("startup-ascii-field")).toHaveCount(0);
  await expect(page.getByTestId("coordinator-empty-state")).toContainText("No rooms for this coordinator");
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  const settings = await openCoordinatorSettings(page);
  await expect(page.locator(".host-layout")).toHaveCSS("filter", "none");
  await expect(settings.getByRole("button", { name: "Copy coordinator public key" })).toContainText("npub");
  await expect(settings.getByLabel("Toggle announcement")).not.toBeChecked();
  await expect(settings.getByTestId("max-users-input")).toHaveValue("64");
  await closeCoordinatorSettings(settings);
});

test("startup recovery states stay truthful for empty recovery", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);

  await page.getByRole("button", { name: "Start", exact: true }).click();

  const startup = page.getByTestId("startup-progress-panel");
  await expect(startup).toContainText("Restoring rooms");
  await expect(startup).toContainText("No rooms to restore");
  await expect(startup).toContainText("0 of 0 rooms restored");
  await expect(page.getByTestId("host-message-list")).toHaveCount(0);
  await expect(page.getByTestId("status-badge")).toHaveText("running");
});

test("does not render disconnected local chat during recovery", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);

  await page.getByRole("button", { name: "Start", exact: true }).click();

  const startup = page.getByTestId("startup-progress-panel");
  await expect(startup).toContainText("No rooms to restore");
  await expect(page.getByTestId("host-message-list")).toHaveCount(0);
  await expect(page.getByText("Local room offline", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/MCP error|relay timeout|wss:\/\//i)).toHaveCount(0);
});

test("startup signal follows retry and exhaustion truth", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await enablePersistence(page, "multi-room-recovery-passphrase");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(page, "Recovery alpha");
  await createRoom(page, "Recovery bravo");
  await expect(page.getByTestId("status-badge")).toHaveText("running");

  const fixture = await page.evaluate(() => {
    const entries: Array<{ key: string; raw: string; room: { coordinatorPubkey: string; id: string; title: string; stablePubkey: string } }> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const room = JSON.parse(raw) as { coordinatorPubkey?: string; id?: string; title?: string; stablePubkey?: string; isHost?: boolean };
      if (!room.isHost || !room.coordinatorPubkey || !room.id || !room.title || !room.stablePubkey) continue;
      entries.push({ key, raw, room: room as { coordinatorPubkey: string; id: string; title: string; stablePubkey: string } });
    }
    entries.sort((left, right) => `${left.room.coordinatorPubkey}:${left.room.id}`.localeCompare(`${right.room.coordinatorPubkey}:${right.room.id}`));
    if (entries.length !== 2) throw new Error(`Expected two hosted rooms, found ${entries.length}`);
    const target = entries[1]!;
    const corrupted = JSON.parse(target.raw) as { stablePubkey: string };
    corrupted.stablePubkey = corrupted.stablePubkey === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
    return {
      key: target.key,
      validRaw: target.raw,
      corruptedRaw: JSON.stringify(corrupted),
      roomName: target.room.title,
      forbiddenStablePubkey: corrupted.stablePubkey,
      rooms: entries.map((entry) => ({
        key: entry.key,
        id: entry.room.id,
        title: entry.room.title,
        coordinatorPubkey: entry.room.coordinatorPubkey,
        stablePubkey: entry.room.stablePubkey,
      })),
    };
  });
  expect(new Set(fixture.rooms.map((room) => `${room.coordinatorPubkey}:${room.id}`)).size).toBe(2);
  expect(new Set(fixture.rooms.map((room) => room.coordinatorPubkey)).size).toBe(1);
  expect(new Set(fixture.rooms.map((room) => room.stablePubkey)).size).toBe(1);

  await page.reload();
  await page.getByPlaceholder("passphrase", { exact: true }).fill("multi-room-recovery-passphrase");
  await page.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();
  const roomsAfterUnlock = await page.evaluate(() => {
    const rooms: Array<{ key: string; id?: string; title?: string; coordinatorPubkey?: string; stablePubkey?: string; isHost?: boolean; membershipStatus?: string }> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:")) continue;
      const raw = localStorage.getItem(key);
      if (raw) rooms.push({ key, ...JSON.parse(raw) });
    }
    return rooms;
  });
  expect(roomsAfterUnlock.map((room) => ({
    id: room.id,
    title: room.title,
    coordinatorPubkey: room.coordinatorPubkey,
    stablePubkey: room.stablePubkey,
    isHost: room.isHost,
    membershipStatus: room.membershipStatus,
  }))).toEqual(expect.arrayContaining(fixture.rooms.map((room) => expect.objectContaining({
    id: room.id,
    title: room.title,
    coordinatorPubkey: room.coordinatorPubkey,
    isHost: true,
  }))));
  await page.evaluate(({ key, corruptedRaw }) => localStorage.setItem(key, corruptedRaw), fixture);
  await page.evaluate(() => {
    type RecoverySnapshot = { state: string; completed: number; total: number; retryActions: number };
    const target = window as unknown as { __recoveryHistory: RecoverySnapshot[] };
    target.__recoveryHistory = [];
    const capture = () => {
      const panel = document.querySelector<HTMLElement>('[data-testid="startup-progress-panel"]');
      if (!panel) return;
      const state = panel.dataset.recoveryState ?? "";
      const completed = Number(panel.dataset.recoveryCompleted ?? "0");
      const total = Number(panel.dataset.recoveryTotal ?? "0");
      const retryActions = Array.from(panel.querySelectorAll("button")).filter((button) => button.textContent?.trim() === "Retry recovery").length;
      const next = { state, completed, total, retryActions };
      const previous = target.__recoveryHistory.at(-1);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(next)) target.__recoveryHistory.push(next);
    };
    new MutationObserver(capture).observe(document.body, { subtree: true, childList: true, attributes: true });
    capture();
  });

  await page.getByRole("button", { name: "Start", exact: true }).click();
  const startup = page.getByTestId("startup-progress-panel");
  await expect(startup).toHaveAttribute("data-recovery-total", "2");
  await expect(startup).toHaveAttribute("data-recovery-state", "retrying");
  await expect(page.getByTestId("startup-ascii-field")).toHaveAttribute("data-motion-state", "retrying");
  await expect(page.getByRole("button", { name: "Retry recovery" })).toHaveCount(0);
  await expect(startup).toHaveAttribute("data-recovery-state", "exhausted");
  await expect(page.getByTestId("startup-ascii-field")).toHaveAttribute("data-motion-state", "exhausted");
  await expect(startup).toHaveAttribute("data-recovery-completed", "1");
  await expect(startup).toContainText(`Couldn’t restore # ${fixture.roomName}`);
  await expect(startup).toContainText("Check your connection, then retry recovery.");
  await expect(page.getByRole("button", { name: "Retry recovery" })).toHaveCount(1);
  await expect(page.getByTestId("status-badge")).toHaveText("starting");
  await expect(page.getByTestId("host-message-list")).toHaveCount(0);
  await expect(page.getByTestId("room-connection-panel")).toHaveCount(0);
  await expect(page.getByText("Local room offline", { exact: true })).toHaveCount(0);
  await expect(page.locator('input[placeholder="Message as host"]')).toHaveCount(0);
  const renderedText = await page.locator("body").innerText();
  expect(renderedText).not.toContain(fixture.forbiddenStablePubkey);
  expect(renderedText).not.toMatch(/signer does not match|MCP error|Hosted room recovery failed|wss:\/\//i);

  const automaticHistory = await page.evaluate(() => (
    window as unknown as { __recoveryHistory: Array<{ state: string; completed: number; total: number; retryActions: number }> }
  ).__recoveryHistory.filter((snapshot) => snapshot.total === 2));
  expect(automaticHistory.some((snapshot) => snapshot.state === "retrying" && snapshot.retryActions === 0)).toBe(true);
  expect(automaticHistory.at(-1)).toMatchObject({ state: "exhausted", completed: 1, total: 2 });
  expect(automaticHistory.every((snapshot, index) => index === 0 || snapshot.completed >= automaticHistory[index - 1]!.completed)).toBe(true);

  await page.evaluate(({ key, validRaw }) => localStorage.setItem(key, validRaw), fixture);
  await page.getByRole("button", { name: "Retry recovery" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId("host-message-list")).toBeVisible();
  await expect(page.getByText("Local room offline", { exact: true })).toHaveCount(0);
  const completedHistory = await page.evaluate(() => (
    window as unknown as { __recoveryHistory: Array<{ state: string; completed: number; total: number }> }
  ).__recoveryHistory.filter((snapshot) => snapshot.total === 2));
  expect(completedHistory.some((snapshot) => snapshot.state === "restoring" && snapshot.completed === 1)).toBe(true);
  expect(completedHistory.some((snapshot) => snapshot.state === "complete" && snapshot.completed === 2)).toBe(true);
});

test("an unrecoverable hosted room can be confirmed, deleted, and removed from the startup queue", async ({ page }) => {
  test.setTimeout(60_000);
  const passphrase = "delete-failed-recovery-passphrase";
  const roomTitle = "Unrecoverable room";
  await page.goto("/");
  await enablePersistence(page, passphrase);
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(page, roomTitle);
  await expect(page.getByTestId("status-badge")).toHaveText("running");

  const fixture = await page.evaluate((expectedTitle) => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const stored = JSON.parse(raw) as {
        id?: string;
        title?: string;
        coordinatorPubkey?: string;
        stablePubkey?: string;
        isHost?: boolean;
      };
      if (!stored.isHost || stored.title !== expectedTitle || !stored.id || !stored.coordinatorPubkey || !stored.stablePubkey) continue;
      stored.stablePubkey = stored.stablePubkey === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
      return { key, corruptedRaw: JSON.stringify(stored), roomId: stored.id, coordinatorPubkey: stored.coordinatorPubkey };
    }
    throw new Error(`Could not find hosted room ${expectedTitle}`);
  }, roomTitle);

  await page.reload();
  await page.getByPlaceholder("passphrase", { exact: true }).fill(passphrase);
  await page.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();
  await page.evaluate(({ key, corruptedRaw }) => localStorage.setItem(key, corruptedRaw), fixture);
  await page.getByRole("button", { name: "Start", exact: true }).click();

  const startup = page.getByTestId("startup-progress-panel");
  await expect(startup).toHaveAttribute("data-recovery-state", "exhausted");
  await expect(startup).toContainText(`Couldn’t restore # ${roomTitle}`);
  await expect(page.getByRole("button", { name: "Retry recovery" })).toBeVisible();
  await page.getByRole("button", { name: "Delete failed room" }).click();

  const dialog = page.getByTestId("room-removal-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: `Delete #${roomTitle}?` })).toBeVisible();
  await expect(dialog.getByTestId("room-removal-impact")).toContainText("This cannot be undone.");
  await dialog.getByTestId("confirm-delete-room").click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByRole("button", { name: "Delete failed room" })).toHaveCount(0);
  await expect(page.getByTestId("coordinator-empty-state")).toContainText("No rooms for this coordinator");
  await expect(page.getByTestId("host-message-list")).toHaveCount(0);
  await expect(page.getByText("Local room offline", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(({ key }) => localStorage.getItem(key), fixture)).toBeNull();
});

test("browses joined chats from the root shell without starting an unprotected local coordinator", async ({ page }) => {
  await page.goto("/");
  await seedJoinedRoom(page, "Elsewhere lounge");
  await page.reload();

  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByTestId("workspace-navigation")).toHaveCount(1);
  await page.locator(".channel-context-button").click();
  await page.getByRole("menu", { name: "Choose coordinator" }).getByRole("menuitem").nth(1).click();
  await expect(page.getByRole("button", { name: /Open room Elsewhere lounge/ })).toBeVisible();
});

test("browses cached chats while a persisted coordinator stays locked", async ({ page }) => {
  await page.goto("/");
  await enablePersistence(page, "chat-only-passphrase");
  await seedJoinedRoom(page, "Locked-out lounge", "c".repeat(64));
  await page.reload();

  await expect(page.getByRole("heading", { name: "Unlock Cordn Ad-Hoc" })).toBeVisible();
  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByTestId("workspace-navigation")).toHaveCount(1);
  await page.locator(".channel-context-button").click();
  await page.getByRole("menu", { name: "Choose coordinator" }).getByRole("menuitem").nth(1).click();
  await page.getByRole("button", { name: /Open room Locked-out lounge/ }).click();
  await expect(page.getByTestId("cached-room-view")).toContainText("Locked-out lounge");
  await expect(page.locator(".presence-control")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 667 });
  await expect.poll(() => page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".workspace-nav");
    const visibleControls = [...(header?.querySelectorAll<HTMLElement>("button, a") ?? [])]
      .filter((control) => control.getClientRects().length > 0)
      .map((control) => {
        const bounds = control.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth;
      });
    return {
      pageFits: document.documentElement.scrollWidth === document.documentElement.clientWidth,
      headerFits: Boolean(header && header.scrollWidth <= header.clientWidth),
      controlsFit: visibleControls.every(Boolean),
    };
  })).toEqual({ pageFits: true, headerFits: true, controlsFit: true });

  await page.getByRole("link", { name: "CAHMLS home" }).click();
  await expect(page.getByRole("heading", { name: "Unlock Cordn Ad-Hoc" })).toBeVisible();
});

test("legacy chat index canonicalizes to the root shell and honors autostart", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  const settings = await openCoordinatorSettings(page, true);
  await settings.getByLabel("Toggle autostart").check();
  await closeCoordinatorSettings(settings);

  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByTestId("workspace-navigation")).toHaveCount(1);
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect
    .poll(() => page.evaluate(() => ({
      viewport: document.documentElement.clientHeight,
      page: document.documentElement.scrollHeight,
      body: document.body.scrollHeight,
    })))
    .toEqual({ viewport: 667, page: 667, body: 667 });
});

test("offers a NIP-46 nostrconnect QR through the default Coracle relay", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("user-profile").getByRole("button").first().click();
  const profile = page.getByRole("dialog", { name: "User profile" });
  await profile.getByRole("button", { name: /NIP-46 remote signer/ }).click();

  const connection = profile.getByTestId("nip46-qr-connect");
  await expect(connection.getByAltText("QR code for NIP-46 signer connection")).toHaveAttribute("src", /^data:image\/svg\+xml/);
  const uri = await connection.getByRole("link", { name: "Open NIP-46 connection in a signer" }).getAttribute("href");
  expect(uri).toMatch(/^nostrconnect:\/\//);
  expect(new URL(uri ?? "").searchParams.getAll("relay")).toContain("wss://bucket.coracle.social");

  await connection.getByRole("button", { name: "Cancel" }).click();
  await expect(connection).toBeHidden();
});

test("requests notification permission explicitly and persists grouped notification preferences", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { __notificationPermissionRequests?: number };
    state.__notificationPermissionRequests = 0;
    class MockNotification {
      static permission: NotificationPermission = localStorage.getItem("e2e:notification-permission") === "granted" ? "granted" : "default";
      static async requestPermission(): Promise<NotificationPermission> {
        state.__notificationPermissionRequests = (state.__notificationPermissionRequests ?? 0) + 1;
        MockNotification.permission = "granted";
        localStorage.setItem("e2e:notification-permission", "granted");
        return "granted";
      }
      onclick: ((event: Event) => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        void title;
        void options;
      }
      close(): void {}
    }
    Object.defineProperty(window, "Notification", { configurable: true, value: MockNotification });
  });
  await page.goto("/");

  expect(await page.evaluate(() => (window as typeof window & { __notificationPermissionRequests?: number }).__notificationPermissionRequests)).toBe(0);
  await page.getByRole("button", { name: "Enable notifications", exact: true }).click();
  const notifications = page.getByRole("dialog", { name: "Notifications" });
  await expect(notifications).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __notificationPermissionRequests?: number }).__notificationPermissionRequests)).toBe(1);
  await expect(notifications.getByRole("checkbox", { name: /People coming online/ })).toBeChecked();
  await expect(notifications.getByRole("checkbox", { name: /New messages/ })).not.toBeChecked();
  await notifications.getByRole("checkbox", { name: /New messages/ }).check();
  await notifications.getByRole("combobox").selectOption("30000");
  await notifications.getByRole("button", { name: "Close notification settings" }).click();

  await page.reload();
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const reloaded = page.getByRole("dialog", { name: "Notifications" });
  await expect(reloaded.getByRole("checkbox", { name: /New messages/ })).toBeChecked();
  await expect(reloaded.getByRole("combobox")).toHaveValue("30000");
});

test("operator shell does not overflow common viewports", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 390, height: 350 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByTestId("operator-shell")).toBeVisible();
    await expect.poll(() => page.getByTestId("operator-shell").evaluate((element) => element.clientHeight)).toBe(viewport.height);
    await expect
      .poll(() =>
        page.getByTestId("operator-shell").evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return { left: bounds.left, right: bounds.right, width: bounds.width };
        }),
      )
      .toEqual({ left: 0, right: viewport.width, width: viewport.width });
    await expectViewportOwned(page, viewport);
    if (viewport.width <= 900) {
      await expect.poll(() => page.locator(".host-topbar").evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBeLessThanOrEqual(100);
      await expect.poll(() => page.getByTestId("host-chat").evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBeGreaterThan(100);
      for (const control of await page.locator(".host-topbar button:visible, .host-topbar a:visible").all()) {
        await expectInsideViewport(control);
      }
    }
  }
});

test("names the coordinator context without changing its runtime", async ({ page }) => {
  await page.goto("/");
  const settings = await openCoordinatorSettings(page, true);
  await settings.getByLabel("Coordinator name").fill("Madeira node");
  await closeCoordinatorSettings(settings);

  await expect(page.getByTestId("active-server-context")).toHaveText("Workspace");
  await expect(page.getByRole("navigation", { name: "Server and channel browser" })).toContainText("Madeira node");
  await page.getByRole("button", { name: "Open management interface" }).click();
  await expect(page.getByRole("navigation", { name: "Server and channel browser" })).toContainText("Madeira node");
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
});

test("starts, locks relay configuration, and stops", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  const initialSettings = await openCoordinatorSettings(page, true);
  await initialSettings.getByLabel("Toggle announcement").check();
  await initialSettings.getByTestId("max-users-input").fill("32");
  await initialSettings.getByTestId("max-users-input").blur();
  await expect(initialSettings.getByTestId("max-users-state")).toContainText("32 key packages / identity");
  await closeCoordinatorSettings(initialSettings);
  expect(await pageExitIsGuarded(page)).toBe(false);

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Coordinator is starting" })).toBeVisible();
  const startup = page.getByTestId("startup-progress-panel");
  await expect(startup).toBeVisible();
  await expect(startup.getByTestId("startup-current-status")).toContainText(/checking|opening|preparing|connecting/i);
  await expect(startup.getByRole("progressbar", { name: "Coordinator startup progress" })).toHaveAttribute(
    "aria-valuenow",
    /^(20|40|60|80)$/,
  );
  await expect(startup.getByRole("status")).toContainText(/identity|room|MLS|relay|coordinator/i);
  await expect(startup.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("Starting", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Destroy" })).toHaveCount(0);
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  expect(await pageExitIsGuarded(page)).toBe(true);
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId("server-online-notice")).toBeVisible();
  await expect(page.getByTestId("host-chat")).toBeVisible();
  await expect(page.getByText("My coordinator", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Server and channel browser" })).toContainText(/\d+ relay paths?/);
  await expect(page.getByTestId("coordinator-empty-state")).toContainText("No rooms for this coordinator");
  await expect(page.getByRole("button", { name: "Rooms", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("invite-panel")).toBeVisible();
  await page.getByRole("button", { name: "Open management interface" }).click();
  await expect(page.getByTestId("management-interface")).toBeVisible();
  await expect(page.getByTestId("host-chat")).toBeHidden();
  const channelBrowser = page.getByRole("navigation", { name: "Server and channel browser" });
  const serverSelector = channelBrowser.locator(".channel-context-button");
  await expect(serverSelector).toBeVisible();
  await serverSelector.click();
  await expect(channelBrowser.getByRole("menu", { name: "Choose coordinator" })).toBeVisible();
  await channelBrowser.getByRole("menuitem", { name: /My coordinator/ }).click();
  const runningSettings = await openCoordinatorSettings(page, true);
  await runningSettings.getByTestId("max-users-input").fill("33");
  await runningSettings.getByTestId("max-users-input").blur();
  await expect(runningSettings.getByTestId("restart-required")).toBeVisible();
  await runningSettings.getByRole("button", { name: "Done editing" }).click();
  await runningSettings.getByRole("button", { name: "Restart to apply" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(runningSettings.getByTestId("restart-required")).toBeHidden();
  await closeCoordinatorSettings(runningSettings);
  await expect(page.getByTestId("resource-monitor")).toBeVisible();
  await expect(page.getByTestId("telemetry-client-streams")).toContainText("(est.)");
  await expect(page.getByTestId("telemetry-fanout-legs")).not.toContainText("debug");
  await expect(page.getByTestId("telemetry-message-rate")).toContainText("/min (est.)");
  await expect(page.getByTestId("telemetry-memory")).toContainText(/unavailable|MB \(est\.\)/);
  const telemetryCells = page.getByTestId("resource-monitor").locator("dl > div");
  await expect(telemetryCells).toHaveCount(4);
  const telemetryRows = await telemetryCells.evaluateAll((cells) => cells.map((cell) => Math.round(cell.getBoundingClientRect().top)));
  expect(new Set(telemetryRows).size).toBe(1);
  await expect(telemetryCells.first()).toHaveCSS("opacity", "0.28");
  await telemetryCells.first().hover();
  await expect(telemetryCells.first()).toHaveCSS("opacity", "0.95");
  await expect(page.getByRole("log", { name: "Coordinator activity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close management interface" })).toHaveText("Host");
  await page.getByRole("button", { name: "Close management interface" }).click();
  await expect(page.getByTestId("management-interface")).toBeHidden();
  await expect(page.getByTestId("host-chat")).toBeVisible();

  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  expect(await pageExitIsGuarded(page)).toBe(false);
  await expect(page.getByTestId("resource-monitor")).toBeHidden();

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId("host-chat")).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
});

test("separates the coordinator runtime from the selected room connection", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();

  await expect(page.getByTestId("coordinator-runtime-status")).toHaveText(/Coordinator\s*running/);
  const channelBrowser = page.getByRole("navigation", { name: "Server and channel browser" });
  await expect(channelBrowser).not.toContainText(/\brunning\b/i);
  await expect(channelBrowser).toContainText(/\d+ relay paths?/);

  await page.getByRole("button", { name: "Open management interface" }).click();
  const summary = page.getByTestId("management-summary");
  await expect(summary.locator(":scope > div")).toHaveCount(3);
  await page.getByRole("button", { name: "Close management interface" }).click();

  await createRoom(page, "Status room");
  await expect(page.getByTestId("chat-connection-status")).toHaveText("Room synced", { timeout: 15_000 });
});

test("keeps live startup status and progress inside a short mobile viewport", async ({ page }) => {
  const viewport = { width: 390, height: 350 };
  await page.setViewportSize(viewport);
  await page.goto("/");
  await configureMockRelay(page);

  await page.getByRole("button", { name: "Start", exact: true }).click();
  const panel = page.getByTestId("startup-progress-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("progressbar", { name: "Coordinator startup progress" })).toBeVisible();
  await expect(panel.getByRole("status")).not.toHaveText("");
  await expect(page.getByTestId("invite-panel")).toHaveAttribute("aria-hidden", "true");
  expect(await page.getByTestId("invite-panel").evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  await expect.poll(() => page.getByTestId("invite-panel").evaluate((element) => Math.round(element.getBoundingClientRect().right))).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".startup-stage")?.getBoundingClientRect();
    const progress = document.querySelector<HTMLElement>('[data-testid="startup-progress-panel"]')?.getBoundingClientRect();
    return {
      viewport: document.documentElement.clientHeight,
      page: document.documentElement.scrollHeight,
      body: document.body.scrollHeight,
      panelInsideStage: Boolean(stage && progress && progress.top >= stage.top && progress.bottom <= stage.bottom),
    };
  })).toEqual({
    viewport: viewport.height,
    page: viewport.height,
    body: viewport.height,
    panelInsideStage: true,
  });

  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
});

test("uses the full viewport for the live host workspace on desktop and mobile", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await configureMockRelay(page);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByTestId("host-chat")).toBeVisible();
    await expect.poll(() => page.getByTestId("operator-shell").evaluate((element) => element.clientHeight)).toBe(viewport.height);
    await expect.poll(() => page.locator(".host-layout").evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(viewport.width);
    await expectViewportOwned(page, viewport);
    const hostColumns = await page.locator(".host-layout").evaluate((layout) => {
      const rail = layout.querySelector<HTMLElement>(".host-rail")!.getBoundingClientRect();
      const chat = layout.querySelector<HTMLElement>(".host-chat")!.getBoundingClientRect();
      return {
        railLeft: Math.round(rail.left),
        railRight: Math.round(rail.right),
        railWidth: Math.round(rail.width),
        chatWidth: Math.round(chat.width),
        chatHeight: Math.round(chat.height),
        combinedWidth: Math.round(rail.width + chat.width),
        stacked: Math.round(rail.top) !== Math.round(chat.top),
      };
    });
    if (viewport.width > 900) {
      expect(hostColumns.stacked).toBe(false);
      expect(hostColumns.combinedWidth).toBe(viewport.width);
      await expect(page.getByTestId("invite-panel")).toHaveAttribute("aria-hidden", "false");
    } else {
      expect(hostColumns.stacked).toBe(false);
      expect(hostColumns.railRight).toBeLessThanOrEqual(1);
      expect(hostColumns.chatWidth).toBe(viewport.width);
      expect(hostColumns.chatHeight).toBeGreaterThan(100);
      await expect(page.getByTestId("invite-panel")).toHaveAttribute("aria-hidden", "true");
      expect(await page.getByTestId("invite-panel").evaluate((element) => (element as HTMLElement).inert)).toBe(true);

      const railToggle = page.locator(".mobile-rail-toggle");
      await railToggle.click();
      await expect(page.getByTestId("invite-panel")).toHaveAttribute("aria-hidden", "false");
      await expectInsideViewport(page.getByTestId("invite-panel"));
      expect(await page.getByTestId("invite-panel").evaluate((element) => ({
        overflowY: getComputedStyle(element).overflowY,
        scrollOwnsContent: element.scrollHeight >= element.clientHeight,
      }))).toEqual({ overflowY: "auto", scrollOwnsContent: true });
      await railToggle.click();
      await expect(page.getByTestId("invite-panel")).toHaveAttribute("aria-hidden", "true");
    }
    await page.getByRole("button", { name: "Open management interface" }).click();
    await expect(page.getByTestId("management-interface")).toBeVisible();
    await expect(page.getByTestId("host-chat")).toBeHidden();
    await expect.poll(() => page.locator(".host-layout").evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(viewport.width);
    await expectViewportOwned(page, viewport);
    await expect.poll(() => page.getByRole("log", { name: "Coordinator activity" }).evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBeGreaterThan(100);
    if (viewport.width <= 900) {
      await expect(page.getByTestId("invite-panel")).toHaveAttribute("aria-hidden", "true");
    } else {
      await expect(page.getByTestId("invite-panel")).toHaveAttribute("aria-hidden", "false");
    }
    await page.getByRole("button", { name: "Close management interface" }).click();
    await expect(page.getByTestId("management-interface")).toBeHidden();
    await expect(page.getByTestId("host-chat")).toBeVisible();
    const restoredHostColumns = await page.locator(".host-layout").evaluate((layout) => {
      const rail = layout.querySelector<HTMLElement>(".host-rail")!.getBoundingClientRect();
      const chat = layout.querySelector<HTMLElement>(".host-chat")!.getBoundingClientRect();
      return {
        railRight: Math.round(rail.right),
        railWidth: Math.round(rail.width),
        chatWidth: Math.round(chat.width),
        combinedWidth: Math.round(rail.width + chat.width),
        stacked: Math.round(rail.top) !== Math.round(chat.top),
      };
    });
    if (viewport.width > 900) {
      expect(restoredHostColumns.stacked).toBe(false);
      expect(restoredHostColumns.combinedWidth).toBe(viewport.width);
      await expect(page.getByRole("navigation", { name: "Server and channel browser" })).toBeVisible();
    } else {
      expect(restoredHostColumns.stacked).toBe(false);
      expect(restoredHostColumns.chatWidth).toBe(viewport.width);
      await expect(page.getByTestId("invite-panel")).toHaveAttribute("aria-hidden", "true");
      await expect.poll(() => page.getByTestId("invite-panel").evaluate((element) => Math.round(element.getBoundingClientRect().right))).toBeLessThanOrEqual(1);
      await page.locator(".mobile-rail-toggle").click();
      await expect(page.getByRole("navigation", { name: "Server and channel browser" })).toBeVisible();
      await expectInsideViewport(page.getByTestId("invite-panel"));
      await page.locator(".mobile-rail-toggle").click();
    }
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.getByTestId("status-badge")).toHaveText("idle");
  }
});

test("keeps host mobile tools and room dialogs bounded inside the app shell", async ({ page }) => {
  const portrait = { width: 320, height: 568 };
  await page.setViewportSize(portrait);
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");

  await page.getByRole("button", { name: "Open host tools" }).click();
  await page.getByRole("button", { name: /Open profile for/ }).click();
  const profile = page.getByRole("dialog", { name: "User profile" });
  await expect(profile).toBeVisible();
  await expectInsideViewport(profile);
  expect(await profile.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    scrollOwnsContent: element.scrollHeight >= element.clientHeight,
  }))).toEqual({ overflowY: "auto", scrollOwnsContent: true });
  await page.keyboard.press("Escape");
  await expect(profile).toBeHidden();
  await expectViewportOwned(page, portrait);

  await createRoom(page, "Mobile controls");
  await page.getByRole("button", { name: "Open room browser" }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const share = page.getByTestId("share-dialog").getByRole("dialog");
  const shareBody = share.locator(".share-dialog-body");
  await expectInsideViewport(share);
  expect(await shareBody.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    scrollable: element.scrollHeight > element.clientHeight,
  }))).toEqual({ overflowY: "auto", scrollable: true });
  await expectViewportOwned(page, portrait);

  const landscape = { width: 568, height: 320 };
  await page.setViewportSize(landscape);
  await expectInsideViewport(share);
  await expect.poll(() => shareBody.evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBeGreaterThan(80);
  await expectViewportOwned(page, landscape);
  await share.locator(".share-close").click();

  await page.getByRole("button", { name: "Open management interface" }).click();
  await expect.poll(() => page.getByRole("log", { name: "Coordinator activity" }).evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBeGreaterThan(100);
  await expectViewportOwned(page, landscape);
  await page.getByRole("button", { name: "Close management interface" }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
});

test("persists and honors the autostart coordinator setting", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  const settings = await openCoordinatorSettings(page, true);
  await settings.getByLabel("Toggle autostart").check();
  await closeCoordinatorSettings(settings);
  await page.reload();

  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
});

test("Feature: invite-only chat — Scenario: a guest link opens inside the unified root workspace", async ({ page, browser }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByText("Invite a small group.")).toHaveCount(0);
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  const createDialog = page.getByTestId("create-room-dialog");
  await expect(createDialog).toBeVisible();
  await expect(page.getByLabel("Auto-approve invitees")).toBeChecked();
  await expect(page.locator(".host-layout")).toHaveCSS("filter", "blur(2px)");
  await createDialog.getByPlaceholder("Friday plans").fill("BDD room");
  await createDialog.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(createDialog).toBeHidden();
  await expect(page.getByTestId("host-chat")).toBeVisible();
  const shareButton = page.getByTestId("invite-panel").getByRole("button", { name: "Share", exact: true });
  await expect(shareButton).toBeVisible();
  await expect(page.getByAltText("QR code to join BDD room")).toHaveCount(0);
  await shareButton.click();
  const shareDialog = page.getByTestId("share-dialog");
  await expect(shareDialog).toBeVisible();
  await expect(shareDialog.getByRole("button", { name: "Copy link" })).toBeVisible();
  await expect.poll(async () => (await shareDialog.getByAltText("QR code to join BDD room").boundingBox())?.width ?? 0).toBeGreaterThan(240);
  await expect(page.locator(".host-layout")).toHaveCSS("filter", "blur(2px)");
  const inviteLink = await page.getByTestId("invite-link").textContent();
  expect(inviteLink).toContain("/chat/");
  await shareDialog.getByRole("button", { name: "Close share dialog" }).last().click();
  await expect(shareDialog).toBeHidden();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteLink!);

  await expect(guest).toHaveURL(/\/$/);
  await expect(guest.getByTestId("operator-shell")).toBeVisible();
  await expect(guest.getByTestId("workspace-navigation")).toHaveCount(1);
  await expect(guest.getByTestId("invite-panel")).toBeVisible();
  await expect(guest.getByTestId("chat-route")).toBeVisible();
  await expect(guest.getByText("Choose a name, then join the encrypted room.")).toHaveCount(0);
  await expect(guest.getByRole("button", { name: "Join chat" })).toHaveCount(0);
  await expect(guest.getByTestId("cached-room-view")).toBeVisible({ timeout: 35_000 });
  await expect(guest.getByRole("heading", { name: "BDD room" })).toBeVisible();
  await expect(guest.locator(".host-chat > [data-testid='chat-route']")).toBeVisible();
  await expectEmbeddedChatFillsHostPane(guest);
  await guestContext.close();
});

test("refreshes a room invite without disconnecting the room and rejects the previous link", async ({ page, browser }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await createRoom(page, "Rotating room");

  const previousInvite = await page.getByTestId("invite-link").textContent();
  await page.getByTestId("invite-panel").getByRole("button", { name: "Share", exact: true }).click();
  const shareDialog = page.getByTestId("share-dialog");
  await shareDialog.getByRole("button", { name: "Refresh link" }).click();
  await expect(shareDialog.getByText("New link ready. Previous links can no longer admit guests.")).toBeVisible();
  const currentInvite = await page.getByTestId("invite-link").textContent();
  expect(currentInvite).not.toBe(previousInvite);
  expect(new URL(currentInvite!).pathname).toBe(new URL(previousInvite!).pathname);
  await shareDialog.getByRole("button", { name: "Close share dialog" }).last().click();
  await expect(page.getByTestId("host-chat")).toBeVisible();

  const previousContext = await browser.newContext();
  const previousGuest = await previousContext.newPage();
  await previousGuest.goto(previousInvite!);
  await expect(previousGuest.getByRole("button", { name: "Join chat" })).toHaveCount(0);
  await expect(previousGuest.getByText("Your encrypted join request is with the host.")).toBeVisible();

  const currentContext = await browser.newContext();
  const currentGuest = await currentContext.newPage();
  await currentGuest.goto(currentInvite!);
  await expect(currentGuest.getByRole("button", { name: "Join chat" })).toHaveCount(0);
  await expect(currentGuest.getByPlaceholder("Message")).toBeVisible({ timeout: 20_000 });
  await expect(previousGuest.getByText("Your encrypted join request is with the host.")).toBeVisible();
  await expect(previousGuest.getByPlaceholder("Message")).toHaveCount(0);

  await previousContext.close();
  await currentContext.close();
});

test("Feature: invite-only chat — Scenario: a guest is admitted and messages survive coordinator delivery", async ({ page, browser }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await customizeHostIdentity(page, "Mara", "guide", "🦉");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await createRoom(page, "Working room");
  const inviteLink = await page.getByTestId("invite-link").textContent();
  await expect(page.getByTestId("host-chat")).toBeVisible();
  const hostedRoomRow = page.getByTestId("invite-panel").getByRole("button", { name: "Open room Working room" });
  await expect(hostedRoomRow.getByTestId("room-host-identity")).toContainText("Mara");
  await expect(hostedRoomRow.getByTestId("room-host-identity")).toContainText("host");
  const hostActions = await openRoomActions(page, "Working room");
  await expect(hostActions.getByRole("menuitemcheckbox", { name: /Mute notification sounds/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(hostActions).toBeHidden();
  await expect(page.getByTestId("invite-panel").getByLabel("Mute notification sounds")).toHaveCount(0);

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteLink!);
  await expect(guest.getByRole("button", { name: "Join chat" })).toHaveCount(0);
  await expect(guest.getByTestId("active-server-context")).toContainText("Mara · host");
  await expect(guest.getByText("Your encrypted join request is with the host.")).toBeVisible();

  await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByLabel("Add 👍")).toBeVisible();
  const reachableCoordinator = guest.getByTestId("selected-coordinator-status");
  await expect(reachableCoordinator).toHaveAttribute("data-state", "online", { timeout: 20_000 });
  await expect(reachableCoordinator).toHaveAttribute("aria-label", /coordinator online/i);
  const guestActions = await openRoomActions(guest, "Working room");
  await expect(guestActions.getByRole("menuitemcheckbox", { name: /Mute notification sounds/ })).toBeVisible();
  await expect(guestActions.getByRole("menuitem", { name: "Leave room Working room" })).toBeVisible();
  await guest.keyboard.press("Escape");
  await expect(guestActions).toBeHidden();
  await expect(guest.getByTestId("active-server-context")).toContainText("Mara · host");
  const guestSidebarRoom = guest.getByTestId("invite-panel").getByRole("button", { name: /Open room Working room/ });
  await expect(guestSidebarRoom.getByTestId("room-host-identity")).toContainText("Mara");
  await expect(guestSidebarRoom.getByTestId("room-host-identity")).toContainText("host");
  await guest.getByPlaceholder("Message").fill("Hello from BDD");
  await guest.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("host-chat").getByText("Hello from BDD")).toBeVisible({ timeout: 15_000 });

  await guest.setViewportSize({ width: 390, height: 350 });
  await expect.poll(() => guest.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    pageHeight: document.documentElement.scrollHeight,
    viewportHeight: document.documentElement.clientHeight,
  }))).toEqual({ pageWidth: 390, viewportWidth: 390, pageHeight: 350, viewportHeight: 350 });
  await expect.poll(() => guest.getByTestId("guest-message-list").evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBeGreaterThan(60);
  await expect(guest.getByTestId("workspace-navigation")).toBeVisible();
  await expect(guest.getByRole("button", { name: "Open host tools" })).toBeVisible();
  for (let index = 1; index <= 10; index += 1) {
    await page.getByPlaceholder("Message as host").fill(`Host note ${index}`);
    await page.getByPlaceholder("Message as host").press("Enter");
  }
  await expect(guest.getByText("Host note 10")).toBeVisible({ timeout: 30_000 });
  const hostMessage = guest.locator("article.message").filter({ hasText: "Host note 10" });
  await expect(hostMessage.getByTestId("message-author")).toContainText("Mara");
  await expect(hostMessage.getByTestId("message-badge")).toContainText(/🦉\s*guide/);
  await expect(hostMessage.getByTestId("message-author").locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
  await expect(hostMessage.getByTestId("message-badge")).toHaveCSS("user-select", "text");
  await expect.poll(() => guest.getByTestId("guest-message-list").evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThanOrEqual(2);
  await guestContext.close();
});

test("message reactions persist and synchronize", async ({ page, browser }) => {
  test.setTimeout(75_000);
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await createRoom(page, "Reaction room");
  const inviteLink = await page.getByTestId("invite-link").textContent();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteLink!);
  await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 20_000 });
  await guest.getByPlaceholder("Message").fill("A reaction target");
  await guest.getByRole("button", { name: "Send" }).click();
  const hostMessage = page.locator("article.host-message").filter({ hasText: "A reaction target" });
  await expect(hostMessage).toBeVisible({ timeout: 20_000 });

  const hostPaneActions = page.getByTestId("host-chat").getByRole("button", { name: "More room actions" });
  await expect(hostPaneActions).toBeVisible();
  await hostPaneActions.click();
  await expect(page.getByTestId("host-chat").getByRole("menuitem", { name: "Delete room Reaction room" })).toBeVisible();
  await page.keyboard.press("Escape");

  await hostMessage.getByRole("button", { name: "Add reaction" }).click();
  await hostMessage.getByRole("menu", { name: /Choose reaction/ }).getByRole("menuitem", { name: "React 👍" }).click();
  await expect(hostMessage.getByRole("button", { name: /Remove 👍 reaction, 1 participant/ })).toHaveAttribute("aria-pressed", "true");

  const guestMessage = guest.locator("article.message").filter({ hasText: "A reaction target" });
  await expect(guestMessage.getByRole("button", { name: /Add 👍 reaction, 1 participant/ })).toBeVisible({ timeout: 20_000 });
  const guestPaneActions = guest.getByTestId("cached-room-view").getByRole("button", { name: "More room actions" });
  await expect(guestPaneActions).toBeVisible();
  await guestPaneActions.click();
  await expect(guest.getByTestId("cached-room-view").getByRole("menuitem", { name: "Leave room Reaction room" })).toBeVisible();
  await guest.keyboard.press("Escape");
  await guestMessage.getByRole("button", { name: /Add 👍 reaction, 1 participant/ }).click();
  await expect(guestMessage.getByRole("button", { name: /Remove 👍 reaction, 2 participants/ })).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  await expect(hostMessage.getByRole("button", { name: /Remove 👍 reaction, 2 participants/ })).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });

  await guestMessage.getByRole("button", { name: /Remove 👍 reaction, 2 participants/ }).click();
  await expect(guestMessage.getByRole("button", { name: /Add 👍 reaction, 1 participant/ })).toBeVisible({ timeout: 20_000 });
  await expect(hostMessage.getByRole("button", { name: /Remove 👍 reaction, 1 participant/ })).toBeVisible({ timeout: 20_000 });
  for (const emoji of ["👍", "❤️", "😂", "🎉", "👋", "✨"]) {
    await expect(page.getByTestId("host-chat").getByLabel(`Add ${emoji}`, { exact: true })).toBeVisible();
  }
  await guest.setViewportSize({ width: 390, height: 667 });
  for (const emoji of ["👍", "❤️", "😂", "🎉", "👋", "✨"]) {
    await expect(guest.getByTestId("chat-composer").getByLabel(`Add ${emoji}`, { exact: true })).toBeVisible();
  }
  await guestContext.close();
});

test("emoji shortcuts and offline cached reactions", async ({ page }) => {
  await page.goto("/");
  await seedJoinedRoom(page, "Offline reactions");
  await page.evaluate(() => {
    const key = [...Array(localStorage.length).keys()]
      .map((index) => localStorage.key(index) ?? "")
      .find((entry) => entry.includes("cordn-adhoc-chat-room:v2:"));
    if (!key) throw new Error("seeded room was not found");
    const room = JSON.parse(localStorage.getItem(key) ?? "{}");
    room.messages = [{
      type: "message", id: "cached-message", sender: "c".repeat(64), name: "Cached guest", content: "Still readable", createdAt: 1,
    }];
    room.reactions = [
      { id: "cached-reaction", sender: "d".repeat(64), targetMessageId: "cached-message", emoji: "✨", active: true, createdAt: 2 },
      { id: "bad-reaction", sender: "d".repeat(64), targetMessageId: "cached-message", emoji: "not-an-emoji", active: true, createdAt: 3 },
    ];
    localStorage.setItem(key, JSON.stringify(room));
  });
  await page.reload();
  await page.locator(".channel-context-button").click();
  await page.getByRole("menu", { name: "Choose coordinator" }).getByRole("menuitem").nth(1).click();
  await page.getByRole("button", { name: /Open room Offline reactions/ }).click();
  const cachedRoom = page.getByTestId("cached-room-view");
  await expect(cachedRoom.getByText("Still readable")).toBeVisible();
  await expect(cachedRoom.getByRole("button", { name: "Add reaction" })).toBeDisabled();
  for (const emoji of ["👍", "❤️", "😂", "🎉", "👋", "✨"]) {
    await expect(cachedRoom.getByLabel(`Add ${emoji}`, { exact: true })).toBeVisible();
    await expect(cachedRoom.getByLabel(`Add ${emoji}`, { exact: true })).toBeDisabled();
  }
});

test("hosts delete rooms and members leave with contextual confirmation", async ({ page, browser }) => {
  test.setTimeout(75_000);
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await createRoom(page, "Keep room");
  await createRoom(page, "Disposable room");
  const inviteLink = await page.getByTestId("invite-link").textContent();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteLink!);
  await expect(guest.getByRole("button", { name: "Join chat" })).toHaveCount(0);
  await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 20_000 });
  await guest.getByPlaceholder("Message").fill("Keep this cached");
  await guest.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("host-chat").getByText("Keep this cached")).toBeVisible({ timeout: 15_000 });

  let roomActions = await openRoomActions(page, "Disposable room");
  await expect(roomActions.getByRole("menuitem", { name: "Leave room Disposable room" })).toHaveCount(0);
  await roomActions.getByRole("menuitem", { name: "Delete room Disposable room" }).click();
  const deleteDialog = page.getByTestId("room-removal-dialog");
  await expect(deleteDialog.getByRole("heading", { name: "Delete #Disposable room?" })).toBeVisible();
  await expect(deleteDialog.getByTestId("room-removal-impact")).toContainText("1 cached message");
  await expect(deleteDialog.getByTestId("room-removal-impact")).toContainText("Coordinator");
  await expect(deleteDialog.getByTestId("room-removal-impact")).toContainText("Host");
  await expect(deleteDialog.getByTestId("room-removal-impact")).toContainText("This cannot be undone");
  await expect(deleteDialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(deleteDialog).toBeHidden();
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Open room Disposable room" })).toBeVisible();

  roomActions = await openRoomActions(page, "Disposable room");
  await roomActions.getByRole("menuitem", { name: "Delete room Disposable room" }).click();
  await deleteDialog.getByTestId("confirm-delete-room").click();
  await expect(deleteDialog).toBeHidden();
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Open room Disposable room" })).toHaveCount(0);
  await expect(page.locator(".channel-row.active")).toContainText("Keep room");

  await expect(guest.getByTestId("room-deleted-message")).toBeVisible({ timeout: 25_000 });
  await expect(guest.getByPlaceholder("Room deleted by host")).toBeDisabled();
  await guest.setViewportSize({ width: 390, height: 350 });
  const guestRoomActions = await openRoomActions(guest, "Disposable room");
  await expect(guestRoomActions.getByRole("menuitem", { name: "Delete room Disposable room" })).toHaveCount(0);
  await guestRoomActions.getByRole("menuitem", { name: "Leave room Disposable room" }).click();
  const leaveDialog = guest.getByTestId("room-removal-dialog");
  await expect(leaveDialog.getByRole("heading", { name: "Leave #Disposable room?" })).toBeVisible();
  await expect(leaveDialog.getByTestId("room-removal-impact")).toContainText("1 cached message");
  await expect.poll(() => guest.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('[data-testid="room-removal-dialog"]');
    const bounds = dialog?.getBoundingClientRect();
    return {
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      fits: Boolean(bounds && bounds.top >= 0 && bounds.bottom <= window.innerHeight),
    };
  })).toEqual({ pageHeight: 350, viewportHeight: 350, fits: true });

  await leaveDialog.getByTestId("confirm-leave-room").click();
  await expect(guest).toHaveURL(/\/$/);
  await expect(guest.getByTestId("operator-shell")).toBeVisible();
  await expect(guest.getByTestId("workspace-navigation")).toHaveCount(1);
  expect(await guest.evaluate(() => [...Array(localStorage.length).keys()].some((index) => {
    const value = localStorage.getItem(localStorage.key(index) ?? "");
    return value?.includes('"title":"Disposable room"') ?? false;
  }))).toBe(false);

  await guestContext.close();
});

test("active room removal selects the previous room, then next, then the coordinator empty state", async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await createRoom(page, "Adjacent first");
  await createRoom(page, "Adjacent middle");
  await createRoom(page, "Adjacent last");

  const deleteFromRail = async (title: string) => {
    const row = page.locator(".channel-row").filter({ hasText: title });
    const trigger = row.getByRole("button", { name: `More actions for # ${title}` });
    await trigger.click();
    await page.getByRole("menu", { name: `Room actions for ${title}` }).getByRole("menuitem", { name: `Delete room ${title}` }).click();
    await page.getByTestId("confirm-delete-room").click();
  };

  await page.getByRole("button", { name: /Open room Adjacent middle/ }).click();
  await deleteFromRail("Adjacent middle");
  await expect(page.locator(".channel-row.active .channel-row-primary")).toContainText("Adjacent last");

  await deleteFromRail("Adjacent last");
  await expect(page.locator(".channel-row.active .channel-row-primary")).toContainText("Adjacent first");

  await deleteFromRail("Adjacent first");
  await expect(page.getByTestId("coordinator-empty-state")).toContainText("No rooms for this coordinator");
  await expect(page.getByTestId("coordinator-empty-state")).toContainText("Create a room or open a current invite to add one here.");
  await expect(page.getByTestId("coordinator-empty-content")).toBeVisible();
});

test("room removal missing-target failure stays contextual and safe", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await createRoom(page, "Safe removal");
  const roomActions = await openRoomActions(page, "Safe removal");
  await roomActions.getByRole("menuitem", { name: "Delete room Safe removal" }).click();
  const dialog = page.getByTestId("room-removal-dialog");
  await page.evaluate(() => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("cordn-adhoc-chat-room:v2:")) localStorage.removeItem(key);
    }
  });
  await dialog.getByTestId("confirm-delete-room").click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveText("Couldn’t delete # Safe removal. Try again.");
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
});

test("sidebar room actions do not open the row before deleting its exact host room", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await createRoom(page, "Sidebar keep");
  await createRoom(page, "Sidebar delete");

  await expect(page.locator(".channel-row.active .channel-row-primary")).toContainText("Sidebar delete");
  const targetRow = page.locator(".channel-row").filter({ hasText: "Sidebar delete" });
  const trigger = targetRow.getByRole("button", { name: "More actions for # Sidebar delete" });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.locator(".channel-row.active .channel-row-primary")).toContainText("Sidebar delete");

  const menu = page.getByRole("menu", { name: "Room actions for Sidebar delete" });
  await expect(menu.getByRole("menuitem", { name: "Delete room Sidebar delete" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Delete room Sidebar delete" }).click();
  const dialog = page.getByTestId("room-removal-dialog");
  await expect(dialog.getByRole("heading", { name: "Delete #Sidebar delete?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("same-id sidebar removal leaves only the captured remote record", async ({ page }) => {
  await page.goto("/");
  await seedJoinedRoom(page, "Sidebar remote", "f".repeat(64));
  await page.reload();
  await page.locator(".channel-context-button").click();
  await page.getByRole("menu", { name: "Choose coordinator" }).getByRole("menuitem", { name: /Coordinator ffffff/ }).click();

  const targetRow = page.locator(".channel-row").filter({ hasText: "Sidebar remote" });
  const trigger = targetRow.getByRole("button", { name: "More actions for # Sidebar remote" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Room actions for Sidebar remote" });
  await expect(menu.getByRole("menuitem", { name: "Leave room Sidebar remote" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete room Sidebar remote" })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Leave room Sidebar remote" }).click();
  const dialog = page.getByTestId("room-removal-dialog");
  await expect(dialog.getByRole("heading", { name: "Leave #Sidebar remote?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("leaving the last remote room returns to the home coordinator", async ({ page }) => {
  await page.goto("/");
  const remoteCoordinatorPubkey = "f".repeat(64);
  await seedJoinedRoom(page, "Last remote room", remoteCoordinatorPubkey);
  await page.reload();

  await page.locator(".channel-context-button").click();
  const coordinatorMenu = page.getByRole("menu", { name: "Choose coordinator" });
  const homeCoordinatorPubkey = await coordinatorMenu
    .getByTestId("local-coordinator-menu-status")
    .getAttribute("data-coordinator-pubkey");
  expect(homeCoordinatorPubkey).toBeTruthy();
  await coordinatorMenu.getByRole("menuitem", { name: /Coordinator ffffff/ }).click();
  await expect(page.getByTestId("selected-coordinator-status"))
    .toHaveAttribute("data-coordinator-pubkey", remoteCoordinatorPubkey);

  const targetRow = page.locator(".channel-row").filter({ hasText: "Last remote room" });
  await targetRow.getByRole("button", { name: "More actions for # Last remote room" }).click();
  await page.getByRole("menu", { name: "Room actions for Last remote room" })
    .getByRole("menuitem", { name: "Leave room Last remote room" })
    .click();
  await page.getByTestId("confirm-leave-room").click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("selected-coordinator-status"))
    .toHaveAttribute("data-coordinator-pubkey", homeCoordinatorPubkey!);
  await expect(page.getByTestId("coordinator-empty-state"))
    .toContainText("Create a room or open a current invite to add one here.");
  await expect(page.getByRole("button", { name: "Create room from coordinator sidebar" })).toBeVisible();

  await page.locator(".channel-context-button").click();
  await expect(page.getByRole("menu", { name: "Choose coordinator" })
    .getByRole("menuitem", { name: /Coordinator ffffff/ }))
    .toHaveCount(0);
});

test("switches local Delete to remote Leave without crossing same-id room identities", async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");

  await createRoom(page, "Exact local delete target");
  const exactLocalActions = await openRoomActions(page, "Exact local delete target");
  await expect(exactLocalActions.getByRole("menuitem", { name: "Leave room Exact local delete target" })).toHaveCount(0);
  await exactLocalActions.getByRole("menuitem", { name: "Delete room Exact local delete target" }).click();
  const localDeleteDialog = page.getByTestId("room-removal-dialog");
  await expect(localDeleteDialog.getByRole("heading", { name: "Delete #Exact local delete target?" })).toBeVisible();
  await localDeleteDialog.getByTestId("confirm-delete-room").click();
  await expect(localDeleteDialog).toBeHidden();
  expect(await page.evaluate(() => [...Array(localStorage.length).keys()].every((index) => {
    const value = localStorage.getItem(localStorage.key(index) ?? "");
    return !value?.includes('"title":"Exact local delete target"');
  }))).toBe(true);

  await createRoom(page, "Local collision room");
  const localInvite = await page.getByTestId("invite-link").textContent();
  expect(localInvite).toBeTruthy();
  const localRoom = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:v2:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const room = JSON.parse(raw) as {
        id?: string;
        title?: string;
        coordinatorPubkey?: string;
        relayUrls?: string[];
      };
      if (room.title === "Local collision room"
        && typeof room.id === "string"
        && typeof room.coordinatorPubkey === "string"
        && Array.isArray(room.relayUrls)) {
        return room as Required<Pick<typeof room, "id" | "title" | "coordinatorPubkey" | "relayUrls">>;
      }
    }
    return null;
  });
  if (!localRoom) throw new Error("Could not find the hosted collision room");

  const remoteCoordinatorPubkey = "f".repeat(64);
  const remotePrivateFixture = createStoredRoomPrivateFixture();
  await page.evaluate(({ localRoom, remoteCoordinatorPubkey, relayUrl, remotePrivateFixture }) => {
    const remoteRoom = {
      version: 1,
      id: localRoom.id,
      title: "Remote collision room",
      coordinatorPubkey: remoteCoordinatorPubkey,
      coordinatorOrigin: "https://remote.example",
      relayUrls: [relayUrl],
      name: "Reader",
      stablePubkey: "b".repeat(64),
      isHost: false,
      stateBase64: "",
      keyPackage: {
        reference: "remote-ref",
        publicBase64: "public",
        privateBase64: remotePrivateFixture.keyPackagePrivateBase64,
      },
      anonymousSecretKey: remotePrivateFixture.anonymousSecretKey,
      lastCursor: 0,
      messages: [],
      pending: [],
      joinRequestSent: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const key = `cordn-adhoc-chat-room:v2:${encodeURIComponent(remoteCoordinatorPubkey)}:${encodeURIComponent(remoteRoom.id)}`;
    localStorage.setItem(key, JSON.stringify(remoteRoom));
  }, { localRoom, remoteCoordinatorPubkey, relayUrl: relay.url, remotePrivateFixture });

  await navigateWithinShell(page, localInvite!);
  let collisionActions = await openRoomActions(page, "Local collision room");
  await expect(collisionActions.getByRole("menuitem", { name: "Delete room Local collision room" })).toBeVisible();
  await expect(collisionActions.getByRole("menuitem", { name: "Leave room Local collision room" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator(".channel-context-button").click();
  await page.getByRole("menu", { name: "Choose coordinator" }).getByRole("menuitem", { name: /Coordinator ffffff/ }).click();
  await page.getByRole("button", { name: /Open room Remote collision room/ }).click();

  collisionActions = await openRoomActions(page, "Remote collision room");
  const remoteLeave = collisionActions.getByRole("menuitem", { name: "Leave room Remote collision room" });
  await expect(remoteLeave).toBeVisible();
  await expect(collisionActions.getByRole("menuitem", { name: "Delete room Remote collision room" })).toHaveCount(0);
  await remoteLeave.click();
  const remoteLeaveDialog = page.getByTestId("room-removal-dialog");
  await expect(remoteLeaveDialog.getByRole("heading", { name: "Leave #Remote collision room?" })).toBeVisible();
  await remoteLeaveDialog.getByTestId("confirm-leave-room").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("operator-shell")).toBeVisible();

  expect(await page.evaluate(({ localRoom, remoteCoordinatorPubkey }) => {
    const roomKey = (coordinatorPubkey: string) => (
      `cordn-adhoc-chat-room:v2:${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(localRoom.id)}`
    );
    return {
      local: localStorage.getItem(roomKey(localRoom.coordinatorPubkey)) !== null,
      remote: localStorage.getItem(roomKey(remoteCoordinatorPubkey)) !== null,
    };
  }, { localRoom, remoteCoordinatorPubkey })).toEqual({ local: true, remote: false });
  await navigateWithinShell(page, localInvite!);
  collisionActions = await openRoomActions(page, "Local collision room");
  await expect(collisionActions.getByRole("menuitem", { name: "Delete room Local collision room" })).toBeVisible();
});

test("leaves a previous local host session without deleting its same-id current room", async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");

  await createRoom(page, "Current local collision room");
  const localInvite = await page.getByTestId("invite-link").textContent();
  expect(localInvite).toBeTruthy();
  const localRoom = await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:v2:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const room = JSON.parse(raw) as { id?: string; title?: string; coordinatorPubkey?: string };
      if (room.title === "Current local collision room"
        && typeof room.id === "string"
        && typeof room.coordinatorPubkey === "string") return room;
    }
    return null;
  });
  if (!localRoom?.id || !localRoom.coordinatorPubkey) throw new Error("Could not find the local collision room");
  const localRoomIdentity = {
    id: localRoom.id,
    coordinatorPubkey: localRoom.coordinatorPubkey,
  };

  const remoteCoordinatorPubkey = "e".repeat(64);
  const stalePrivateFixture = createStoredRoomPrivateFixture();
  await page.evaluate(({ localRoom, remoteCoordinatorPubkey, relayUrl, stalePrivateFixture }) => {
    const staleRemoteRoom = {
      version: 1,
      id: localRoom.id,
      title: "Stale remote host claim",
      coordinatorPubkey: remoteCoordinatorPubkey,
      coordinatorOrigin: "https://remote.example",
      relayUrls: [relayUrl],
      name: "Stale host",
      stablePubkey: "b".repeat(64),
      // A legacy/corrupt record can preserve this old host claim even though
      // coordinator identity puts the room under a remote coordinator.
      isHost: true,
      stateBase64: "",
      keyPackage: {
        reference: "stale-remote-ref",
        publicBase64: "public",
        privateBase64: stalePrivateFixture.keyPackagePrivateBase64,
      },
      anonymousSecretKey: stalePrivateFixture.anonymousSecretKey,
      lastCursor: 0,
      messages: [],
      pending: [],
      joinRequestSent: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const key = `cordn-adhoc-chat-room:v2:${encodeURIComponent(remoteCoordinatorPubkey)}:${encodeURIComponent(staleRemoteRoom.id)}`;
    localStorage.setItem(key, JSON.stringify(staleRemoteRoom));
  }, {
    localRoom: localRoomIdentity,
    remoteCoordinatorPubkey,
    relayUrl: relay.url,
    stalePrivateFixture,
  });

  await navigateWithinShell(page, localInvite!);
  const localActions = await openRoomActions(page, "Current local collision room");
  await expect(localActions.getByRole("menuitem", { name: "Delete room Current local collision room" })).toBeVisible();
  await expect(localActions.getByRole("menuitem", { name: "Leave room Current local collision room" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator(".channel-context-button").click();
  const coordinatorMenu = page.getByRole("menu", { name: "Choose coordinator" });
  await expect(coordinatorMenu.getByText("Previous local sessions", { exact: true })).toBeVisible();
  await coordinatorMenu.getByRole("menuitem", { name: /Previous local eeeeee/ }).click();
  await page.getByRole("button", { name: /Open previous local session Stale remote host claim/ }).click();

  const staleActions = await openRoomActions(page, "Stale remote host claim");
  const remoteLeave = staleActions.getByRole("menuitem", { name: "Leave room Stale remote host claim" });
  await expect(remoteLeave).toBeVisible();
  await expect(staleActions.getByRole("menuitem", { name: "Delete room Stale remote host claim" })).toHaveCount(0);
  await remoteLeave.click();
  const leaveDialog = page.getByTestId("room-removal-dialog");
  await expect(leaveDialog.getByRole("heading", { name: "Leave #Stale remote host claim?" })).toBeVisible();
  await leaveDialog.getByTestId("confirm-leave-room").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("operator-shell")).toBeVisible();

  expect(await page.evaluate(({ localRoom, remoteCoordinatorPubkey }) => {
    const keyFor = (coordinatorPubkey: string) => (
      `cordn-adhoc-chat-room:v2:${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(localRoom.id)}`
    );
    return {
      local: localStorage.getItem(keyFor(localRoom.coordinatorPubkey)) !== null,
      remote: localStorage.getItem(keyFor(remoteCoordinatorPubkey)) !== null,
    };
  }, { localRoom: localRoomIdentity, remoteCoordinatorPubkey })).toEqual({ local: true, remote: false });
});

test("manual admission shows a counted, identified queue and clears it after approval", async ({ page, browser }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  const createDialog = page.getByTestId("create-room-dialog");
  await createDialog.getByPlaceholder("Friday plans").fill("Manual room");
  await createDialog.getByLabel("Auto-approve invitees").uncheck();
  await createDialog.getByRole("button", { name: "Create room", exact: true }).click();

  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Open room Manual room" })).toBeVisible();
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Auto-approve invitees for Manual room: off" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".room-rail-heading")).toHaveCount(0);
  await page.getByRole("button", { name: "Open management interface" }).click();
  const approval = page.getByTestId("pending-invitees");
  await expect(approval.getByRole("button")).toBeDisabled();
  await expect(approval.getByRole("button")).toContainText("0");

  const inviteLink = await page.getByTestId("invite-link").textContent();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteLink!);
  await expect(guest.getByRole("button", { name: "Join chat" })).toHaveCount(0);

  await expect(approval.getByRole("button", { name: /Approve waiting invitees, 1 request/ })).toBeEnabled({ timeout: 15_000 });
  await expect(approval.locator("article")).toHaveCount(1);
  await expect(approval.locator("code")).toContainText("npub1");
  await expect(approval.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml/);

  await approval.getByRole("button", { name: /Approve waiting invitees, 1 request/ }).click();
  await expect(approval.getByRole("button")).toBeDisabled();
  await expect(approval.getByRole("button")).toContainText("0");
  await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 20_000 });
  await guestContext.close();
});

test("keeps auto-approval scoped to each room", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");

  await createRoom(page, "Manual access");
  const firstRoomToggle = page.getByTestId("invite-panel").getByRole("button", { name: "Auto-approve invitees for Manual access: on" });
  await expect(firstRoomToggle).toHaveAttribute("aria-pressed", "true");
  await firstRoomToggle.click();
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Auto-approve invitees for Manual access: off" })).toHaveAttribute("aria-pressed", "false");

  await createRoom(page, "Open access");
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Auto-approve invitees for Open access: on" })).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("invite-panel").getByRole("button", { name: "Open room Manual access" }).click();
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Auto-approve invitees for Manual access: off" })).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("invite-panel").getByRole("button", { name: "Open room Open access" }).click();
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Auto-approve invitees for Open access: on" })).toHaveAttribute("aria-pressed", "true");
});

test("a persistent host can navigate home rooms while communicating on another coordinator", async ({ browser }) => {
  test.setTimeout(90_000);
  const homeContext = await browser.newContext();
  const home = await homeContext.newPage();
  await home.goto("/");
  await enablePersistence(home, "room-navigation-passphrase");
  await configureMockRelay(home);
  await home.getByRole("button", { name: "Start", exact: true }).click();

  await createRoom(home, "Home alpha");
  await createRoom(home, "Home beta");

  const remoteContext = await browser.newContext();
  const remote = await remoteContext.newPage();
  await remote.goto("/");
  await configureMockRelay(remote);
  await remote.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(remote, "Remote lounge");
  const remoteInvite = await remote.getByTestId("invite-link").textContent();

  await navigateWithinShell(home, remoteInvite!);
  await expect(home).toHaveURL(/\/$/);
  await expect(home.getByTestId("active-server-context")).toContainText("remote");
  await expect(home.getByRole("button", { name: "Join chat" })).toHaveCount(0);
  await expect(home.getByPlaceholder("Message")).toBeVisible({ timeout: 35_000 });
  await home.getByPlaceholder("Message").fill("Hello across coordinators");
  await home.getByRole("button", { name: "Send" }).click();
  await expect(remote.getByTestId("host-chat").getByText("Hello across coordinators")).toBeVisible({ timeout: 15_000 });

  await home.locator(".channel-context-button").click();
  const serverMenu = home.getByRole("menu", { name: "Choose coordinator" });
  await expect(serverMenu.getByRole("menuitem")).toHaveCount(2);
  const homeCoordinatorPubkey = await serverMenu.getByTestId("local-coordinator-menu-status").getAttribute("data-coordinator-pubkey");
  expect(homeCoordinatorPubkey).toMatch(/^[0-9a-f]{64}$/);
  await serverMenu.getByRole("menuitem").filter({ hasText: "My coordinator" }).click();
  await home.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(home.locator(".channel-context-copy strong")).toHaveText("My coordinator");
  await expect(home.getByTestId("selected-coordinator-status")).toHaveAttribute("data-coordinator-pubkey", homeCoordinatorPubkey!);
  await expect(home.getByRole("button", { name: /Open room Home alpha/ })).toBeVisible();
  await expect(home.getByRole("button", { name: /Open room Home beta/ })).toBeVisible();

  await home.getByRole("button", { name: /Open room Home alpha/ }).click();
  await expect(home.getByTestId("active-server-context")).toContainText("anon · host");
  await expect(home.getByTestId("active-server-context")).toContainText("Home alpha");

  await home.locator(".channel-context-button").click();
  await home.getByRole("menu", { name: "Choose coordinator" }).getByRole("menuitem").nth(1).click();
  await home.getByRole("button", { name: /Open room Remote lounge/ }).click();
  await expect(home.getByTestId("active-server-context")).toContainText("Remote lounge");
  await expect(home.getByPlaceholder("Message")).toBeVisible({ timeout: 25_000 });
  await home.getByPlaceholder("Message").fill("Back in the remote room");
  await home.getByRole("button", { name: "Send" }).click();
  await expect(remote.getByTestId("host-chat").getByText("Back in the remote room")).toBeVisible({ timeout: 15_000 });
  const remoteCoordinatorStatus = home.getByTestId("selected-coordinator-status");
  await expect(remoteCoordinatorStatus).toHaveAttribute("data-state", "online", { timeout: 20_000 });

  await remote.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(remote.getByTestId("status-badge")).toHaveText("idle");
  await expect(home.getByTestId("room-connection-offline-message")).toBeVisible({ timeout: 25_000 });
  await expect(remoteCoordinatorStatus).toHaveAttribute("data-state", "offline", { timeout: 25_000 });
  await expect(remoteCoordinatorStatus).not.toHaveClass(/\bonline\b/);
  await expect(home.getByTestId("guest-message-list")).toContainText("Back in the remote room");
  await expect(home.getByPlaceholder("Room offline")).toBeDisabled();
  await expect(home.getByTestId("chat-composer").getByRole("button", { name: "Send" })).toBeDisabled();
  await expect(home.getByTestId("chat-composer").getByRole("button", { name: "Add 👍" })).toBeDisabled();

  await remote.getByRole("button", { name: "Start", exact: true }).click();
  await expect(remote.getByTestId("status-badge")).toHaveText("running");
  await expect(home.getByPlaceholder("Message")).toBeEnabled({ timeout: 25_000 });
  await expect(remoteCoordinatorStatus).toHaveAttribute("data-state", "online", { timeout: 25_000 });

  await home.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const candidate = JSON.parse(raw) as { title?: string; anonymousSecretKey?: string };
      if (candidate.title !== "Remote lounge") continue;
      delete candidate.anonymousSecretKey;
      localStorage.setItem(key, JSON.stringify(candidate));
    }
  });
  await home.reload();
  await expect(home.getByTestId("chat-connection-status")).toHaveText("Room synced", { timeout: 25_000 });
  await expect(home.getByTestId("guest-message-list")).toContainText("Back in the remote room");
  await expect(home.getByPlaceholder("Message")).toBeEnabled();
  await expect(home.getByTestId("reconnect-signer")).toHaveCount(0);

  await homeContext.close();
  await remoteContext.close();
});

test("persists relay and runtime configuration across reloads", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  const settings = await openCoordinatorSettings(page, true);
  await settings.getByLabel("Toggle announcement").check();
  await settings.getByTestId("max-users-input").fill("17");
  await settings.getByTestId("max-users-input").blur();
  await closeCoordinatorSettings(settings);

  await page.reload();

  const reloadedSettings = await openCoordinatorSettings(page);
  await expect(reloadedSettings.getByText(relay.url)).toBeVisible();
  await expect(reloadedSettings.getByText("wss://relay.contextvm.org")).toBeHidden();
  await expect(reloadedSettings.getByLabel("Toggle announcement")).toBeChecked();
  await expect(reloadedSettings.getByTestId("max-users-input")).toHaveValue("17");
  await closeCoordinatorSettings(reloadedSettings);
});

test("startup handoff keeps actions reachable", async ({ page }) => {
  await page.goto("/");
  await enablePersistence(page, "active-room-passphrase");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(page, "First room");
  await createRoom(page, "Second room");

  const firstRoom = page.locator(".channel-row").filter({ hasText: "First room" });
  await firstRoom.click();
  await expect(firstRoom).toHaveClass(/active/);
  await expect.poll(() => page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const room = JSON.parse(raw) as { title?: string; identityOwner?: string };
      if (room.title === "First room") return room.identityOwner;
    }
    return null;
  })).toBe("anonymous");

  await page.reload();
  await page.getByPlaceholder("passphrase", { exact: true }).fill("active-room-passphrase");
  await page.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();

  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByTestId("startup-ascii-field")).toBeVisible();
  await expect(page.getByTestId("host-message-list")).toBeHidden();

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("startup-progress-panel")).toBeVisible();
  await expect(page.getByTestId("host-message-list")).toBeHidden();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.locator(".channel-row.active")).toContainText("First room");
  await expect(page.getByTestId("host-message-list")).toBeVisible();
  await expect(page.getByText("No channel selected")).toBeHidden();
});

test("startup uses exactly three masked ASCII reveals", async ({ page }) => {
  const viewport = { width: 1280, height: 720 };
  await page.setViewportSize(viewport);
  await page.goto("/");
  await enablePersistence(page, "offline-host-room-passphrase");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(page, "Offline host room");

  await page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const room = JSON.parse(raw) as { isHost?: boolean; relayUrls?: string[]; title?: string };
      if (!room.isHost || room.title !== "Offline host room") continue;
      room.relayUrls = ["ws://127.0.0.1:1"];
      localStorage.setItem(key, JSON.stringify(room));
      return;
    }
    throw new Error("Could not find the persisted local host room");
  });

  await page.reload();
  await page.getByPlaceholder("passphrase", { exact: true }).fill("offline-host-room-passphrase");
  await page.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();

  const localStatus = page.getByTestId("selected-coordinator-status");
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByTestId("startup-ascii-field")).toBeVisible();
  await expect(page.getByTestId("host-message-list")).toBeHidden();
  await expect(localStatus).toHaveAttribute("data-state", "offline");
  await expect(localStatus).toHaveAttribute("title", "Coordinator offline");

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("startup-progress-panel")).toBeVisible();
  await expectStartupFillsHostPane(page);
  const stage = page.locator(".startup-stage");
  await expect(stage).toHaveCSS("position", "absolute");
  await expectShellControlsUsable(page);
  await expectStartupMasks(page);
  await expect(page.getByTestId("startup-ascii-field")).toHaveAttribute("data-motion-preference", "normal");
  const bedTexture = page.getByTestId("startup-ascii-field").locator(".ascii-bed .ascii-texture");
  const initialTransform = await bedTexture.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(650);
  await expect.poll(() => bedTexture.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initialTransform);
  await expect(page.getByTestId("startup-ascii-field")).toHaveAttribute("data-forward-target", /\d+/);
  await expect(page.getByTestId("startup-ascii-field")).toHaveAttribute("data-recovery-state", /restoring|retrying|exhausted/);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("status")).toBeVisible();
  await stage.getByRole("button", { name: "Review settings" }).click();
  const stageSettings = page.getByTestId("coordinator-settings");
  await expect(stageSettings).toBeVisible();
  await closeCoordinatorSettings(stageSettings);
  await expect(page.getByTestId("host-message-list")).toBeHidden();
  await expect(page.getByTestId("status-badge")).toHaveText("starting");
  await expect(page.getByTestId("startup-ascii-field")).toBeVisible();
  await expect(page.getByTestId("room-connection-panel")).toHaveCount(0);
  await expect(page.getByText("Local room offline", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("host-message-list")).toBeHidden();
  await expect(localStatus).toHaveAttribute("data-state", "connecting");
  await expect(localStatus).toHaveAttribute("title", "Coordinator starting");

  await page.locator(".channel-context-button").click();
  await expect(page.getByTestId("local-coordinator-menu-status")).toHaveAttribute("data-state", "connecting");
});

test("startup reduced motion stays static and readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await configureMockRelay(page);

  await page.getByRole("button", { name: "Start", exact: true }).click();
  const startup = page.getByTestId("startup-progress-panel");
  const field = page.getByTestId("startup-ascii-field");
  await expect(startup).toBeVisible();
  await expect(field).toHaveAttribute("data-motion-preference", "reduced");
  await expectStartupFillsHostPane(page);
  await expectStartupMasks(page);
  await expectShellControlsUsable(page);
  await expect(startup.getByRole("progressbar")).toBeVisible();
  await expect(startup.getByRole("status")).toBeVisible();

  const beforeTransform = await field.evaluate((element) => (
    getComputedStyle(element.querySelector(".ring-plane")!).transform
  ));
  await page.waitForTimeout(650);
  await expect.poll(() => field.evaluate((element) => (
    getComputedStyle(element.querySelector(".ring-plane")!).transform
  ))).toBe(beforeTransform);
});

test("startup motion cleans up across repeated recovery cycles", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(page, "Cycle room");

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.getByTestId("status-badge")).toHaveText("idle");
    const field = page.getByTestId("startup-ascii-field");
    await expect(field).toHaveCount(1);
    await expect(field).toHaveAttribute("data-motion-preference", "normal");
    await expect(field.locator(".ascii-bed")).toHaveCount(1);
    await expect(field.locator(".ascii-ring")).toHaveCount(3);
    await expectShellControlsUsable(page);
    await expect(page.getByTestId("operator-shell")).toBeVisible();

    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByTestId("status-badge")).toHaveText("running");
    await expect(page.getByTestId("startup-ascii-field")).toHaveCount(0);
    await expect(page.getByTestId("host-message-list")).toBeVisible();
    await expectShellControlsUsable(page);
  }

  expect(errors).toEqual([]);
});

test("startup covers every supported content pane", async ({ page }) => {
  const createdRoomTitle = "Content pane recovery room";
  const longRoomTitle = `Long <room> ${"recovery label ".repeat(18)}`;
  await page.goto("/");
  await enablePersistence(page, "content-pane-passphrase");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(page, createdRoomTitle);

  await page.evaluate(({ createdTitle, longTitle }) => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("cordn-adhoc-chat-room:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const room = JSON.parse(raw) as { isHost?: boolean; relayUrls?: string[]; title?: string };
      if (!room.isHost || room.title !== createdTitle) continue;
      room.title = longTitle;
      room.relayUrls = ["ws://127.0.0.1:1"];
      localStorage.setItem(key, JSON.stringify(room));
      return;
    }
    throw new Error("Could not find the persisted local host room");
  }, { createdTitle: createdRoomTitle, longTitle: longRoomTitle });

  await page.reload();
  await page.getByPlaceholder("passphrase", { exact: true }).fill("content-pane-passphrase");
  await page.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("startup-progress-panel")).toBeVisible();
  await expect(page.getByTestId("startup-current-status")).toContainText(longRoomTitle);

  for (const viewport of [
    { width: 1024, height: 640 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expectStartupFillsHostPane(page);
    await expectShellControlsUsable(page);
    await expectStartupMasks(page);
    await expectViewportOwned(page, viewport);
    await expect(page.getByTestId("startup-progress-panel")).toContainText(longRoomTitle);
  }
});

test("blocks a second running coordinator for the same public key", async ({ page }) => {
  await page.goto("/");
  await enablePersistence(page, "single-instance-passphrase");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId("host-chat")).toBeVisible();

  const secondPage = await page.context().newPage();
  await secondPage.goto("/");
  await secondPage.getByPlaceholder("passphrase", { exact: true }).fill("single-instance-passphrase");
  await secondPage.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();
  await configureMockRelay(secondPage);
  await secondPage.getByRole("button", { name: "Start", exact: true }).click();

  await expect(secondPage.getByTestId("status-badge")).toHaveText("idle");
  await expect(secondPage.getByTestId("error-banner")).toContainText("cordn already running");
  await secondPage.getByRole("button", { name: "Open management interface" }).click();
  await expect(secondPage.getByTestId("management-log-entries")).toContainText("cordn already running");

  await secondPage.close();
});

test("rejects invalid relay URLs inline", async ({ page }) => {
  await page.goto("/");

  const settings = await openCoordinatorSettings(page, true);
  await settings.getByPlaceholder("wss://relay.example").fill("https://relay.example");
  await settings.getByRole("button", { name: "Add" }).click();
  await expect(settings.getByTestId("relay-error")).toContainText("ws:// or wss://");
  await closeCoordinatorSettings(settings);
});

test("persists encrypted key, rejects wrong passphrase, and unlocks after reload", async ({ page }) => {
  await page.goto("/");
  const initialNpub = await readCoordinatorNpub(page);

  await enablePersistence(page, "phase-two-passphrase");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Unlock Cordn Ad-Hoc" })).toBeVisible();

  await page.getByPlaceholder("passphrase", { exact: true }).fill("wrong-passphrase");
  await page.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();
  await expect(page.getByTestId("passphrase-error")).toContainText("Wrong passphrase");

  await page.getByPlaceholder("passphrase", { exact: true }).fill("phase-two-passphrase");
  await page.getByTestId("coordinator-unlock").getByRole("button", { name: "Unlock coordinator" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  expect(await readCoordinatorNpub(page)).toBe(initialNpub);
});

test("exports a persisted coordinator as a password-verified encrypted backup", async ({ page }) => {
  await page.goto("/");

  let settings = await openCoordinatorSettings(page);
  await expect(settings.getByRole("button", { name: "Export backup" })).toHaveCount(0);
  await closeCoordinatorSettings(settings);

  const passphrase = "portable-coordinator-passphrase";
  await enablePersistence(page, passphrase);

  settings = await openCoordinatorSettings(page);
  await settings.getByRole("button", { name: "Export backup" }).click();
  const exportDialog = page.getByTestId("coordinator-export-dialog");
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByLabel("Current passphrase")).toBeFocused();

  await exportDialog.getByRole("button", { name: "Download backup" }).click();
  await expect(exportDialog.getByTestId("export-error")).toContainText("Passphrase is required");

  await exportDialog.getByLabel("Current passphrase").fill("wrong-passphrase");
  await exportDialog.getByRole("button", { name: "Download backup" }).click();
  await expect(exportDialog.getByTestId("export-error")).toContainText("Wrong passphrase");
  await expect(exportDialog).toBeVisible();

  const persistedKey = await page.evaluate(() => JSON.parse(localStorage.getItem("cordn:v1:persistence") ?? "null"));
  await exportDialog.getByLabel("Current passphrase").fill(passphrase);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    exportDialog.getByRole("button", { name: "Download backup" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^cordn-npub1.+\.backup\.json$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const backupText = await readFile(downloadPath ?? "", "utf8");
  const backup = JSON.parse(backupText) as {
    format: string;
    version: number;
    identity: { publicKeyHex: string; npub: string };
    encryptedKey: unknown;
  };
  expect(backup).toMatchObject({
    format: "cordn.coordinator-key-backup",
    version: 1,
    identity: {
      publicKeyHex: expect.stringMatching(/^[0-9a-f]{64}$/),
      npub: expect.stringMatching(/^npub1/),
    },
    encryptedKey: persistedKey,
  });
  expect(backupText).not.toContain(passphrase);
  expect(backupText).not.toContain("nsec1");
  await expect(exportDialog).toBeHidden();
  await expect(settings.getByRole("status")).toHaveText("Encrypted backup downloaded");

  await settings.getByRole("button", { name: "Edit settings" }).click();
  await settings.getByRole("button", { name: "Remove saved key" }).click();
  await expect(settings.getByRole("button", { name: "Export backup" })).toHaveCount(0);
  await closeCoordinatorSettings(settings);
});

test("destroys persisted state after explicit confirmation", async ({ page }) => {
  await page.goto("/");
  const initialNpub = await readCoordinatorNpub(page);

  await enablePersistence(page, "destroy-passphrase");
  await page.evaluate(async () => {
    const cache = await caches.open("cordn-test-cache");
    await cache.put("/cache-proof", new Response("cached coordinator state"));
  });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("cordn-test-cache"))).toBe(true);

  await page.getByRole("button", { name: "Destroy" }).click();
  await page.getByTestId("confirm-destroy").click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  const destroyedSettings = await openCoordinatorSettings(page);
  await expect(destroyedSettings.getByTestId("persistence-state")).toHaveText("off");
  await closeCoordinatorSettings(destroyedSettings);
  expect(await readCoordinatorNpub(page)).not.toBe(initialNpub);
  await expect.poll(() => page.evaluate(() => Array.from(
    { length: localStorage.length },
    (_, index) => localStorage.key(index),
  ).filter((key): key is string => Boolean(key)).sort())).toEqual(["cordn:v1:anonymous-identity"]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cordn:v1:persistence"))).toBeNull();
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("cordn-test-cache"))).toBe(false);
});

test("in-session invite redemption preserves the running home coordinator", async ({ browser }) => {
  test.setTimeout(90_000);
  const hostAContext = await browser.newContext();
  const hostA = await hostAContext.newPage();
  await hostA.goto("/");
  await configureMockRelay(hostA);
  await hostA.getByRole("button", { name: "Start", exact: true }).click();
  await expect(hostA.getByTestId("status-badge")).toHaveText("running");
  await createRoom(hostA, "Redeemable room");
  const inviteLink = await hostA.getByTestId("invite-link").textContent();
  const remoteCoordinatorPubkey = await hostA.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.startsWith("cordn-adhoc-chat-room:v2:"))
    .map(([, value]) => JSON.parse(value ?? "{}") as { title?: string; coordinatorPubkey?: string })
    .find((room) => room.title === "Redeemable room")?.coordinatorPubkey);
  expect(remoteCoordinatorPubkey).toMatch(/^[0-9a-f]{64}$/);

  const hostBContext = await browser.newContext();
  const hostB = await hostBContext.newPage();
  await hostB.goto("/");
  await configureMockRelay(hostB);
  await hostB.getByRole("button", { name: "Start", exact: true }).click();
  await expect(hostB.getByTestId("status-badge")).toHaveText("running");
  await hostB.evaluate(() => { (window as typeof window & { __inviteRedeemSentinel?: boolean }).__inviteRedeemSentinel = true; });

  await hostB.getByRole("button", { name: "Redeem invite" }).click();
  const redeemer = hostB.getByTestId("invite-redeemer");
  await redeemer.getByLabel("Invite link").fill("this is not an invite");
  await redeemer.getByRole("button", { name: "Join invite" }).click();
  await expect(redeemer.getByRole("alert")).toContainText("valid invite link");
  await expect(hostB).toHaveURL(/\/$/);

  const foreignOriginInvite = new URL(inviteLink!);
  foreignOriginInvite.protocol = "https:";
  foreignOriginInvite.hostname = "invite.example.test";
  foreignOriginInvite.port = "";
  await redeemer.getByLabel("Invite link").fill(foreignOriginInvite.href);
  await redeemer.getByRole("button", { name: "Join invite" }).click();
  await expect(hostB.getByPlaceholder("Message")).toBeVisible({ timeout: 35_000 });
  expect(new URL(hostB.url()).origin).toBe(new URL(await hostB.evaluate(() => window.location.origin)).origin);
  expect(await hostB.evaluate(() => (window as typeof window & { __inviteRedeemSentinel?: boolean }).__inviteRedeemSentinel)).toBe(true);
  expect(await hostB.evaluate((coordinatorPubkey) => Object.keys(localStorage)
    .some((key) => key.startsWith(`cordn-adhoc-chat-room:v2:${encodeURIComponent(coordinatorPubkey)}:`)), remoteCoordinatorPubkey!)).toBe(true);

  await createRoom(hostA, "Fresh anonymous redemption room");
  const freshInviteLink = await hostA.getByTestId("invite-link").textContent();
  expect(freshInviteLink).toBeTruthy();

  await hostB.getByRole("link", { name: "CAHMLS home" }).click();
  await expect(hostB.getByTestId("status-badge")).toHaveText("running");
  await hostB.getByRole("button", { name: "Redeem invite" }).click();
  const repeatRedeemer = hostB.getByTestId("invite-redeemer");
  await repeatRedeemer.getByLabel("Invite link").fill(freshInviteLink!);
  await repeatRedeemer.getByRole("button", { name: "Join invite" }).click();
  expect(await hostB.getByText("Choose a name, then join the encrypted room. This invite connects only to its host coordinator.").count()).toBe(0);
  await expect(hostB.getByPlaceholder("Message")).toBeVisible({ timeout: 35_000 });
  await hostAContext.close();
  await hostBContext.close();
});

test("invite camera scanner uses the redemption path and releases camera tracks", async ({ browser }) => {
  test.setTimeout(90_000);
  const hostAContext = await browser.newContext();
  const hostA = await hostAContext.newPage();
  await hostA.goto("/");
  await configureMockRelay(hostA);
  await hostA.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(hostA, "Scanned room");
  const inviteLink = await hostA.getByTestId("invite-link").textContent();

  const hostBContext = await browser.newContext();
  await hostBContext.addInitScript(() => {
    const testWindow = window as typeof window & {
      __cameraTrackStops?: number;
      __barcodeDetections?: number;
      __qrPayload?: string;
    };
    testWindow.__cameraTrackStops = 0;
    testWindow.__barcodeDetections = 0;
    const stream = new MediaStream();
    Object.defineProperty(stream, "getTracks", {
      value: () => [{ stop: () => { testWindow.__cameraTrackStops = (testWindow.__cameraTrackStops ?? 0) + 1; } }],
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
    class MockBarcodeDetector {
      async detect(): Promise<Array<{ rawValue: string }>> {
        testWindow.__barcodeDetections = (testWindow.__barcodeDetections ?? 0) + 1;
        return testWindow.__qrPayload ? [{ rawValue: testWindow.__qrPayload }] : [];
      }
    }
    Object.defineProperty(window, "BarcodeDetector", { configurable: true, value: MockBarcodeDetector });
  });
  const hostB = await hostBContext.newPage();
  await hostB.goto("/");
  await configureMockRelay(hostB);
  await hostB.getByRole("button", { name: "Start", exact: true }).click();
  await hostB.evaluate(() => { (window as typeof window & { __qrPayload?: string }).__qrPayload = "not an invite"; });

  await hostB.getByRole("button", { name: "Redeem invite" }).click();
  const redeemer = hostB.getByTestId("invite-redeemer");
  await redeemer.getByRole("button", { name: "Scan QR code" }).click();
  await expect(redeemer.getByRole("alert")).toContainText("valid invite link");
  await hostB.evaluate((payload) => { (window as typeof window & { __qrPayload?: string }).__qrPayload = payload; }, inviteLink!);
  await expect(hostB.getByPlaceholder("Message")).toBeVisible({ timeout: 35_000 });
  await expect.poll(() => hostB.evaluate(() => (window as typeof window & { __barcodeDetections?: number }).__barcodeDetections ?? 0)).toBeGreaterThan(0);
  await expect.poll(() => hostB.evaluate(() => (window as typeof window & { __cameraTrackStops?: number }).__cameraTrackStops ?? 0)).toBeGreaterThan(0);

  await hostB.getByRole("link", { name: "CAHMLS home" }).click();
  await hostB.evaluate(() => { (window as typeof window & { __qrPayload?: string }).__qrPayload = undefined; });
  await hostB.getByRole("button", { name: "Redeem invite" }).click();
  await redeemer.getByRole("button", { name: "Scan QR code" }).click();
  await expect.poll(() => hostB.evaluate(() => (window as typeof window & { __barcodeDetections?: number }).__barcodeDetections ?? 0)).toBeGreaterThan(1);
  await hostB.keyboard.press("Escape");
  await expect(redeemer).toBeHidden();
  await expect.poll(() => hostB.evaluate(() => (window as typeof window & { __cameraTrackStops?: number }).__cameraTrackStops ?? 0)).toBeGreaterThan(1);

  await hostB.evaluate(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("denied", "NotAllowedError"); } },
    });
  });
  await hostB.getByRole("button", { name: "Redeem invite" }).click();
  await redeemer.getByRole("button", { name: "Scan QR code" }).click();
  await expect(redeemer.getByRole("alert")).toContainText("permission was denied");
  await expect(redeemer.getByRole("button", { name: "Join invite" })).toBeEnabled();
  await redeemer.getByRole("button", { name: "Close invite redemption" }).last().click();

  await hostB.evaluate(() => { Object.defineProperty(window, "BarcodeDetector", { configurable: true, value: undefined }); });
  await hostB.getByRole("button", { name: "Redeem invite" }).click();
  await redeemer.getByRole("button", { name: "Scan QR code" }).click();
  await expect(redeemer.getByRole("alert")).toContainText("QR scanning is not available");
  await expect(redeemer.getByRole("button", { name: "Join invite" })).toBeEnabled();
  await redeemer.getByRole("button", { name: "Close invite redemption" }).last().click();

  await hostB.evaluate(() => { Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined }); });
  await hostB.getByRole("button", { name: "Redeem invite" }).click();
  await redeemer.getByRole("button", { name: "Scan QR code" }).click();
  await expect(redeemer.getByRole("alert")).toContainText("Camera access is not available");
  await expect(redeemer.getByRole("button", { name: "Join invite" })).toBeEnabled();
  await redeemer.getByRole("button", { name: "Close invite redemption" }).last().click();
  await hostAContext.close();
  await hostBContext.close();
});
