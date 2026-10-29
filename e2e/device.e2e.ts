import { expect, expectAccessible, expectNoSideScroll, signInDemo, test } from "./fixtures";

test.describe("offline", () => {
  test.use({ serviceWorkers: "allow" });

  test("the plan opens and changes with no signal", async ({ page, context }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/day");
    await expect(page.getByRole("heading", { name: "Day of" })).toBeVisible();
    // Let the service worker install and cache the app.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active?.state !== "activated")
        await new Promise((r) => reg.active?.addEventListener("statechange", r, { once: true }));
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await context.setOffline(true);
    await page.goto("/events/ananya-rohan/guests");
    await expect(page.getByRole("heading", { name: "Guests" })).toBeVisible();
    await page.goto("/events/green-valley-mela/volunteers");
    await expect(page.getByRole("heading", { name: "Volunteers" })).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe("account", () => {
  test("the account page explains installing and keeps the demo's data local @phone", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Account and privacy" })).toBeVisible();
    await expect(page.getByText("The demo keeps everything in this browser only")).toBeVisible();
    await expectAccessible(page);
    await expectNoSideScroll(page);
  });
});
