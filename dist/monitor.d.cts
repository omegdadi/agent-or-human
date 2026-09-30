import { type ClassifierOptions, type Segment, type SegmentAssessment } from './analytics.cjs';
import type { DetectOptions } from './index.cjs';
export type SessionEventType = 'statechange' | 'assessmentchange';
/** Structural types keep SSR/native TypeScript consumers independent of DOM libraries. */
export interface SessionAbortSignal {
    readonly aborted: boolean;
    addEventListener(type: 'abort', listener: () => void, options?: {
        once?: boolean;
    }): void;
    removeEventListener(type: 'abort', listener: () => void): void;
}
export interface SessionListenerOptions {
    capture?: boolean;
    once?: boolean;
    signal?: SessionAbortSignal;
}
export interface SessionChangeEvent {
    readonly type: SessionEventType;
    readonly target: SessionMonitor;
    readonly state: Segment;
    readonly previousState: Segment;
    /** A fresh copy on every read; consumers cannot mutate the monitor or another listener's evidence. */
    readonly assessment: SegmentAssessment;
    readonly previousAssessment: SegmentAssessment;
}
export type SessionEventListener = ((this: SessionMonitor, event: SessionChangeEvent) => void) | {
    handleEvent(event: SessionChangeEvent): void;
};
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
    wrapWebMCPTool<This, Args extends unknown[], Result>(execute: (this: This, ...args: Args) => Result): (this: This, ...args: Args) => Result;
    /** Remove listeners, polling, and input collection; freeze the last assessment. */
    stop(): void;
}
/** Browser-style listener ergonomics on an owned monitor; does not patch window/document/navigator.
 * This is a scoped emitter, not a DOM EventTarget: events do not bubble or support cancellation.
 */
export declare function createSessionMonitor(options?: SessionMonitorOptions): SessionMonitor;
