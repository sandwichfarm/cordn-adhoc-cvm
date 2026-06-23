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
  await page.getByLabel(/Remove wss:\/\/relay\.damus\.io/).click();
  await page.getByPlaceholder("wss://relay.example").fill(relay.url);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(relay.url)).toBeVisible();
}

test("generates copyable identity on first load", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Copy coordinator public key" })).toContainText("npub");
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByLabel("Toggle announcement")).not.toBeChecked();
  await expect(page.getByTestId("max-users-input")).toHaveValue("64");
});

test("starts, locks relay configuration, and stops", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);
  await page.getByLabel("Toggle announcement").check();
  await page.getByTestId("max-users-input").fill("32");
  await page.getByTestId("max-users-input").blur();
  await expect(page.getByTestId("max-users-state")).toContainText("0/32 active subscriptions");

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByTestId(`relay-status-${relay.url}`)).toContainText("connected");
  await expect(page.getByRole("button", { name: "Edit configuration" })).toBeDisabled();
  await expect(page.getByTestId("lock-indicator")).toContainText("locked");
  await expect(page.getByLabel("Toggle announcement")).toBeDisabled();
  await expect(page.getByTestId("max-users-input")).toBeDisabled();
  await expect(page.getByTestId("resource-monitor")).toBeVisible();
  await expect(page.getByTestId("telemetry-subscriptions")).toContainText("(est.)");
  await expect(page.getByTestId("telemetry-message-rate")).toContainText("/min (est.)");
  await expect(page.getByTestId("telemetry-memory")).toContainText(/unavailable|MB \(est\.\)/);

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByTestId("resource-monitor")).toBeHidden();
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
  await expect(page.getByRole("heading", { name: "Unlock Cordn" })).toBeVisible();

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

  await page.getByRole("button", { name: "Destroy" }).click();
  await page.getByTestId("confirm-destroy").click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
  await expect(page.getByTestId("persistence-state")).toHaveText("off");
  await expect(page.getByRole("button", { name: "Copy coordinator public key" })).not.toHaveText(initialNpub ?? "");
  await expect.poll(() => page.evaluate(() => localStorage.length)).toBe(0);
});
