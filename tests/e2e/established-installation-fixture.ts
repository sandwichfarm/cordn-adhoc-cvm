import { expect, test as base } from "@playwright/test";

/**
 * Legacy suites exercise an already-established installation. Keep that
 * precondition explicit now that a genuinely fresh origin enters onboarding.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
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
        maxUsers: 16,
        autostart: false,
        coordinatorName: "My coordinator",
        setupCompleted: true,
        presenceState: "invisible",
      }));
    });
    await use(page);
  },
});

export { expect };
export type { Locator, Page } from "@playwright/test";
