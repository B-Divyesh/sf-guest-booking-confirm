import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: "npm run build && rm -f /tmp/gbc-playwright.db && DATABASE_URL=sqlite:/tmp/gbc-playwright.db PORT=4173 cargo run",
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    {
      name: 'chromium-desktop',
      grep: /unknown routes/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } }
    }
  ]
});
