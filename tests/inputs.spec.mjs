import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><button style="width:150px;height:70px">Activate</button>');
  await page.addScriptTag({ path: 'dist/agent-or-human.global.js' });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', { value: false });
    Object.defineProperty(navigator, 'userAgent', { get() { throw Error('UA must not be read'); } });
    window.monitor = AgentOrHuman.createSessionMonitor({ pointerAnalysis: 'classify', pollIntervalMs: 0 });
  });
});
test('real input is counted once and touch does not enter mouse inference', async ({ page }, testInfo) => {
  const touch = Boolean(testInfo.project.use.hasTouch);
  const button = page.getByRole('button', { name: 'Activate' });
  if (touch) await button.tap(); else await button.click();
  const snapshot = await page.evaluate(() => monitor.refresh());
  expect(snapshot.behavior.trustedEvents).toBe(1);
  expect(snapshot.behavior.modalities).toEqual([touch ? 'touch' : 'mouse']);
  expect(snapshot.segment).toBe('unclassified');
  expect(snapshot.pointer.automationPattern).toBe(false);
  expect(snapshot.detection.signals.some(signal => signal.code === 'unreadable-property')).toBe(false);
  await page.evaluate(() => monitor.stop());
  if (touch) await button.tap(); else await button.click();
  expect(await page.evaluate(() => monitor.assessment.behavior.trustedEvents)).toBe(1);
});
test('keyboard activation is not counted twice across device profiles', async ({ page }) => {
  await page.getByRole('button').focus();
  await page.keyboard.press('Enter');
  const result = await page.evaluate(() => monitor.refresh());
  expect(result.behavior.trustedEvents).toBe(1);
  expect(result.behavior.modalities).toEqual(['keyboard']);
  expect(result.segment).toBe('unclassified');
  await page.evaluate(() => monitor.stop());
});
