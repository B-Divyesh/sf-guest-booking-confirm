import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: "npm run build && db_dir=$(mktemp -d /tmp/gbc-playwright-XXXXXX) && TEST_ENTRA_OID=playwright-sociobot-entra-user DATABASE_URL=sqlite:$db_dir/app.db PORT=4173 cargo run",
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium-desktop',
      grep: /@desktop-only|unknown routes/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } }
    },
    { name: 'chromium-mobile', grepInvert: /@desktop-only/, use: { ...devices['iPhone 13'], browserName: 'chromium' } }
  ]
});
