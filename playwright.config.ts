import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  // Performance has a separately executed production-build bootstrap (npm run test:performance).
  testIgnore: process.env.LOVER_E2E_PRODUCTION === "1" ? undefined : ["**/performance.spec.ts"],
  workers: 1,
  maxFailures: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://127.0.0.1:5175", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, {
    name: "mobile",
    use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
  }],
  reporter: [["list"], ["json", {
    outputFile: "artifacts/browser-results.json",
  }]],
});
