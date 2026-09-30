import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { detectSession, declareSessionDriver, observeSession } from '../dist/index.js';
const browser = (navigator = {}) => ({ document: {}, navigator });
test('ESM and CommonJS imports are safe in SSR', () => {
  assert.equal(detectSession().verdict, 'unsupported');
  assert.equal(createRequire(import.meta.url)('../dist/index.cjs').detectSession().verdict, 'unsupported');
  assert.match(renderToString(createElement('span', null, detectSession().verdict)), /unsupported/);
});
test('React Native-like and worker environments are unsupported', () => {
  for (const scope of [null, {}, { navigator: { product: 'ReactNative' } }, { navigator: { userAgent: 'worker' } }]) assert.equal(detectSession({ scope }).verdict, 'unsupported');
});
test('absence of automation evidence never proves human', () => {
  for (const webdriver of [false, undefined, 'true', 1]) {
    assert.equal(detectSession({ scope: browser({ webdriver }) }).verdict, 'unknown');
    assert.equal(detectSession({ scope: browser({ webdriver }) }).automated, null);
  }
});
test('WebDriver means automation, not necessarily an AI loop', () => {
  const result = detectSession({ scope: browser({ webdriver: true }) });
  assert.equal(result.verdict, 'automated'); assert.equal(result.automated, true); assert.equal(result.agentic, null);
});
test('user-agent strings are not detection evidence', () => {
  const result = detectSession({ scope: browser({ userAgent: 'Mozilla/5.0 HeadlessChrome/140.0' }) });
  assert.equal(result.verdict, 'unknown'); assert.equal(result.signals.length, 0);
  const navigator = { get userAgent() { throw Error('must not read UA'); } };
  assert.deepEqual(detectSession({ scope: browser(navigator) }).signals, []);
});
test('cooperative agent/human declaration and clearing', () => {
  const scope = browser();
  assert.equal(declareSessionDriver('agent', { scope }), true);
  assert.equal(detectSession({ scope }).agentic, true);
  declareSessionDriver('human', { scope });
  assert.equal(detectSession({ scope }).verdict, 'human');
  assert.equal(detectSession({ scope }).automated, null);
  declareSessionDriver(null, { scope });
  assert.equal(detectSession({ scope }).verdict, 'unknown');
  assert.equal(declareSessionDriver('agent', { scope: null }), false);
  assert.throws(() => declareSessionDriver('bot', { scope }), TypeError);
});
test('human declaration cannot suppress positive WebDriver evidence', () => {
  const scope = browser({ webdriver: true }); scope.__SESSION_DRIVER__ = 'human';
  const result = detectSession({ scope });
  assert.equal(result.verdict, 'automated');
  assert.ok(result.signals.some(s => s.code === 'declaration-conflict'));
});
test('host agent state and debugger attachment have distinct semantics', () => {
  assert.equal(detectSession({ scope: browser(), host: { agentActive: true } }).verdict, 'agent');
  const result = detectSession({ scope: browser(), host: { debuggerAttached: true } });
  assert.equal(result.verdict, 'unknown'); assert.equal(result.signals[0].code, 'debugger-attached');
});
test('WebMCP capability is not evidence of active control', () => {
  for (const scope of [{ document: { modelContext: {} } }, browser({ modelContext: {} })]) {
    const result = detectSession({ scope });
    assert.equal(result.verdict, 'unknown'); assert.ok(result.signals.some(s => s.code === 'webmcp-available'));
  }
});
test('UI indicators are opt-in and cannot alone establish an agent', () => {
  let calls = 0;
  const scope = { document: { querySelector(selector) { calls++; if (selector === '[') throw Error(); return {}; } } };
  detectSession({ scope }); assert.equal(calls, 0);
  const result = detectSession({ scope, agentIndicatorSelectors: ['[', '.agent-badge'] });
  assert.equal(result.verdict, 'unknown');
  assert.deepEqual(result.signals.map(s => s.code), ['invalid-selector', 'agent-ui-indicator']);
});
test('restricted browser properties and frozen declarations do not throw', () => {
  const scope = browser({ get webdriver() { throw Error('blocked'); } });
  assert.equal(detectSession({ scope }).verdict, 'unknown');
  assert.equal(detectSession({ scope: { get document() { throw Error(); } } }).verdict, 'unsupported');
  assert.equal(declareSessionDriver('agent', { scope: Object.freeze(browser()) }), false);
});
test('observer tracks counts, not human identity; supports unsubscribe and teardown', () => {
  const events = new Map(); const scope = browser();
  scope.addEventListener = (name, cb) => events.set(name, cb);
  scope.removeEventListener = name => events.delete(name);
  const observer = observeSession({ scope }); let updates = 0;
  const unsubscribe = observer.subscribe(() => updates++);
  const click = events.get('click');
  click({ isTrusted: true }); click({ isTrusted: false });
  assert.equal(updates, 2); assert.equal(observer.getSnapshot().verdict, 'unknown');
  assert.deepEqual(observer.getSnapshot().interactions, { trusted: 1, synthetic: 1 });
  unsubscribe(); click({ isTrusted: true }); assert.equal(updates, 2);
  observer.stop(); observer.stop(); assert.equal(events.size, 0);
  click({ isTrusted: true }); assert.equal(observer.getSnapshot().interactions.trusted, 2);
});
test('observer preserves host options and safely stops without a browser', () => {
  const observer = observeSession({ scope: browser(), host: { agentActive: true } });
  assert.equal(observer.getSnapshot().verdict, 'agent'); observer.stop();
  const native = observeSession({ scope: null }); assert.equal(native.getSnapshot().verdict, 'unsupported'); native.stop();
});
