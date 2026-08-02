import { Buffer } from "node:buffer";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { generateSecretKey } from "nostr-tools";
import { bytesToHex } from "nostr-tools/utils";

const previousCoordinatorPubkey = "a".repeat(64);
const currentTestTitle = "Recovered local host session";

function createStoredRoomPrivateFixture(): {
  anonymousSecretKey: string;
  keyPackagePrivateBase64: string;
} {
  return {
    anonymousSecretKey: bytesToHex(generateSecretKey()),
    keyPackagePrivateBase64: Buffer.from(generateSecretKey()).toString("base64"),
  };
}

async function openCoordinatorSettings(page: Page, edit = false): Promise<Locator> {
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

async function closeCoordinatorSettings(settings: Locator): Promise<void> {
  const done = settings.getByRole("button", { name: "Done editing" });
  if (await done.isVisible()) await done.click();
  await settings.getByRole("button", { name: "Close coordinator settings" }).last().click();
  await expect(settings).toBeHidden();
}

async function enablePersistence(page: Page, passphrase: string): Promise<void> {
  const settings = await openCoordinatorSettings(page, true);
  await settings.getByRole("button", { name: "Enable persistence" }).click();
  await settings.getByPlaceholder("passphrase", { exact: true }).fill(passphrase);
  await settings.getByPlaceholder("confirm passphrase").fill(passphrase);
  await settings.getByRole("button", { name: "Save key" }).click();
  await expect(settings.getByText("Saved on this device")).toBeVisible();
  await closeCoordinatorSettings(settings);
}

async function readCurrentCoordinatorPubkey(page: Page): Promise<string> {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  const settings = await openCoordinatorSettings(page);
  await settings.getByRole("button", { name: "Copy coordinator public key" }).click();
  const pubkey = await page.evaluate(() => navigator.clipboard.readText());
  await closeCoordinatorSettings(settings);
  expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
  return pubkey;
}

async function seedStoredRoom(
  page: Page,
  input: {
    coordinatorPubkey: string;
    roomId: string;
    title: string;
    name: string;
    isHost: boolean;
    coordinatorKeyMode?: "ephemeral" | "persistent";
    messages?: Array<Record<string, unknown>>;
  },
): Promise<void> {
  const privateFixture = createStoredRoomPrivateFixture();
  await page.evaluate(({ coordinatorPubkey, roomId, title, name, isHost, coordinatorKeyMode, messages, privateFixture }) => {
    const room = {
      version: 1,
      id: roomId,
      title,
      coordinatorPubkey,
      coordinatorOrigin: window.location.origin,
      relayUrls: ["ws://127.0.0.1:1"],
      name,
      stablePubkey: "b".repeat(64),
      host: { name, pubkey: "d".repeat(64) },
      isHost,
      stateBase64: "",
      keyPackage: {
        reference: `${name}-ref`,
        publicBase64: "public",
        privateBase64: privateFixture.keyPackagePrivateBase64,
      },
      anonymousSecretKey: privateFixture.anonymousSecretKey,
      lastCursor: 0,
      messages: messages ?? [],
      pending: [],
      coordinatorKeyMode: coordinatorKeyMode ?? "ephemeral",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem(
      `cordn-adhoc-chat-room:v2:${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(roomId)}`,
      JSON.stringify(room),
    );
    window.dispatchEvent(new CustomEvent("cordn:rooms-changed", {
      detail: { roomId, coordinatorPubkey },
    }));
  }, { ...input, privateFixture });
}

async function chooseCoordinator(page: Page, name: RegExp): Promise<void> {
  await page.locator("button.channel-context-button").click();
  const menu = page.getByRole("menu", { name: "Choose coordinator" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name }).click();
  await expect(menu).toBeHidden();
}

async function openRoomActions(page: Page, roomTitle: string): Promise<Locator> {
  const navigation = page.getByTestId("workspace-navigation");
  await expect(navigation.getByRole("button", { name: "More room actions" })).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "More room actions" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.getByRole("menu", { name: `Room actions for ${roomTitle}` });
  await expect(menu).toBeVisible();
  return menu;
}

async function expectEmbeddedChatFillsHostPane(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('[data-testid="host-chat"]');
    const route = pane?.querySelector<HTMLElement>('[data-testid="chat-route"]');
    const cached = route?.querySelector<HTMLElement>('[data-testid="cached-room-view"]');
    if (!pane || !route || !cached) return false;
    const paneBounds = pane.getBoundingClientRect();
    const routeBounds = route.getBoundingClientRect();
    const cachedBounds = cached.getBoundingClientRect();
    const aligned = (bounds: DOMRect) => (
      Math.abs(bounds.left - paneBounds.left) <= 1
      && Math.abs(bounds.right - paneBounds.right) <= 1
    );
    return aligned(routeBounds) && aligned(cachedBounds);
  })).toBe(true);
}

async function expectSelectedCoordinatorOffline(page: Page): Promise<void> {
  const status = page.getByTestId("selected-coordinator-status");
  await expect(status).toHaveAttribute("data-state", "offline", { timeout: 15_000 });
  await expect(status).toHaveAttribute("aria-label", /coordinator offline/i);
  await expect(status).not.toHaveClass(/\bonline\b/);
}

test("keeps a foreign host record as a leaveable previous local session after reload", async ({ page }) => {
  const roomId = "same-id-current-and-previous-local-room";
  const passphrase = "stale-local-session-passphrase";
  await page.goto("/");
  await expect(page.getByTestId("operator-shell")).toBeVisible();

  // Persist the current coordinator so the reload used to exercise the legacy
  // route does not turn both composite room identities into stale sessions.
  await enablePersistence(page, passphrase);
  const currentCoordinatorPubkey = await readCurrentCoordinatorPubkey(page);
  expect(currentCoordinatorPubkey).not.toBe(previousCoordinatorPubkey);

  await seedStoredRoom(page, {
    coordinatorPubkey: previousCoordinatorPubkey,
    roomId,
    title: currentTestTitle,
    name: "Original host",
    isHost: true,
  });
  await seedStoredRoom(page, {
    coordinatorPubkey: currentCoordinatorPubkey,
    roomId,
    title: currentTestTitle,
    name: "Current host",
    isHost: true,
    coordinatorKeyMode: "persistent",
  });

  await page.goto("/chats", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByTestId("chat-lobby")).toHaveCount(0);

  const unlock = page.getByTestId("coordinator-unlock");
  await expect(unlock).toBeVisible();
  await unlock.getByPlaceholder("passphrase", { exact: true }).fill(passphrase);
  await unlock.getByRole("button", { name: "Unlock coordinator" }).click();
  await expect(unlock).toBeHidden();

  const currentRoomButton = page.getByRole("button", {
    name: new RegExp(`^Open room ${currentTestTitle}, hosted by `),
  });
  await expect(currentRoomButton).toBeVisible();

  await page.locator("button.channel-context-button").click();
  const coordinatorMenu = page.getByRole("menu", { name: "Choose coordinator" });
  await expect(coordinatorMenu.getByText("Previous local sessions", { exact: true })).toBeVisible();
  await expect(coordinatorMenu.getByText(/Coordinator offline · key changed; retained on this device\./)).toBeVisible({ timeout: 15_000 });
  await coordinatorMenu.getByRole("menuitem", { name: /Previous local/ }).click();
  await expectSelectedCoordinatorOffline(page);

  await expect(page.getByText("This session belongs to a previous local coordinator key. Open it to leave its saved copy; the current coordinator cannot delete it.", { exact: true })).toBeVisible();
  const previousSession = page.getByRole("button", {
    name: `Open previous local session ${currentTestTitle}, hosted by Original host`,
  });
  await expect(previousSession).toContainText("temporary key");
  await previousSession.click();

  // The room deep link is now in shell state; the address and surrounding GUI
  // stay canonical and stable while cached content opens in the main pane.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByTestId("cached-room-view")).toBeVisible();
  await expectEmbeddedChatFillsHostPane(page);
  const roomActions = await openRoomActions(page, currentTestTitle);
  const leaveRoom = roomActions.getByRole("menuitem", { name: `Leave room ${currentTestTitle}` });
  await expect(leaveRoom).toBeVisible();
  await expect(roomActions.getByRole("menuitem", { name: `Delete room ${currentTestTitle}` })).toHaveCount(0);

  await leaveRoom.click();
  const dialog = page.getByTestId("room-removal-dialog");
  await expect(dialog.getByRole("heading", { name: `Leave #${currentTestTitle}?` })).toBeVisible();
  await dialog.getByTestId("confirm-leave-room").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("operator-shell")).toBeVisible();

  await expect.poll(() => page.evaluate(({ currentCoordinatorPubkey, previousCoordinatorPubkey, roomId }) => {
    const roomKey = (coordinatorPubkey: string) => (
      `cordn-adhoc-chat-room:v2:${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(roomId)}`
    );
    return {
      current: JSON.parse(localStorage.getItem(roomKey(currentCoordinatorPubkey)) ?? "null"),
      previous: localStorage.getItem(roomKey(previousCoordinatorPubkey)),
    };
  }, { currentCoordinatorPubkey, previousCoordinatorPubkey, roomId })).toEqual({
    current: expect.objectContaining({
      id: roomId,
      coordinatorPubkey: currentCoordinatorPubkey,
      isHost: true,
    }),
    previous: null,
  });

  await chooseCoordinator(page, /My coordinator/);
  await expect(page.getByRole("button", {
    name: new RegExp(`^Open room ${currentTestTitle}, hosted by `),
  })).toBeVisible();
});

test("opens a stale remote room from the unified sidebar as readable offline cache", async ({ page }) => {
  const remoteCoordinatorPubkey = "c".repeat(64);
  const roomId = "stale-remote-room";
  const title = "Remote archive";
  const cachedMessage = "Cached before the remote coordinator went away";

  await page.goto("/");
  await seedStoredRoom(page, {
    coordinatorPubkey: remoteCoordinatorPubkey,
    roomId,
    title,
    name: "Remote host",
    isHost: false,
    messages: [{
      type: "message",
      id: "cached-remote-message",
      sender: "d".repeat(64),
      name: "Remote host",
      content: cachedMessage,
      createdAt: Date.now() - 1_000,
    }],
  });

  await page.goto("/chats", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByTestId("chat-lobby")).toHaveCount(0);

  await chooseCoordinator(page, /Coordinator cccccc/);
  await expectSelectedCoordinatorOffline(page);
  const remoteRoom = page.getByRole("button", {
    name: new RegExp(`^Open room ${title}, hosted by .+, on `),
  });
  await expect(remoteRoom).toBeVisible();
  await remoteRoom.click();

  await expect(page).toHaveURL(/\/$/);
  const cachedView = page.getByTestId("cached-room-view");
  await expect(cachedView).toBeVisible();
  await expect(cachedView.getByText(cachedMessage, { exact: true })).toBeVisible();
  await expectEmbeddedChatFillsHostPane(page);
  await expect(page.getByTestId("room-connection-offline-message")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("chat-composer").getByRole("textbox")).toBeDisabled();
  await expect(page.getByTestId("chat-composer-status")).toContainText("cached messages are read-only");
  const roomActions = await openRoomActions(page, title);
  await expect(roomActions.getByRole("menuitem", { name: `Leave room ${title}` })).toBeVisible();
  await expect(roomActions.getByRole("menuitem", { name: `Delete room ${title}` })).toHaveCount(0);
});
