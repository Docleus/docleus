import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT, E2E_RESULTS } from "./tests/e2e/global-setup.ts";

// The global setup builds and starts the server itself, because the tests
// need the setup token that the first boot prints.
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Traces stay out of the repository.
  outputDir: E2E_RESULTS,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL: `http://127.0.0.1:${String(E2E_PORT)}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
