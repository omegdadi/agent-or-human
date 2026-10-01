import type { SessionMonitor } from './monitor.js';
export type BotDResult = {
    bot: false;
} | {
    bot: true;
    botKind: string;
};
/** Structural interface: consumers supply BotD, keeping it out of the core bundle. */
export interface BotDDetector {
    collect(): Promise<unknown>;
    detect(): BotDResult | Promise<BotDResult>;
}
export interface BotDConnection {
    refresh(): Promise<BotDResult | null>;
    stop(): void;
}
/** Refreshes BotD's collected inputs, records provenance and expiry, never infers human from bot:false. */
export declare function connectBotD(monitor: SessionMonitor, detector: BotDDetector, options?: {
    ttlMs?: number;
}): BotDConnection;
