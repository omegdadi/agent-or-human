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
  isTrusted: boolean; pointerType?: string; pointerId?: number; isPrimary?: boolean;
  clientX?: number; clientY?: number; timeStamp?: number; button?: number;
  getCoalescedEvents?: () => Input[]; target?: unknown;
}
type Point = { x: number; y: number; t: number };
type Gesture = { time: number; long: boolean; sparse: boolean; short: boolean; centered: boolean | null; uniform: boolean };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
function point(event: Input): Point | null {
  return finite(event.clientX) && finite(event.clientY) && finite(event.timeStamp)
    ? { x: event.clientX, y: event.clientY, t: event.timeStamp } : null;
}
function centerHit(target: unknown, p: Point): boolean | null {
  try {
    const element = (target as Element)?.closest?.('button,a[href],input,select,[role="button"]');
    if (!element) return null;
    const box = element.getBoundingClientRect();
    if (box.width < 16 || box.height < 16) return null;
    return Math.abs(p.x - (box.left + box.width / 2)) <= 1 && Math.abs(p.y - (box.top + box.height / 2)) <= 1;
  } catch { return null; }
}
export function createPointerCollector(mode: PointerEvidence['mode']) {
  let previous: Point | null = null;
  let previousAt = -Infinity;
  let pointerId: number | undefined;
  let points: Point[] = [];
  let overflow = false;
  let down: { p: Point; id: number | undefined; at: number; long: boolean; sparse: boolean; centered: boolean | null; uniform: boolean } | null = null;
  const gestures: Gesture[] = [];
  const movement: { time: number; speed: number; coalesced: number }[] = [];
  function reset() { previous = null; previousAt = -Infinity; points = []; down = null; overflow = false; pointerId = undefined; }
  function prune(now: number) {
    while (gestures.length && now - gestures[0].time > 30_000) gestures.shift();
    while (movement.length && now - movement[0].time > 30_000) movement.shift();
    if (previous && now - previousAt > 10_000) reset();
  }
  function record(type: string, event: Input, now: number) {
    prune(now);
    if (mode === 'off' || !event.isTrusted) return;
    if (event.pointerType !== 'mouse' || event.isPrimary === false) { reset(); return; }
    if (pointerId !== undefined && event.pointerId !== pointerId) reset();
    pointerId = event.pointerId;
    const p = point(event);
    if (!p) { reset(); return; }
    if (type === 'pointermove') {
      if (down) return; // No inference from dragging.
      let batch: Input[] = [event];
      let coalesced = 0;
      try { const raw = event.getCoalescedEvents?.(); if (raw?.length) { batch = raw.slice(-128); coalesced = batch.length; if (raw.length > 128) overflow = true; } } catch { /* optional API */ }
      for (const item of batch) {
        const next = point(item); if (!next) continue;
        const last = points[points.length - 1] ?? previous;
        if (last && next.t <= last.t) continue; // Rounded/equal timestamps cannot prove speed.
        if (last) {
          const dt = next.t - last.t; const length = distance(last, next);
          if (dt > 0 && dt <= 100 && length >= 1) movement.push({ time: now, speed: length / dt, coalesced: 0 });
        }
        points.push(next);
        if (points.length > 128) { points.shift(); overflow = true; }
      }
      if (coalesced) movement.push({ time: now, speed: 0, coalesced });
      if (movement.length > 128) movement.splice(0, movement.length - 128);
      return;
    }
    if (event.button !== 0) { reset(); return; }
    if (type === 'pointerdown') {
      const long = previous !== null && distance(previous, p) >= 120;
      const path = previous ? [previous, ...points, p] : [];
      const lengths = path.slice(1).map((v, i) => distance(path[i], v));
      const pathLength = lengths.reduce((sum, n) => sum + n, 0);
      const speeds = path.slice(1).map((v, i) => ({ d: lengths[i], dt: v.t - path[i].t })).filter(v => v.d > 0 && v.dt > 0 && v.dt <= 100).map(v => v.d / v.dt);
      const mean = speeds.reduce((sum, v) => sum + v, 0) / speeds.length;
      const cv = Math.sqrt(speeds.reduce((sum, v) => sum + (v - mean) ** 2, 0) / speeds.length) / mean;
      const uniform = !overflow && long && points.length >= 6 && speeds.length >= 5 && pathLength > 0 && distance(path[0], p) / pathLength >= 0.995 && cv < 0.1;
      down = { p, id: event.pointerId, at: now, long, sparse: long && !overflow && points.length <= 2, centered: centerHit(event.target, p), uniform };
      return;
    }
    if (type === 'pointerup') {
      if (down && down.id === event.pointerId && now - down.at <= 2000 && p.t >= down.p.t && distance(down.p, p) <= 4) {
        const duration = p.t - down.p.t;
        // A zero delta may mean timer precision reduction; exclude it from timing evidence.
        gestures.push({ time: now, long: down.long, sparse: down.sparse, short: duration > 0 && duration <= 8, centered: down.centered, uniform: down.uniform });
        if (gestures.length > 16) gestures.shift();
      }
      previous = p; previousAt = now; points = []; overflow = false; down = null;
    }
  }
  function snapshot(now: number): PointerEvidence {
    prune(now);
    const count = (key: 'long' | 'sparse' | 'short' | 'uniform') => gestures.filter(g => g[key]).length;
    const longTransitions = count('long'); const sparseTransitions = count('sparse');
    const shortPresses = count('short'); const uniformStraightPaths = count('uniform');
    const centerSamples = gestures.filter(g => g.centered !== null).length;
    const centeredClicks = gestures.filter(g => g.centered).length;
    const reasons: string[] = [];
    if (sparseTransitions >= 4 && sparseTransitions / longTransitions >= 0.8) reasons.push('repeated-sparse-pointer-transitions');
    if (shortPresses >= 4 && shortPresses / gestures.length >= 0.8) reasons.push('repeated-short-pointer-presses');
    if (centeredClicks >= 5 && centeredClicks / centerSamples >= 0.9) reasons.push('repeated-exact-center-clicks');
    if (uniformStraightPaths >= 4 && uniformStraightPaths / longTransitions >= 0.8) reasons.push('repeated-uniform-straight-paths');
    const spatial = reasons.includes('repeated-sparse-pointer-transitions') || reasons.includes('repeated-uniform-straight-paths');
    const execution = reasons.includes('repeated-short-pointer-presses') || reasons.includes('repeated-exact-center-clicks');
    return { mode, mouseGestures: gestures.length, longTransitions, sparseTransitions, shortPresses, centeredClicks, centerSamples, uniformStraightPaths,
      fastMoves: movement.filter(m => m.speed >= 10).length,
      maxSpeedPxPerMs: movement.some(m => m.speed > 0) ? Math.round(Math.max(...movement.map(m => m.speed)) * 100) / 100 : null,
      speedSamples: movement.filter(m => m.speed > 0).length,
      coalescedSamples: movement.reduce((sum, m) => sum + m.coalesced, 0), reasons,
      automationPattern: spatial && execution };
  }
  return { record, snapshot, reset, clear() { reset(); gestures.length = 0; movement.length = 0; } };
}
