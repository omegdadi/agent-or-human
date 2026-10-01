import type { SessionMonitor } from './monitor.js';
export type BotDResult = { bot: false } | { bot: true; botKind: string };
/** Structural interface: consumers supply BotD, keeping it out of the core bundle. */
export interface BotDDetector { collect(): Promise<unknown>; detect(): BotDResult | Promise<BotDResult> }
export interface BotDConnection { refresh(): Promise<BotDResult | null>; stop(): void }
/** Refreshes BotD's collected inputs, records provenance and expiry, never infers human from bot:false. */
export function connectBotD(monitor: SessionMonitor, detector: BotDDetector, options: { ttlMs?: number } = {}): BotDConnection {
  const ttlMs = options.ttlMs ?? 60000;
  if (!Number.isFinite(ttlMs) || ttlMs < 1 || ttlMs > 3600000) throw new RangeError('ttlMs must be 1–3600000');
  let stopped = false;
  let pending: Promise<BotDResult | null> | undefined;
  return {
    refresh() {
      if (stopped || monitor.stopped || monitor.assessment.environment !== 'browser') return Promise.resolve(null);
      if (pending) return pending;
      pending = Promise.resolve().then(async () => {
        if (stopped || monitor.stopped) return null;
        await detector.collect();
        if (stopped || monitor.stopped) return null;
        const result = await detector.detect();
        if (stopped || monitor.stopped) return null;
        if (!result || typeof result.bot !== 'boolean' || (result.bot && typeof result.botKind !== 'string')) throw new TypeError('Invalid BotD result');
        const safe: BotDResult = result.bot ? { bot: true, botKind: result.botKind } : { bot: false };
        monitor.setAutomationEvidence('botd', { automated: safe.bot, kind: safe.bot ? safe.botKind : undefined, ttlMs });
        return safe;
      }).catch(error => {
        if (!stopped && !monitor.stopped) monitor.setAutomationEvidence('botd', null);
        throw error;
      }).finally(() => { pending = undefined; });
      return pending;
    },
    stop() { if (stopped) return; stopped = true; if (!monitor.stopped) monitor.setAutomationEvidence('botd', null); },
  };
}
