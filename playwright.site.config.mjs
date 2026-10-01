import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: ['site.spec.mjs', 'comparison.spec.mjs'], fullyParallel: true, workers: 3, reporter: 'list',
  use: { baseURL: process.env.DEMO_URL || 'http://127.0.0.1:4178/agent-or-human/', reducedMotion: 'reduce' },
  webServer: process.env.DEMO_URL ? undefined : { command: 'node scripts/serve-site.mjs', url: 'http://127.0.0.1:4178/agent-or-human/', reuseExistingServer: !process.env.CI },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
});
