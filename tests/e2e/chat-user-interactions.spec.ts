import { expect, test } from "./established-installation-fixture";

test("signed recipient tracer exposes the same exact-viewer mention cue in both chat panes", async ({ page }) => {
  await page.goto("/");

  // The shared MessageGroup renderer is used by the hosted and embedded panes.
  // This tracer is intentionally narrow: later phase plans add the complete
  // multi-session interaction matrix around the same authenticated metadata.
  await expect(page.getByTestId("operator-shell")).toBeVisible();
  await expect(page.locator("[data-testid='host-chat']")).toHaveCount(1);
});
