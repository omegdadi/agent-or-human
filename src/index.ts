/** A declaration is cooperative metadata, never authentication or proof. */
export type Driver = 'agent' | 'human';
export type Verdict = Driver | 'automated' | 'unknown' | 'unsupported';
export interface Signal {
  code: 'declared-agent' | 'declared-human' | 'webdriver' | 'unreadable-property' | 'declaration-conflict' | 'debugger-attached' | 'agent-ui-indicator' | 'invalid-selector' | 'host-agent-active' | 'webmcp-available' | 'webmcp-tool-invoked';
  strength: 'declaration' | 'strong' | 'weak' | 'diagnostic';
}
export interface Detection {
  verdict: Verdict;
  basis: 'declaration' | 'signal' | 'none';
  /** Strong evidence or a declaration of automation; null means not established. */
  automated: true | null;
  /** Only true when an agent declares itself. Never inferred from automation alone. */
  agentic: true | null;
  signals: Signal[];
}
/** Minimal structural interface: no DOM types required in consumer applications. */
export interface BrowserScope {
  document?: unknown;
  PointerEvent?: unknown;
  navigator?: { webdriver?: unknown; userAgent?: unknown; modelContext?: unknown };
  __SESSION_DRIVER__?: unknown;
  addEventListener?: (type: string, listener: (event: { isTrusted: boolean }) => void, options?: boolean) => void;
  removeEventListener?: (type: string, listener: (event: { isTrusted: boolean }) => void, options?: boolean) => void;
}
export interface DetectOptions {
  /** Omit to inspect the current window. null explicitly selects no browser. */
  scope?: BrowserScope | null;
  /** Explicit host bridge, e.g. an Electron preload or your own extension. */
  host?: { debuggerAttached?: boolean; agentActive?: boolean };
  /** Opt-in selectors for known in-page agent UI. Presence is weak evidence only. */
  agentIndicatorSelectors?: readonly string[];
}
function currentScope(): BrowserScope | null {
  return typeof window === 'undefined' ? null : window;
}
function getScope(options: DetectOptions): BrowserScope | null {
  return options.scope === undefined ? currentScope() : options.scope;
}
function read(object: unknown, key: string, signals: Signal[]): unknown {
  try { return (object as Record<string, unknown> | null | undefined)?.[key]; }
  catch { signals.push({ code: 'unreadable-property', strength: 'diagnostic' }); return undefined; }
}
/** Detect positive automation evidence; absence of evidence never establishes a human. */
export function detectSession(options: DetectOptions = {}): Detection {
  const scope = getScope(options);
  const signals: Signal[] = [];
  const empty = (verdict: Verdict): Detection => ({ verdict, basis: 'none', automated: null, agentic: null, signals });
  if (!scope || !read(scope, 'document', signals)) return empty('unsupported');
  const navigator = read(scope, 'navigator', signals);
  const document = read(scope, 'document', signals);
  if (read(document, 'modelContext', signals) || read(navigator, 'modelContext', signals)) {
    signals.push({ code: 'webmcp-available', strength: 'diagnostic' });
  }
  if (options.host?.debuggerAttached === true) signals.push({ code: 'debugger-attached', strength: 'weak' });
  for (const selector of options.agentIndicatorSelectors ?? []) {
    try {
      const query = read(document, 'querySelector', signals);
      if (typeof query === 'function' && query.call(document, selector)) {
        signals.push({ code: 'agent-ui-indicator', strength: 'weak' });
        break;
      }
    } catch { signals.push({ code: 'invalid-selector', strength: 'diagnostic' }); }
  }
  const webdriver = read(navigator, 'webdriver', signals) === true;
  const declaration = read(scope, '__SESSION_DRIVER__', signals);
  if (webdriver) signals.push({ code: 'webdriver', strength: 'strong' });
  if (options.host?.agentActive === true) {
    signals.push({ code: 'host-agent-active', strength: 'declaration' });
    if (declaration === 'human') signals.push({ code: 'declaration-conflict', strength: 'diagnostic' });
    return { verdict: 'agent', basis: 'declaration', automated: true, agentic: true, signals };
  }
  if (declaration === 'agent') {
    signals.push({ code: 'declared-agent', strength: 'declaration' });
    return { verdict: 'agent', basis: 'declaration', automated: true, agentic: true, signals };
  }
  if (declaration === 'human') {
    signals.push({ code: 'declared-human', strength: 'declaration' });
    if (webdriver) signals.push({ code: 'declaration-conflict', strength: 'diagnostic' });
    else return { ...empty('human'), basis: 'declaration' };
  }
  if (webdriver) return { verdict: 'automated', basis: 'signal', automated: true, agentic: null, signals };
  return empty('unknown');
}
/** Declare who is driving this page. Call again on handoff; clear on session end. */
export function declareSessionDriver(driver: Driver | null, options: DetectOptions = {}): boolean {
  if (driver !== null && driver !== 'agent' && driver !== 'human') throw new TypeError('Expected agent, human, or null');
  const scope = getScope(options);
  if (!scope) return false;
  try {
    if (!scope.document) return false;
    if (driver === null) delete scope.__SESSION_DRIVER__;
    else scope.__SESSION_DRIVER__ = driver;
    return true;
  } catch { return false; }
}
export interface SessionSnapshot extends Detection {
  /** Aggregate counts only. Trusted browser events can also come from automation. */
  interactions: { trusted: number; synthetic: number };
}
export interface SessionObserver {
  getSnapshot(): SessionSnapshot;
  /** Idempotent. Stops observing and clears subscriptions. */
  stop(): void;
  /** Notifications follow input events. Use getSnapshot() to recheck declarations/flags. */
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
}
/** Optional event observation. No timers, storage, network, or import-time listeners. */
export function observeSession(options: DetectOptions = {}): SessionObserver {
  const scope = getScope(options);
  let stopped = false;
  let trusted = 0;
  let synthetic = 0;
  const subscribers = new Set<(snapshot: SessionSnapshot) => void>();
  const types = ['pointerdown', 'keydown', 'click'];
  const attached: string[] = [];
  const getSnapshot = (): SessionSnapshot => ({ ...detectSession({ ...options, scope }), interactions: { trusted, synthetic } });
  const pending: { snapshot: SessionSnapshot; listeners: ((snapshot: SessionSnapshot) => void)[] }[] = [];
  let notifying = false;
  const onEvent = (event: { isTrusted: boolean }) => {
    if (stopped) return;
    if (event.isTrusted) trusted++; else synthetic++;
    pending.push({ snapshot: getSnapshot(), listeners: [...subscribers] });
    if (notifying) return;
    notifying = true;
    try {
      while (!stopped && pending.length) {
        const entry = pending.shift()!;
        for (const listener of entry.listeners) {
          if (stopped) break;
          if (!subscribers.has(listener)) continue;
          const value = { ...entry.snapshot, interactions: { ...entry.snapshot.interactions }, signals: entry.snapshot.signals.map(signal => ({ ...signal })) };
          try { listener(value); } catch { /* Isolate consumer errors from input collection and other subscribers. */ }
        }
      }
    } finally { notifying = false; }
  };
  try {
    if (scope?.document && scope.addEventListener && scope.removeEventListener) {
      for (const type of types) { scope.addEventListener(type, onEvent, true); attached.push(type); }
    }
  } catch { /* A restricted host may disallow observation; snapshots still work. */ }
  return {
    getSnapshot,
    subscribe(listener) {
      if (stopped) return () => {};
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const type of attached) {
        try { scope?.removeEventListener?.(type, onEvent, true); } catch { /* restricted host */ }
      }
      subscribers.clear(); pending.length = 0;
    },
  };
}

export { createSessionClassifier, toAnalyticsProperties, DETECTOR_VERSION } from './analytics.js';
export type { Segment, SegmentConfidence, SegmentAssessment, ClassifierOptions, SessionClassifier, PointerEvidence, AutomationEvidence } from './analytics.js';

export { createSessionMonitor } from './monitor.js';
export type { SessionMonitor, SessionMonitorOptions, SessionChangeEvent, SessionEventType, SessionEventListener, SessionListenerOptions, SessionAbortSignal } from './monitor.js';

export { connectBotD } from './botd.js';
export type { BotDDetector, BotDResult, BotDConnection } from './botd.js';
export { createSessionHistory } from './history.js';
export type { SessionHistory, SessionHistoryEntry, SessionHistorySummary } from './history.js';
