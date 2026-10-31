/** Finding your way: search, dead ends, what search engines see, and shared pages. */
import { seedEvents } from "../src/data/seed";
import { present } from "../tests/support";
import { expect, signInDemo, signInGuest, test } from "./fixtures";

test.describe("finding your way", () => {
  test("⌘K finds a task and opens it beside the plan", async ({ page }) => {
    await signInDemo(page);
    await expect(page.getByRole("heading", { name: "My events" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByRole("combobox", { name: "Search events, tasks and commands" });
    await search.fill("guest list");
    await expect(page.getByRole("option", { name: /Finalise guest list with both families/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/\/events\/ananya-rohan\/timeline\?task=/);
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

test.describe("sharing a page", () => {
  test("WhatsApp opens in its own tab with the link, cut off from Plannr, and Plannr stays put", async ({
    page,
  }) => {
    await signInGuest(page, "Rekha");
    const ev = {
      ...present(seedEvents().find((e) => e.id === "green-valley-mela")),
      id: `mela-${Date.now()}`,
    };
    expect((await page.request.post("/api/events", { data: { event: ev } })).status()).toBe(201);
    // WhatsApp itself is out of reach in tests; a stand-in page answers instead.
    await page.context().route("https://wa.me/**", (r) => r.fulfill({ body: "WhatsApp" }));

    await page.goto(`/events/${ev.id}/volunteers`);
    const opened = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Share the sign-up sheet on WhatsApp" }).click();
    const whatsapp = await opened;
    await whatsapp.waitForURL(/^https:\/\/wa\.me\//);
    const text = new URL(whatsapp.url()).searchParams.get("text") ?? "";
    expect(text).toContain("Volunteers needed");
    expect(text).toMatch(/\/s\/[\w-]+$/);
    // The new tab can't reach back into Plannr, and Plannr didn't navigate away.
    expect(await whatsapp.evaluate(() => window.opener)).toBeNull();
    await expect(page).toHaveURL(new RegExp(`/events/${ev.id}/volunteers$`));
  });
});
