import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { installEstablishedInstallation } from "./established-installation-fixture";
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

async function completeFreshDurableSetup(page: Page): Promise<void> {
  await tap(page.getByRole("button", { name: /Advanced setup/ }));
  const persistence = page.getByTestId("setup-advanced-persistence");
  await expect(persistence).toBeVisible();
  await persistence.getByTestId("setup-passphrase").fill("mobile-test-password");
  await persistence.getByTestId("setup-passphrase-confirmation").fill("mobile-test-password");
  await tap(persistence.getByRole("button", { name: "Continue to relays" }));

  const relays = page.getByTestId("setup-advanced-relays");
  await expect(relays).toBeVisible();
  await tap(relays.getByRole("button", { name: "Continue to announcement" }));
  await tap(page.getByRole("button", { name: /No\s+Keep the coordinator private/ }));
  await tap(page.getByRole("button", { name: "Continue to autostart" }));
  await tap(page.getByRole("button", { name: /No\s+Wait for you to start/ }));
  await tap(page.getByRole("button", { name: "Finish setup" }));
}

async function configureMockRelay(page: Page): Promise<void> {
  const review = page.getByRole("button", { name: "Review settings", exact: true });
  const settings = page.getByRole("button", { name: /^Settings for / }).first();
  if (await review.isVisible()) await tap(review);
  else {
    if (!(await settings.isVisible())) await tap(page.getByRole("button", { name: "Open room browser" }));
    await tap(settings);
  }
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

async function startCoordinator(page: Page): Promise<void> {
  const start = page.getByRole("button", { name: "Start", exact: true })
    .or(page.getByRole("button", { name: "Start coordinator", exact: true }))
    .or(page.getByRole("button", { name: "Wake", exact: true })).first();
  await tap(start);
}

async function stopCoordinator(page: Page): Promise<void> {
  const stop = page.getByRole("button", { name: "Stop", exact: true });
  if (!(await stop.isVisible())) await tap(page.getByRole("button", { name: "Open room browser" }));
  await tap(stop);
}

async function assertTouchGeometry(page: Page, controls: Locator[]): Promise<void> {
  for (const control of controls) {
    const bounds = await control.boundingBox();
    expect(bounds, `visible mobile control must have geometry`).not.toBeNull();
    expect(bounds!.width, `mobile control ${await control.getAttribute("aria-label") ?? ""} width`).toBeGreaterThanOrEqual(44);
    expect(bounds!.height, `mobile control ${await control.getAttribute("aria-label") ?? ""} height`).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual({ clientWidth: MOBILE_VIEWPORT.width, scrollWidth: MOBILE_VIEWPORT.width });
}

async function assertSecretSafeDiagnostics(page: Page, diagnostics: string[]): Promise<void> {
  const publicText = await page.locator("body").innerText();
  expect(publicText).not.toMatch(PROHIBITED_DIAGNOSTIC);
  expect(diagnostics.join("\n")).not.toMatch(PROHIBITED_DIAGNOSTIC);
}

test("mobile projects enumerate real touch Chromium and WebKit contexts", async ({ page }, testInfo) => {
  const config = await readFile("playwright.config.ts", "utf8");
  for (const project of MOBILE_PROJECTS) expect(config).toContain(`name: "${project}"`);
  expect(config).toContain('name: "chromium"');

  if (MOBILE_PROJECTS.includes(testInfo.project.name as (typeof MOBILE_PROJECTS)[number])) {
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  }
});

test("complete durable host journey uses touch controls", async ({ page }, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name as (typeof MOBILE_PROJECTS)[number]), "the tracer runs only in real mobile projects");
  test.setTimeout(120_000);
  const diagnostics: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.push(error.message));

  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/");
  await tap(page.getByRole("button", { name: /Continue anonymously/ }));
  await page.getByLabel("Coordinator name").fill("Mobile host");
  await tap(page.getByRole("button", { name: "Save and continue" }));
  await completeFreshDurableSetup(page);
  await configureMockRelay(page);
  await startCoordinator(page);
  await expect(page.getByTestId("startup-progress-panel")).toBeVisible();
  await expect(page.getByTestId("coordinator-empty-content")).toContainText("Coordinator online", { timeout: 35_000 });
  await createRoom(page, "Mobile durable room");

  const roomBrowser = page.getByRole("button", { name: "Open room browser" });
  await tap(roomBrowser);
  const drawer = page.getByTestId("invite-panel");
  await expect(drawer.getByRole("heading", { name: "Rooms" })).toBeVisible();
  await assertTouchGeometry(page, [drawer.getByRole("button", { name: "Close room browser" })]);
  await tap(drawer.getByRole("button", { name: "Close room browser" }));
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  const composer = page.getByPlaceholder("Message as host");
  await composer.fill("Mobile host message");
  await tap(page.getByRole("button", { name: "Send", exact: true }));
  const message = page.getByTestId("host-message-list").locator("article.host-message").filter({ hasText: "Mobile host message" });
  await expect(message).toBeVisible();
  await tap(page.getByRole("button", { name: "More room actions" }));
  const roomActions = page.getByRole("menu", { name: "Room actions for Mobile durable room" });
  await expect(roomActions).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(roomActions).toBeHidden();

  await stopCoordinator(page);
  await expect(page.getByText("Stopping and saving…", { exact: true })).toBeVisible();
  await expect(page.getByTestId("status-badge")).toHaveText("idle", { timeout: 35_000 });
  await startCoordinator(page);
  await expect(page.getByTestId("status-badge")).toHaveText("running", { timeout: 35_000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  const unlock = page.getByTestId("coordinator-unlock");
  await expect(unlock.getByRole("button", { name: "Unlock coordinator" })).toBeVisible({ timeout: 35_000 });
  await unlock.getByPlaceholder("passphrase", { exact: true }).fill("mobile-test-password");
  await tap(unlock.getByRole("button", { name: "Unlock coordinator" }));
  await expect(page.getByRole("heading", { name: "Mobile host" })).toBeVisible({ timeout: 35_000 });
  await startCoordinator(page);
  await expect(page.getByTestId("status-badge")).toHaveText("running", { timeout: 35_000 });
  await tap(page.getByRole("button", { name: "Open room browser" }));
  await tap(page.getByTestId("invite-panel").getByRole("button", { name: /Open room Mobile durable room/ }));
  await expect(page.getByRole("heading", { name: "Mobile durable room" })).toBeVisible();

  await assertTouchGeometry(page, [
    page.getByRole("button", { name: "Open room browser" }),
    page.getByRole("button", { name: "Send", exact: true }),
  ]);
  await assertSecretSafeDiagnostics(page, diagnostics);
  await stopCoordinator(page);
  await expect(page.getByTestId("status-badge")).toHaveText("idle", { timeout: 35_000 });
});

test("independent mobile clients exchange an admitted encrypted reaction journey by tap", async ({ page: host, browser }, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name as (typeof MOBILE_PROJECTS)[number]), "requires a real mobile project");
  test.setTimeout(120_000);
  await installEstablishedInstallation(host);
  await host.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await host.setViewportSize(MOBILE_VIEWPORT);
  await host.goto("/");
  await configureMockRelay(host);
  await startCoordinator(host);
  await expect(host.getByRole("button", { name: "Create room", exact: true })).toBeVisible({ timeout: 35_000 });
  await tap(host.getByRole("button", { name: "Create room", exact: true }));
  const createDialog = host.getByTestId("create-room-dialog");
  await createDialog.getByPlaceholder("Friday plans").fill("Mobile two-client room");
  await tap(createDialog.getByLabel("Auto-approve invitees"));
  await tap(createDialog.getByRole("button", { name: "Create room", exact: true }));
  await expect(createDialog).toBeHidden();

  await tap(host.getByRole("button", { name: "Open room browser" }));
  await tap(host.getByTestId("invite-panel").getByRole("button", { name: "Invite", exact: true }));
  const inviteDialog = host.getByTestId("invite-dialog");
  await expect(inviteDialog).toBeVisible();
  const copyInvite = inviteDialog.getByRole("button", { name: "Copy invite link" });
  const inviteUrl = await host.getByTestId("invite-link").textContent();
  expect(Boolean(inviteUrl)).toBe(true);
  await tap(copyInvite);
  await expect(copyInvite).toHaveText("Copied");
  expect(await host.evaluate(async () => Boolean(await navigator.clipboard.readText()))).toBe(true);
  await tap(inviteDialog.getByRole("button", { name: "Close invite dialog" }).last());

  const guestContext = await browser.newContext({ hasTouch: true, isMobile: true, viewport: MOBILE_VIEWPORT });
  const guest = await guestContext.newPage();
  try {
    await installEstablishedInstallation(guest);
    await guest.goto(inviteUrl!);
    await expect(guest.getByText("Your encrypted join request is with the host.")).toBeVisible({ timeout: 35_000 });

    await tap(host.getByRole("button", { name: "Open room browser" }));
    await expect(host.getByTestId("invite-panel").getByRole("heading", { name: "Rooms" })).toBeVisible();
    const approve = host.getByRole("button", { name: /Approve waiting invitees, 1 request/ });
    await expect(approve).toBeEnabled({ timeout: 35_000 });
    await tap(approve);
    await expect(guest.getByPlaceholder("Message")).toBeVisible({ timeout: 35_000 });

    await host.getByPlaceholder("Message as host").fill("Host message for a mobile guest");
    await tap(host.getByRole("button", { name: "Send", exact: true }));
    const guestMessage = guest.locator("article.message").filter({ hasText: "Host message for a mobile guest" });
    await expect(guestMessage).toBeVisible({ timeout: 35_000 });
    await tap(guestMessage.getByRole("button", { name: "Add reaction" }));
    const reactionSheet = guestMessage.getByRole("menu", { name: /Choose reaction/ });
    await expect(reactionSheet).toBeVisible();
    await tap(reactionSheet.getByRole("menuitem", { name: "React 👍" }));
    await expect(guestMessage.getByRole("button", { name: /Remove 👍 reaction, 1 participant/ })).toHaveAttribute("aria-pressed", "true");
    await expect(host.locator("article.host-message").filter({ hasText: "Host message for a mobile guest" }).getByLabel("👍 reaction, 1 participant")).toBeVisible({ timeout: 35_000 });

    await guest.getByPlaceholder("Message").fill("Guest response from a touch context");
    await tap(guest.getByRole("button", { name: "Send", exact: true }));
    await expect(host.getByTestId("host-message-list").getByText("Guest response from a touch context")).toBeVisible({ timeout: 35_000 });
    await tap(guest.getByRole("button", { name: "Open room browser" }));
    await tap(guest.getByTestId("invite-panel").getByRole("button", { name: /Open room Mobile two-client room/ }));
    await expect(guest.getByRole("heading", { name: "Mobile two-client room" })).toBeVisible();
  } finally {
    await guestContext.close();
    await stopCoordinator(host).catch(() => undefined);
  }
});
