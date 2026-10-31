/** Accessibility and layout on every main page. */
import { expect, expectAccessible, expectNoSideScroll, signInDemo, test } from "./fixtures";

test.describe("accessibility and layout", () => {
  for (const path of ["/", "/new", "/gallery", "/signin"]) {
    test(`${path} has no serious accessibility problems @phone`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page);
      await expectNoSideScroll(page);
    });
  }

  for (const path of [
    "/events",
    "/events/ananya-rohan",
    "/events/green-valley-mela",
    "/events/aarav-6",
    "/events/ananya-rohan/timeline",
    "/events/ananya-rohan/vendors",
    "/events/aarav-6/ideas",
    "/events/green-valley-mela/timeline",
    "/events/ananya-rohan/history",
    "/today",
    "/inbox",
  ]) {
    test(`${path} has no serious accessibility problems @phone`, async ({ page }) => {
      await signInDemo(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page);
      await expectNoSideScroll(page);
    });
  }

  test("keyboard users can skip straight past the header to the page", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/aarav-6/timeline");
    await expect(page.getByRole("heading", { name: "Timeline", level: 1 })).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    // The next Tab starts from the page's content, not the header.
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => !!document.getElementById("main")?.contains(document.activeElement)),
    ).toBe(true);
  });

  test("moving between screens is announced, and focus starts at the new content", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/aarav-6");
    await page.getByRole("link", { name: "Vendors", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vendors", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Vendors · Aarav's 6th birthday" }),
    ).toBeAttached();
    await expect(page.locator("#main")).toBeFocused();
  });

  test("a shared page in another language says so, for screen readers", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/preview/shifts/green-valley-mela");
    await page.getByRole("button", { name: "മലയാളം" }).click();
    await expect(page.locator("[lang='ml']").first()).toBeVisible();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("[lang='en']").first()).toBeVisible();
  });

  test("the gallery renders every component in both themes", async ({ page }, info) => {
    await page.goto("/gallery");
    await expect(page.getByTestId("gallery-day").getByRole("heading", { name: "Paper" })).toBeVisible();
    await expect(
      page.getByTestId("gallery-night").getByRole("heading", { name: "Lamp-lit night" }),
    ).toBeVisible();
    await info.attach("gallery", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
});
