import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function installEstablishedInstallation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const storageKey = "cordn:v1:config";
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      relaySetVersion: 1,
      relays: [
        { url: "wss://relay2.contextvm.org", enabled: true },
        { url: "wss://bucket.coracle.social", enabled: true },
        { url: "wss://nos.lol", enabled: true },
      ],
      announce: false,
      maxUsers: 64,
      autostart: false,
      coordinatorName: "My coordinator",
      setupCompleted: true,
      presenceState: "invisible",
    }));
  });
}

/**
 * Legacy suites exercise an already-established installation. Keep that
 * precondition explicit now that a genuinely fresh origin enters onboarding.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await installEstablishedInstallation(page);
    await use(page);
  },
});

export { expect };
export type { Locator, Page } from "@playwright/test";
