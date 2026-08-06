import { expect, test } from "@playwright/test";

const configStorageKey = "cordn:v1:config";

test("checking and anonymous setup keep coordinator start unavailable until a valid name is saved", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.removeItem(storageKey);
    const testWindow = window as typeof window & { __setupStartObserved?: boolean; __setupAllowStart?: boolean; __setupObserver?: MutationObserver };
    const check = () => {
      if (!testWindow.__setupAllowStart && document.querySelector('[data-testid="coordinator-start"]:not([disabled]), button[aria-label="Start"]:not([disabled])')) {
        testWindow.__setupStartObserved = true;
      }
    };
    testWindow.__setupStartObserved = false;
    testWindow.__setupObserver = new MutationObserver(check);
    testWindow.__setupObserver.observe(document.documentElement, { childList: true, subtree: true });
    check();
  }, configStorageKey);

  await page.goto("/");

  const setup = page.getByTestId("coordinator-setup");
  await expect(setup).toHaveAttribute("data-setup-state", "identity");
  await expect(setup.getByRole("heading", { name: "Choose your operator identity" })).toBeVisible();
  await expect(setup.getByTestId("setup-anonymous")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toHaveCount(0);
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  await expect.poll(() => page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const host = document.querySelector<HTMLElement>('[data-testid="host-chat"]')?.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>('[data-testid="coordinator-setup"]')?.getBoundingClientRect();
    return {
      hostLeft: Math.round(host?.left ?? -1),
      hostWidth: Math.round(host?.width ?? -1),
      cardCenterOffset: Math.round(Math.abs(((card?.left ?? 0) + (card?.width ?? 0) / 2) - viewportWidth / 2)),
    };
  })).toEqual({ hostLeft: 0, hostWidth: viewportWidth, cardCenterOffset: 0 });

  await setup.getByTestId("setup-anonymous").click();
  const name = setup.getByTestId("setup-coordinator-name");
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("My coordinator");

  await name.fill("   ");
  await name.blur();
  await expect(setup.getByTestId("setup-name-error")).toHaveText("Enter a coordinator name to continue.");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(setup.getByTestId("setup-save")).toBeDisabled();

  await name.fill("  My test coordinator  ");
  await setup.getByTestId("setup-save").click();
  await expect(setup.getByTestId("setup-path-stage")).toBeVisible();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), configStorageKey)).toBeNull();
  await setup.getByTestId("setup-advanced").click();
  await setup.getByTestId("setup-ephemeral").click();
  await setup.getByTestId("setup-advanced-persistence").getByRole("button", { name: "Continue to relays", exact: true }).click();
  await expect(setup.getByTestId("setup-relay-input")).toHaveCount(3);
  await setup.getByTestId("setup-advanced-relays").getByRole("button", { name: "Continue to announcement", exact: true }).click();
  await setup.getByTestId("setup-advanced-announce").getByRole("button").filter({ hasText: /^No/ }).click();
  await setup.getByTestId("setup-advanced-announce").getByRole("button", { name: "Continue to autostart", exact: true }).click();
  await setup.getByTestId("setup-advanced-autostart").getByRole("button").filter({ hasText: /^No/ }).click();
  await page.evaluate(() => { (window as typeof window & { __setupAllowStart?: boolean }).__setupAllowStart = true; });
  await setup.getByTestId("setup-finish").click();
  await expect(page.getByTestId("guided-start-state")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  expect(await page.evaluate(() => {
    const testWindow = window as typeof window & { __setupStartObserved?: boolean; __setupObserver?: MutationObserver };
    testWindow.__setupObserver?.disconnect();
    return testWindow.__setupStartObserved ?? false;
  })).toBe(false);
});

test("meaningful legacy configuration bypasses setup while defaults still require it", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      relays: [],
      announce: false,
      maxUsers: 16,
      autostart: false,
      coordinatorName: "Existing coordinator",
      presenceState: "invisible",
    }));
  }, configStorageKey);
  await page.goto("/");
  await expect(page.getByTestId("coordinator-setup")).toHaveCount(0);
  await expect(page.getByTestId("guided-start-state")).toBeVisible();
});

test("identity recovery stays reachable inside the setup gate", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cordn:v1:anonymous-identity", "{");
  });
  await page.goto("/");
  const setup = page.getByTestId("coordinator-setup");
  await expect(setup.getByRole("heading", { name: "Recover local identity" })).toBeVisible();
  await setup.getByRole("button", { name: "Create new identity" }).click();
  await expect(setup).toHaveAttribute("data-setup-state", "identity");
});

test("advanced setup preserves draft choices and commits edited relays only at finish", async ({ page }) => {
  await page.goto("/");
  const setup = page.getByTestId("coordinator-setup");
  await setup.getByTestId("setup-anonymous").click();
  await setup.getByTestId("setup-coordinator-name").fill("Advanced coordinator");
  await setup.getByTestId("setup-save").click();
  await setup.getByTestId("setup-advanced").click();
  await setup.getByTestId("setup-ephemeral").click();
  await setup.getByTestId("setup-advanced-persistence").getByRole("button", { name: "Continue to relays", exact: true }).click();

  const relayStage = setup.getByTestId("setup-advanced-relays");
  await relayStage.getByTestId("setup-relay-input").first().fill("wss://custom.example.com");
  await relayStage.getByRole("button", { name: "Remove relay 3" }).click();
  await relayStage.getByTestId("setup-add-relay").click();
  await relayStage.getByTestId("setup-relay-input").last().fill("wss://extra.example.com");
  await relayStage.getByRole("button", { name: "Continue to announcement", exact: true }).click();
  await setup.getByTestId("setup-advanced-announce").getByRole("button").filter({ hasText: /^Yes/ }).click();
  await setup.getByTestId("setup-advanced-announce").getByRole("button", { name: "Back to relays", exact: true }).click();
  expect(await relayStage.getByTestId("setup-relay-input").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual([
    "wss://custom.example.com",
    "wss://bucket.coracle.social",
    "wss://extra.example.com",
  ]);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), configStorageKey)).toBeNull();

  await relayStage.getByRole("button", { name: "Continue to announcement", exact: true }).click();
  await expect(setup.getByTestId("setup-advanced-announce").getByRole("button").filter({ hasText: /^Yes/ })).toHaveAttribute("aria-pressed", "true");
  await setup.getByTestId("setup-advanced-announce").getByRole("button", { name: "Continue to autostart", exact: true }).click();
  await setup.getByTestId("setup-advanced-autostart").getByRole("button").filter({ hasText: /^No/ }).click();
  await setup.getByTestId("setup-finish").click();
  await expect(page.getByTestId("guided-start-state")).toBeVisible();

  expect(await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? "{}"), configStorageKey)).toMatchObject({
    coordinatorName: "Advanced coordinator",
    setupCompleted: true,
    relays: [
      { url: "wss://custom.example.com", enabled: true },
      { url: "wss://bucket.coracle.social", enabled: true },
      { url: "wss://extra.example.com", enabled: true },
    ],
    announce: true,
    autostart: false,
  });
  expect(await page.evaluate(() => localStorage.getItem("cordn:v1:persistence"))).toBeNull();
});

async function completeRecommendedAnonymousSetup(page: import("@playwright/test").Page, passphrase: string, name = "Encrypted setup coordinator"): Promise<void> {
  const setup = page.getByTestId("coordinator-setup");
  await expect(setup).toHaveAttribute("data-setup-state", "identity");
  await setup.getByTestId("setup-anonymous").click();
  await setup.getByTestId("setup-coordinator-name").fill(name);
  await setup.getByTestId("setup-save").click();
  await setup.getByTestId("setup-recommended").click();
  await setup.getByTestId("setup-passphrase").fill(passphrase);
  await setup.getByTestId("setup-passphrase-confirmation").fill(`${passphrase}-wrong`);
  await setup.getByTestId("setup-save-and-start").click();
  await expect(setup.getByTestId("setup-persistence-error")).toHaveText("Passphrases do not match");
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), configStorageKey)).toBeNull();
  await setup.getByTestId("setup-passphrase-confirmation").fill(passphrase);
  await page.evaluate(() => {
    const testWindow = window as typeof window & { __recommendedStartObserved?: boolean; __recommendedStartObserver?: MutationObserver };
    testWindow.__recommendedStartObserved = false;
    const check = () => {
      if (document.querySelector('[data-testid="startup-progress-panel"]')) testWindow.__recommendedStartObserved = true;
    };
    testWindow.__recommendedStartObserver = new MutationObserver(check);
    testWindow.__recommendedStartObserver.observe(document.documentElement, { childList: true, subtree: true });
  });
  await setup.getByTestId("setup-save-and-start").click();
  await expect(setup).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __recommendedStartObserved?: boolean }).__recommendedStartObserved ?? false)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("cordn:v1:persistence"))).not.toBeNull();
  expect(await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? "{}"), configStorageKey)).toMatchObject({
    coordinatorName: name,
    setupCompleted: true,
    autostart: true,
    announce: false,
  });
}

test("durable config failure keeps recommended setup incomplete and never starts", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage && key === storageKey) throw new Error("synthetic private config failure");
      return original.call(this, key, value);
    };
  }, configStorageKey);
  await page.goto("/");
  const setup = page.getByTestId("coordinator-setup");
  await setup.getByTestId("setup-anonymous").click();
  await setup.getByTestId("setup-coordinator-name").fill("Uncommitted coordinator");
  await setup.getByTestId("setup-save").click();
  await setup.getByTestId("setup-recommended").click();
  await setup.getByTestId("setup-passphrase").fill("config-write-failure");
  await setup.getByTestId("setup-passphrase-confirmation").fill("config-write-failure");
  await setup.getByTestId("setup-save-and-start").click();

  await expect(setup.getByTestId("setup-persistence-error")).toHaveText("Could not save coordinator setup");
  await expect(setup).toHaveAttribute("data-setup-state", "preferences");
  await expect(page.getByTestId("guided-start-state")).toHaveCount(0);
  await expect(page.getByTestId("startup-progress")).toHaveCount(0);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), configStorageKey)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("cordn:v1:persistence"))).toBeNull();
});

test("encrypted coordinator unlock resolves before setup and then honors persisted completion state", async ({ page }) => {
  const passphrase = "phase-21-setup-unlock";
  await page.goto("/");
  await completeRecommendedAnonymousSetup(page, passphrase);

  await page.reload();
  const unlock = page.getByTestId("coordinator-unlock");
  await expect(unlock.getByRole("button", { name: "Unlock coordinator" })).toBeVisible();
  await expect(page.getByTestId("coordinator-setup")).toHaveCount(0);
  await unlock.getByPlaceholder("passphrase", { exact: true }).fill(passphrase);
  await unlock.getByRole("button", { name: "Unlock coordinator" }).click();
  await expect(page.getByTestId("coordinator-setup")).toHaveCount(0);

  await page.evaluate((storageKey) => {
    const config = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    config.setupCompleted = false;
    config.coordinatorName = "My coordinator";
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, configStorageKey);
  await page.reload();
  await unlock.getByPlaceholder("passphrase", { exact: true }).fill(passphrase);
  await unlock.getByRole("button", { name: "Unlock coordinator" }).click();
  await expect(page.getByTestId("coordinator-setup")).toHaveAttribute("data-setup-state", "identity");
});
