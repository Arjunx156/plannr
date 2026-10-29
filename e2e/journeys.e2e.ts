import { seedEvents } from "../src/data/seed";
import {
  expect,
  expectAccessible,
  expectNoSideScroll,
  mockAi,
  signInDemo,
  signInGuest,
  test,
} from "./fixtures";

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
    const { code } = (await (await page.request.get(`/api/dev/outbox/${email}`)).json()) as { code: string };
    for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(code[i] ?? "");
    await page.getByRole("button", { name: "Verify and keep my plans" }).click();
    // The name chosen as a guest carries over, so there's nothing more to ask.
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByText("Welcome, Lakshmi.")).toBeVisible();
    await page.getByRole("button", { name: "Account" }).click();
    await expect(page.getByRole("menu", { name: "Account" })).toContainText(email);
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

  test("the overview flags an overrun from the plan's own numbers, and accepting it updates the budget", async ({
    page,
  }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan");
    const notices = page.getByRole("region", { name: "Needs attention" });
    await expect(
      notices.getByText("Catering is heading for ₹5,04,000 against ₹4,50,000 planned, 12% over."),
    ).toBeVisible();
    await notices.getByRole("button", { name: "Make ₹5,04,000 the plan" }).click();
    await expect(page.getByText(/Catering is now planned at ₹5,04,000/)).toBeVisible();
    await expect(notices.getByText(/Catering is heading for/)).toHaveCount(0);
    await page.goto("/events/ananya-rohan/budget");
    await expect(page.getByRole("button", { name: /Catering/ }).first()).toContainText("₹5,04,000");
  });

  test("a notice can be put off for now", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/green-valley-mela");
    const notices = page.getByRole("region", { name: "Needs attention" });
    const claims = notices.getByRole("article").filter({ hasText: "expense claims to decide" });
    await expect(claims).toBeVisible();
    await claims.getByRole("button", { name: "Not now" }).click();
    await expect(claims).toHaveCount(0);
    await page.reload();
    await expect(notices.getByText("expense claims to decide")).toHaveCount(0);
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

test.describe("planning together", () => {
  test("an invite brings in a co-planner whose changes reach the owner, and can be undone", async ({
    page,
    browser,
  }) => {
    await signInGuest(page, "Priya");
    const wedding = seedEvents()[0];
    if (!wedding) throw new Error("seed has a wedding");
    const id = `wedding-${Date.now().toString(36)}`;
    const created = await page.request.post("/api/events", { data: { event: { ...wedding, id } } });
    expect(created.status()).toBe(201);

    await page.goto(`/events/${id}/people`);
    await expect(page.getByText("Priya (you)")).toBeVisible();
    await page.getByLabel("Side (optional)").fill("Groom's side");
    await page.getByRole("button", { name: "Create invite link" }).click();
    const link = await page.getByLabel(/Invite link/).inputValue();
    expect(link).toMatch(/\/join\/[\w-]+$/);

    // Priya keeps the task list open while Rohan joins and works.
    await page.goto(`/events/${id}/tasks`);
    await page.getByRole("button", { name: "All", exact: true }).click();
    const task = page.getByLabel("Finalise guest list with both families");
    await expect(task).not.toBeChecked();

    const rohanContext = await browser.newContext();
    const rohan = await rohanContext.newPage();
    await rohan.clock.setFixedTime(new Date("2026-09-27T18:00:00+05:30"));
    await rohan.goto(link);
    await expect(
      rohan.getByRole("heading", { name: `Priya invited you to plan ${wedding.name}` }),
    ).toBeVisible();
    await expect(rohan.getByText("Co-planner · Groom's side")).toBeVisible();
    await rohan.getByLabel("Your name").fill("Rohan");
    await rohan.getByRole("button", { name: "Join the plan" }).click();
    await expect(rohan).toHaveURL(new RegExp(`/events/${id}$`));
    await rohan.getByLabel("Finalise guest list with both families").check();
    await expect(rohan.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

    // Priya sees it within a few seconds, without reloading.
    await expect(task).toBeChecked({ timeout: 15_000 });

    await page.getByRole("link", { name: "Inbox" }).click();
    await expect(page.getByText("Rohan: Ticked off “Finalise guest list with both families”")).toBeVisible();

    await page.goto(`/events/${id}/history`);
    await page
      .getByRole("button", { name: "Undo Ticked off “Finalise guest list with both families”" })
      .click();
    await expect(page.getByText("Undid: Ticked off “Finalise guest list with both families”")).toBeVisible();
    await page.getByRole("link", { name: "Tasks", exact: true }).click();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(task).not.toBeChecked();
    await rohanContext.close();
  });
});

test.describe("finding your way", () => {
  test("⌘K finds a task and opens it beside the plan", async ({ page }) => {
    await signInDemo(page);
    await expect(page.getByRole("heading", { name: "My events" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByRole("combobox", { name: "Search events, tasks and commands" });
    await search.fill("guest list");
    await expect(page.getByRole("option", { name: /Finalise guest list with both families/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/\/events\/ananya-rohan\/tasks\?task=/);
    await expect(page.getByLabel("Title")).toHaveValue("Finalise guest list with both families");
    await page.getByLabel("Note").fill("Amma has the final list");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Amma has the final list").first()).toBeVisible();

    // A sheet closed with Escape hands the keyboard back: ⌘K opens again.
    await page.getByRole("button", { name: "Book photographer" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Book photographer");
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/task=/);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(search).toBeVisible();
    await expect(search).toBeFocused();
  });

  test("Today gathers what's due across every event", async ({ page }) => {
    await signInDemo(page);
    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Next 7 days" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Coming up" })).toContainText("Ananya & Rohan's wedding");
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
    await page.goto("/join/not-a-real-invite");
    await expect(page.getByRole("heading", { name: "This invite link isn't valid." })).toBeVisible();
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
    "/events/ananya-rohan/tasks",
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
