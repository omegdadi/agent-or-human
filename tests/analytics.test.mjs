import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionClassifier, toAnalyticsProperties, DETECTOR_VERSION } from '../dist/index.js';
function fixture(navigator = {}, pointerEvents = true) {
  let time = 1000; const listeners = new Map();
  const scope = { document: {}, navigator, PointerEvent: pointerEvents ? function() {} : undefined, addEventListener: (type, cb) => listeners.set(type, cb), removeEventListener: type => listeners.delete(type) };
  const classifier = createSessionClassifier({ scope, now: () => time });
  return { classifier, scope, listeners, advance(ms) { time += ms; }, event(type, ms = 500, trusted = true, repeat = false, props = {}) { time += ms; listeners.get(type)?.({ isTrusted: trusted, repeat, ...props }); } };
}
function human(f) { for (const [i, gap] of [0, 250, 700, 350, 1400, 800].entries()) f.event(i % 2 ? 'wheel' : 'pointerdown', gap); }
test('passive visits and waiting never become human', () => {
  const f = fixture(); f.advance(10000); assert.equal(f.classifier.refresh().segment, 'unclassified');
  f.event('pointerdown'); f.advance(10000); assert.equal(f.classifier.refresh().segment, 'unclassified');
});
test('varied browsing becomes likely human, with heuristic confidence and version', () => {
  const f = fixture(); human(f); const result = f.classifier.getSnapshot();
  assert.equal(result.segment, 'likely_human'); assert.equal(result.confidence, 'heuristic');
  assert.equal(result.detectorVersion, DETECTOR_VERSION); assert.equal(result.detection.verdict, 'unknown');
});
test('keyboard-only input can qualify; repeated held keys cannot', () => {
  const f = fixture(); for (const gap of [200,300,1000,400,1500,600,1400,300,1200,500]) f.event('keydown', gap);
  assert.equal(f.classifier.getSnapshot().segment, 'likely_human');
  const held = fixture(); for (let i = 0; i < 20; i++) held.event('keydown', 500, true, true);
  assert.equal(held.classifier.getSnapshot().segment, 'unclassified');
});
test('regular trusted clicks alone and synthetic bursts do not establish human', () => {
  for (const trusted of [true, false]) { const f = fixture(); for (let i = 0; i < 15; i++) f.event('pointerdown', 600, trusted); assert.equal(f.classifier.getSnapshot().segment, 'unclassified'); }
});
test('UA strings and regular synthetic input do not establish automation', () => {
  const f = fixture({ userAgent: 'HeadlessChrome/153.0' });
  for (let i = 0; i < 12; i++) f.event('pointerdown', 400, false);
  assert.equal(f.classifier.getSnapshot().segment, 'unclassified');
});
test('automation signals override human-like behavior; declarations win over automation', () => {
  const f = fixture({ webdriver: true }); human(f);
  assert.equal(f.classifier.getSnapshot().segment, 'likely_automated'); assert.equal(f.classifier.getSnapshot().confidence, 'strong_signal');
  f.scope.__SESSION_DRIVER__ = 'agent'; assert.equal(f.classifier.refresh().segment, 'declared_agent');
  f.scope.__SESSION_DRIVER__ = 'human'; assert.equal(f.classifier.refresh().segment, 'likely_automated');
});
test('a human declaration alone does not turn into measured human evidence', () => {
  const f = fixture(); f.scope.__SESSION_DRIVER__ = 'human'; assert.equal(f.classifier.refresh().segment, 'unclassified');
});
test('segment changes notify once and recover to unclassified when evidence expires', () => {
  const f = fixture(); const transitions = [];
  f.classifier.subscribe(() => { throw Error('broken analytics client'); });
  const unsubscribe = f.classifier.subscribe(a => transitions.push(a)); human(f); f.classifier.refresh();
  assert.equal(transitions.length, 1); assert.equal(transitions[0].revision, 1);
  const changedAt = transitions[0].changedAt;
  f.advance(100); assert.equal(f.classifier.refresh().changedAt, changedAt);
  f.advance(31000); assert.equal(f.classifier.refresh().segment, 'unclassified'); assert.equal(transitions.length, 2);
  unsubscribe(); f.scope.__SESSION_DRIVER__ = 'agent'; f.classifier.refresh(); assert.equal(transitions.length, 2);
});
test('snapshots isolate mutations; stop removes listeners and freezes output', () => {
  const f = fixture(); human(f); const snap = f.classifier.getSnapshot(); snap.reasons.length = 0; snap.behavior.modalities.push('injected');
  assert.ok(f.classifier.getSnapshot().reasons.length); assert.equal(f.classifier.getSnapshot().behavior.modalities.includes('injected'), false);
  f.classifier.stop(); f.classifier.stop(); assert.equal(f.listeners.size, 0);
  f.advance(40000); assert.equal(f.classifier.refresh().segment, 'likely_human');
});
test('bounded/coalesced evidence and unsupported environments', () => {
  const f = fixture(); for (let i = 0; i < 1000; i++) f.event('wheel', 1);
  assert.ok(f.classifier.getSnapshot().behavior.trustedEvents <= 7);
  for (let i = 0; i < 100; i++) f.event('pointerdown', 200);
  assert.ok(f.classifier.getSnapshot().behavior.trustedEvents <= 32);
  const native = createSessionClassifier({ scope: null }); assert.equal(native.getSnapshot().environment, 'unsupported'); native.stop();
});
test('analytics properties are serializable evidence metadata without experiment assignment or IDs', () => {
  const f = fixture(); human(f); const properties = toAnalyticsProperties(f.classifier.getSnapshot());
  assert.equal(properties.session_driver_segment, 'likely_human'); assert.ok(properties.session_driver_assessed_at);
  assert.equal('variant' in properties, false); assert.equal('sessionId' in properties, false);
  assert.deepEqual(JSON.parse(JSON.stringify(properties)), properties);
});
test('WebMCP wrapping does not classify until execution; evidence expires and stop freezes', () => {
  const f = fixture(); const changes = [];
  f.classifier.subscribe(value => changes.push(value));
  const execute = f.classifier.wrapWebMCPTool(value => value * 2);
  assert.equal(f.classifier.getSnapshot().segment, 'unclassified');
  assert.equal(execute(3), 6);
  const result = f.classifier.getSnapshot();
  assert.equal(result.segment, 'likely_automated');
  assert.equal(result.confidence, 'heuristic');
  assert.deepEqual(result.reasons, ['webmcp-tool-invoked']);
  assert.equal(result.detection.agentic, null);
  assert.equal(f.scope.__SESSION_DRIVER__, undefined);
  assert.equal(changes.length, 1);
  human(f); assert.equal(f.classifier.getSnapshot().segment, 'likely_automated');
  f.advance(31000); assert.equal(f.classifier.refresh().segment, 'unclassified');
  f.classifier.stop(); execute(4); assert.equal(f.classifier.refresh().segment, 'unclassified');
});
test('tool wrapper preserves results and failures and respects browser/declaration precedence', async () => {
  const f = fixture(); const promise = Promise.resolve({ ok: true });
  assert.equal(f.classifier.wrapWebMCPTool(() => promise)(), promise);
  const failure = Error('tool failed');
  assert.throws(f.classifier.wrapWebMCPTool(() => { throw failure; }), error => error === failure);
  f.scope.navigator.webdriver = true;
  assert.equal(f.classifier.refresh().confidence, 'strong_signal');
  f.scope.__SESSION_DRIVER__ = 'agent';
  assert.equal(f.classifier.refresh().segment, 'declared_agent');
  const native = createSessionClassifier({ scope: null }); native.wrapWebMCPTool(() => {})();
  assert.equal(native.getSnapshot().segment, 'unclassified'); native.stop();
});

const variedGaps = [200,300,1000,400,1500,600,1400,300,1200,500];
for (const pointerType of ['mouse', 'touch', 'pen']) test(`${pointerType} only activity works without a UA or wheel`, () => {
  const f = fixture();
  for (const gap of variedGaps) f.event('pointerdown', gap, true, false, { pointerType, isPrimary: true });
  assert.equal(f.classifier.getSnapshot().segment, 'likely_human');
  assert.deepEqual(f.classifier.getSnapshot().behavior.modalities, [pointerType]);
});
test('legacy touch and compatibility mouse/click count as one input, not three', () => {
  const f = fixture({}, false);
  for (const gap of variedGaps) {
    f.event('touchstart', gap, true, false, { touches: { length: 1 } });
    f.event('mousedown', 200, true, false, { sourceCapabilities: { firesTouchEvents: true } });
    f.event('click', 0, true, false, { detail: 1 });
  }
  const snapshot = f.classifier.getSnapshot();
  assert.equal(snapshot.behavior.trustedEvents, 10);
  assert.deepEqual(snapshot.behavior.modalities, ['touch']);
  assert.equal(snapshot.segment, 'likely_human');
});
test('standalone accessible activation is accepted but keyboard clicks and long presses are not double counted', () => {
  const f = fixture();
  for (const gap of variedGaps) f.event('click', gap, true, false, { detail: 0 });
  assert.equal(f.classifier.getSnapshot().segment, 'likely_human');
  const k = fixture();
  k.event('keydown'); k.event('click', 200, true, false, { detail: 0 });
  k.event('pointerdown', 2000); k.event('click', 2000, true, false, { detail: 1 });
  assert.equal(k.classifier.getSnapshot().behavior.trustedEvents, 2);
});
test('secondary contacts and multitouch starts do not inflate samples', () => {
  const f = fixture({}, false);
  f.event('pointerdown', 500, true, false, { pointerType: 'touch', isPrimary: false });
  f.event('touchstart', 500, true, false, { touches: { length: 2 } });
  assert.equal(f.classifier.getSnapshot().behavior.trustedEvents, 0);
});

test('long touches and held-key release do not create a second compatibility activation', () => {
  const f = fixture({}, false);
  f.event('touchstart', 500, true, false, { touches: { length: 1 } });
  f.event('touchend', 2000);
  f.event('mousedown', 200);
  f.event('click', 0, true, false, { detail: 1 });
  f.event('keydown', 2000);
  f.event('keyup', 2000);
  f.event('click', 0, true, false, { detail: 0 });
  assert.equal(f.classifier.getSnapshot().behavior.trustedEvents, 2);
});
