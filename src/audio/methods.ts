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
  /** The technique in a breath. Not an explanation of it. */
  line: string;
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
    line: "One point, held past thinking",
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
    line: "Descent. The edge of sleep",
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
    line: "Ascent. Past the pace of thought",
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
    line: "Left out in the weather",
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
