import { defineConfig, devices } from "@playwright/test";

// Runs against the production build on the HF Space port. /api/check and postcodes.io are mocked in
// each spec, so no model or network is needed. PLAYWRIGHT_CHROMIUM_PATH points at a preinstalled
// Chromium when the bundled one is not downloaded.
const PORT = 7860;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "pnpm build && pnpm start" : "pnpm start",
        url: BASE,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
});
