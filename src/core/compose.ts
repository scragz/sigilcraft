/**
 * Stage 03 — compress the glyph.
 *
 * Three passes, because the four requirements (illegible / continuous /
 * distributed / circle-relating) fight each other in a single pass:
 *
 *   1. gesture library            (gestures.ts)
 *   2. chain, don't scatter       — entry of k onto exit of k-1, then fragment
 *   3. anneal for distribution    — hill-climb the rotation/scale vector
 *
 * Seeding is deterministic: seed = hash(letterSet.join('')). The same intent
 * always produces the same sigil, because the glyph is derived from the
 * statement rather than sampled alongside it.
 */

import { arcLengths, gestureFor, type Pt } from "./gestures";
import { mulberry32 } from "./rng";

/** Where a letter's surviving fragment sits along the finished stroke. */
export interface Segment {
  letter: string;
  /** Fraction of total arc length at which this letter's fragment begins. */
  start: number;
  end: number;
}

export interface Composition {
  letters: string[];
  seed: number;
  points: Pt[];
  segments: Segment[];
  /** SVG path data in a [-1, 1] unit-circle space, y down. */
  d: string;
  crossings: number;
  score: number;
}

/** The seal circle the mark reaches for but does not breach. */
export const SEAL_RADIUS = 0.88;
/** `pathLength` declared on the rendered path, so dash math needs no measuring. */
export const PATH_LENGTH = 1000;

const ANNEAL_ITERATIONS = 300;
const SAMPLE_COUNT = 128;

interface Params {
  rot: number[];
  scale: number[];
}

// ---------------------------------------------------------------------------
// Pass 2 — chain, don't scatter
// ---------------------------------------------------------------------------

/** Portion of each gesture's arc length that actually gets drawn. */
function fragmentRatios(letters: string[], rng: () => number): number[] {
  return letters.map((_, i) => {
    const drift = (i * 0.618 + rng()) % 1;
    return 0.35 + 0.35 * drift; // 0.35 – 0.70
  });
}

function build(letters: string[], params: Params, ratios: number[]) {
  const points: Pt[] = [];
  const segments: Segment[] = [];
  let cx = 0;
  let cy = 0;

  letters.forEach((letter, i) => {
    const raw = gestureFor(letter);
    const entry = raw[0]!;
    const cos = Math.cos(params.rot[i]!);
    const sin = Math.sin(params.rot[i]!);
    const s = params.scale[i]!;

    // Place this gesture's entry exactly on the previous gesture's exit.
    const placed: Pt[] = raw.map((p) => {
      const dx = (p[0] - entry[0]) * s;
      const dy = (p[1] - entry[1]) * s;
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos] as Pt;
    });

    // The cursor advances by the *whole* gesture even though only a fragment
    // is drawn: continuity is structural, and the undrawn remainder is what
    // the connector chord cuts across.
    const exit = placed[placed.length - 1]!;

    const acc = arcLengths(placed);
    const total = acc[acc.length - 1]!;
    const target = total * ratios[i]!;
    const startIndex = points.length;

    points.push(placed[0]!);
    for (let k = 1; k < placed.length; k++) {
      if (acc[k]! <= target) {
        points.push(placed[k]!);
        continue;
      }
      // Cut mid-edge so the fragment length is exact rather than quantised.
      const span = acc[k]! - acc[k - 1]!;
      const t = span > 1e-9 ? (target - acc[k - 1]!) / span : 0;
      const a = placed[k - 1]!;
      const b = placed[k]!;
      if (t > 1e-6) points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      break;
    }

    segments.push({ letter, start: startIndex, end: points.length - 1 });
    cx = exit[0];
    cy = exit[1];
  });

  return { points, segments };
}

// ---------------------------------------------------------------------------
// Pass 3 — anneal for distribution
// ---------------------------------------------------------------------------

/** Even resampling, so the metrics measure geometry rather than vertex density. */
function resample(pts: Pt[], count: number): Pt[] {
  if (pts.length < 2) return [...pts];
  const acc = arcLengths(pts);
  const total = acc[acc.length - 1]!;
  if (total <= 1e-9) return [pts[0]!];
  const out: Pt[] = [];
  let k = 1;
  for (let i = 0; i < count; i++) {
    const target = (total * i) / (count - 1);
    while (k < acc.length - 1 && acc[k]! < target) k++;
    const span = acc[k]! - acc[k - 1]!;
    const t = span > 1e-9 ? (target - acc[k - 1]!) / span : 0;
    const a = pts[k - 1]!;
    const b = pts[k]!;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

const radius = (p: Pt) => Math.hypot(p[0], p[1]);

function centroid(pts: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/** Occupancy entropy over an n x n grid, normalised to [0, 1]. Want high. */
function gridEntropy(pts: Pt[], n: number): number {
  const bins = new Array(n * n).fill(0);
  for (const p of pts) {
    const gx = Math.min(n - 1, Math.max(0, Math.floor(((p[0] + 1) / 2) * n)));
    const gy = Math.min(n - 1, Math.max(0, Math.floor(((p[1] + 1) / 2) * n)));
    bins[gy * n + gx]++;
  }
  let h = 0;
  for (const c of bins) {
    if (!c) continue;
    const p = c / pts.length;
    h -= p * Math.log(p);
  }
  return h / Math.log(n * n);
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(a, b, c);
  const d2 = o(a, b, d);
  const d3 = o(c, d, a);
  const d4 = o(c, d, b);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/**
 * Self-intersections. Load-bearing: a mark reads as one thing largely because
 * it crosses itself. Zero crossings reads as a chain of separate marks however
 * continuous the path technically is.
 */
function countCrossings(pts: Pt[]): number {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      if (segmentsCross(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!)) n++;
    }
  }
  return n;
}

/** Spread of stroke directions, mod pi. Penalises an all-parallel mark. */
function angleDiversity(pts: Pt[]): number {
  const bins = new Array(8).fill(0);
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]![0] - pts[i - 1]![0];
    const dy = pts[i]![1] - pts[i - 1]![1];
    if (Math.hypot(dx, dy) < 1e-9) continue;
    let a = Math.atan2(dy, dx);
    if (a < 0) a += Math.PI;
    if (a >= Math.PI) a -= Math.PI;
    bins[Math.min(7, Math.floor((a / Math.PI) * 8))]++;
    total++;
  }
  if (!total) return 0;
  let h = 0;
  for (const c of bins) {
    if (!c) continue;
    const p = c / total;
    h -= p * Math.log(p);
  }
  return h / Math.log(8);
}

function score(pts: Pt[]): { value: number; crossings: number } {
  const cov = gridEntropy(pts, 5); // want high
  const rMax = Math.max(...pts.map(radius));
  const fit = -Math.abs(rMax - SEAL_RADIUS); // reach the circle, don't breach it
  const c = centroid(pts);
  const cen = -Math.hypot(c[0], c[1]); // centered mass
  const crossings = countCrossings(pts);
  const xing = -Math.abs(crossings - 3); // self-intersection = one object
  const ang = angleDiversity(pts); // penalize all-parallel
  return { value: 2 * cov + 3 * fit + 1.5 * cen + xing + ang, crossings };
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

function toPathData(pts: Pt[]): string {
  if (!pts.length) return "";
  const fmt = (n: number) => (Math.round(n * 10000) / 10000).toString();
  let d = `M ${fmt(pts[0]![0])} ${fmt(pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${fmt(pts[i]![0])} ${fmt(pts[i]![1])}`;
  return d;
}

/** Keep the finished mark inside the seal without discarding the annealed shape. */
function normalise(pts: Pt[]): Pt[] {
  if (!pts.length) return pts;
  const c = centroid(pts);
  const centred = pts.map((p) => [p[0] - c[0], p[1] - c[1]] as Pt);
  const rMax = Math.max(...centred.map(radius));
  if (rMax <= 1e-9) return centred;
  // Shrink a mark that breaches the circle; grow one that never reaches it.
  if (rMax <= SEAL_RADIUS && rMax >= SEAL_RADIUS * 0.68) return centred;
  const k = SEAL_RADIUS / rMax;
  return centred.map((p) => [p[0] * k, p[1] * k] as Pt);
}

export function compose(letters: string[], seed: number): Composition {
  const rng = mulberry32(seed);
  const ratios = fragmentRatios(letters, rng);

  const params: Params = {
    rot: letters.map(() => rng() * Math.PI * 2),
    scale: letters.map(() => 0.7 + rng() * 0.5),
  };

  let best = build(letters, params, ratios);
  let bestScore = score(resample(best.points, SAMPLE_COUNT)).value;

  // Hill climb: perturb one coordinate of the rotation/scale vector at a time,
  // keep the move only if the mark got better by the score above.
  for (let iter = 0; iter < ANNEAL_ITERATIONS; iter++) {
    const cool = 1 - iter / ANNEAL_ITERATIONS;
    const i = Math.floor(rng() * letters.length);
    const touchRotation = rng() < 0.65;
    const prev = touchRotation ? params.rot[i]! : params.scale[i]!;

    if (touchRotation) {
      params.rot[i] = prev + (rng() - 0.5) * Math.PI * cool;
    } else {
      params.scale[i] = Math.min(1.6, Math.max(0.45, prev + (rng() - 0.5) * 0.5 * cool));
    }

    const candidate = build(letters, params, ratios);
    const value = score(resample(candidate.points, SAMPLE_COUNT)).value;
    if (value > bestScore) {
      best = candidate;
      bestScore = value;
    } else if (touchRotation) {
      params.rot[i] = prev;
    } else {
      params.scale[i] = prev;
    }
  }

  const points = normalise(best.points);
  const acc = arcLengths(points);
  const total = acc[acc.length - 1] || 1;
  const segments: Segment[] = best.segments.map((s) => ({
    letter: s.letter,
    start: (acc[s.start] ?? 0) / total,
    end: (acc[s.end] ?? 0) / total,
  }));

  const final = score(resample(points, SAMPLE_COUNT));

  return {
    letters,
    seed,
    points,
    segments,
    d: toPathData(points),
    crossings: final.crossings,
    score: final.value,
  };
}
