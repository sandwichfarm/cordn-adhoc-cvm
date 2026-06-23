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
});

test("starts, locks relay configuration, and stops", async ({ page }) => {
  await page.goto("/");
  await configureMockRelay(page);

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("running");
  await expect(page.getByRole("button", { name: "Edit configuration" })).toBeDisabled();
  await expect(page.getByTestId("lock-indicator")).toContainText("locked");

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("idle");
});

test("rejects invalid relay URLs inline", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Edit configuration" }).click();
  await page.getByPlaceholder("wss://relay.example").fill("https://relay.example");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByTestId("relay-error")).toContainText("ws:// or wss://");
});
