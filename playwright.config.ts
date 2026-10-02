import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4174);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "tyre-management.spec.ts",
  timeout: 30_000,
  use: { baseURL, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  // Keep browser tests focused on the app shell; their API is mocked and local
  // auth settings must not strand the suite on the sign-in screen.
  webServer: { command: `VITE_REQUIRE_AUTH=false npm run dev -- --host 127.0.0.1 --port ${port}`, url: baseURL, reuseExistingServer: true, timeout: 120_000 },
  reporter: [["list"], ["html", { open: "never" }]],
});
