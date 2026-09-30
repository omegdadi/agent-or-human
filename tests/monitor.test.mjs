import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionMonitor } from '../dist/index.js';
function fixture(options = {}) {
  const listeners = new Map();
  const scope = { document: {}, navigator: {}, addEventListener(type, cb) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(cb); }, removeEventListener(type, cb) { listeners.get(type)?.delete(cb); } };
  const monitor = createSessionMonitor({ scope, pollIntervalMs: 0, ...options });
  return { monitor, scope, emit(type) { for (const cb of listeners.get(type) ?? []) cb({ isTrusted: true }); }, listeners };
}
test('state property and ordered state/evidence events report host start and release without duplicates', () => {
  const { monitor } = fixture(); const events = [];
  assert.equal(monitor.state, 'unclassified');
  monitor.addEventListener('statechange', function (e) { assert.equal(this, monitor); assert.equal(e.target, monitor); events.push([e.type, e.previousState, e.state]); });
  monitor.addEventListener('assessmentchange', e => events.push([e.type, e.previousState, e.state]));
  monitor.setHostState({ agentActive: true }); monitor.refresh();
  monitor.setHostState({});
  assert.deepEqual(events, [['statechange','unclassified','declared_agent'],['assessmentchange','unclassified','declared_agent'],['statechange','declared_agent','unclassified'],['assessmentchange','declared_agent','unclassified']]);
  monitor.stop();
});
test('same-state confidence and reason changes emit assessmentchange, not statechange', () => {
  const { monitor, scope } = fixture(); let states = 0; let evidence = 0;
  monitor.onstatechange = () => states++; monitor.onassessmentchange = () => evidence++;
  monitor.setHostState({ debuggerAttached: true }); assert.equal(states, 0); assert.equal(evidence, 1);
  monitor.setHostState({ debuggerAttached: true }); assert.equal(evidence, 1);
  monitor.wrapWebMCPTool(() => {})(); assert.equal(states, 1);
  scope.navigator.webdriver = true; monitor.refresh();
  assert.equal(states, 1); assert.equal(evidence, 3); assert.equal(monitor.assessment.confidence, 'strong_signal');
  monitor.stop();
});
test('duplicate registration, removal, once, objects, and AbortSignal work', () => {
  const { monitor } = fixture(); let count = 0; let once = 0; let object = 0;
  const controller = new AbortController(); const fn = () => count++;
  monitor.addEventListener('statechange', fn, { signal: controller.signal });
  monitor.addEventListener('statechange', fn);
  monitor.addEventListener('statechange', () => once++, { once: true });
  const obj = { handleEvent() { object++; } }; monitor.addEventListener('statechange', obj);
  monitor.setHostState({ agentActive: true }); controller.abort(); monitor.removeEventListener('statechange', obj);
  monitor.setHostState({}); assert.equal(count, 1); assert.equal(once, 1); assert.equal(object, 1);
  monitor.addEventListener('statechange', fn, { signal: controller.signal }); monitor.setHostState({ agentActive: true }); assert.equal(count, 1);
  monitor.stop();
});
test('listeners can remove listeners, fail, and trigger reentrant transitions safely', () => {
  const { monitor } = fixture(); const values = []; let removed = 0;
  const later = () => removed++;
  monitor.addEventListener('statechange', e => { values.push(e.state); monitor.removeEventListener('statechange', later); if (e.state === 'declared_agent') monitor.setHostState({}); });
  monitor.addEventListener('statechange', later);
  monitor.addEventListener('statechange', () => { throw Error('consumer'); });
  monitor.setHostState({ agentActive: true });
  assert.deepEqual(values, ['declared_agent', 'unclassified']); assert.equal(removed, 0); assert.equal(monitor.state, 'unclassified');
  monitor.stop();
});
test('snapshots and event snapshots cannot corrupt other listeners or retained state', () => {
  const { monitor } = fixture(); let seen;
  monitor.addEventListener('statechange', e => { e.assessment.reasons.length = 0; e.previousAssessment.pointer.reasons.push('injected'); });
  monitor.addEventListener('statechange', e => { seen = e.assessment.reasons; assert.equal(e.previousAssessment.pointer.reasons.includes('injected'), false); });
  monitor.setHostState({ agentActive: true }); monitor.assessment.reasons.length = 0;
  assert.deepEqual(seen, ['host-agent-active']); assert.deepEqual(monitor.assessment.reasons, ['host-agent-active']); monitor.stop();
});
test('polling expires tool evidence without input and observes external declarations', t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1000 });
  const { monitor, scope } = fixture({ pollIntervalMs: 1000 }); const states = [];
  monitor.onstatechange = e => states.push(e.state);
  monitor.wrapWebMCPTool(() => 42)();
  t.mock.timers.tick(31000); assert.equal(monitor.state, 'unclassified');
  scope.__SESSION_DRIVER__ = 'agent'; t.mock.timers.tick(1000); assert.equal(monitor.state, 'declared_agent');
  assert.deepEqual(states, ['likely_automated','unclassified','declared_agent']); monitor.stop();
});
test('lifecycle wake refreshes after suspension; stop removes all listeners and freezes state', () => {
  const { monitor, scope, emit, listeners } = fixture(); let count = 0;
  monitor.onstatechange = () => count++;
  scope.__SESSION_DRIVER__ = 'agent'; emit('pageshow'); assert.equal(count, 1);
  monitor.stop(); monitor.stop(); scope.__SESSION_DRIVER__ = undefined; emit('visibilitychange'); monitor.refresh();
  assert.equal(monitor.state, 'declared_agent'); assert.equal(monitor.stopped, true); assert.equal(monitor.onstatechange, null);
  assert.equal([...listeners.values()].reduce((sum, set) => sum + set.size, 0), 0);
});
test('SSR/native without a document stays unsupported; invalid intervals rejected', () => {
  const monitor = createSessionMonitor({ scope: null }); assert.equal(monitor.state, 'unclassified'); assert.equal(monitor.assessment.environment, 'unsupported'); monitor.stop();
  for (const value of [-1, 1, NaN, Infinity, 60001]) assert.throws(() => createSessionMonitor({ pollIntervalMs: value }), RangeError);
});
test('stop cancels timers and removes AbortSignal hooks; handlers can be cleared during dispatch', t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1000 });
  const { monitor, scope } = fixture({ pollIntervalMs: 1000 }); const abortHandlers = new Set();
  const signal = { aborted: false, addEventListener(type, fn) { abortHandlers.add(fn); }, removeEventListener(type, fn) { abortHandlers.delete(fn); } };
  let called = 0; monitor.onstatechange = () => called++;
  monitor.addEventListener('statechange', () => { monitor.onstatechange = null; }, { signal });
  monitor.setHostState({ agentActive: true }); assert.equal(called, 0); assert.equal(abortHandlers.size, 1);
  const at = monitor.assessment.assessedAt; monitor.stop(); assert.equal(abortHandlers.size, 0);
  scope.__SESSION_DRIVER__ = 'human'; t.mock.timers.tick(60000);
  assert.equal(monitor.assessment.assessedAt, at); assert.equal(monitor.state, 'declared_agent');
});
