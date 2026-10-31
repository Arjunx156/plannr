/** Starting a plan, and the brief: budgets, timelines, vendor checklists and ideas. */
import { z } from "zod";
import { expect, expectNoSideScroll, mockAi, signInDemo, signInGuest, test } from "./fixtures";

test.describe("planning a new event", () => {
  test("a guest goes from one sentence to a live dashboard @phone", async ({ page }) => {
    await page.goto("/");
    await page
      .locator("#hero-prompt")
      .fill(
        "Kerala-style wedding in Kochi for Meera and Arjun, around 250 guests, ₹18 lakh, end of April next year",
      );
    await page.locator("#hero-prompt").press("Enter");

    await expect(page).toHaveURL(/\/new$/);
    const understood = page.getByRole("complementary", { name: "What Plannr understood" });
    await expect(understood).toContainText("Kochi");
    await expect(understood).toContainText("About 250");
    await expect(understood).toContainText("₹18,00,000");

    await page.getByRole("button", { name: "Not started" }).click();
    await expect(page.getByText(/I'll put venue visits in the first week/)).toBeVisible();
    await page.getByRole("button", { name: "Draft my plan" }).click();

    await expect(page.getByRole("heading", { name: "The plan for Meera & Arjun" })).toBeVisible();
    await expect(page.getByText("₹18,00,000").first()).toBeVisible();
    // Gemini is off in this test, so the AI notes stay hidden rather than spinning.
    await expect(page.getByRole("heading", { name: "Plannr's notes" })).toHaveCount(0);
    await page.getByRole("button", { name: "Accept and start planning" }).click();

    await expect(page).toHaveURL(/\/signup\?next=accept/);
    await page.getByRole("button", { name: "Continue as a guest" }).click();

    await expect(page).toHaveURL(/\/onboarding\?next=accept/);
    await page.getByLabel("Your name").fill("Meera");
    await page.getByRole("button", { name: "Continue to my plan" }).click();

    await expect(page).toHaveURL(/\/events\/meera-arjuns-wedding-/);
    const heading = page.getByRole("heading", { level: 1, name: "Meera & Arjun's wedding" });
    await expect(heading).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await expectNoSideScroll(page);

    // The plan lives on the server: a browser that forgot everything gets it back.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(heading).toBeVisible();
  });

  test("signing in with an email code works and keeps the plans", async ({ page }) => {
    await signInGuest(page, "Lakshmi");
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Keep your plans on every device" }).click();
    await expect(page.getByRole("heading", { name: "Keep your plans safe" })).toBeVisible();
    const email = `lakshmi-${Date.now()}@example.com`;
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a code" }).click();
    const outbox = await (await page.request.get(`/api/dev/outbox/${email}`)).json();
    const { code } = z.object({ code: z.string() }).parse(outbox);
    for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(code[i] ?? "");
    await page.getByRole("button", { name: "Verify and keep my plans" }).click();
    // The name chosen as a guest carries over, so there's nothing more to ask.
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByText("Welcome, Lakshmi.")).toBeVisible();
    await page.getByRole("button", { name: "Account" }).click();
    await expect(page.getByRole("menu", { name: "Account" })).toContainText(email);
  });

  test("Gemini fills what the parser misses, drafts the split, dates and vendors, and its ideas start the board", async ({
    page,
  }) => {
    await mockAi(page, {
      intake: {
        kind: "wedding",
        city: "Palakkad",
        guests: 300,
        budget: 2500000,
        functions: [],
        needs: [],
        moods: [],
        colours: [],
        coPlanners: [],
        reply: "Palakkad in January sounds lovely.",
      },
      plan: {
        summary: "Two functions in Palakkad for 300 guests.",
        tips: [{ title: "Check the ramps", detail: "Visit the venue with the wheelchair route in mind." }],
        watchouts: ["January is peak wedding season."],
        ideas: ["Tender coconut welcome drinks"],
        budget: [
          { name: "Sadhya catering", percent: 36, why: "Food for 300 is where the money goes in Palakkad." },
          { name: "Venue", percent: 20, why: "A mandapam for 300 in January." },
          { name: "Décor", percent: 14, why: "Jasmine and kasavu, kept simple." },
          { name: "Photography & video", percent: 12, why: "One team for both functions." },
          { name: "Attire & jewellery", percent: 12, why: "The bride's family's call." },
          { name: "Contingency", percent: 6, why: "January is peak season; prices move." },
        ],
        timeline: [
          { title: "Book the kalyana mandapam", due: "2026-10-05", why: "January halls go a season ahead." },
          { title: "Taste two sadhya caterers", due: "2026-10-20", why: "Before the menu is fixed." },
          { title: "Send the invitations", due: "2026-11-20", why: "Six weeks out for family abroad." },
        ],
        vendors: [
          { name: "Sadhya caterer", why: "Food is the priority." },
          { name: "Venue", why: "Everything keys off the hall." },
          { name: "Nadaswaram", why: "For the muhurtham." },
        ],
      },
    });
    await page.goto("/new?fresh=1");
    await page
      .getByLabel("Message Plannr")
      .fill("Our wedding in the town where my grandparents live, in January");
    await page.getByLabel("Message Plannr").press("Enter");

    await expect(page.getByText("Palakkad in January sounds lovely.")).toBeVisible();
    const understood = page.getByRole("complementary", { name: "What Plannr understood" });
    await expect(understood).toContainText("Palakkad");
    await expect(understood).toContainText("About 300");

    await page.getByRole("button", { name: "Draft my plan" }).click();
    await expect(page.getByRole("heading", { name: "Plannr's notes" })).toBeVisible();
    // The split, the dates and the vendors are Gemini's, each with its reason, and say so.
    await expect(page.getByText("◆ Drafted by Gemini")).toHaveCount(3);
    await expect(page.getByText("Food for 300 is where the money goes in Palakkad.")).toBeVisible();
    await expect(page.getByText("Book the kalyana mandapam")).toBeVisible();
    await expect(page.getByText("Check the ramps")).toBeVisible();
    await expect(page.getByText("January is peak wedding season.")).toBeVisible();

    // The ideas survive signing up on the way to accepting, and start the new event's board.
    await page.getByRole("button", { name: "Accept and start planning" }).click();
    await page.getByRole("button", { name: "Continue as a guest" }).click();
    await page.getByLabel("Your name").fill("Lakshmi");
    await page.getByRole("button", { name: "Continue to my plan" }).click();
    await expect(page).toHaveURL(/\/events\/[^/]+$/);
    await page.getByRole("link", { name: "Ideas", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Ideas board" }).getByText("Tender coconut welcome drinks"),
    ).toBeVisible();
    // Gemini's dated tasks are the live plan's first tasks.
    await page.getByRole("link", { name: "Timeline", exact: true }).click();
    await expect(page.getByText("Book the kalyana mandapam")).toBeVisible();
  });
});

test.describe("the brief: budgets, timelines, vendor checklists and personalised ideas", () => {
  test("the timeline puts tasks, payments and bookings in phases, and shows where today falls", async ({
    page,
  }) => {
    await signInDemo(page);
    await page.goto("/events/aarav-6/timeline");
    await expect(page.getByRole("heading", { name: "Timeline", level: 1 })).toBeVisible();
    const month = page.getByRole("region", { name: "The final month" });
    await expect(month.getByText("you are here")).toBeVisible();
    await expect(month.getByRole("link", { name: "Book entertainment" })).toBeVisible();
    await expect(month.getByText("Book · late")).toBeVisible();
    await expect(page.getByRole("region", { name: "The day" }).getByText("The party")).toBeVisible();
    // Old links to the task list still work.
    await page.goto("/events/aarav-6/tasks");
    await expect(page).toHaveURL(/\/events\/aarav-6\/timeline$/);
  });

  test("the vendor checklist ticks off bookings and starts the next search", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/aarav-6/vendors");
    const checklist = page.getByRole("region", { name: "Vendor checklist" });
    await expect(checklist.getByText("2 of 7 booked")).toBeVisible();
    await expect(checklist.getByText("1 past their book-by date")).toBeVisible();
    await expect(checklist.getByText("Late: book now")).toBeVisible();
    await checklist.getByRole("button", { name: "Start looking for Photography" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(checklist.getByRole("button", { name: "Open Photography" })).toBeVisible();
  });

  test("ideas answer the family's own notes, and planning one adds its task", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/aarav-6/ideas");
    await page.getByRole("button", { name: "Suggest ideas" }).click();
    await expect(page.getByText(/came from the rules on this device/)).toBeVisible();
    const board = page.getByRole("region", { name: "Ideas board" });
    await expect(board.getByText("Your note: “Everything nut-free: Kabir is allergic”")).toBeVisible();
    await board.getByRole("button", { name: "Plan it: Allergy labels on every dish" }).click();
    await expect(board.getByText("in the plan", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Timeline", exact: true }).click();
    await expect(page.getByText("Arrange: Allergy labels on every dish")).toBeVisible();
  });

  test("Plannr AI writes ideas that say why, when it's on", async ({ page }) => {
    await mockAi(page, {
      ideas: {
        ideas: [
          {
            title: "Rocket countdown for the cake",
            detail: "Everyone counts down from ten before Aarav blows out the candles.",
            because: "A space-themed sixth birthday",
            effort: "low",
          },
        ],
      },
    });
    await signInDemo(page);
    await page.goto("/events/aarav-6/ideas");
    await page.getByRole("button", { name: "Suggest ideas" }).click();
    await expect(page.getByText("Added 1 idea picked for this event.")).toBeVisible();
    const board = page.getByRole("region", { name: "Ideas board" });
    await expect(board.getByText("Rocket countdown for the cake", { exact: true })).toBeVisible();
    await expect(board.getByText("A space-themed sixth birthday")).toBeVisible();
  });
});
