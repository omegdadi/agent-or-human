/** Experimental aggregates, not a biometric identity or calibrated probability. */
export interface PointerEvidence {
    mode: 'off' | 'observe' | 'classify';
    mouseGestures: number;
    longTransitions: number;
    sparseTransitions: number;
    shortPresses: number;
    centeredClicks: number;
    centerSamples: number;
    uniformStraightPaths: number;
    fastMoves: number;
    maxSpeedPxPerMs: number | null;
    speedSamples: number;
    coalescedSamples: number;
    reasons: string[];
    automationPattern: boolean;
}
interface Input {
    isTrusted: boolean;
    pointerType?: string;
    pointerId?: number;
    isPrimary?: boolean;
    clientX?: number;
    clientY?: number;
    timeStamp?: number;
    button?: number;
    getCoalescedEvents?: () => Input[];
    target?: unknown;
}
export declare function createPointerCollector(mode: PointerEvidence['mode']): {
    record: (type: string, event: Input, now: number) => void;
    snapshot: (now: number) => PointerEvidence;
    reset: () => void;
    clear(): void;
};
export {};
