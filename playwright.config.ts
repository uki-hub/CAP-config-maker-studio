import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: 'browser.spec.ts',
  timeout: 45000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: './test-results/browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1600, height: 1000 }, channel: 'chromium', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120000 },
})
