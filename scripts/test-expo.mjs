import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const root = resolve('tests/fixtures/expo/dist');
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    response.setHeader('Content-Type', extname(file) === '.js' ? 'text/javascript' : 'text/html');
    response.end(data);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByTestId('verdict').waitFor();
  assert.equal(await page.getByTestId('verdict').textContent(), 'automated');
  assert.deepEqual(errors, []);
  console.log('Expo SDK 57 / Metro export rendered automated in Chromium without page errors');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
