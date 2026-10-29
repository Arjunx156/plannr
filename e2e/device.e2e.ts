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

test.describe("public pages", () => {
  for (const path of [
    "/weddings",
    "/birthdays",
    "/community",
    "/how-it-works",
    "/pricing",
    "/tools",
    "/tools/kerala-wedding-checklist",
    "/tools/festival-checklist",
    "/privacy",
    "/terms",
  ])
    test(`${path} reads well and is accessible @phone`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
      await expectAccessible(page);
      await expectNoSideScroll(page);
    });

  test("the budget splitter adds up and suggests a per-plate figure", async ({ page }) => {
    await page.goto("/tools/budget-calculator");
    await page.getByLabel("Total budget").fill("10L");
    await page.getByLabel("Guests").fill("200");
    await expect(
      page.getByRole("heading", { name: /₹10,00,000 for 200 guests: ₹5,000 a guest/ }),
    ).toBeVisible();
    await expect(page.getByText(/a plate/)).toBeVisible();
    await expectAccessible(page);
  });

  test("the shagun register keeps entries in this browser and totals them", async ({ page }) => {
    await page.goto("/tools/shagun-register");
    await page.getByLabel("From").fill("Menon family");
    await page.getByLabel("Amount").fill("1,001");
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByLabel("From").fill("Nair family");
    await page.getByLabel("Amount").fill("2001");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("heading", { name: "2 entries · ₹3,002" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "2 entries · ₹3,002" })).toBeVisible();
    await expectAccessible(page);
  });

  test("a checklist remembers what's ticked", async ({ page }) => {
    await page.goto("/tools/kerala-wedding-checklist");
    await page.getByLabel(/Fix the muhurtham/).check();
    await expect(page.getByText(/1 of \d+ done/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/Fix the muhurtham/)).toBeChecked();
  });
});

test.describe("shared pages in the family's language", () => {
  test("volunteers can read the sign-up sheet in Malayalam, Hindi or Tamil @phone", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/preview/shifts/green-valley-mela");
    await expect(page.getByText("Volunteer sign-up")).toBeVisible();
    await page.getByRole("button", { name: "മലയാളം" }).click();
    await expect(page.getByText("വോളണ്ടിയർ രജിസ്ട്രേഷൻ")).toBeVisible();
    await page.getByRole("button", { name: "हिन्दी" }).click();
    await expect(page.getByText("स्वयंसेवक पंजीकरण")).toBeVisible();
    await expectAccessible(page);
    await expectNoSideScroll(page);
  });

  test("the gate team's page switches language", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/preview/gate/green-valley-mela");
    await page.getByRole("button", { name: "தமிழ்" }).click();
    await expect(page.getByLabel("பாஸைக் கண்டுபிடி")).toBeVisible();
  });
});

test.describe("passes and the gate", () => {
  test("passes print with a QR code each, and the gate checks them in by name", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/green-valley-mela/stalls");
    await page.getByRole("link", { name: "Print passes" }).click();
    await expect(page).toHaveURL(/\/events\/green-valley-mela\/passes$/);
    const first = page.getByRole("listitem").first();
    await expect(first.getByRole("img", { name: /^Pass for / })).toBeVisible();
    const name = (await first.locator(".font-serif").textContent()) ?? "";
    await expectAccessible(page);

    await page.goto("/events/green-valley-mela/day");
    const gate = page.getByRole("region", { name: "Gate" });
    await gate.getByLabel("Find a pass").fill(name);
    await gate.getByRole("button", { name: `One more in for ${name}` }).click();
    await expect(gate.getByText(/^1 of \d+ in$/)).toBeVisible();
  });
});

test.describe("vendor and resident pages in the family's language", () => {
  test("the call sheet and fund report switch language", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/preview/vendor/ananya-rohan/catering");
    await page.getByRole("button", { name: "മലയാളം" }).click();
    await expect(page.getByRole("heading", { name: "എപ്പോൾ, എവിടെ" })).toBeVisible();
    await page.goto("/preview/fund/green-valley-mela");
    await page.getByRole("button", { name: "தமிழ்" }).click();
    await expect(page.getByRole("heading", { name: "பணம் எங்கிருந்து வருகிறது" })).toBeVisible();
    await expectAccessible(page);
  });
});

test.describe("on a phone", () => {
  test("the section you're on stays in view in the tab bar @phone", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/green-valley-mela/stalls");
    const tab = page
      .getByRole("navigation", { name: "Event sections" })
      .getByRole("link", { name: "Stalls & passes" });
    await expect(tab).toBeInViewport();
    const box = await tab.boundingBox();
    expect(box?.height ?? 0).toBeLessThan(60);
  });
});
