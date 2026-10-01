import type { SessionMonitor } from './monitor.cjs';
import type { Segment, SegmentConfidence } from './analytics.cjs';
export interface SessionHistoryEntry {
    at: number;
    from: Segment;
    to: Segment;
    confidence: SegmentConfidence;
    reasons: string[];
}
export interface SessionHistorySummary {
    durationMs: number;
    durationsMs: Record<Segment, number>;
    transitionCount: number;
    /** Both kinds of evidence occurred; this is not proof of a human/agent handoff. */
    mixedEvidence: boolean;
}
export interface SessionHistory {
    getEntries(): SessionHistoryEntry[];
    getSummary(): SessionHistorySummary;
    stop(): void;
}
/** Bounded, local, wall-clock evidence history. No navigation history, identity, or analytics transport. */
export declare function createSessionHistory(monitor: SessionMonitor, options?: {
    limit?: number;
    now?: () => number;
}): SessionHistory;
