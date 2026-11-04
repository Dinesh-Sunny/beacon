import { defineConfig, devices } from "@playwright/test";

// Front-end tests only. Every /api/* call to the Meta models is mocked inside each spec, so the
// tests run without a key or network. PLAYWRIGHT_CHROMIUM_PATH points at a preinstalled Chromium.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm dev", url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 120_000 },
});
