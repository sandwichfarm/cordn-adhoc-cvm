import { expect, test, type Locator, type Page } from "@playwright/test";

import { startMockRelay, type MockRelay } from "./mock-relay";

const configStorageKey = "cordn:v1:config";
const primaryRelayUrl = "wss://profile-primary.example.test";
const appUrl = process.env.E2E_BASE_URL ?? "/";

let relay: MockRelay;

test.beforeAll(async () => {
  relay = await startMockRelay(8894);
});

test.afterAll(async () => {
  await relay.close();
});

async function installRelayRoute(page: Page): Promise<void> {
  await page.addInitScript(({ primaryRelayUrl, relayUrl }) => {
    const NativeWebSocket = window.WebSocket;
    const RoutedWebSocket = new Proxy(NativeWebSocket, {
      construct(Target, args) {
        const target = String(args[0] ?? "");
        if (target === primaryRelayUrl) {
          return Reflect.construct(Target, [relayUrl, ...args.slice(1)]);
        }
        return Reflect.construct(Target, args);
      },
    });
    Object.defineProperty(window, "WebSocket", { configurable: true, value: RoutedWebSocket });
  }, { primaryRelayUrl, relayUrl: relay.url });
}

async function openRunningCoordinatorSettings(page: Page): Promise<Locator> {
  await page.addInitScript(({ storageKey, relayUrl }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      relays: [{ id: "profile-relay", url: relayUrl, enabled: true }],
      announce: false,
      maxUsers: 16,
      autostart: false,
      coordinatorName: "Before rename",
      setupCompleted: true,
      presenceState: "invisible",
    }));
  }, { storageKey: configStorageKey, relayUrl: primaryRelayUrl });
  await installRelayRoute(page);
  await page.goto(appUrl);

  await expect(page.getByTestId("guided-start-state")).toBeVisible();
  await page.getByTestId("coordinator-start").click();
  await expect(page.getByText("Coordinator online", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  const createRoom = page.getByTestId("create-room-dialog");
  await createRoom.getByPlaceholder("Friday plans").fill("Profile rename room");
  await createRoom.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(createRoom).toBeHidden();
  await expect(page.getByTestId("invite-panel")).toHaveAttribute("data-local-rail-state", "ready", { timeout: 15_000 });
  await page.getByRole("button", { name: /^Settings for / }).click();
  const settings = page.getByTestId("coordinator-settings");
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "Edit settings" }).click();
  return settings;
}

test("rename publishes a signed coordinator profile only after explicit save", async ({ page }) => {
  const settings = await openRunningCoordinatorSettings(page);
  const name = settings.getByLabel("Coordinator name", { exact: true });

  await expect(name).toHaveValue("Before rename");
  await name.fill("Renamed coordinator");
  await expect(settings.getByRole("button", { name: "Save coordinator name", exact: true })).toBeEnabled();
});
