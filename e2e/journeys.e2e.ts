import { expect, expectAccessible, expectNoSideScroll, mockAi, signInDemo, test } from "./fixtures";

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
    await page.getByLabel("Mobile number").fill("9847012345");
    await page.getByRole("button", { name: "Send code by SMS" }).click();
    for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i}`).fill(String(i));
    await page.getByRole("button", { name: "Verify and save plan" }).click();

    await expect(page).toHaveURL(/\/onboarding\?next=accept/);
    await page.getByRole("button", { name: "Continue to my plan" }).click();

    await expect(page).toHaveURL(/\/events\/meera-arjuns-wedding-/);
    await expect(page.getByRole("heading", { level: 1, name: "Meera & Arjun's wedding" })).toBeVisible();
    await expectNoSideScroll(page);
  });

  test("Gemini fills what the parser misses, then adds notes to the plan", async ({ page }) => {
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
    await expect(page.getByText("Check the ramps")).toBeVisible();
    await expect(page.getByText("January is peak wedding season.")).toBeVisible();
  });
});

test.describe("running an event", () => {
  test("ticking a task can be undone", async ({ page }) => {
    await signInDemo(page);
    await page.getByRole("link", { name: /Ananya & Rohan's wedding/ }).click();
    const task = page.getByLabel("Finalise guest list with both families");
    await task.check();
    await expect(page.getByText("Done: Finalise guest list with both families")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(task).not.toBeChecked();
  });

  test("the assistant previews a change and applies it only on approval", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan");
    const assistant = page.getByRole("region", { name: "Plannr assistant" });
    const apply = assistant.getByRole("button", { name: "Apply changes" });
    const before = await apply.count();

    await assistant.getByLabel("Ask about this event").fill("Move the haldi to Friday and update the tasks");
    await assistant.getByRole("button", { name: "Send" }).click();
    await expect(apply).toHaveCount(before + 1);
    await apply.last().click();

    await expect(page.getByText("Applied: Haldi. The plan and its tasks are updated.")).toBeVisible();
    await expect(page.getByText("Fri 23 Apr · 5:00 pm")).toBeVisible();
  });

  test("questions go to Gemini with the live plan when AI is on", async ({ page }) => {
    await mockAi(page, {
      assistant: { text: "Catering is ₹54,000 over plan.", source: "From the Sree Annapoorna quote." },
    });
    await signInDemo(page);
    await page.goto("/events/ananya-rohan");
    const assistant = page.getByRole("region", { name: "Plannr assistant" });
    await expect(assistant.getByText("Gemini · live plan")).toBeVisible();
    const sent = page.waitForRequest("**/api/ai/assistant");
    await assistant.getByLabel("Ask about this event").fill("Where are we over budget?");
    await assistant.getByRole("button", { name: "Send" }).click();
    const body = (await sent).postDataJSON() as { facts: { budget: { total: number } } };
    expect(body.facts.budget.total).toBe(1800000);
    await expect(assistant.getByText("Catering is ₹54,000 over plan.")).toBeVisible();
    await expect(assistant.getByText("From the Sree Annapoorna quote.")).toBeVisible();
  });

  test("approving a guest-list change updates the plan", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan");
    await page.getByRole("button", { name: "Review 3 changes" }).click();
    await expect(
      page.getByText("Applied: catering, invitations and seating now plan for 268."),
    ).toBeVisible();
  });

  test("a committee approves an expense and fills a shift", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/green-valley-mela");
    const funds = page.locator("#approvals");
    await funds.getByRole("button", { name: "Approve" }).first().click();
    await expect(funds.getByText("approved", { exact: true })).toBeVisible();
    const assign = page.getByLabel(/Assign a volunteer to Food safety/).first();
    const name = await assign.locator("option").nth(1).textContent();
    await assign.selectOption({ index: 1 });
    await expect(page.locator("table").getByText(name ?? "")).not.toHaveCount(0);
  });
});

test.describe("dead ends", () => {
  test("unknown events and pages offer a way back", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/not-a-real-event");
    await expect(page.getByRole("heading", { name: "We couldn't find that event" })).toBeVisible();
    await page.goto("/nowhere");
    await expect(page.getByRole("heading", { name: "This page isn't part of the plan" })).toBeVisible();
  });

  test("signed-out visitors are sent to sign in", async ({ page }) => {
    await page.goto("/events/ananya-rohan");
    await expect(page).toHaveURL(/\/signin\?next=\/events\/ananya-rohan/);
  });
});

test.describe("search engines and sharing", () => {
  test("the landing page describes itself; signed-in pages ask not to be indexed", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Plannr · Describe the day, get a plan you can run");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /wedding, birthday or community/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og\.png$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await signInDemo(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    const robots = await page.request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /events");
  });
});

test.describe("accessibility and layout", () => {
  for (const path of ["/", "/new", "/gallery"]) {
    test(`${path} has no serious accessibility problems @phone`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page);
      await expectNoSideScroll(page);
    });
  }

  for (const path of ["/events", "/events/ananya-rohan", "/events/green-valley-mela", "/events/aarav-6"]) {
    test(`${path} has no serious accessibility problems @phone`, async ({ page }) => {
      await signInDemo(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page);
      await expectNoSideScroll(page);
    });
  }

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
