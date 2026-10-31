/** Running an event: the day-to-day, planning with others, and the next year. */
import { z } from "zod";
import { seedEvents } from "../src/data/seed";
import { present } from "../tests/support";
import { expect, mockAi, signInDemo, signInGuest, test } from "./fixtures";

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
    // The saved conversation already holds a proposal; count only once the panel has drawn it.
    await expect(assistant.getByLabel("Ask about this event")).toBeVisible();
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
    const body = z
      .object({ facts: z.object({ budget: z.object({ total: z.number() }) }) })
      .parse((await sent).postDataJSON());
    expect(body.facts.budget.total).toBe(1800000);
    await expect(assistant.getByText("Catering is ₹54,000 over plan.")).toBeVisible();
    await expect(assistant.getByText("From the Sree Annapoorna quote.")).toBeVisible();
  });

  test("the answer streams in as it's written, and proposed changes wait for approval", async ({ page }) => {
    await mockAi(page, {});
    const events = [
      `event: text\ndata: ${JSON.stringify({ text: "I've proposed " })}\n\n`,
      `event: text\ndata: ${JSON.stringify({ text: "I've proposed adding the task." })}\n\n`,
      `event: done\ndata: ${JSON.stringify({
        text: "I've proposed adding the task.",
        actions: [{ kind: "addTask", title: "Call the florist about jasmine" }],
      })}\n\n`,
    ].join("");
    await page.route("**/api/ai/assistant/stream", (r) =>
      r.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: events }),
    );
    await signInDemo(page);
    await page.goto("/events/ananya-rohan");
    const assistant = page.getByRole("region", { name: "Plannr assistant" });
    await assistant.getByLabel("Ask about this event").fill("Add a task to call the florist");
    await assistant.getByRole("button", { name: "Send" }).click();
    await expect(assistant.getByText("I've proposed adding the task.")).toBeVisible();
    await expect(assistant.getByText(/Call the florist about jasmine/)).toBeVisible();
    await assistant.getByRole("button", { name: "Apply all" }).click();
    await expect(assistant.getByText("✓ Applied")).toBeVisible();
    await page.goto("/events/ananya-rohan/timeline");
    await expect(page.getByText("Call the florist about jasmine")).toBeVisible();
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
    await page.goto(`/events/${id}/timeline`);
    await page.getByRole("button", { name: "Task list" }).click();
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
    await page.getByRole("link", { name: "Timeline", exact: true }).click();
    await page.getByRole("button", { name: "Task list" }).click();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(task).not.toBeChecked();
    await rohanContext.close();
  });
});

test.describe("year after year", () => {
  test("an event is saved as a template and next year's starts from it", async ({ page }) => {
    await signInGuest(page, "Meera");
    const ev = {
      ...present(seedEvents().find((e) => e.id === "green-valley-mela")),
      id: `mela-${Date.now()}`,
    };
    const made = await page.request.post("/api/events", { data: { event: ev } });
    expect(made.status()).toBe(201);
    await page.goto(`/events/${ev.id}/settings`);
    await page.getByRole("button", { name: "Save as a template" }).click();
    await expect(page.getByText(/Saved\. Start your next event from it/)).toBeVisible();

    await page.goto("/events");
    await page.getByRole("button", { name: "From a template" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Use" }).first().click();
    await dialog.getByLabel("Name").fill("Green Valley Mela 2027");
    await dialog.getByRole("button", { name: "Create the event" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Green Valley Mela 2027" })).toBeVisible();
    // Last year's answers and money are cleared; its shape and costs carry over.
    await page.goto(page.url().replace(/\/?$/, "/funds"));
    await expect(page.getByText("No claims yet.")).toBeVisible();
  });

  test("the admin page is hidden from ordinary accounts", async ({ page }) => {
    await signInGuest(page, "Ravi");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });
});
