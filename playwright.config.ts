import { defineConfig } from '@playwright/test';

/** Runs against the built site, served under the GitHub Pages base path. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173/SecretEngerl/',
    locale: 'de-AT',
    // A preinstalled browser can be used instead of `playwright install` (e.g. in a sandbox).
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/SecretEngerl/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
