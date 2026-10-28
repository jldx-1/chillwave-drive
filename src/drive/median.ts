import { clamp } from './config';

export const MEDIAN_INTERVAL = 600;
export const MEDIAN_START = 240;
export const MEDIAN_LENGTH = 84;
export interface MedianGate { id: number; start: number; end: number; open: boolean; warning: boolean; lift: number }

/** A deterministic schedule shared by collision geometry, signs, and the map. */
export function medianGate(s: number, time: number, held?: number): MedianGate {
  const id = Math.floor(s / MEDIAN_INTERVAL);
  const start = id * MEDIAN_INTERVAL + MEDIAN_START;
  const phase = ((time + id * 5) % 24 + 24) % 24;
  const open = phase < 17 || held === id;
  return { id, start, end: start + MEDIAN_LENGTH, open, warning: open && phase >= 14 && held !== id,
    lift: held === id ? 1 : phase < 1 ? phase : phase < 16 ? 1 : phase < 17 ? 17 - phase : 0 };
}

export function medianIsOpen(s: number, time: number, held?: number, margin = 0): boolean {
  const gate = medianGate(s, time, held);
  // The gate remains impassable until fully retracted, and while lowering.
  return gate.open && gate.lift >= .99 && s >= gate.start + margin && s <= gate.end - margin;
}

export function medianBarriers(s: number, time: number, held?: number) {
  const result: { id: number; x: number; s: number; width: number; length: number }[] = [];
  const current = Math.floor(s / MEDIAN_INTERVAL);
  for (let id = current - 1; id <= current + 1; id++) {
    const base = id * MEDIAN_INTERVAL, gate = medianGate(base, time, held);
    const spans = [[base, gate.start], [gate.end, base + MEDIAN_INTERVAL]];
    if (!medianIsOpen((gate.start + gate.end) / 2, time, held)) spans.push([gate.start, gate.end]);
    for (let part = 0; part < spans.length; part++) {
      const [a, b] = spans[part];
      result.push({ id: -2000000 + id * 3 + part, x: 0, s: (a + b) / 2, width: .65, length: b - a });
    }
  }
  return result;
}

/** Limit a requested crossing to the side occupied before meeting a closed median. */
export function constrainMedian(x: number, s: number, oldX: number, time: number, held?: number): number {
  // A car already straddling the center meets the end cap in the contact solver.
  if (Math.abs(oldX) < 1.25 || medianIsOpen(s, time, held)) return x;
  return oldX < 0 ? clamp(x, -15.45, -1.25) : clamp(x, 1.25, 100);
}
