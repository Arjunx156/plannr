import { expect, expectAccessible, expectNoSideScroll, signInDemo, test } from "./fixtures";

/** Every section of every demo event opens cleanly, is accessible and fits a phone. */
const TABS: Record<string, string[]> = {
  "ananya-rohan": ["guests", "budget", "vendors", "day", "website", "settings", "people"],
  "aarav-6": ["guests", "budget", "vendors", "day", "website", "settings"],
  "green-valley-mela": ["funds", "volunteers", "stalls", "vendors", "day", "website", "settings"],
};

test.describe("every section", () => {
  for (const [id, tabs] of Object.entries(TABS))
    for (const tab of tabs)
      test(`/events/${id}/${tab} opens and has no serious accessibility problems @phone`, async ({
        page,
      }) => {
        await signInDemo(page);
        await page.goto(`/events/${id}/${tab}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expectAccessible(page);
        await expectNoSideScroll(page);
      });
});

test.describe("guests", () => {
  test("a household is added and found in the list", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/guests");
    await page.getByRole("button", { name: "+ Add a household" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Test Kurup family");
    await dialog.getByLabel("People").fill("3");
    await dialog.getByRole("button", { name: "Add household" }).click();
    await page.getByLabel("Search households").fill("Kurup");
    await expect(page.getByRole("button", { name: /Test Kurup family/ }).first()).toBeVisible();
  });
});

test.describe("money", () => {
  test("the what-if previews every consequence before planning for more guests", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/budget");
    const slider = page.getByRole("slider", { name: /Guests/ });
    await slider.fill("300");
    await page.getByRole("button", { name: /Plan for 300/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Catering")).toBeVisible();
    await expect(dialog.getByText(/Projected/)).toBeVisible();
    await dialog.getByRole("button", { name: "Apply all" }).click();
    await expect(page.getByText("Planned for 300")).toBeVisible();
  });

  test("marking a payment paid moves the budget and the family split", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/budget");
    const spent = await page.getByText(/% of the plan/).textContent();
    await page.getByRole("button", { name: "Mark paid" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Mark paid" }).click();
    await expect(page.getByText(/% of the plan/)).not.toHaveText(spent ?? "");
    await page.getByRole("button", { name: /Show paid/ }).click();
    await expect(page.getByRole("button", { name: "Not paid" }).first()).toBeVisible();
  });

  test("a gift gets a thank-you and is marked thanked", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/budget");
    await page.getByRole("button", { name: "Say thank you" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Draft")).toHaveValue(/Thank you/);
    await dialog.getByRole("button", { name: "Mark thanked" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("vendors", () => {
  test("caterers are compared side by side and booking one shows what it moves", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/vendors");
    const compare = page.getByRole("region", { name: "Catering: side by side" });
    await expect(compare).toBeVisible();
    await compare.getByRole("button", { name: "Book Kerala Kitchen Caterers" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Payments")).toBeVisible();
    await dialog.getByRole("button", { name: "Apply all" }).click();
    await expect(compare.getByText("booked").first()).toBeVisible();
  });

  test("a new vendor gets a quote and an enquiry draft", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/vendors");
    await page.getByRole("button", { name: "+ Add a vendor" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("What for").fill("Mehendi artist");
    await dialog.getByRole("button", { name: "Add" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Package").fill("Bridal + 10 guests");
    await dialog.getByLabel("Amount (₹)").fill("18k");
    await dialog.getByRole("button", { name: "Add quote" }).click();
    await expect(dialog.getByText("₹18,000")).toBeVisible();
    await dialog.getByRole("button", { name: "Draft a message" }).click();
    await expect(dialog.getByLabel("Draft")).toHaveValue(/Mehendi artist|mehendi artist/);
  });
});

test.describe("the day", () => {
  test("running late moves the rest of the run sheet", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/day");
    await expect(page.getByRole("heading", { name: "Run sheet" })).toBeVisible();
    const late = page.getByRole("button", { name: "+15 min" });
    if (await late.count()) {
      await late.click();
      await expect(page.getByText(/moved 15 minutes later/)).toBeVisible();
    }
  });

  test("a family is checked in by name", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan/day");
    const checkIn = page.getByRole("region", { name: "Check-in" });
    await checkIn.getByRole("button", { name: "All in" }).first().click();
    await expect(checkIn.getByText(/ in$/).first()).toBeVisible();
  });
});

test.describe("community", () => {
  test("an expense is claimed, approved and counted", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/green-valley-mela/funds");
    await page.getByRole("button", { name: "+ Claim an expense" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("What for").fill("Stage garlands");
    await dialog.getByLabel("Amount (₹)").fill("4,500");
    await dialog.getByLabel("Paid by").fill("Meera");
    await dialog.getByRole("button", { name: /^Claim/ }).click();
    const row = page.getByRole("listitem").filter({ hasText: "Stage garlands" });
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(row.getByText("approved")).toBeVisible();
  });

  test("a permit letter is drafted and kept", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/green-valley-mela/funds");
    await page.getByRole("button", { name: "Draft letter" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Draft")).toHaveValue(/^To\nThe Station House Officer\n/);
    await expect(dialog.getByLabel("Draft")).toHaveValue(/Respected Sir/);
    await dialog.getByRole("button", { name: "Keep with the permit" }).click();
    await expect(page.getByText("letter drafted").first()).toBeVisible();
  });

  test("a volunteer joins the roster and a shift", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/green-valley-mela/volunteers");
    await page.getByLabel("Add a volunteer").fill("Test Volunteer");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Test Volunteer" })).toBeVisible();
    await page
      .getByLabel(/^Assign a volunteer to/)
      .first()
      .selectOption("Test Volunteer");
    await expect(page.locator("td").filter({ hasText: "Test Volunteer" }).first()).toBeVisible();
  });

  test("a stall request is confirmed and a pass issued", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/green-valley-mela/stalls");
    const confirm = page.getByRole("button", { name: "Confirm" });
    if (await confirm.count()) await confirm.first().click();
    await page.getByLabel("Flat or name").fill("Z-999 · Test");
    await page.getByRole("button", { name: "Issue" }).click();
    await page.getByLabel("Find a pass").fill("Z-999");
    await expect(page.getByText("Z-999 · Test")).toBeVisible();
  });
});
