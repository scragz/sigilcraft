/**
 * The four charging methods.
 *
 * They are not four presets. They are the same system at four points on its own
 * bifurcation diagram — rho is the actual control parameter of the Lorenz
 * system, so the difference between them is real dynamics rather than
 * decoration.
 */

export type MethodId = "gnosis" | "inhibitory" | "excitatory" | "passive";

export interface MethodProfile {
  id: MethodId;
  name: string;
  /** The traditional technique, stated as technique. */
  body: string;
  /** What the field does under it. */
  feel: string;
  /** rho at progress 0 and at progress 1. */
  rho: [number, number];
  /** Multiplier on the integration step — how fast the attractor is traversed. */
  dtScale: number;
  /** Binaural offset between the L and R spines, in Hz, start -> end. */
  beat: [number, number] | null;
  /** Spine level relative to the substrate, in dB. */
  spineDb: number;
  /** Base rate of the luminance breathing, in Hz. Never above 1. */
  visualHz: number;
  /** Amplitude of the luminance breathing, 0-1. */
  visualDepth: number;
  defaultDuration: number;
}

export const METHODS: Record<MethodId, MethodProfile> = {
  gnosis: {
    id: "gnosis",
    name: "Gnosis",
    body: "Attention driven to a single point and held there until everything either side of it drops away. Any exertion severe enough to leave no spare capacity for commentary will do. The mark is looked at, not thought about.",
    feel: "Canonical chaos. The field holds one lobe for tens of seconds, then crosses without warning. Hovering, unresolved.",
    rho: [28, 28],
    dtScale: 1,
    beat: [7, 7],
    spineDb: 0,
    visualHz: 0.5,
    visualDepth: 1,
    defaultDuration: 180,
  },
  inhibitory: {
    id: "inhibitory",
    name: "Inhibitory",
    body: "Descent rather than exertion. Breath slowed, body still, the mark held in soft focus until the boundary between looking and being looked at stops being obvious. Sleep is the edge this method walks.",
    feel: "The field passes below the chaotic threshold partway through and stops being chaotic — it settles toward a fixed point. Progressively more predictable as the descent goes on.",
    rho: [28, 15],
    dtScale: 1,
    beat: [4, 2],
    spineDb: 0,
    visualHz: 0.25,
    visualDepth: 1,
    defaultDuration: 180,
  },
  excitatory: {
    id: "excitatory",
    name: "Excitatory",
    body: "Ascent. Rhythm, strain, repetition — anything that raises the whole system past the point where deliberate thought can keep pace. The mark is held at the peak and released with it.",
    feel: "Deeper into chaos, faster transitions, a wider index range. Accelerating and unstable.",
    rho: [28, 45],
    dtScale: 2.5,
    beat: [12, 16],
    spineDb: 0,
    visualHz: 1,
    visualDepth: 1,
    defaultDuration: 180,
  },
  passive: {
    id: "passive",
    name: "Passive",
    body: "No exertion in either direction. The mark is left in the field of vision and not attended to. Long, undirected, closer to leaving something out in the weather than to performing an operation on it.",
    feel: "The same attractor at a sixth the rate — lobe flips every three to six minutes. Substrate only; the spine sits far under it. Almost not there.",
    rho: [28, 28],
    dtScale: 0.15,
    beat: null,
    spineDb: -24,
    visualHz: 0.25,
    visualDepth: 0.55,
    defaultDuration: 600,
  },
};

export const METHOD_ORDER: MethodId[] = ["gnosis", "inhibitory", "excitatory", "passive"];

export const DURATIONS = [60, 180, 600] as const;

export function isMethodId(v: unknown): v is MethodId {
  return typeof v === "string" && v in METHODS;
}
