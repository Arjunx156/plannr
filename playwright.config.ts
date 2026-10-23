import { defineConfig, devices } from "@playwright/test";

/**
 * Journey tests run against the production build (plus the component gallery), with
 * the clock pinned to the demo story's day and Gemini mocked per test.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@phone/ },
  ],
  webServer: {
    command: `VITE_GALLERY=1 bun x vite build && bun x vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // No key: every AI call in the tests is mocked, and the rest must work without it.
    env: { GEMINI_API_KEY: "", PLANNR_DB: "memory", PLANNR_DEV_OUTBOX: "1" },
  },
});
