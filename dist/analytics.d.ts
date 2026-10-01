import { type PointerEvidence } from './pointer.js';
export type { PointerEvidence } from './pointer.js';
import { type DetectOptions, type Detection } from './index.js';
export declare const DETECTOR_VERSION = "0.8.0";
export type Segment = 'likely_human' | 'likely_automated' | 'declared_agent' | 'unclassified';
/** Evidence quality, not a calibrated probability of identity. */
export type SegmentConfidence = 'insufficient' | 'heuristic' | 'strong_signal' | 'declared';
export interface AutomationEvidence {
    source: string;
    automated: boolean;
    kind?: string;
    observedAt: number;
    expiresAt: number;
}
export interface SegmentAssessment {
    segment: Segment;
    confidence: SegmentConfidence;
    basis: 'none' | 'behavior' | 'browser_signal' | 'declaration' | 'provider';
    reasons: string[];
    detectorVersion: string;
    assessedAt: number;
    changedAt: number;
    revision: number;
    environment: 'browser' | 'unsupported';
    detection: Detection;
    pointer: PointerEvidence;
    providers: AutomationEvidence[];
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
    wrapWebMCPTool<This, Args extends unknown[], Result>(execute: (this: This, ...args: Args) => Result): (this: This, ...args: Args) => Result;
    /** Freeze the last assessment and remove listeners. Idempotent. */
    stop(): void;
}
/** Opt-in, local-only analytics heuristic. No storage, network, IDs, or experiment allocation. */
export declare function createSessionClassifier(options?: ClassifierOptions): SessionClassifier;
/** Internal assessment channel for the monitor; public subscriptions remain transition-only. */
export declare function createClassifier(options: ClassifierOptions, onAssessment?: (assessment: SegmentAssessment) => void, readProviders?: (now: number) => AutomationEvidence[]): SessionClassifier;
/** Flattened event properties for your existing analytics client. Sends nothing. */
export declare function toAnalyticsProperties(assessment: SegmentAssessment): {
    agent_or_human_segment: Segment;
    agent_or_human_confidence: SegmentConfidence;
    agent_or_human_basis: "declaration" | "none" | "behavior" | "browser_signal" | "provider";
    agent_or_human_reasons: string[];
    agent_or_human_signals: ("declared-agent" | "declared-human" | "webdriver" | "unreadable-property" | "declaration-conflict" | "debugger-attached" | "agent-ui-indicator" | "invalid-selector" | "host-agent-active" | "webmcp-available" | "webmcp-tool-invoked")[];
    agent_or_human_version: string;
    agent_or_human_assessed_at: number;
    agent_or_human_changed_at: number;
    agent_or_human_revision: number;
    agent_or_human_environment: "browser" | "unsupported";
    agent_or_human_provider_sources: string[];
    agent_or_human_automation_providers: string[];
    agent_or_human_pointer_mode: "off" | "observe" | "classify";
    agent_or_human_pointer_reasons: string[];
};
