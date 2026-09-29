import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
const app = await electron.launch({ args: ['tests/electron-main.cjs'] });
try {
  const page = await app.firstWindow();
  const result = await page.evaluate(() => SessionDriver.detectSession());
  assert.ok(['unknown', 'automated'].includes(result.verdict));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.debugger.attach('1.3'));
  const attached = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.debugger.isAttached());
  assert.equal(attached, true);
  const bridged = await page.evaluate(debuggerAttached => SessionDriver.detectSession({ host: { debuggerAttached } }), attached);
  assert.ok(bridged.signals.some(s => s.code === 'debugger-attached'));
  assert.notEqual(bridged.verdict, 'agent');
  const agent = await page.evaluate(() => SessionDriver.detectSession({ host: { agentActive: true } }));
  assert.equal(agent.verdict, 'agent');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.debugger.detach());
  console.log('Electron: sandboxed renderer, real debugger attach/detach, host-agent bridge passed');
} finally { await app.close(); }
