import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { startMockRelay, type MockRelay } from "./mock-relay";

const MOBILE_PROJECTS = ["mobile-chromium", "mobile-webkit"] as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const PROHIBITED_DIAGNOSTIC = /private.?key|secret|invite(?:\s|-)??(?:url|link|token|capability)|keyPackage64|welcome64|snapshot/i;

let relay: MockRelay;

test.beforeAll(async () => {
  relay = await startMockRelay(8777);
});

test.afterAll(async () => {
  await relay.close();
});

async function tap(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await locator.tap();
}

async function configureMockRelay(page: Page): Promise<void> {
  const openBrowser = page.getByRole("button", { name: "Open room browser" });
  const settings = page.getByRole("button", { name: /^Settings for / }).first();
  if (!(await settings.isVisible()) && await openBrowser.isVisible()) await tap(openBrowser);
  await tap(settings);
  const panel = page.getByTestId("coordinator-settings");
  await expect(panel).toBeVisible();
  const edit = panel.getByRole("button", { name: "Edit settings" });
  if (await edit.isVisible()) await tap(edit);
  const existing = panel.getByText(relay.url, { exact: true });
  if (!(await existing.isVisible())) {
    const removeDefault = panel.getByLabel(/Remove wss:\/\/relay\.contextvm\.org/);
    if (await removeDefault.isVisible()) await tap(removeDefault);
    await panel.getByPlaceholder("wss://relay.example").fill(relay.url);
    await tap(panel.getByRole("button", { name: "Add", exact: true }));
    await expect(existing).toBeVisible();
  }
  const done = panel.getByRole("button", { name: "Done editing" });
  if (await done.isVisible()) await tap(done);
  await tap(panel.getByRole("button", { name: "Close coordinator settings" }).last());
}

async function createRoom(page: Page, title: string): Promise<void> {
  const create = page.getByRole("button", { name: "Create room", exact: true })
    .or(page.getByRole("button", { name: "Create group", exact: true })).first();
  if (!(await create.isVisible())) await tap(page.getByRole("button", { name: "Open room browser" }));
  await tap(create);
  const dialog = page.getByTestId("create-room-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Friday plans").fill(title);
  await tap(dialog.getByRole("button", { name: "Create room", exact: true }));
  await expect(dialog).toBeHidden();
}

async function assertTouchGeometry(page: Page, controls: Locator[]): Promise<void> {
  for (const control of controls) {
    const bounds = await control.boundingBox();
    expect(bounds, `visible mobile control must have geometry`).not.toBeNull();
    expect(bounds!.width, `mobile control ${await control.getAttribute("aria-label") ?? ""} width`).toBeGreaterThanOrEqual(44);
    expect(bounds!.height, `mobile control ${await control.getAttribute("aria-label") ?? ""} height`).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
}

async function assertSecretSafeDiagnostics(page: Page, diagnostics: string[]): Promise<void> {
  const publicText = await page.locator("body").innerText();
  expect(publicText).not.toMatch(PROHIBITED_DIAGNOSTIC);
  expect(diagnostics.join("\n")).not.toMatch(PROHIBITED_DIAGNOSTIC);
}

test("mobile projects enumerate real touch Chromium and WebKit contexts", async ({ page }, testInfo) => {
  const config = await readFile("playwright.config.ts", "utf8");
  for (const project of MOBILE_PROJECTS) expect(config).toContain(`name: \"${project}\"`);
  expect(config).toContain('name: "chromium"');

  if (MOBILE_PROJECTS.includes(testInfo.project.name as (typeof MOBILE_PROJECTS)[number])) {
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  }
});

test("complete durable host journey uses touch controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "the tracer runs only in the real mobile Chromium project");
  test.setTimeout(120_000);
  const diagnostics: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.push(error.message));

  await page.goto("/");
  await tap(page.getByRole("button", { name: /Continue anonymously/ }));
  await page.getByLabel("Coordinator name").fill("Mobile host");
  await tap(page.getByRole("button", { name: "Save and continue" }));
  await configureMockRelay(page);
  await tap(page.getByRole("button", { name: "Start", exact: true }));
  await expect(page.getByTestId("startup-progress-panel")).toBeVisible();
  await expect(page.getByTestId("coordinator-empty-content")).toContainText("Coordinator online", { timeout: 35_000 });
  await createRoom(page, "Mobile durable room");

  const roomBrowser = page.getByRole("button", { name: "Open room browser" });
  await tap(roomBrowser);
  const drawer = page.getByRole("dialog", { name: "Room browser" });
  await expect(drawer).toBeVisible();
  await assertTouchGeometry(page, [drawer.getByRole("button", { name: "Close room browser" })]);
  await tap(drawer.getByRole("button", { name: "Close room browser" }));
  await expect(drawer).toBeHidden();

  const composer = page.getByPlaceholder("Message as host");
  await composer.fill("Mobile host message");
  await tap(page.getByRole("button", { name: "Send", exact: true }));
  const message = page.getByTestId("host-message-list").locator("article.host-message").filter({ hasText: "Mobile host message" });
  await expect(message).toBeVisible();
  await tap(message.getByRole("button", { name: "Add reaction" }));
  const reactionMenu = page.getByRole("menu", { name: /Choose reaction/ });
  await expect(reactionMenu).toBeVisible();
  await tap(reactionMenu.getByRole("menuitem", { name: "React 👍" }));
  await expect(message.getByRole("button", { name: /Remove 👍 reaction/ })).toBeVisible();

  await tap(page.getByRole("button", { name: "Stop", exact: true }));
  await expect(page.getByText("Stopping and saving…", { exact: true })).toBeVisible();
  await expect(page.getByTestId("status-badge")).toHaveText("idle", { timeout: 35_000 });
  await tap(page.getByRole("button", { name: "Start", exact: true }));
  await expect(page.getByTestId("status-badge")).toHaveText("running", { timeout: 35_000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mobile host" })).toBeVisible({ timeout: 35_000 });
  await expect(page.getByRole("button", { name: /Open room Mobile durable room/ })).toBeVisible();

  await assertTouchGeometry(page, [
    page.getByRole("button", { name: "Open room browser" }),
    page.getByRole("button", { name: "Send", exact: true }),
  ]);
  await assertSecretSafeDiagnostics(page, diagnostics);
});
