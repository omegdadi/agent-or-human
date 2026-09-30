import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'inputs.spec.mjs', fullyParallel: true, workers: 3, reporter: 'list',
  projects: [
    ...['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
    { name: 'android-phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'ipad', use: { ...devices['iPad Pro 11'], browserName: 'webkit' } },
  ],
});
