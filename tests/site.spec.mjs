import { test, expect } from '@playwright/test';
const errors = new WeakMap();
test.beforeEach(async ({ page }) => { const captured = []; errors.set(page, captured); page.on('pageerror', error => captured.push(error.message)); });
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function open(page) { await page.goto('./'); await expect(page.locator('#verdict')).not.toHaveText('CHECKING'); }
test('live verdict uses the real library; button refreshes and raw evidence agrees', async ({ page }) => {
  await open(page);
  const webdriver = await page.evaluate(() => navigator.webdriver);
  await expect(page.locator('#verdict')).toHaveText(webdriver ? 'AUTOMATED' : 'UNKNOWN');
  await expect(page.locator('#check-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Reverify session' }).click();
  await expect(page.locator('#check-count')).toHaveText('2');
  const raw = JSON.parse(await page.locator('#raw-result').textContent());
  expect(raw.verdict).toBe(webdriver ? 'automated' : 'unknown');
  expect(await page.locator('#trusted-count').textContent()).not.toBe('0');
});
test('scroll checkpoint verifies once per visit and rearms above', async ({ page }) => {
  await open(page);
  await page.locator('#checkpoint').scrollIntoViewIfNeeded();
  await expect(page.locator('#scroll-count')).toHaveText('1');
  await expect(page.locator('#checkpoint-status')).toContainText('Check 2:');
  await page.locator('#top').scrollIntoViewIfNeeded();
  await expect(page.locator('#checkpoint')).not.toBeInViewport();
  await page.locator('#checkpoint').scrollIntoViewIfNeeded();
  await expect(page.locator('#scroll-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.locator('#check-count')).toHaveText('4');
});
test('lab demonstrates each technique without changing the live verdict', async ({ page }) => {
  await open(page);
  const actual = await page.locator('#verdict').textContent();
  for (const [scenario, expected] of [['ordinary','UNKNOWN'],['webdriver','AUTOMATED'],['agent','AGENT'],['human','HUMAN'],['hidden','UNKNOWN'],['debugger','UNKNOWN'],['overlay','UNKNOWN'],['conflict','AUTOMATED']]) {
    await page.locator('#scenario').selectOption(scenario);
    await expect(page.locator('#lab-verdict')).toHaveText(expected);
    await expect(page.locator('#verdict')).toHaveText(actual);
  }
  expect(await page.evaluate(() => window.__SESSION_DRIVER__)).toBeUndefined();
  await page.locator('#lab-host').check();
  await expect(page.locator('#lab-verdict')).toHaveText('AGENT');
  await page.locator('#lab-host').uncheck();
  await expect(page.locator('#lab-verdict')).toHaveText('AUTOMATED');
});
test('ordinary/hidden control stays unknown rather than human', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { value: false }));
  await open(page); await expect(page.locator('#verdict')).toHaveText('UNKNOWN');
});
test('explicit live declarations show human/agent with visible caveat', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { value: false }); window.__SESSION_DRIVER__ = 'human'; });
  await open(page);
  await expect(page.locator('#verdict')).toHaveText('HUMAN');
  await expect(page.locator('#basis')).toContainText('not verified identity');
  await page.evaluate(() => { window.__SESSION_DRIVER__ = 'agent'; });
  await page.getByRole('button', { name: 'Reverify session' }).click();
  await expect(page.locator('#verdict')).toHaveText('AGENT');
});
test('notebook is bounded and exports genuine checks as JSON', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 14; i++) await page.getByRole('button', { name: 'Reverify session' }).click();
  await expect(page.locator('#history tr')).toHaveCount(12);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download results' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('session-driver-results.json');
  const stream = await download.createReadStream(); const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const result = JSON.parse(Buffer.concat(chunks).toString());
  expect(result.history).toHaveLength(12); expect(result.checks).toBeGreaterThanOrEqual(15);
  expect(result.library).toBe('@omegdadi/session-driver');
  expect(result.history[0].verdict).toBe((await page.locator('#verdict').textContent()).toLowerCase());
});
test('mobile fits screen and switches work with keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#lab-webdriver').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#lab-verdict')).toHaveText('AUTOMATED');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
