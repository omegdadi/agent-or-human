/** A declaration is cooperative metadata, never authentication or proof. */
export type Driver = 'agent' | 'human';
export type Verdict = Driver | 'automated' | 'unknown' | 'unsupported';
export interface Signal {
    code: 'declared-agent' | 'declared-human' | 'webdriver' | 'headless-user-agent' | 'unreadable-property' | 'declaration-conflict' | 'debugger-attached' | 'agent-ui-indicator' | 'invalid-selector' | 'host-agent-active' | 'webmcp-available' | 'webmcp-tool-invoked';
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
    navigator?: {
        webdriver?: unknown;
        userAgent?: unknown;
        modelContext?: unknown;
    };
    __SESSION_DRIVER__?: unknown;
    addEventListener?: (type: string, listener: (event: {
        isTrusted: boolean;
    }) => void, options?: boolean) => void;
    removeEventListener?: (type: string, listener: (event: {
        isTrusted: boolean;
    }) => void, options?: boolean) => void;
}
export interface DetectOptions {
    /** Omit to inspect the current window. null explicitly selects no browser. */
    scope?: BrowserScope | null;
    /** Explicit host bridge, e.g. an Electron preload or your own extension. */
    host?: {
        debuggerAttached?: boolean;
        agentActive?: boolean;
    };
    /** Opt-in selectors for known in-page agent UI. Presence is weak evidence only. */
    agentIndicatorSelectors?: readonly string[];
}
/** Detect positive automation evidence; absence of evidence never establishes a human. */
export declare function detectSession(options?: DetectOptions): Detection;
/** Declare who is driving this page. Call again on handoff; clear on session end. */
export declare function declareSessionDriver(driver: Driver | null, options?: DetectOptions): boolean;
export interface SessionSnapshot extends Detection {
    /** Aggregate counts only. Trusted browser events can also come from automation. */
    interactions: {
        trusted: number;
        synthetic: number;
    };
}
export interface SessionObserver {
    getSnapshot(): SessionSnapshot;
    /** Idempotent. Stops observing and clears subscriptions. */
    stop(): void;
    /** Notifications follow input events. Use getSnapshot() to recheck declarations/flags. */
    subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
}
/** Optional event observation. No timers, storage, network, or import-time listeners. */
export declare function observeSession(options?: DetectOptions): SessionObserver;
export { createSessionClassifier, toAnalyticsProperties, DETECTOR_VERSION } from './analytics.js';
export type { Segment, SegmentConfidence, SegmentAssessment, ClassifierOptions, SessionClassifier, PointerEvidence } from './analytics.js';
