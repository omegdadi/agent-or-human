import type { SessionMonitor } from './monitor.js';
import type { Segment, SegmentConfidence } from './analytics.js';
export interface SessionHistoryEntry { at: number; from: Segment; to: Segment; confidence: SegmentConfidence; reasons: string[] }
export interface SessionHistorySummary {
  durationMs: number;
  durationsMs: Record<Segment, number>;
  transitionCount: number;
  /** Both kinds of evidence occurred; this is not proof of a human/agent handoff. */
  mixedEvidence: boolean;
}
export interface SessionHistory { getEntries(): SessionHistoryEntry[]; getSummary(): SessionHistorySummary; stop(): void }
/** Bounded, local, wall-clock evidence history. No navigation history, identity, or analytics transport. */
export function createSessionHistory(monitor: SessionMonitor, options: { limit?: number; now?: () => number } = {}): SessionHistory {
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError('limit must be 1–1000');
  const clock = options.now ?? Date.now;
  let lastTime = 0;
  const now = () => { const value = clock(); if (Number.isFinite(value)) lastTime = Math.max(lastTime, value); return lastTime; };
  const started = now(); let since = started; let ended: number | undefined;
  let state = monitor.state; let transitions = 0;
  let human = state === 'likely_human'; let automated = state === 'likely_automated' || state === 'declared_agent';
  const durations: Record<Segment, number> = { unclassified: 0, likely_human: 0, likely_automated: 0, declared_agent: 0 };
  const entries: SessionHistoryEntry[] = [];
  const listener = (event: import('./monitor.js').SessionChangeEvent) => {
    if (ended !== undefined) return;
    const at = now(); durations[state] += at - since; since = at; state = event.state; transitions++;
    human ||= state === 'likely_human'; automated ||= state === 'likely_automated' || state === 'declared_agent';
    entries.push({ at, from: event.previousState, to: state, confidence: event.assessment.confidence, reasons: [...event.assessment.reasons] });
    if (entries.length > limit) entries.shift();
  };
  monitor.addEventListener('statechange', listener);
  return {
    getEntries: () => entries.map(e => ({ ...e, reasons: [...e.reasons] })),
    getSummary() { const at = ended ?? now(); return { durationMs: at - started, durationsMs: { ...durations, [state]: durations[state] + at - since }, transitionCount: transitions, mixedEvidence: human && automated }; },
    stop() { if (ended !== undefined) return; ended = now(); monitor.removeEventListener('statechange', listener); },
  };
}
