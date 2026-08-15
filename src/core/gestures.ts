/**
 * Stage 03, pass 1 — the gesture library.
 *
 * Each consonant maps to one stroke in unit space, sampled as a polyline.
 * `entry` is the first point and `exit` is the last; pass 2 chains gesture k's
 * entry onto gesture k-1's exit.
 *
 * The gestures are deliberately distinct from one another — K angular, S a
 * double curve, T a cross — so that isolation-recognizability holds. A letter
 * lifted out of a finished mark should still read as that letter; the mark as a
 * whole should not.
 */

export type Pt = readonly [number, number];

/** Sampled elliptical arc. Angles in turns (1 = full circle), y down. */
function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  steps = 14,
): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    const a = t * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

const line = (...pts: Pt[]): Pt[] => pts;
const join = (...runs: Pt[][]): Pt[] => {
  const out: Pt[] = [];
  for (const run of runs) {
    for (const p of run) {
      const last = out[out.length - 1];
      if (last && last[0] === p[0] && last[1] === p[1]) continue;
      out.push(p);
    }
  }
  return out;
};

/**
 * One stroke per consonant, drawn top-to-bottom in a roughly [-0.5, 0.5] box.
 * Letters that are conventionally multi-stroke (T, X, F, H) retrace instead of
 * lifting, which keeps the chain continuous without flattening their shape.
 */
export const GESTURES: Record<string, Pt[]> = {
  // Spine with two bellies.
  B: join(
    line([-0.28, -0.5], [-0.28, 0.5]),
    arc(-0.28, 0.25, 0.34, 0.25, 0.25, -0.25, 10),
    arc(-0.28, -0.25, 0.3, 0.25, 0.25, -0.25, 10),
  ),
  // Open arc, gap facing right.
  C: arc(0.05, 0, 0.42, 0.46, 0.1, 0.4, 18),
  // Straight back, bowed front.
  D: join(line([-0.3, 0.5], [-0.3, -0.5]), arc(-0.3, 0, 0.36, 0.5, -0.25, 0.25, 16)),
  // Two bars off a stem, retraced.
  F: join(
    line([-0.3, 0.5], [-0.3, -0.5], [0.3, -0.5], [-0.3, -0.5], [-0.3, 0.0], [0.16, 0.0]),
  ),
  // C with the hook turned inward.
  G: join(arc(0.02, 0, 0.42, 0.46, 0.08, 0.42, 18), line([0.02, 0.12], [-0.16, 0.12])),
  // Two posts bridged, retraced.
  H: join(line([-0.3, -0.5], [-0.3, 0.5], [-0.3, 0.0], [0.3, 0.0], [0.3, -0.5], [0.3, 0.5])),
  // Descender with a hook at the foot.
  J: join(line([0.22, -0.5], [0.22, 0.28]), arc(-0.02, 0.28, 0.24, 0.22, 0, 0.25, 8)),
  // Angular: chevron into the stem.
  K: join(line([-0.3, -0.5], [-0.3, 0.5], [-0.3, 0.06], [0.32, -0.5], [-0.3, 0.06], [0.32, 0.5])),
  // Right angle.
  L: line([-0.24, -0.5], [-0.24, 0.44], [0.3, 0.44]),
  // Four-stroke zigzag.
  M: line([-0.4, 0.5], [-0.4, -0.5], [0, 0.14], [0.4, -0.5], [0.4, 0.5]),
  // Three-stroke zigzag.
  N: line([-0.32, 0.5], [-0.32, -0.5], [0.32, 0.5], [0.32, -0.5]),
  // Stem with a closed head.
  P: join(line([-0.28, 0.5], [-0.28, -0.5]), arc(-0.28, -0.24, 0.34, 0.26, 0.25, -0.25, 12)),
  // Ring with a tail crossing it.
  Q: join(arc(0, -0.06, 0.38, 0.38, 0, 1, 22), line([0.12, 0.16], [0.38, 0.5])),
  // P with a leg thrown out.
  R: join(
    line([-0.28, 0.5], [-0.28, -0.5]),
    arc(-0.28, -0.24, 0.32, 0.26, 0.25, -0.25, 12),
    line([-0.28, 0.02], [0.32, 0.5]),
  ),
  // Double curve.
  S: join(arc(0.0, -0.24, 0.3, 0.26, 0.12, -0.32, 14), arc(0.0, 0.24, 0.3, 0.26, 0.68, 0.18, 14)),
  // Cross: bar retraced back to centre, then the stem.
  T: line([-0.36, -0.44], [0.36, -0.44], [0.0, -0.44], [0.0, 0.5]),
  // Single vertex.
  V: line([-0.34, -0.5], [0.0, 0.5], [0.34, -0.5]),
  // Double vertex.
  W: line([-0.44, -0.5], [-0.2, 0.5], [0.0, -0.2], [0.2, 0.5], [0.44, -0.5]),
  // Diagonal, retraced, then its opposite.
  X: line([-0.36, -0.46], [0.36, 0.46], [0.0, 0.0], [0.36, -0.46], [0.0, 0.0], [-0.36, 0.46]),
  // Two arms into a stem. (Declared a consonant — see stage 02.)
  Y: line([-0.32, -0.5], [0.0, -0.04], [0.32, -0.5], [0.0, -0.04], [0.0, 0.5]),
  // Bar, diagonal, bar.
  Z: line([-0.34, -0.44], [0.34, -0.44], [-0.34, 0.44], [0.34, 0.44]),
};

/** Fallback for any consonant the library somehow misses. */
export const DEFAULT_GESTURE: Pt[] = line([-0.3, -0.3], [0.3, 0.3]);

export function gestureFor(letter: string): Pt[] {
  return GESTURES[letter] ?? DEFAULT_GESTURE;
}

/** Cumulative arc length along a polyline. */
export function arcLengths(pts: readonly Pt[]): number[] {
  const acc: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]![0] - pts[i - 1]![0];
    const dy = pts[i]![1] - pts[i - 1]![1];
    acc.push(acc[i - 1]! + Math.hypot(dx, dy));
  }
  return acc;
}
