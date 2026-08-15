/**
 * Session state.
 *
 * Client-only. There is no backend, no account, and no request carrying a
 * statement anywhere. The session persists across reloads in localStorage until
 * stage 05 releases it, at which point the record is destroyed along with the
 * mark.
 *
 * Everything the interface used to ask for — method, duration, volume, motion —
 * is derived or fixed in code. What is left here is what the person actually
 * did.
 */

import { METHODS, methodForSeed, type MethodProfile } from "./audio/methods";
import { compose, type Composition } from "./core/compose";
import { hashString } from "./core/rng";
import { analyze, type StripResult } from "./core/strip";

export type StageId = 1 | 2 | 3 | 4 | 5;

export const FIRST_STAGE: StageId = 1;
export const LAST_STAGE: StageId = 5;

export interface Session {
  statement: string;
  /** Reroll count; the working seed is `base + rerolls`. */
  rerolls: number;
  /** Slider position, 0-1. Locked in place once the mark has been charged. */
  compression: number;
  /** Accumulated charge time, in ms. */
  held: number;
  chargedAt: number | null;
  /** The one quiet line after charging states itself once and never again. */
  doneLineSeen: boolean;
  stage: StageId;
}

const KEY = "sigilcraft.session.v1";

export function blankSession(): Session {
  return {
    statement: "",
    rerolls: 0,
    compression: 0,
    held: 0,
    chargedAt: null,
    doneLineSeen: false,
    stage: FIRST_STAGE,
  };
}

function asStage(value: unknown): StageId {
  const n = typeof value === "number" ? Math.trunc(value) : FIRST_STAGE;
  if (n < FIRST_STAGE || n > LAST_STAGE) return FIRST_STAGE;
  return n as StageId;
}

export function loadSession(): Session {
  const base = blankSession();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return base; // private mode, or storage denied
  }
  if (!raw) return base;
  try {
    const saved = JSON.parse(raw) as Partial<Session>;
    return {
      ...base,
      statement: typeof saved.statement === "string" ? saved.statement : "",
      rerolls: Number.isFinite(saved.rerolls) ? Math.max(0, Math.trunc(saved.rerolls!)) : 0,
      compression: Number.isFinite(saved.compression)
        ? Math.min(1, Math.max(0, saved.compression!))
        : 0,
      held: Number.isFinite(saved.held) ? Math.max(0, saved.held!) : 0,
      chargedAt: Number.isFinite(saved.chargedAt) ? saved.chargedAt! : null,
      doneLineSeen: saved.doneLineSeen === true,
      stage: asStage(saved.stage),
    };
  } catch {
    return base;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* nothing to do; the session simply won't survive the reload */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* already gone */
  }
}

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

export interface Derived {
  analysis: StripResult;
  baseSeed: number;
  seed: number;
  composition: Composition | null;
  /** Chosen by the mark, not by the person holding it. */
  method: MethodProfile;
  chargeMs: number;
}

let cache: { key: string; composition: Composition } | null = null;

export function derive(session: Session): Derived {
  const analysis = analyze(session.statement);
  const baseSeed = hashString(analysis.letters.join(""));
  const seed = (baseSeed + session.rerolls) >>> 0;
  const method = analysis.letters.length ? methodForSeed(seed) : METHODS.gnosis;
  const chargeMs = method.duration * 1000;

  if (!analysis.letters.length) {
    return { analysis, baseSeed, seed, composition: null, method, chargeMs };
  }

  // Annealing is ~50 ms; memoise so re-renders don't pay for it.
  const key = `${analysis.letters.join("")}:${seed}`;
  if (!cache || cache.key !== key) {
    cache = { key, composition: compose(analysis.letters, seed) };
  }
  return { analysis, baseSeed, seed, composition: cache.composition, method, chargeMs };
}
