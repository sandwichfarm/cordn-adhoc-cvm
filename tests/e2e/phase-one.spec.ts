import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

import { startMockRelay, type MockRelay } from "./mock-relay";

let relay: MockRelay;

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

async function seedJoinedRoom(
  page: import("@playwright/test").Page,
  title: string,
  coordinatorPubkey = "a".repeat(64),
): Promise<void> {
  await page.evaluate(({ title, coordinatorPubkey, relayUrl }) => {
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
      keyPackage: { reference: "ref", publicBase64: "public", privateBase64: "private" },
      anonymousSecretKey: "01".repeat(32),
      lastCursor: 0,
      messages: [],
      pending: [],
      joinRequestSent: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const key = `cordn-adhoc-chat-room:v2:${encodeURIComponent(coordinatorPubkey)}:${encodeURIComponent(id)}`;
    localStorage.setItem(key, JSON.stringify(room));
  }, { title, coordinatorPubkey, relayUrl: relay.url });
}

test("generates copyable identity on first load", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByTestId("user-profile")).toContainText("anon");
  await expect(page.getByTestId("user-profile").locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
  await expect(page.getByTestId("startup-ascii-field")).toBeVisible();
  await expect(page.getByTestId("startup-ascii-field").locator("pre").first()).toContainText(/[.:+*x01#/]/);
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  const settings = await openCoordinatorSettings(page);
  await expect(page.locator(".host-layout")).toHaveCSS("filter", "none");
  await expect(settings.getByRole("button", { name: "Copy coordinator public key" })).toContainText("npub");
  await expect(settings.getByLabel("Toggle announcement")).not.toBeChecked();
  await expect(settings.getByTestId("max-users-input")).toHaveValue("64");
  await closeCoordinatorSettings(settings);
});

test("opens joined chats without starting an unprotected local coordinator", async ({ page }) => {
  await page.goto("/");
  await seedJoinedRoom(page, "Elsewhere lounge");
  await page.reload();

  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await page.getByTestId("open-chats").click();

  await expect(page).toHaveURL(/\/chats$/);
  const lobby = page.getByTestId("chat-lobby");
  await expect(lobby).toHaveAttribute("data-coordinator-locked", "false");
  await expect(lobby).toHaveAttribute("data-coordinator-status", "idle");
  await expect(lobby.getByRole("button", { name: "Open room Elsewhere lounge" })).toBeVisible();
});

test("browses cached chats while a persisted coordinator stays locked", async ({ page }) => {
  await page.goto("/");
  await enablePersistence(page, "chat-only-passphrase");
  await seedJoinedRoom(page, "Locked-out lounge", "c".repeat(64));
  await page.reload();

  await expect(page.getByRole("heading", { name: "Unlock Cordn Ad-Hoc" })).toBeVisible();
  await page.getByTestId("open-chats").click();

  const lobby = page.getByTestId("chat-lobby");
  await expect(lobby).toHaveAttribute("data-coordinator-locked", "true");
  await expect(lobby).toHaveAttribute("data-coordinator-status", "idle");
  await lobby.getByRole("button", { name: "Open room Locked-out lounge" }).click();
  await expect(page.getByTestId("cached-room-view")).toContainText("Locked-out lounge");
  await expect(page.locator(".presence-control")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 667 });
  await expect.poll(() => page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".chat-global-nav");
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

  const workspaceLink = page.getByRole("link", { name: "Open my coordinator workspace" });
  if (await workspaceLink.isVisible()) {
    await workspaceLink.click();
  } else {
    await page.getByRole("button", { name: /^Rooms,/ }).click();
    await page.getByTestId("room-switcher").getByRole("button", { name: "Workspace" }).click();
  }
  await expect(page.getByRole("heading", { name: "Unlock Cordn Ad-Hoc" })).toBeVisible();
});

test("chat index bypasses autostart and owns viewport scrolling", async ({ page }) => {
  await page.goto("/");
  const settings = await openCoordinatorSettings(page, true);
  await settings.getByLabel("Toggle autostart").check();
  await closeCoordinatorSettings(settings);

  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto("/chat");
  const lobby = page.getByTestId("chat-lobby");
  await expect(lobby).toHaveAttribute("data-coordinator-status", "idle");
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
  await expect(page.getByText("No channel selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rooms", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("invite-panel")).toBeVisible();
  await page.getByRole("button", { name: "Open management interface" }).click();
  await expect(page.getByTestId("management-interface")).toBeVisible();
  await expect(page.getByTestId("host-chat")).toBeHidden();
  const channelBrowser = page.getByRole("navigation", { name: "Server and channel browser" });
  const serverSelector = channelBrowser.getByRole("button", { name: /^My coordinator/ });
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

test("Feature: invite-only chat — Scenario: a guest link opens only the private chat join flow", async ({ page, browser }) => {
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

  await expect(guest.getByTestId("chat-route")).toBeVisible();
  await expect(guest.getByTestId("operator-shell")).toHaveCount(0);
  await expect(guest.getByRole("heading", { name: "BDD room" })).toBeVisible();
  await expect(guest.getByText("Choose a name, then join the encrypted room.")).toBeVisible();
  await expect(guest.getByRole("button", { name: "Join chat" })).toBeVisible();
  await expect(guest.getByTestId("chat-route")).toHaveCSS("background-color", "rgb(11, 14, 13)");
  expect(await guest.getByTestId("chat-route").evaluate((element) => element.clientHeight)).toBe(await guest.evaluate(() => window.innerHeight));
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
  await previousGuest.getByPlaceholder("e.g. River").fill("Old link");
  await previousGuest.getByRole("button", { name: "Join chat" }).click();
  await expect(previousGuest.getByText("Your encrypted join request is with the host.")).toBeVisible();

  const currentContext = await browser.newContext();
  const currentGuest = await currentContext.newPage();
  await currentGuest.goto(currentInvite!);
  await currentGuest.getByPlaceholder("e.g. River").fill("Fresh link");
  await currentGuest.getByRole("button", { name: "Join chat" }).click();
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
  await expect(page.locator(".host-topbar").getByLabel("Mute notification sounds")).toBeVisible();
  await expect(page.getByTestId("invite-panel").getByLabel("Mute notification sounds")).toHaveCount(0);

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteLink!);
  await expect(guest.getByTestId("invite-host")).toContainText("Invited by");
  await expect(guest.getByTestId("invite-host").getByTestId("room-host-identity")).toContainText("Mara");
  await expect(guest.getByTestId("active-server-context")).toContainText("Mara · host");
  await guest.getByPlaceholder("e.g. River").fill("River");
  await guest.getByRole("button", { name: "Join chat" }).click();
  await expect(guest.getByText("Your encrypted join request is with the host.")).toBeVisible();

  await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByLabel("Add 👍")).toBeVisible();
  await expect(guest.locator(".chat-global-nav").getByLabel("Mute notification sounds")).toBeVisible();
  await expect(guest.getByTestId("active-server-context")).toContainText("Mara · host");
  await guest.getByRole("button", { name: /Rooms/ }).click();
  const guestSwitcherRoom = guest.getByTestId("room-switcher").getByRole("button", { name: /Working room/ });
  await expect(guestSwitcherRoom.getByTestId("room-host-identity")).toContainText("Mara");
  await expect(guestSwitcherRoom.getByTestId("room-host-identity")).toContainText("host");
  await guest.getByRole("button", { name: "Close room switcher" }).last().click();
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
  await guest.getByRole("button", { name: "More chat actions" }).click();
  const mobileChatActions = guest.getByRole("dialog", { name: "More chat actions" });
  await expect(mobileChatActions).toBeVisible();
  await expectInsideViewport(mobileChatActions);
  await expect(mobileChatActions.getByText("Profile & signer")).toBeVisible();
  expect(await mobileChatActions.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");
  await mobileChatActions.getByRole("button", { name: "Close chat actions" }).click();
  await expect(mobileChatActions).toBeHidden();
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
  await guest.getByPlaceholder("e.g. River").fill("River");
  await guest.getByRole("button", { name: "Join chat" }).click();
  await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 20_000 });
  await guest.getByPlaceholder("Message").fill("Keep this cached");
  await guest.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("host-chat").getByText("Keep this cached")).toBeVisible({ timeout: 15_000 });

  const deleteTrigger = page.getByRole("button", { name: "Delete room Disposable room" });
  await deleteTrigger.click();
  const deleteDialog = page.getByTestId("room-removal-dialog");
  await expect(deleteDialog.getByRole("heading", { name: "Delete #Disposable room?" })).toBeVisible();
  await expect(deleteDialog.getByTestId("room-removal-impact")).toContainText("1 cached message");
  await expect(deleteDialog.getByTestId("room-removal-impact")).toContainText("This cannot be undone");
  await expect(deleteDialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(deleteDialog).toBeHidden();
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Open room Disposable room" })).toBeVisible();

  await deleteTrigger.click();
  await deleteDialog.getByTestId("confirm-delete-room").click();
  await expect(deleteDialog).toBeHidden();
  await expect(page.getByTestId("invite-panel").getByRole("button", { name: "Open room Disposable room" })).toHaveCount(0);
  await expect(page.locator(".channel-row.active")).toContainText("Keep room");

  await expect(guest.getByTestId("room-deleted-message")).toBeVisible({ timeout: 25_000 });
  await expect(guest.getByPlaceholder("Room deleted by host")).toBeDisabled();
  await guest.setViewportSize({ width: 390, height: 350 });
  await guest.getByRole("button", { name: "More chat actions" }).click();
  await guest.getByRole("dialog", { name: "More chat actions" }).getByRole("button", { name: "Leave this room" }).click();
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
  await expect(guest).toHaveURL(/\/chats$/);
  await expect(guest.getByTestId("chat-lobby")).toBeVisible();
  expect(await guest.evaluate(() => [...Array(localStorage.length).keys()].some((index) => {
    const value = localStorage.getItem(localStorage.key(index) ?? "");
    return value?.includes('"title":"Disposable room"') ?? false;
  }))).toBe(false);

  await guestContext.close();
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
  await guest.getByPlaceholder("e.g. River").fill("River");
  await guest.getByRole("button", { name: "Join chat" }).click();

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

  await home.goto(remoteInvite!);
  await expect(home.getByTestId("active-server-context")).toContainText("remote");
  await home.getByPlaceholder("e.g. River").fill("Home host");
  await home.getByRole("button", { name: "Join chat" }).click();
  await expect(home.getByPlaceholder("Message")).toBeVisible({ timeout: 35_000 });
  await home.getByPlaceholder("Message").fill("Hello across coordinators");
  await home.getByRole("button", { name: "Send" }).click();
  await expect(remote.getByTestId("host-chat").getByText("Hello across coordinators")).toBeVisible({ timeout: 15_000 });

  await home.getByRole("button", { name: "Rooms" }).click();
  const switcher = home.getByTestId("room-switcher");
  await expect(switcher.getByText("My coordinator", { exact: true })).toBeVisible();
  await expect(switcher.getByRole("button", { name: /Home alpha/ })).toBeVisible();
  await expect(switcher.getByRole("button", { name: /Home beta/ })).toBeVisible();
  await expect(switcher.getByRole("button", { name: /Remote lounge/ })).toBeVisible();

  await switcher.getByRole("button", { name: /Home alpha/ }).click();
  await expect(home.getByTestId("active-server-context")).toContainText("anon · host");
  await expect(home.getByTestId("active-server-context")).toContainText("Home alpha");

  await home.goBack();
  await expect(home.getByTestId("active-server-context")).toContainText("Remote lounge");
  await expect(home.getByPlaceholder("Message")).toBeVisible({ timeout: 25_000 });
  await home.getByPlaceholder("Message").fill("Back in the remote room");
  await home.getByRole("button", { name: "Send" }).click();
  await expect(remote.getByTestId("host-chat").getByText("Back in the remote room")).toBeVisible({ timeout: 15_000 });

  await remote.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(remote.getByTestId("status-badge")).toHaveText("idle");
  await expect(home.getByTestId("room-connection-offline-message")).toBeVisible({ timeout: 25_000 });
  await expect(home.getByTestId("guest-message-list")).toContainText("Back in the remote room");
  await expect(home.getByPlaceholder("Room offline")).toBeDisabled();
  await expect(home.getByTestId("chat-composer").getByRole("button", { name: "Send" })).toBeDisabled();
  await expect(home.getByTestId("chat-composer").getByRole("button", { name: "Add 👍" })).toBeDisabled();

  await remote.getByRole("button", { name: "Start", exact: true }).click();
  await expect(remote.getByTestId("status-badge")).toHaveText("running");
  await expect(home.getByPlaceholder("Message")).toBeEnabled({ timeout: 25_000 });

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
  await expect(home.getByTestId("chat-connection-status")).toHaveText("Room cached");
  await expect(home.getByTestId("guest-message-list")).toContainText("Back in the remote room");
  await expect(home.getByPlaceholder("Reconnect your signer")).toBeDisabled();
  await expect(home.getByTestId("reconnect-signer")).toContainText("Reconnect the signer that joined this room");

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

test("restores the last active host channel across sessions", async ({ page }) => {
  await page.goto("/");
  await enablePersistence(page, "active-room-passphrase");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await createRoom(page, "First room");
  await createRoom(page, "Second room");

  const firstRoom = page.locator(".channel-row").filter({ hasText: "First room" });
  await firstRoom.click();
  await expect(firstRoom).toHaveClass(/active/);

  await page.reload();
  await page.getByPlaceholder("passphrase", { exact: true }).fill("active-room-passphrase");
  await page.getByRole("button", { name: "Unlock" }).click();

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

test("keeps an offline remembered host room in the startup stage", async ({ page }) => {
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
  await page.getByRole("button", { name: "Unlock" }).click();

  const localStatus = page.getByTestId("local-coordinator-status");
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByTestId("startup-ascii-field")).toBeVisible();
  await expect(page.getByTestId("host-message-list")).toBeHidden();
  await expect(localStatus).toHaveAttribute("data-state", "neutral");

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByTestId("startup-progress-panel")).toBeVisible();
  await expect(page.getByTestId("host-message-list")).toBeHidden();
  await expect(localStatus).toHaveAttribute("data-state", "neutral");
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId("startup-ascii-field")).toBeVisible();
  const roomConnectionPanel = page.getByTestId("room-connection-panel");
  await expect(roomConnectionPanel).toBeVisible();
  await expect(roomConnectionPanel).toContainText("Local room offline", { timeout: 20_000 });
  await expect(page.getByTestId("host-message-list")).toBeHidden();
  await expect(localStatus).toHaveAttribute("data-state", "error");
  await expect(localStatus).toHaveAttribute("title", "Coordinator running; local room offline");

  await page.locator(".channel-context-button").click();
  await expect(page.getByTestId("local-coordinator-menu-status")).toHaveAttribute("data-state", "error");
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
  await secondPage.getByRole("button", { name: "Unlock" }).click();
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
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByTestId("passphrase-error")).toContainText("Wrong passphrase");

  await page.getByPlaceholder("passphrase", { exact: true }).fill("phase-two-passphrase");
  await page.getByRole("button", { name: "Unlock" }).click();
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
  await expect.poll(() => page.evaluate(() => localStorage.length)).toBe(0);
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

  await hostB.getByRole("link", { name: "CAHMLS home" }).click();
  await expect(hostB.getByTestId("status-badge")).toHaveText("running");
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
