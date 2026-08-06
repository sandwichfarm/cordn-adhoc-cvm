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
  await page.evaluate(() => { (window as typeof window & { __setupAllowStart?: boolean }).__setupAllowStart = true; });
  await setup.getByTestId("setup-save").click();
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

async function completeAnonymousSetup(page: import("@playwright/test").Page, name = "Encrypted setup coordinator"): Promise<void> {
  const setup = page.getByTestId("coordinator-setup");
  await expect(setup).toHaveAttribute("data-setup-state", "identity");
  await setup.getByTestId("setup-anonymous").click();
  await setup.getByTestId("setup-coordinator-name").fill(name);
  await setup.getByTestId("setup-save").click();
  await expect(page.getByTestId("guided-start-state")).toBeVisible();
}

test("encrypted coordinator unlock resolves before setup and then honors persisted completion state", async ({ page }) => {
  const passphrase = "phase-21-setup-unlock";
  await page.goto("/");
  await completeAnonymousSetup(page);

  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  const settings = page.getByTestId("coordinator-settings");
  await settings.getByRole("button", { name: "Edit settings" }).click();
  await settings.getByRole("button", { name: "Enable persistence" }).click();
  await settings.getByPlaceholder("passphrase", { exact: true }).fill(passphrase);
  await settings.getByPlaceholder("confirm passphrase").fill(passphrase);
  await settings.getByRole("button", { name: "Save key" }).click();
  await expect(settings.getByText("Saved on this device")).toBeVisible();

  await page.reload();
  const unlock = page.getByTestId("coordinator-unlock");
  await expect(unlock.getByRole("button", { name: "Unlock coordinator" })).toBeVisible();
  await expect(page.getByTestId("coordinator-setup")).toHaveCount(0);
  await unlock.getByPlaceholder("passphrase", { exact: true }).fill(passphrase);
  await unlock.getByRole("button", { name: "Unlock coordinator" }).click();
  await expect(page.getByTestId("guided-start-state")).toBeVisible();

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
