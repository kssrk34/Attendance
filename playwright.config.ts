import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Running against a far-away database (e.g. Neon from a laptop)? Set E2E_SLOW=1 for longer waits.
const SLOW = !!process.env.E2E_SLOW;

/**
 * E2E tests run against a production build and a seeded local database.
 * The global setup re-runs the seed so every run starts from the same demo data.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: SLOW ? 300_000 : 60_000,
  expect: { timeout: SLOW ? 60_000 : 10_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
