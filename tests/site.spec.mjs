import { test, expect } from '@playwright/test';
const errors = new WeakMap();
test.beforeEach(async ({ page }) => { const captured = []; errors.set(page, captured); page.on('pageerror', error => captured.push(error.message)); });
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function open(page) { await page.goto('./'); await expect(page.locator('#verdict')).not.toHaveText('CHECKING'); }
test('live verdict uses the real library; button refreshes and raw evidence agrees', async ({ page }) => {
  await open(page);
  const webdriver = await page.evaluate(() => navigator.webdriver);
  await expect(page.locator('#verdict')).toHaveText(webdriver ? 'LIKELY AUTOMATED' : 'UNCLASSIFIED');
  await expect(page.locator('#check-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Reverify session' }).click();
  await expect(page.locator('#check-count')).toHaveText('2');
  const raw = JSON.parse(await page.locator('#raw-result').textContent());
  expect(raw.detection.verdict).toBe(webdriver ? 'automated' : 'unknown');
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
  await open(page); await expect(page.locator('#verdict')).toHaveText('UNCLASSIFIED');
});
test('explicit live declarations show human/agent with visible caveat', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { value: false }); window.__SESSION_DRIVER__ = 'human'; });
  await open(page);
  await expect(page.locator('#verdict')).toHaveText('UNCLASSIFIED');
  await expect(page.locator('#segment-reasons')).toContainText('human-declaration-not-independently-verified');
  await page.evaluate(() => { window.__SESSION_DRIVER__ = 'agent'; });
  await page.getByRole('button', { name: 'Reverify session' }).click();
  await expect(page.locator('#verdict')).toHaveText('DECLARED AGENT');
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
  expect(result.history[0].segment).toBe((await page.locator('#verdict').textContent()).toLowerCase().replaceAll(' ', '_'));
  expect(result.version).toBe('0.4.0');
  expect(result.currentAssessment.pointer.mode).toBe('classify');
  expect(result.validationContext.source).toBe('self-reported-not-used-by-classifier');
  expect(result.segmentTransitions.length).toBeGreaterThan(0);
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

test('ordinary Chrome-like browsing develops a likely-human segment; experiment variant stays fixed', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { value: false });
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 Chrome/153.0 Safari/537.36' });
  });
  await open(page);
  await expect(page.locator('#verdict')).toHaveText('UNCLASSIFIED');
  // Native browser input is trusted even though this test is automated: this is a known heuristic limitation.
  await page.locator('#example-variant').selectOption('B');
  await page.getByRole('button', { name: 'Record exposure', exact: true }).click();
  for (const [index, delay] of [200, 450, 1100, 300, 1500, 850, 550].entries()) {
    await page.waitForTimeout(delay);
    if (index % 2) await page.keyboard.press('Tab');
    else await page.getByRole('button', { name: 'Reset example', exact: true }).focus();
    if (!(index % 2)) await page.mouse.wheel(0, index % 4 ? 70 : -70);
  }
  await expect(page.locator('#verdict')).toHaveText('LIKELY HUMAN');
  await expect(page.locator('#basis')).toContainText('Behavioral heuristic');
  await page.getByRole('button', { name: 'Record conversion', exact: true }).click();
  const recorded = JSON.parse(await page.locator('#experiment-result').textContent());
  expect(recorded[0].variant).toBe('B'); expect(recorded.at(-1).variant).toBe('B');
  expect(recorded.at(-1).session_driver_segment).toBe('likely_human');
  expect(recorded.at(-1).segment_at_exposure).toBe(recorded[0].session_driver_segment);
  await expect(page.locator('#example-variant')).toBeDisabled();
});

test('WebMCP registration and clicks do not classify; an instrumented execution does', async ({ page }) => {
  // Mock registration only: actual browser-mediated invocation is separately checked in Codex IAB.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { value: false });
    Object.defineProperty(document, 'modelContext', { value: { registerTool(tool) { window.testRegisteredTool = tool; } } });
  });
  await open(page);
  await expect(page.locator('#tool-status')).toContainText('Ready:');
  await expect(page.locator('#verdict')).toHaveText('UNCLASSIFIED');
  await page.getByRole('button', { name: 'Reverify session' }).click();
  await expect(page.locator('#verdict')).toHaveText('UNCLASSIFIED');
  const response = await page.evaluate(() => window.testRegisteredTool.execute({}));
  expect(JSON.parse(response.content[0].text).session_driver_reasons).toEqual(['webmcp-tool-invoked']);
  await expect(page.locator('#verdict')).toHaveText('AGENT TOOL USED');
  await expect(page.locator('#basis')).toContainText('heuristic');
  expect(await page.evaluate(() => window.__SESSION_DRIVER__)).toBeUndefined();
});

test('ordinary mouse automation is inferred from multiple signals with webdriver hidden', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { value: false });
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 Chrome/154.0 Safari/537.36' });
  });
  await open(page);
  for (const name of ['North','East','North','East','North','East']) await page.getByRole('button', { name, exact: true }).click();
  await expect(page.locator('#verdict')).toHaveText('LIKELY AUTOMATED');
  const result = JSON.parse(await page.locator('#raw-result').textContent());
  expect(result.basis).toBe('behavior'); expect(result.confidence).toBe('heuristic');
  expect(result.pointer.sparseTransitions).toBeGreaterThanOrEqual(4);
  expect(result.reasons).toContain('repeated-exact-center-clicks');
  expect(result.detection.automated).toBeNull(); expect(result.detection.agentic).toBeNull();
  expect(result.reasons).not.toContain('webmcp-tool-invoked');
});
test('validation labels never become detector declarations', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { value: false }));
  await open(page); await page.locator('#validation-driver').selectOption('agent');
  await expect(page.locator('#verdict')).toHaveText('UNCLASSIFIED');
  expect(await page.evaluate(() => window.__SESSION_DRIVER__)).toBeUndefined();
});
