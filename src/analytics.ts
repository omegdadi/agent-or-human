import { detectSession, type DetectOptions, type Detection } from './index.js';

export const DETECTOR_VERSION = '0.2.0';
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
  behavior: { trustedEvents: number; syntheticEvents: number; modalities: string[]; activeSpanMs: number; variedCadence: boolean };
}
export interface ClassifierOptions extends DetectOptions {
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
  /** Freeze the last assessment and remove listeners. Idempotent. */
  stop(): void;
}
type Sample = { time: number; trusted: boolean; modality: string };
function cadence(samples: Sample[]) {
  const gaps = samples.slice(1).map((sample, i) => sample.time - samples[i].time);
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const deviation = Math.sqrt(gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length);
  return { varied: gaps.length >= 4 && mean > 0 && deviation / mean >= 0.25 && Math.max(...gaps) - Math.min(...gaps) >= 150,
    regular: gaps.length >= 10 && mean > 0 && deviation / mean < 0.1 };
}
/** Opt-in, local-only analytics heuristic. No storage, network, IDs, or experiment allocation. */
export function createSessionClassifier(options: ClassifierOptions = {}): SessionClassifier {
  const scope = options.scope === undefined ? (typeof window === 'undefined' ? null : window) : options.scope;
  const clock = options.now ?? Date.now;
  let lastTime = 0;
  const now = () => { const value = clock(); if (Number.isFinite(value)) lastTime = Math.max(lastTime, value); return lastTime; };
  const samples: Sample[] = [];
  let lastSample = -Infinity;
  let stopped = false;
  let current: SegmentAssessment | undefined;
  const subscribers = new Set<(value: SegmentAssessment) => void>();
  const removers: (() => void)[] = [];
  const copy = (value: SegmentAssessment): SegmentAssessment => ({ ...value, reasons: [...value.reasons], behavior: { ...value.behavior, modalities: [...value.behavior.modalities] }, detection: { ...value.detection, signals: value.detection.signals.map(signal => ({ ...signal })) } });
  function refresh(): SegmentAssessment {
    if (stopped && current) return copy(current);
    const timestamp = now();
    while (samples.length && timestamp - samples[0].time > 30_000) samples.shift();
    const detection = detectSession({ ...options, scope });
    const trusted = samples.filter(sample => sample.trusted);
    const synthetic = samples.filter(sample => !sample.trusted);
    const modalities = [...new Set(trusted.map(sample => sample.modality))];
    const activeSpanMs = trusted.length > 1 ? trusted[trusted.length - 1].time - trusted[0].time : 0;
    const variedCadence = cadence(trusted).varied;
    let segment: Segment = 'unclassified';
    let confidence: SegmentConfidence = 'insufficient';
    let basis: SegmentAssessment['basis'] = 'none';
    let reasons = ['insufficient-interaction-evidence'];
    const codes = detection.signals.map(signal => signal.code);
    if (detection.verdict === 'unsupported') reasons = ['no-browser-document'];
    else if (detection.agentic === true) {
      segment = 'declared_agent'; confidence = 'declared'; basis = 'declaration'; reasons = codes.filter(code => code === 'declared-agent' || code === 'host-agent-active');
    } else if (detection.automated === true) {
      segment = 'likely_automated'; confidence = 'strong_signal'; basis = 'browser_signal'; reasons = ['webdriver'];
    } else if (codes.includes('headless-user-agent') && synthetic.length >= 12 && synthetic.length / samples.length >= 0.9 && synthetic[synthetic.length - 1].time - synthetic[0].time >= 3000 && cadence(synthetic).regular) {
      segment = 'likely_automated'; confidence = 'heuristic'; basis = 'behavior'; reasons = ['headless-user-agent', 'regular-synthetic-input'];
    } else if (!codes.includes('headless-user-agent') && !codes.includes('agent-ui-indicator') && variedCadence && trusted.length / samples.length >= 0.9 && ((trusted.length >= 6 && activeSpanMs >= 3000 && modalities.length >= 2) || (trusted.length >= 10 && activeSpanMs >= 6000))) {
      segment = 'likely_human'; confidence = 'heuristic'; basis = 'behavior'; reasons = ['varied-trusted-interactions', modalities.length >= 2 ? 'multiple-input-modalities' : 'sustained-single-modality'];
    } else if (detection.verdict === 'human') reasons = ['human-declaration-not-independently-verified'];
    const changed = current !== undefined && (current.segment !== segment || current.confidence !== confidence || current.basis !== basis);
    current = { segment, confidence, basis, reasons, detectorVersion: DETECTOR_VERSION, assessedAt: timestamp, changedAt: !current || changed ? timestamp : current.changedAt, revision: current ? current.revision + Number(changed) : 0, environment: detection.verdict === 'unsupported' ? 'unsupported' : 'browser', detection, behavior: { trustedEvents: trusted.length, syntheticEvents: synthetic.length, modalities, activeSpanMs, variedCadence } };
    if (changed) for (const listener of [...subscribers]) {
      // Analytics consumer failures must not break classification or other subscribers.
      try { listener(copy(current)); } catch { /* Consumer owns its reporting errors. */ }
    }
    return copy(current);
  }
  refresh();
  try {
    if (scope?.document && scope.addEventListener && scope.removeEventListener) {
      for (const [type, modality] of [['pointerdown', 'pointer'], ['keydown', 'keyboard'], ['wheel', 'scroll']]) {
        const listener = (event: { isTrusted: boolean; repeat?: boolean }) => {
          if (stopped || event.repeat) return;
          const time = now();
          // Coalesce bursts and duplicate gestures; do not retain targets, keys, or coordinates.
          if (time - lastSample < 150) return;
          lastSample = time;
          samples.push({ time, trusted: event.isTrusted === true, modality });
          if (samples.length > 32) samples.shift();
          refresh();
        };
        scope.addEventListener(type, listener, true);
        removers.push(() => scope.removeEventListener?.(type, listener, true));
      }
    }
  } catch { /* Restricted host: explicit refresh remains usable. */ }
  return {
    getSnapshot: () => copy(current!), refresh,
    subscribe(listener) { if (stopped) return () => {}; subscribers.add(listener); return () => { subscribers.delete(listener); }; },
    stop() { if (stopped) return; stopped = true; for (const remove of removers) { try { remove(); } catch { /* restricted host */ } } subscribers.clear(); samples.length = 0; },
  };
}
/** Flattened event properties for your existing analytics client. Sends nothing. */
export function toAnalyticsProperties(assessment: SegmentAssessment) {
  return {
    session_driver_segment: assessment.segment,
    session_driver_confidence: assessment.confidence,
    session_driver_basis: assessment.basis,
    session_driver_reasons: [...assessment.reasons],
    session_driver_signals: assessment.detection.signals.map(signal => signal.code),
    session_driver_version: assessment.detectorVersion,
    session_driver_assessed_at: assessment.assessedAt,
    session_driver_changed_at: assessment.changedAt,
    session_driver_revision: assessment.revision,
    session_driver_environment: assessment.environment,
  };
}
