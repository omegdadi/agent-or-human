import { createSessionClassifier, type ClassifierOptions, type Segment, type SegmentAssessment } from './analytics.js';
import type { DetectOptions } from './index.js';
export type SessionEventType = 'statechange' | 'assessmentchange';
/** Structural types keep SSR/native TypeScript consumers independent of DOM libraries. */
export interface SessionAbortSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}
export interface SessionListenerOptions { capture?: boolean; once?: boolean; signal?: SessionAbortSignal }
export interface SessionChangeEvent {
  readonly type: SessionEventType;
  readonly target: SessionMonitor;
  readonly state: Segment;
  readonly previousState: Segment;
  /** A fresh copy on every read; consumers cannot mutate the monitor or another listener's evidence. */
  readonly assessment: SegmentAssessment;
  readonly previousAssessment: SegmentAssessment;
}
export type SessionEventListener = ((this: SessionMonitor, event: SessionChangeEvent) => void) | { handleEvent(event: SessionChangeEvent): void };
export interface SessionMonitorOptions extends ClassifierOptions {
  /** Default 1000 ms. 0 disables polling; input, explicit updates and lifecycle refreshes remain active. */
  pollIntervalMs?: number;
}
export interface SessionMonitor {
  readonly state: Segment;
  readonly assessment: SegmentAssessment;
  readonly stopped: boolean;
  onstatechange: ((this: SessionMonitor, event: SessionChangeEvent) => void) | null;
  onassessmentchange: ((this: SessionMonitor, event: SessionChangeEvent) => void) | null;
  addEventListener(type: SessionEventType, listener: SessionEventListener | null, options?: boolean | SessionListenerOptions): void;
  removeEventListener(type: SessionEventType, listener: SessionEventListener | null, options?: boolean | SessionListenerOptions): void;
  refresh(): SegmentAssessment;
  /** Replace host evidence, including clearing omitted fields. This is a cooperative declaration, not attestation. */
  setHostState(host: NonNullable<DetectOptions['host']>): SegmentAssessment;
  wrapWebMCPTool<Args extends unknown[], Result>(execute: (...args: Args) => Result): (...args: Args) => Result;
  /** Remove listeners, polling, and input collection; freeze the last assessment. */
  stop(): void;
}
function copy(a: SegmentAssessment): SegmentAssessment {
  return { ...a, reasons: [...a.reasons], pointer: { ...a.pointer, reasons: [...a.pointer.reasons] },
    behavior: { ...a.behavior, modalities: [...a.behavior.modalities] },
    detection: { ...a.detection, signals: a.detection.signals.map(s => ({ ...s })) } };
}
function evidenceKey(a: SegmentAssessment) {
  return JSON.stringify([a.segment, a.confidence, a.basis, a.environment, a.detection.verdict,
    [...a.reasons].sort(), a.detection.signals.map(s => `${s.code}:${s.strength}`).sort(),
    a.pointer.mode, [...a.pointer.reasons].sort()]);
}
/** Browser-style listener ergonomics on an owned monitor; does not patch window/document/navigator.
 * This is a scoped emitter, not a DOM EventTarget: events do not bubble or support cancellation.
 */
export function createSessionMonitor(options: SessionMonitorOptions = {}): SessionMonitor {
  const interval = options.pollIntervalMs ?? 1000;
  if (!Number.isFinite(interval) || interval < 0 || interval > 60000 || (interval > 0 && interval < 10)) throw new RangeError('pollIntervalMs must be 0 or between 10 and 60000');
  const scope = options.scope === undefined ? (typeof window === 'undefined' ? null : window) : options.scope;
  const host = { ...options.host };
  const classifier = createSessionClassifier({ ...options, scope, host });
  let current = classifier.getSnapshot();
  let stopped = false;
  let dispatching = false;
  let stateHandler: SessionMonitor['onstatechange'] = null;
  let assessmentHandler: SessionMonitor['onassessmentchange'] = null;
  type Registration = { type: SessionEventType; listener: SessionEventListener; capture: boolean; once: boolean; signal?: SessionAbortSignal; abort?: () => void };
  const registrations = new Set<Registration>();
  const pending: { type: SessionEventType; previous: SegmentAssessment; next: SegmentAssessment }[] = [];
  const removers: (() => void)[] = [];
  function remove(registration: Registration) {
    registrations.delete(registration);
    if (registration.abort) registration.signal?.removeEventListener('abort', registration.abort);
  }
  function notify(next: SegmentAssessment) {
    if (stopped) return;
    const previous = current;
    current = copy(next);
    if (previous.segment !== next.segment) pending.push({ type: 'statechange', previous, next: current });
    if (evidenceKey(previous) !== evidenceKey(next)) pending.push({ type: 'assessmentchange', previous, next: current });
    if (dispatching) return;
    dispatching = true;
    try {
      while (!stopped && pending.length) {
        const entry = pending.shift()!;
        const event: SessionChangeEvent = Object.freeze({ type: entry.type, target: monitor,
          state: entry.next.segment, previousState: entry.previous.segment,
          get assessment() { return copy(entry.next); }, get previousAssessment() { return copy(entry.previous); } });
        for (const registration of [...registrations]) {
          if (stopped) break;
          if (registration.type !== entry.type || !registrations.has(registration)) continue;
          if (registration.once) remove(registration);
          try {
            if (typeof registration.listener === 'function') registration.listener.call(monitor, event);
            else registration.listener.handleEvent(event);
          } catch { /* One analytics consumer must not stop other listeners. */ }
        }
        const handler = entry.type === 'statechange' ? stateHandler : assessmentHandler;
        if (!stopped && handler) { try { handler.call(monitor, event); } catch { /* consumer-owned error */ } }
      }
    } finally { dispatching = false; }
  }
  function refresh() { if (!stopped) notify(classifier.refresh()); return copy(current); }
  const monitor: SessionMonitor = {
    get state() { return current.segment; }, get assessment() { return copy(current); }, get stopped() { return stopped; },
    get onstatechange() { return stateHandler; }, set onstatechange(listener) { if (!stopped) stateHandler = listener; },
    get onassessmentchange() { return assessmentHandler; }, set onassessmentchange(listener) { if (!stopped) assessmentHandler = listener; },
    addEventListener(type, listener, input = {}) {
      if (stopped || !listener || (type !== 'statechange' && type !== 'assessmentchange')) return;
      const config = typeof input === 'boolean' ? { capture: input } : input;
      if (config.signal?.aborted) return;
      const capture = config.capture === true;
      if ([...registrations].some(r => r.type === type && r.listener === listener && r.capture === capture)) return;
      const registration: Registration = { type, listener, capture, once: config.once === true, signal: config.signal };
      if (config.signal) {
        registration.abort = () => remove(registration);
        config.signal.addEventListener('abort', registration.abort, { once: true });
      }
      registrations.add(registration);
    },
    removeEventListener(type, listener, input = {}) {
      const capture = typeof input === 'boolean' ? input : input.capture === true;
      for (const r of registrations) if (r.type === type && r.listener === listener && r.capture === capture) remove(r);
    },
    refresh,
    setHostState(value) { if (!stopped) { host.agentActive = value.agentActive; host.debuggerAttached = value.debuggerAttached; } return refresh(); },
    wrapWebMCPTool(execute) { return classifier.wrapWebMCPTool((...args) => { notify(classifier.getSnapshot()); return execute(...args); }); },
    stop() {
      if (stopped) return; stopped = true;
      classifier.stop(); for (const removeListener of removers) removeListener();
      for (const r of registrations) remove(r);
      pending.length = 0; stateHandler = null; assessmentHandler = null;
    },
  };
  removers.push(classifier.subscribe(notify));
  if (current.environment === 'browser') {
    if (interval > 0) {
      const timer = setInterval(refresh, interval);
      (timer as unknown as { unref?: () => void }).unref?.();
      removers.push(() => clearInterval(timer));
    }
    if (scope?.addEventListener && scope.removeEventListener) {
      for (const type of ['pageshow', 'visibilitychange', 'focus']) {
        try {
          scope.addEventListener(type, refresh, true);
          removers.push(() => { try { scope.removeEventListener?.(type, refresh, true); } catch { /* restricted host */ } });
        } catch { /* Explicit refresh and polling still work. */ }
      }
    }
  }
  return monitor;
}
