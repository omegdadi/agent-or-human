import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const script = 'dist/session-driver.global.js';
test.beforeEach(async ({ page }) => { await page.setContent('<button>Press me</button><div id="root"></div>'); await page.addScriptTag({ path: script }); });
test('real browser reports WebDriver when exposed', async ({ page, browserName }) => {
  const { result, webdriver } = await page.evaluate(() => ({ result: SessionDriver.detectSession(), webdriver: navigator.webdriver }));
  expect(result.verdict).toBe(webdriver === true ? 'automated' : 'unknown');
  expect(result.agentic).toBeNull();
  if (browserName !== 'webkit') expect(webdriver).toBe(true);
});
test('trusted automated clicks are never classified as human', async ({ page }) => {
  await page.evaluate(() => { window.observer = SessionDriver.observeSession(); });
  await page.getByRole('button').click();
  const snapshot = await page.evaluate(() => observer.getSnapshot());
  expect(snapshot.interactions.trusted).toBeGreaterThan(0);
  expect(snapshot.verdict).not.toBe('human');
  await page.evaluate(() => document.querySelector('button').click());
  expect((await page.evaluate(() => observer.getSnapshot())).interactions.synthetic).toBe(1);
  await page.evaluate(() => observer.stop());
  await page.getByRole('button').click();
  expect((await page.evaluate(() => observer.getSnapshot())).interactions.trusted).toBe(snapshot.interactions.trusted);
});
test('hidden automation returns unknown instead of a false human verdict', async ({ page }) => {
  const result = await page.evaluate(() => { Object.defineProperty(navigator, 'webdriver', { value: false }); return SessionDriver.detectSession(); });
  expect(result.verdict).toBe('unknown'); expect(result.automated).toBeNull();
});
test('declaration follows agent-to-human handoff and clear', async ({ page }) => {
  const results = await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', { value: false });
    return ['agent', 'human', null].map(value => { SessionDriver.declareSessionDriver(value); return SessionDriver.detectSession().verdict; });
  });
  expect(results).toEqual(['agent', 'human', 'unknown']);
});
test('in-page overlay and WebMCP availability remain weak/diagnostic', async ({ page }) => {
  const result = await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', { value: false });
    document.body.insertAdjacentHTML('beforeend', '<aside data-agent-control>Agent is controlling this page</aside>');
    return SessionDriver.detectSession({ agentIndicatorSelectors: ['[data-agent-control]'], host: { debuggerAttached: true } });
  });
  expect(result.verdict).toBe('unknown');
  expect(result.signals.map(s => s.code)).toEqual(expect.arrayContaining(['agent-ui-indicator', 'debugger-attached']));
});
test('React bundle imports package by its public name and renders', async ({ page }) => {
  const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {detectSession} from '@omegdadi/session-driver'; createRoot(document.getElementById('root')).render(React.createElement('output', null, detectSession().verdict));`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', plugins: [{ name: 'node-resolution', setup(build) { build.onResolve({ filter: /^[^./]/ }, args => ({ path: createRequire(args.importer && args.importer !== '<stdin>' ? args.importer : import.meta.url).resolve(args.path) })); } }], define: { 'process.env.NODE_ENV': '"production"' } });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect(page.locator('output')).toHaveText(/automated|unknown/);
});
