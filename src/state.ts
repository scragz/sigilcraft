/**
 * Session state.
 *
 * Client-only. There is no backend, no account, and no request carrying a
 * statement anywhere. The session persists across reloads in localStorage until
 * stage 05 releases it, at which point the record is destroyed along with the
 * mark.
 */

import { isMethodId, METHODS, type MethodId } from "./audio/methods";
import { compose, type Composition } from "./core/compose";
import { hashString } from "./core/rng";
import { analyze, type StripResult } from "./core/strip";

export type StageId = 0 | 1 | 2 | 3 | 4 | 5;

export interface Session {
  statement: string;
  /** Reroll count; the working seed is `base + rerolls`. */
  rerolls: number;
  method: MethodId | null;
  duration: number;
  /** Slider position, 0-1. Locked in place once the mark has been charged. */
  compression: number;
  /** Accumulated hold time, in ms. */
  held: number;
  chargedAt: number | null;
  /** Whether the pre-charge panel has been on screen at least once. */
  gateSeen: boolean;
  /** The one quiet line after charging states itself once and never again. */
  doneLineSeen: boolean;
  /** Manual override, independent of the OS motion setting. */
  stillImage: boolean;
  volume: number;
  stage: StageId;
}

const KEY = "sigilcraft.session.v1";

export function blankSession(): Session {
  return {
    statement: "",
    rerolls: 0,
    method: null,
    duration: 180,
    compression: 0,
    held: 0,
    chargedAt: null,
    gateSeen: false,
    doneLineSeen: false,
    stillImage: false,
    volume: 0.5,
    stage: 0,
  };
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
      method: isMethodId(saved.method) ? saved.method : null,
      duration: Number.isFinite(saved.duration) ? saved.duration! : 180,
      compression: Number.isFinite(saved.compression)
        ? Math.min(1, Math.max(0, saved.compression!))
        : 0,
      held: Number.isFinite(saved.held) ? Math.max(0, saved.held!) : 0,
      chargedAt: Number.isFinite(saved.chargedAt) ? saved.chargedAt! : null,
      gateSeen: saved.gateSeen === true,
      doneLineSeen: saved.doneLineSeen === true,
      stillImage: saved.stillImage === true,
      volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume!)) : 0.5,
      stage: (typeof saved.stage === "number" && saved.stage >= 0 && saved.stage <= 5
        ? Math.trunc(saved.stage)
        : 0) as StageId,
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
}

let cache: { key: string; composition: Composition } | null = null;

export function derive(session: Session): Derived {
  const analysis = analyze(session.statement);
  const baseSeed = hashString(analysis.letters.join(""));
  const seed = (baseSeed + session.rerolls) >>> 0;
  if (!analysis.letters.length) return { analysis, baseSeed, seed, composition: null };

  // Annealing is ~50 ms; memoise so re-renders don't pay for it.
  const key = `${analysis.letters.join("")}:${seed}`;
  if (!cache || cache.key !== key) {
    cache = { key, composition: compose(analysis.letters, seed) };
  }
  return { analysis, baseSeed, seed, composition: cache.composition };
}

export const chargeDuration = (session: Session): number =>
  session.method ? session.duration : METHODS.gnosis.defaultDuration;
