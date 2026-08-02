import { expect, test, type Locator, type Page } from "@playwright/test";

const identityStorageKey = "cordn:v1:anonymous-identity";
const recoveryBoundaryKey = "cordn:v1:anonymous-identity-recovery";

async function openIdentityMenu(page: Page): Promise<{ profile: Locator; trigger: Locator; menu: Locator }> {
  const profile = page.getByTestId("user-profile");
  const trigger = profile.locator(".user-trigger");
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName(/^Open profile for /);
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "User profile" });
  await expect(menu).toBeVisible();
  return { profile, trigger, menu };
}

async function openRotationDialog(page: Page): Promise<Locator> {
  const { menu } = await openIdentityMenu(page);
  await menu.getByRole("button", { name: "Rotate identity…" }).click();
  const dialog = page.getByTestId("identity-rotation-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("keeps an unverified profile trigger hidden while malformed identity recovery resolves", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, "{");
    const testWindow = window as typeof window & {
      __profileTriggerObserved?: boolean;
      __profileTriggerObserver?: MutationObserver;
    };
    const check = () => {
      if (document.querySelector('[data-testid="user-profile"] .user-trigger')) {
        testWindow.__profileTriggerObserved = true;
      }
    };
    testWindow.__profileTriggerObserved = false;
    testWindow.__profileTriggerObserver = new MutationObserver(check);
    testWindow.__profileTriggerObserver.observe(document.documentElement, { childList: true, subtree: true });
    check();
  }, identityStorageKey);

  await page.goto("/");

  const recovery = page.getByTestId("identity-rotation-dialog");
  await expect(recovery.getByRole("heading", { name: "Recover local identity" })).toBeVisible();
  await expect(page.getByTestId("user-profile").locator(".user-trigger")).toHaveCount(0);
  expect(await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __profileTriggerObserved?: boolean;
      __profileTriggerObserver?: MutationObserver;
    };
    testWindow.__profileTriggerObserver?.disconnect();
    return testWindow.__profileTriggerObserved ?? false;
  })).toBe(false);
});

test("uses the selected identity tokens and a labelled 44px close affordance", async ({ page }) => {
  await page.goto("/");
  const { trigger, menu } = await openIdentityMenu(page);

  await expect(trigger).toHaveCSS("border-top-color", "rgb(135, 255, 159)");
  await expect(menu.locator("header strong")).toHaveCSS("font-size", "14px");
  await expect(menu.locator("header div > span")).toHaveCSS("font-size", "10px");
  await expect(menu.locator(".user-menu-section p").first()).toHaveCSS("font-size", "12px");
  await expect(menu.getByRole("button", { name: "Rotate identity…" })).toHaveCSS("font-size", "12px");

  await menu.getByRole("button", { name: "Rotate identity…" }).click();
  const dialog = page.getByTestId("identity-rotation-dialog");
  const safeAction = dialog.getByRole("button", { name: "Keep current identity" });
  const close = dialog.getByRole("button", { name: "Close identity rotation dialog" });
  await expect(safeAction).toBeFocused();
  await expect(close).toBeVisible();
  const closeBox = await close.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox?.width).toBeGreaterThanOrEqual(44);
  expect(closeBox?.height).toBeGreaterThanOrEqual(44);

  await close.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("uses secondary status color and disables the close affordance while rotating", async ({ page }) => {
  await page.addInitScript((boundaryKey) => {
    const testWindow = window as typeof window & {
      __identityBusyVisual?: { closeDisabled: boolean; liveColor: string; liveText: string };
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (this === window.localStorage && key === boundaryKey) {
        const dialog = document.querySelector<HTMLDialogElement>('[data-testid="identity-rotation-dialog"]');
        const close = dialog?.querySelector<HTMLButtonElement>('[aria-label="Close identity rotation dialog"]');
        const live = dialog?.querySelector<HTMLElement>('[aria-live="polite"]');
        if (close && live) {
          testWindow.__identityBusyVisual = {
            closeDisabled: close.disabled,
            liveColor: getComputedStyle(live).color,
            liveText: live.textContent?.trim() ?? "",
          };
        }
      }
      originalSetItem.call(this, key, value);
    };
  }, recoveryBoundaryKey);
  await page.goto("/");

  const dialog = await openRotationDialog(page);
  await dialog.getByRole("button", { name: "Rotate identity" }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => (
    window as typeof window & {
      __identityBusyVisual?: { closeDisabled: boolean; liveColor: string; liveText: string };
    }
  ).__identityBusyVisual)).toEqual({
    closeDisabled: true,
    liveColor: "rgb(145, 165, 154)",
    liveText: "Rotating…",
  });
});

test("retains only non-dismissable recovery after a post-boundary identity write failure", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((storageKey) => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (this === window.localStorage && key === storageKey) throw new Error("injected identity write failure");
      originalSetItem.call(this, key, value);
    };
  }, identityStorageKey);

  const dialog = await openRotationDialog(page);
  await dialog.getByRole("button", { name: "Rotate identity" }).click();

  await expect(dialog.getByRole("heading", { name: "Recover local identity" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close identity rotation dialog" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Keep current identity" })).toHaveCount(0);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("user-profile").locator(".user-trigger")).toHaveCount(0);
});

test("normalizes a retryable recovery failure without making recovery dismissable", async ({ page }) => {
  await page.addInitScript(({ boundaryKey, storageKey }) => {
    localStorage.setItem(storageKey, "{");
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (this === window.localStorage && key === boundaryKey) return;
      originalSetItem.call(this, key, value);
    };
  }, { boundaryKey: recoveryBoundaryKey, storageKey: identityStorageKey });
  await page.goto("/");

  const recovery = page.getByTestId("identity-rotation-dialog");
  await recovery.getByRole("button", { name: "Create new identity" }).click();

  await expect(recovery.getByRole("alert")).toHaveText(
    "Unable to rotate your identity. Your current identity and local room access are unchanged. Try again.",
  );
  await expect(recovery.getByRole("button", { name: "Create new identity" })).toBeEnabled();
  await expect(recovery.getByRole("button", { name: "Close identity rotation dialog" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(recovery).toBeVisible();
});
