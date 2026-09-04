import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "local.spec.ts", fullyParallel: false, workers: 1,
  use: { baseURL: "http://127.0.0.1:3101", screenshot: "only-on-failure", trace: "retain-on-failure", contextOptions: { reducedMotion: "reduce" }, locale: "es-ES" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }, { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }],
  webServer: [
    { command: "node e2e/mock-supabase.mjs", url: "http://127.0.0.1:3199/health", reuseExistingServer: false },
    { command: "npm run dev -- --hostname 127.0.0.1 --port 3101", url: "http://127.0.0.1:3101/login", timeout: 120000,
      env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3199", NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-public-key", NUTRITION_AI_ENABLED: "false", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3101" }, reuseExistingServer: false },
  ],
});
