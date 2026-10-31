/**
 * Pages that adapt to the person reading them: a narrow or zoomed screen, a request for less motion, a
 * high contrast theme, a keyboard instead of a mouse, and a screen reader finding its way by landmarks.
 */
import type { Locator, Page } from "@playwright/test";
import { expect, expectAccessible, expectNoSideScroll, signInDemo, test } from "./fixtures";

const PUBLIC = ["/", "/new", "/signin", "/guides", "/tools/festival-checklist"];
const SIGNED_IN = [
  "/events",
  "/events/ananya-rohan",
  "/events/ananya-rohan/guests",
  "/events/ananya-rohan/budget",
  "/events/ananya-rohan/timeline",
  "/events/ananya-rohan/day",
  "/events/green-valley-mela",
  "/events/green-valley-mela/funds",
  "/events/aarav-6",
  "/today",
  "/inbox",
];

/** Signs in to the demo, then opens each main page in turn and runs `check` on it. */
async function everyPage(page: Page, check: (path: string) => Promise<void>): Promise<void> {
  // Sixteen pages in one test, so the browser and the demo start once.
  test.setTimeout(120_000);
  await signInDemo(page);
  for (const path of [...PUBLIC, ...SIGNED_IN]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await check(path);
  }
}

test.describe("on a 320 pixel screen (WCAG 1.4.10)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("every main page reflows without scrolling sideways", async ({ page }) => {
    await everyPage(page, () => expectNoSideScroll(page));
  });
});

test.describe("zoomed to 200% (WCAG 1.4.4)", () => {
  // What a 1280 pixel window shows at 200% zoom: half the CSS pixels, each drawn twice the size.
  test.use({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 });

  test("every main page still fits its width", async ({ page }) => {
    await everyPage(page, () => expectNoSideScroll(page));
  });
});

test.describe("for people who ask for less motion", () => {
  test("nothing keeps moving on any main page", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await everyPage(page, async (path) => {
      const running = () =>
        page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
      await expect.poll(running, { message: `animations still running on ${path}` }).toBe(0);
    });
  });
});

test.describe("in a high contrast theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
  });

  test("progress bars keep a fill that stands out from their track", async ({ page }) => {
    await signInDemo(page);
    await page.goto("/events/ananya-rohan");
    const bar = page.getByRole("progressbar", { name: "Budget" });
    const [fill, track] = await bar.evaluate((el) => [
      getComputedStyle(el.firstElementChild ?? el).backgroundColor,
      getComputedStyle(el).backgroundColor,
    ]);
    expect(fill).not.toBe(track);
  });

  test("the main pages pass the accessibility checks", async ({ page }) => {
    // Four full axe scans in one test.
    test.slow();
    await signInDemo(page);
    for (const path of ["/", "/events", "/events/ananya-rohan", "/events/green-valley-mela/funds"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // The theme sets every colour here, and axe measures the page's own colours rather than the
      // theme's, so its contrast rule can't judge this mode. Every other rule still runs.
      await expectAccessible(page, ["color-contrast"]);
    }
  });
});

/** Whether the focused element shows a ring: its own outline, or its frame's when it has none. */
function focusShown(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    // Past the last control, focus moves to the browser itself.
    if (!el || el === document.body) return true;
    const ring = (e: Element) => {
      const s = getComputedStyle(e);
      return s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) >= 2;
    };
    const frame = el.closest(".focus-frame, .field");
    return (
      ring(el) ||
      (frame !== null && (ring(frame) || Number.parseFloat(getComputedStyle(frame).borderTopWidth) >= 2))
    );
  });
}

/** Presses Tab until `target` has focus, failing at any stop on the way that shows no focus ring. */
async function tabTo(page: Page, target: Locator, most = 40): Promise<void> {
  for (let stop = 1; stop <= most; stop++) {
    await page.keyboard.press("Tab");
    expect(await focusShown(page), `focus ring at stop ${stop}`).toBe(true);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`${target} wasn't reached in ${most} presses of Tab`);
}

test.describe("with only a keyboard", () => {
  test("a plan can be started from the first page, with a visible focus ring at every stop", async ({
    page,
  }) => {
    await page.goto("/");
    await tabTo(page, page.locator("#hero-prompt"));
    await page.keyboard.type(
      "Wedding in Kochi for Meera and Arjun, 250 guests, ₹18 lakh, end of April next year",
    );
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/new$/);
    const notStarted = page.getByRole("button", { name: "Not started" });
    await expect(notStarted).toBeVisible();
    await tabTo(page, notStarted);
    await page.keyboard.press("Enter");

    const draft = page.getByRole("button", { name: "Draft my plan" });
    await expect(draft).toBeVisible();
    await tabTo(page, draft);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "The plan for Meera & Arjun" })).toBeVisible();
  });
});

test.describe("for screen reader users", () => {
  test("the first page has its landmarks, its one top heading and the box to start in", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toMatchAriaSnapshot(`
      - link "Skip to content"
      - banner:
        - navigation "Main"
        - heading "Describe your event. Get a plan you can actually run." [level=1]
        - textbox "Describe your event"
        - button "Start planning"
      - main
      - contentinfo
    `);
  });

  test("the event list and an event's overview keep their landmarks and headings", async ({ page }) => {
    await signInDemo(page);
    await expect(page.locator("body")).toMatchAriaSnapshot(`
      - link "Skip to content"
      - banner:
        - link "Plannr home"
        - navigation "Main"
      - main:
        - heading "My events" [level=1]
        - region "Upcoming"
        - region "Past events"
    `);
    await page.goto("/events/ananya-rohan");
    await expect(page.locator("body")).toMatchAriaSnapshot(`
      - link "Skip to content"
      - banner
      - navigation "Event sections"
      - main:
        - heading "Ananya & Rohan's wedding" [level=1]
        - progressbar "Readiness"
        - progressbar "Budget"
        - region "Needs attention"
        - heading "Functions" [level=2]
        - heading "Budget" [level=2]
      - complementary:
        - region "Plannr assistant"
    `);
  });
});
