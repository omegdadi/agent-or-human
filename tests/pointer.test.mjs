import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionClassifier, toAnalyticsProperties } from '../dist/index.js';
function fixture(mode = 'classify') {
  let time = 1000; const listeners = new Map();
  const scope = { document: {}, navigator: {},
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }
  };
  const classifier = createSessionClassifier({ scope, pointerAnalysis: mode, now: () => time });
  const emit = (type, props = {}, gap = 0) => { time += gap; const e = { isTrusted: true, pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0, clientX: 0, clientY: 0, timeStamp: time, ...props }; for (const fn of listeners.get(type) ?? []) fn(e); };
  const target = x => ({ closest: () => ({ getBoundingClientRect: () => ({ left: x - 20, top: -20, width: 40, height: 40 }) }) });
  const click = (x, { duration = 2, centered = true, props = {} } = {}) => {
    emit('pointermove', { clientX: x, ...props }, 300);
    emit('pointerdown', { clientX: x, target: centered ? target(x) : null, ...props }, 20);
    emit('blur', { target: {}, relatedTarget: {} }); // Focus moving between elements is not window blur.
    emit('pointerup', { clientX: x, ...props }, duration);
  };
  return { classifier, scope, listeners, emit, click, advance(ms) { time += ms; }, result() { return classifier.refresh(); } };
}
function pattern(f, options) { for (let i = 0; i < 6; i++) f.click(i % 2 ? 250 : 0, options); }
test('ordinary agent-style clicks classify without webdriver, declarations, or WebMCP', () => {
  const f = fixture(); pattern(f); const a = f.result();
  assert.equal(a.segment, 'likely_automated'); assert.equal(a.basis, 'behavior'); assert.equal(a.confidence, 'heuristic');
  assert.equal(a.pointer.mouseGestures, 6); assert.equal(a.pointer.sparseTransitions, 5);
  assert.equal(a.reasons.length, 3); assert.equal(a.detection.agentic, null); assert.equal(a.detection.automated, null);
});
test('observe mode reports candidate patterns without changing the classification', () => {
  const f = fixture('observe'); pattern(f); const a = f.result();
  assert.equal(a.pointer.automationPattern, true); assert.equal(a.segment, 'unclassified');
});
test('one fast jump, sparse input alone, or repeated short clicks in one place are insufficient', () => {
  const f = fixture(); f.click(0); f.emit('pointermove', { clientX: 800 }, 1); f.click(800);
  assert.notEqual(f.result().segment, 'likely_automated');
  const sparse = fixture(); pattern(sparse, { duration: 90, centered: false });
  assert.deepEqual(sparse.result().pointer.reasons, ['repeated-sparse-pointer-transitions']);
  assert.notEqual(sparse.result().segment, 'likely_automated');
  const fixed = fixture(); for (let i = 0; i < 8; i++) fixed.click(0);
  assert.notEqual(fixed.result().segment, 'likely_automated');
});
test('touch, pen, untrusted events, and secondary pointers cannot satisfy mouse rules', () => {
  for (const props of [{ pointerType: 'touch' }, { pointerType: 'pen' }, { isTrusted: false }, { isPrimary: false }]) {
    const f = fixture(); pattern(f, { props }); assert.equal(f.result().pointer.mouseGestures, 0);
  }
});
test('zero-duration rounded timestamps are not short-press evidence', () => {
  const f = fixture(); pattern(f, { duration: 0, centered: false });
  assert.equal(f.result().pointer.shortPresses, 0); assert.equal(f.result().pointer.automationPattern, false);
});
test('window exit, scrolling, idle gaps, and pointer cancellation invalidate approach continuity', () => {
  for (const kind of ['blur', 'scroll', 'pointercancel', 'pointerout', 'visibilitychange', 'pointerlockchange', 'resize']) {
    const f = fixture();
    for (let i = 0; i < 8; i++) { f.emit(kind, { target: f.scope, relatedTarget: null }); f.click(i % 2 ? 250 : 0); }
    assert.equal(f.result().pointer.longTransitions, 0, kind); assert.equal(f.result().pointer.automationPattern, false);
  }
  const idle = fixture(); for (let i = 0; i < 6; i++) { idle.advance(11000); idle.click(i % 2 ? 250 : 0); }
  assert.equal(idle.result().pointer.longTransitions, 0);
});
test('coalesced movement is processed instead of its parent and dense paths are not sparse', () => {
  const f = fixture(); f.click(0);
  for (let i = 0; i < 6; i++) {
    const end = i % 2 ? 0 : 250; const start = i % 2 ? 250 : 0;
    f.emit('pointermove', { clientX: end, getCoalescedEvents() { return Array.from({ length: 10 }, (_, n) => ({ clientX: start + (end-start)*(n+1)/10, clientY: Math.sin(n)*20, timeStamp: this.timeStamp - 100 + n*10 })); } }, 300);
    f.emit('pointerdown', { clientX: end }, 10); f.emit('pointerup', { clientX: end }, 100);
  }
  const a = f.result(); assert.equal(a.pointer.sparseTransitions, 0); assert.equal(a.pointer.uniformStraightPaths, 0); assert.equal(a.pointer.coalescedSamples, 60);
  assert.notEqual(a.segment, 'likely_automated');
});
test('uniform straight trajectories need independent execution evidence', () => {
  for (const duration of [2, 100]) {
    const f = fixture(); f.click(0, { duration, centered: false });
    for (let i = 0; i < 6; i++) {
      const end = i % 2 ? 0 : 250; const start = i % 2 ? 250 : 0;
      for (let n = 1; n <= 10; n++) f.emit('pointermove', { clientX: start + (end-start)*n/10 }, 10);
      f.emit('pointerdown', { clientX: end }, 10); f.emit('pointerup', { clientX: end }, duration);
    }
    const a = f.result(); assert.ok(a.pointer.uniformStraightPaths >= 4);
    assert.equal(a.pointer.automationPattern, duration === 2);
  }
});
test('hidden documents and pointer lock exclude mouse analysis', () => {
  for (const props of [{ visibilityState: 'hidden' }, { pointerLockElement: {} }]) {
    const f = fixture(); Object.assign(f.scope.document, props); pattern(f); assert.equal(f.result().pointer.mouseGestures, 0);
  }
});
test('bounded aggregates expire, are mutation-safe, and reveal no coordinates or targets', () => {
  const f = fixture(); for (let i = 0; i < 40; i++) f.click(i % 2 ? 250 : 0);
  const a = f.result(); assert.equal(a.pointer.mouseGestures, 16);
  a.pointer.reasons.length = 0; assert.ok(f.result().pointer.reasons.length);
  assert.equal(/clientX|clientY|target|timeStamp/.test(JSON.stringify(f.result().pointer)), false);
  assert.equal(toAnalyticsProperties(f.result()).session_driver_pointer_mode, 'classify');
  f.advance(31000); assert.equal(f.result().pointer.mouseGestures, 0); assert.equal(f.result().segment, 'unclassified');
  f.classifier.stop(); assert.equal([...f.listeners.values()].reduce((sum, v) => sum + v.size, 0), 0);
});
