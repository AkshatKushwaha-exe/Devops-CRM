import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3011", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "../backend/.venv/bin/python ../scripts/e2e_server.py",
      url: "http://127.0.0.1:8011/ready",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "pnpm exec vite --host 127.0.0.1 --port 3011 --strictPort",
      env: { API_PROXY_TARGET: "http://127.0.0.1:8011" },
      url: "http://127.0.0.1:3011",
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
