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
  await page.getByRole("button", { name: "Edit configuration" }).click();
  if (await page.getByText(relay.url).isVisible()) {
    return;
  }

  const removeDefaultRelay = page.getByLabel(/Remove wss:\/\/relay\.contextvm\.org/);
  if (await removeDefaultRelay.isVisible()) {
    await removeDefaultRelay.click();
  }

  await page.getByPlaceholder("wss://relay.example").fill(relay.url);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(relay.url)).toBeVisible();
}

test("generates copyable identity on first load", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.getByRole("link", { name: "git" })).toHaveAttribute(
    "href",
    "https://github.com/sandwichfarm/cordn-adhoc-cvm/",
  );
  await expect(page.getByRole("button", { name: "Copy coordinator public key" })).toContainText("npub");
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByLabel("Toggle announcement")).not.toBeChecked();
  await expect(page.getByTestId("max-users-input")).toHaveValue("64");
});

test("operator shell does not overflow common viewports", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByTestId("operator-shell")).toBeVisible();
    await expect.poll(() => page.getByTestId("operator-shell").evaluate((element) => element.clientHeight)).toBe(viewport.height);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        })),
      )
      .toEqual({
        clientWidth: viewport.width,
        scrollWidth: viewport.width,
      });
  }
});

test("starts, locks relay configuration, and stops", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByLabel("Toggle announcement").check();
  await page.getByTestId("max-users-input").fill("32");
  await page.getByTestId("max-users-input").blur();
  await expect(page.getByTestId("max-users-state")).toContainText("32 key packages / identity");

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId("host-chat")).toBeVisible();
  await expect(page.getByText("Create a room to start hosting.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit configuration" })).toHaveCount(0);
  await expect(page.getByTestId("resource-monitor")).toBeVisible();
  await expect(page.getByTestId("telemetry-client-streams")).toContainText("(est.)");
  await expect(page.getByTestId("telemetry-fanout-legs")).toContainText("(debug)");
  await expect(page.getByTestId("telemetry-message-rate")).toContainText("/min (est.)");
  await expect(page.getByTestId("telemetry-memory")).toContainText(/unavailable|MB \(est\.\)/);

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByTestId("resource-monitor")).toBeHidden();

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId("host-chat")).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
});

test("uses the full viewport for the live host workspace on desktop and mobile", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await configureMockRelay(page);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByTestId("host-chat")).toBeVisible();
    await expect.poll(() => page.getByTestId("operator-shell").evaluate((element) => element.clientHeight)).toBe(viewport.height);
    await expect
      .poll(() => page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })))
      .toEqual({ clientWidth: viewport.width, scrollWidth: viewport.width });
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByTestId("status-badge")).toHaveText("idle");
  }
});

test("persists and honors the autostart coordinator setting", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByLabel("Toggle autostart").check();
  await page.reload();

  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
});

test("Feature: invite-only chat — Scenario: a guest link opens only the private chat join flow", async ({ page, browser }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByLabel("Auto-approve invitees")).toBeChecked();

  await page.getByTestId("invite-panel").getByPlaceholder("Friday plans").fill("BDD room");
  await page.getByTestId("invite-panel").getByRole("button", { name: "Create invite" }).click();
  await expect(page.getByTestId("host-chat")).toBeVisible();
  const inviteLink = await page.getByTestId("invite-link").textContent();
  expect(inviteLink).toContain("/chat/");

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

test("Feature: invite-only chat — Scenario: a guest is admitted and messages survive coordinator delivery", async ({ page, browser }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await page.getByTestId("invite-panel").getByPlaceholder("Friday plans").fill("Working room");
  await page.getByTestId("invite-panel").getByRole("button", { name: "Create invite" }).click();
  const inviteLink = await page.getByTestId("invite-link").textContent();
  await expect(page.getByTestId("host-chat")).toBeVisible();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(inviteLink!);
  await guest.getByPlaceholder("e.g. River").fill("River");
  await guest.getByRole("button", { name: "Join chat" }).click();
  await expect(guest.getByText("Your encrypted join request is with the host.")).toBeVisible();

  await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByLabel("Add 👍")).toBeVisible();
  await expect(guest.getByLabel("Mute notification sounds")).toBeVisible();
  await guest.getByPlaceholder("Message").fill("Hello from BDD");
  await guest.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("host-chat").getByText("Hello from BDD")).toBeVisible({ timeout: 15_000 });

  await guest.setViewportSize({ width: 390, height: 350 });
  for (let index = 1; index <= 10; index += 1) {
    await page.getByPlaceholder("Message as host").fill(`Host note ${index}`);
    await page.getByPlaceholder("Message as host").press("Enter");
  }
  await expect(guest.getByText("Host note 10")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => guest.getByTestId("guest-message-list").evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThanOrEqual(2);
  await guestContext.close();
});

test("persists relay and runtime configuration across reloads", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByLabel("Toggle announcement").check();
  await page.getByTestId("max-users-input").fill("17");
  await page.getByTestId("max-users-input").blur();

  await page.reload();

  await expect(page.getByText(relay.url)).toBeVisible();
  await expect(page.getByText("wss://relay.contextvm.org")).toBeHidden();
  await expect(page.getByLabel("Toggle announcement")).toBeChecked();
  await expect(page.getByTestId("max-users-input")).toHaveValue("17");
});

test("blocks a second running coordinator for the same public key", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enable persistence" }).click();
  await page.getByPlaceholder("passphrase", { exact: true }).fill("single-instance-passphrase");
  await page.getByPlaceholder("confirm passphrase").fill("single-instance-passphrase");
  await page.getByRole("button", { name: "Save" }).click();
  await configureMockRelay(page);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId("host-chat")).toBeVisible();

  const secondPage = await page.context().newPage();
  await secondPage.goto("/");
  await secondPage.getByPlaceholder("passphrase", { exact: true }).fill("single-instance-passphrase");
  await secondPage.getByRole("button", { name: "Unlock" }).click();
  await configureMockRelay(secondPage);
  await secondPage.getByRole("button", { name: "Start" }).click();

  await expect(secondPage.getByTestId("status-badge")).toHaveText("idle");
  await expect(secondPage.getByTestId("error-banner")).toContainText("cordn already running");
  await expect(secondPage.getByTestId("debug-log-entries")).toContainText("cordn already running");

  await secondPage.close();
});

test("rejects invalid relay URLs inline", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Edit configuration" }).click();
  await page.getByPlaceholder("wss://relay.example").fill("https://relay.example");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByTestId("relay-error")).toContainText("ws:// or wss://");
});

test("persists encrypted key, rejects wrong passphrase, and unlocks after reload", async ({ page }) => {
  await page.goto("/");
  const initialNpub = await page.getByRole("button", { name: "Copy coordinator public key" }).textContent();

  await page.getByRole("button", { name: "Enable persistence" }).click();
  await page.getByPlaceholder("passphrase", { exact: true }).fill("phase-two-passphrase");
  await page.getByPlaceholder("confirm passphrase").fill("phase-two-passphrase");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("persistence-state")).toHaveText("encrypted");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Unlock Cordn Ad-Hoc" })).toBeVisible();

  await page.getByPlaceholder("passphrase", { exact: true }).fill("wrong-passphrase");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByTestId("passphrase-error")).toContainText("Wrong passphrase");

  await page.getByPlaceholder("passphrase", { exact: true }).fill("phase-two-passphrase");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByRole("button", { name: "Copy coordinator public key" })).toHaveText(initialNpub ?? "");
});

test("destroys persisted state after explicit confirmation", async ({ page }) => {
  await page.goto("/");
  const initialNpub = await page.getByRole("button", { name: "Copy coordinator public key" }).textContent();

  await page.getByRole("button", { name: "Enable persistence" }).click();
  await page.getByPlaceholder("passphrase", { exact: true }).fill("destroy-passphrase");
  await page.getByPlaceholder("confirm passphrase").fill("destroy-passphrase");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("persistence-state")).toHaveText("encrypted");
  await page.evaluate(async () => {
    const cache = await caches.open("cordn-test-cache");
    await cache.put("/cache-proof", new Response("cached coordinator state"));
  });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("cordn-test-cache"))).toBe(true);

  await page.getByRole("button", { name: "Destroy" }).click();
  await page.getByTestId("confirm-destroy").click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByTestId("persistence-state")).toHaveText("off");
  await expect(page.getByRole("button", { name: "Copy coordinator public key" })).not.toHaveText(initialNpub ?? "");
  await expect.poll(() => page.evaluate(() => localStorage.length)).toBe(0);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("cordn-test-cache"))).toBe(false);
});
