import { defineConfig, devices } from "@playwright/test";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is required for the disposable Supabase browser suite.");
  return value;
}

if (required("SUPABASE_TEST_DISPOSABLE") !== "true") {
  throw new Error("Refusing real browser mutations without SUPABASE_TEST_DISPOSABLE=true.");
}

const supabaseUrl = required("SUPABASE_TEST_URL");
const publishableKey = required("SUPABASE_TEST_PUBLISHABLE_KEY");
const projectRef = required("SUPABASE_TEST_PROJECT_REF");
const testEmail = required("SUPABASE_TEST_USER_A_EMAIL");
const testPassword = required("SUPABASE_TEST_USER_A_PASSWORD");
const parsed = new URL(supabaseUrl);
if (parsed.hostname.endsWith(".supabase.co")) {
  if (parsed.hostname.split(".")[0] !== projectRef || projectRef === "dbrxphegxhkjfakqljdr") {
    throw new Error("Refusing to run against a URL other than the declared disposable test project.");
  }
} else if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
  throw new Error("Use local Supabase or a dedicated disposable cloud project.");
}

const port = 4175;
const baseURL = "http://127.0.0.1:" + port;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "supabase-workflow.spec.ts",
  timeout: 60_000,
  use: { baseURL, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port " + port,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_REQUIRE_AUTH: "true",
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      E2E_EMAIL: testEmail,
      E2E_PASSWORD: testPassword,
    },
  },
});
