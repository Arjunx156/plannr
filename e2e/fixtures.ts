import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/** Sunday 27 Sep 2026, 6 pm in Kochi: the day the demo story is written for. */
export const STORY_TIME = new Date("2026-09-27T18:00:00+05:30");

export interface AiMocks {
  intake?: Record<string, unknown>;
  assistant?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  ideas?: Record<string, unknown>;
}

/** Turns Gemini on for this page and answers each route with a canned reply. */
export async function mockAi(page: Page, mocks: AiMocks) {
  await page.route("**/api/ai/status", (r) => r.fulfill({ json: { enabled: true, model: "test" } }));
  for (const [route, body] of Object.entries(mocks))
    await page.route(`**/api/ai/${route}`, (r) => r.fulfill({ json: body }));
}

/** Starts in the demo, with the sample events seeded in this browser. */
export async function signInDemo(page: Page) {
  await page.goto("/signin?next=/events");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/events$/);
}

/** Starts a real guest account on the test server, named so co-planners can tell who's who. */
export async function signInGuest(page: Page, name: string) {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue as a guest" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Continue to my events" }).click();
  await expect(page).toHaveURL(/\/events$/);
}

/** Fails on serious or critical WCAG A/AA problems. */
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
  ).toEqual([]);
}

export async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text());
      });
      await page.clock.setFixedTime(STORY_TIME);
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
