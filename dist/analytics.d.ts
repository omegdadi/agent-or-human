import { type PointerEvidence } from './pointer.js';
export type { PointerEvidence } from './pointer.js';
import { type DetectOptions, type Detection } from './index.js';
export declare const DETECTOR_VERSION = "0.4.0";
export type Segment = 'likely_human' | 'likely_automated' | 'declared_agent' | 'unclassified';
/** Evidence quality, not a calibrated probability of identity. */
export type SegmentConfidence = 'insufficient' | 'heuristic' | 'strong_signal' | 'declared';
export interface SegmentAssessment {
    segment: Segment;
    confidence: SegmentConfidence;
    basis: 'none' | 'behavior' | 'browser_signal' | 'declaration';
    reasons: string[];
    detectorVersion: string;
    assessedAt: number;
    changedAt: number;
    revision: number;
    environment: 'browser' | 'unsupported';
    detection: Detection;
    pointer: PointerEvidence;
    behavior: {
        trustedEvents: number;
        syntheticEvents: number;
        modalities: string[];
        activeSpanMs: number;
        variedCadence: boolean;
    };
}
export interface ClassifierOptions extends DetectOptions {
    /** Opt-in experimental mouse analysis. Observe exposes aggregates; classify enables uncalibrated fusion. Default off. */
    pointerAnalysis?: 'observe' | 'classify';
    /** Optional clock for deterministic testing; defaults to Date.now. */
    now?: () => number;
}
export interface SessionClassifier {
    /** Last assessment, isolated from consumer mutation. */
    getSnapshot(): SegmentAssessment;
    /** Recheck flags, declarations, and the rolling behavior window. */
    refresh(): SegmentAssessment;
    /** Emits only when segment, confidence, or basis changes. No automatic initial event. */
    subscribe(listener: (assessment: SegmentAssessment) => void): () => void;
    /** Wrap only a WebMCP tool's execute callback. Records recent tool use, not agent identity.
     * Page scripts can also invoke tools; this is heuristic evidence. No arguments/results are retained. */
    wrapWebMCPTool<Args extends unknown[], Result>(execute: (...args: Args) => Result): (...args: Args) => Result;
    /** Freeze the last assessment and remove listeners. Idempotent. */
    stop(): void;
}
/** Opt-in, local-only analytics heuristic. No storage, network, IDs, or experiment allocation. */
export declare function createSessionClassifier(options?: ClassifierOptions): SessionClassifier;
/** Flattened event properties for your existing analytics client. Sends nothing. */
export declare function toAnalyticsProperties(assessment: SegmentAssessment): {
    session_driver_segment: Segment;
    session_driver_confidence: SegmentConfidence;
    session_driver_basis: "declaration" | "none" | "behavior" | "browser_signal";
    session_driver_reasons: string[];
    session_driver_signals: ("declared-agent" | "declared-human" | "webdriver" | "headless-user-agent" | "unreadable-property" | "declaration-conflict" | "debugger-attached" | "agent-ui-indicator" | "invalid-selector" | "host-agent-active" | "webmcp-available" | "webmcp-tool-invoked")[];
    session_driver_version: string;
    session_driver_assessed_at: number;
    session_driver_changed_at: number;
    session_driver_revision: number;
    session_driver_environment: "unsupported" | "browser";
    session_driver_pointer_mode: "off" | "observe" | "classify";
    session_driver_pointer_reasons: string[];
};
